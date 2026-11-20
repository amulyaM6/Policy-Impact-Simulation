from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import os
import io
import json
import re
import time
import uuid
import PyPDF2
import docx
from dotenv import load_dotenv
from rag import build_rag, retrieve_chunks
from datasets import get_sector_context
from risk_engine import compute_risk_score, WEIGHTS
from simulation import simulate_timeline
from monte_carlo import run_monte_carlo
from monte_carlo_api import router as monte_carlo_router
from risk_ensemble import rate_risk_dimensions
from impact_scoring import (
    aggregate_sectors, aggregate_stakeholders, aggregate_scope,
    score_states, summarise_method,
)
from state_data import SECTORS as SECTOR_NAMES, state_basis
from compare import build_comparison

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(monte_carlo_router)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def _groq_create(retries: int = 3, **kwargs):
    """Wraps client.chat.completions.create with automatic retry on Groq's
    429 (rate limit) response. Groq's free tier caps tokens-per-minute, and
    this app sometimes makes 2 calls back-to-back (classifier + analysis)
    that together can briefly exceed it. Groq's error message includes the
    exact wait time needed, so we back off a little longer than that and
    try again rather than failing the whole upload."""
    last_error = None
    for attempt in range(retries):
        try:
            return client.chat.completions.create(**kwargs)
        except Exception as e:
            msg = str(e)
            if "rate_limit_exceeded" in msg or "429" in msg:
                last_error = e
                time.sleep(1.5 * (attempt + 1))  # 1.5s, 3s, 4.5s backoff
                continue
            raise
    raise last_error

# All 28 Indian states (matches the paper's "all 28 states" claim — this used
# to be a hardcoded example list of 7 states, so most of the map defaulted
# to 0/no-data regardless of the policy).
INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
    "West Bengal",
]

# ── Extract text from uploaded file ──
def extract_text(file_bytes: bytes, filename: str) -> str:
    if filename.endswith(".pdf"):
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        # `or ""` — extract_text() returns None for pages without a text
        # layer (e.g. scanned pages), which used to crash the join.
        return " ".join((page.extract_text() or "") for page in reader.pages)
    elif filename.endswith(".docx"):
        doc = docx.Document(io.BytesIO(file_bytes))
        return " ".join(p.text for p in doc.paragraphs)
    else:
        return file_bytes.decode("utf-8")

# ── Send RAG context to Groq for analysis ──
#
# This call now only does the work that needs free-form writing: the title,
# the before/after story, the stakeholder groups (names + a description of the
# impact) and the recommendations. Everything that is a NUMBER is produced
# elsewhere:
#   - four risk dimensions, sector impacts, stakeholder exposure and policy
#     scope: rated by three raters against a written rubric with verified
#     evidence quotes (risk_ensemble.py), median taken
#   - overall risk score: fixed formula (risk_engine.py)
#   - stakeholder severity, sector scores and sentiment: computed from those
#     ratings (impact_scoring.py)
#   - state scores: computed from real state baselines (state_data.py)
#   - timeline: deterministic adaptation model (simulation.py)
#
# NOTE: this prompt is an f-string, so every literal { or } in the JSON
# example below MUST be doubled ({{ and }}). Only real placeholders such as
# {policy_text} use single braces.
def analyse_with_groq(policy_text: str) -> dict:
    prompt = f"""
You are a government policy analyst for India.

Analyse this policy document and return ONLY a JSON object with this exact structure, no extra text, no markdown, no backticks:

{{
  "policy_title": "<title of the policy>",
  "two_stage_scenario": {{
    "stage1_before": "<2-3 sentence story describing the societal problems and challenges BEFORE this policy is implemented>",
    "stage2_after": "<2-3 sentence story describing the outcomes, changes, and unintended consequences AFTER this policy is implemented>"
  }},
  "stakeholders": [
    {{"group": "<a group of people or institutions affected by THIS policy>", "impact": "<1-2 sentences on how this policy affects them>"}}
  ],
  "recommendations": [
    {{
      "title": "<short title>",
      "description": "<2-3 sentence explanation of what change should be made and why>",
      "priority": "<high|medium|low>",
      "sector": "<one of: Agriculture, Economy, Healthcare, Education, Infrastructure>"
    }}
  ]
}}

Rules:
- Do NOT provide any scores, risk values or severity labels; the backend computes those separately.
- stakeholders: list the 4 to 5 groups most affected by THIS policy, named specifically (for example "Smallholder farmers", not just "People"). Do not pad the list with groups the policy does not touch.
- recommendations: exactly 4, based on actual weaknesses of the policy, with a mix of priorities.
- Use the reference data only as background; never invent figures that are not in the policy or the reference data.

Policy document (relevant excerpts):
{policy_text}
"""

    # 3200 (was 2200): the added two_stage_scenario text makes the JSON
    # longer, and a truncated response fails JSON parsing.
    return _call_groq_json(prompt, max_tokens=3200)


def _call_groq_json(prompt: str, max_tokens: int = 2000, retries: int = 1) -> dict:
    """Call Groq expecting a JSON object back. Retries once with a sharper
    reminder if the first response isn't valid JSON, so a single flaky
    generation doesn't crash the whole request (this matters live, on stage,
    during a demo)."""
    last_error = None
    attempt_prompt = prompt

    for attempt in range(retries + 1):
        response = _groq_create(
            model="openai/gpt-oss-120b",
            temperature=0,
            max_tokens=max_tokens,
            messages=[
                {
                    "role": "system",
                    "content": "You are a policy analyst. Always respond with valid JSON only. No markdown, no backticks, no extra text."
                },
                {
                    "role": "user",
                    "content": attempt_prompt
                }
            ]
        )

        response_text = response.choices[0].message.content.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            last_error = e
            attempt_prompt = (
                prompt
                + "\n\nYour previous response was not valid JSON. "
                  "Return ONLY the JSON object, with no markdown formatting, "
                  "no backticks, and no explanation text before or after it."
            )

    raise ValueError(f"Groq returned invalid JSON after {retries + 1} attempts: {last_error}")


# ── Input handling shared by /upload and /compare ──
class PolicyInputError(Exception):
    """A problem with the uploaded file that the user can fix."""


ALLOWED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
]


async def read_policy_text(file: UploadFile) -> str:
    if file.content_type not in ALLOWED_TYPES:
        raise PolicyInputError("Only PDF, DOCX, or TXT files are allowed")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise PolicyInputError("File is too large. Maximum size is 10MB")

    text = extract_text(file_bytes, file.filename)
    if not text or len(text.strip()) < 50:
        raise PolicyInputError(
            "Could not extract text from this file. It may be a scanned image or blank document. "
            "Please upload a text-based PDF or DOCX."
        )
    return text


def ensure_government_policy(text: str) -> None:
    check_response = _groq_create(
        model="openai/gpt-oss-120b",
        max_tokens=10,
        messages=[
            {"role": "system", "content": "You are a document classifier. Reply with only 'yes' or 'no'."},
            {
                "role": "user",
                "content": "Is this document a government policy, legislation, bill, scheme, act, or official "
                           f"government document? Reply only yes or no.\n\n{text[:1000]}",
            },
        ],
    )
    reply = (check_response.choices[0].message.content or "").strip().lower()
    if re.match(r"\W*no\b", reply):
        raise PolicyInputError(
            "This does not appear to be a government policy document. Please upload a policy, bill, "
            "act, scheme, or official government document."
        )


# ── The full analysis pipeline for ONE policy text ──
def analyse_policy(text: str, with_monte_carlo: bool = True) -> dict:
    warnings = []

    # RAG: chunk, embed, store, retrieve. Unique collection per analysis so
    # one upload's data can never bleed into another (see rag.py notes).
    collection_id = f"policy_{uuid.uuid4().hex[:12]}"
    build_rag(text, collection_name=collection_id)

    sector_context = retrieve_chunks("sector impact risk economy agriculture healthcare infrastructure education", collection_id)
    state_context = retrieve_chunks("state wise impact india punjab maharashtra kerala uttar pradesh gujarat", collection_id)
    stakeholder_context = retrieve_chunks("stakeholders affected groups people farmers organizations government", collection_id)
    timeline_context = retrieve_chunks("timeline short term long term future impact years months", collection_id)

    dataset_context, data_grounded = get_sector_context([s.lower() for s in SECTOR_NAMES])

    rag_context = f"""
SECTOR IMPACT CONTEXT (from policy):
{sector_context}

STATE IMPACT CONTEXT (from policy):
{state_context}

STAKEHOLDER CONTEXT (from policy):
{stakeholder_context}

TIMELINE CONTEXT (from policy):
{timeline_context}

REFERENCE DATA (real, for background only):
{dataset_context}
"""

    result = analyse_with_groq(rag_context)
    stakeholders = result.get("stakeholders", [])

    # Three raters, one written rubric. Each rates the four risk dimensions,
    # the five sectors, the stakeholder groups named above and the policy's
    # scope; quotes are verified against the full policy text and the median
    # is taken (see risk_ensemble.py).
    ensemble = rate_risk_dimensions(
        rag_context, text, _groq_create,
        group_names=[s.get("group", "") for s in stakeholders],
    )
    extras = ensemble["rater_extras"]
    result["risk_dimension_details"] = ensemble["details"]
    result["risk_confidence"] = ensemble["confidence"]
    result["risk_models_used"] = ensemble["models_used"]

    # Overall risk: fixed formula on the four median dimensions.
    risk = compute_risk_score(ensemble["risk_dimensions"])
    result["overall_risk_score"] = risk["overall_risk_score"]
    result["risk_level"] = risk["risk_level"]
    result["risk_dimensions"] = risk["dimensions"]
    result["score_explanation"] = risk["explanation"]
    result["risk_contributions"] = {
        k: round(v * WEIGHTS.get(k, 0), 1) for k, v in result["risk_dimensions"].items()
    }

    # Sectors, stakeholders, scope and states: computed from the ratings
    # and from real state baselines (impact_scoring.py / state_data.py).
    result["sectors"] = aggregate_sectors(extras)
    if all(s["method"] == "unavailable" for s in result["sectors"]):
        warnings.append("Sector ratings were unavailable from every rater; sector bars show 0.")
    for sector in result["sectors"]:
        sector["data_grounded"] = data_grounded.get(sector["name"].lower(), False)
        sector["state_data_basis"] = state_basis(sector["name"])

    result["stakeholders"] = aggregate_stakeholders(stakeholders, extras)
    if any(s.get("method") == "unavailable" for s in result["stakeholders"]):
        warnings.append("Some stakeholder groups were not rated; their severity comes from the analysis call.")

    scope = aggregate_scope(extras, text)
    result["scope"] = scope
    result["states"] = score_states(result["sectors"], scope, INDIAN_STATES)
    result["scoring_method"] = summarise_method(scope, result["sectors"])

    # Timeline: deterministic stakeholder-adaptation model (not LLM-generated).
    result["timeline"] = simulate_timeline(result["overall_risk_score"], result["stakeholders"])

    if with_monte_carlo:
        result["monte_carlo"] = run_monte_carlo(result["risk_dimensions"], result["stakeholders"])

    if ensemble.get("models_failed"):
        warnings.append("Some raters failed: " + "; ".join(ensemble["models_failed"]))
    if warnings:
        result["scoring_warnings"] = warnings

    result["id"] = f"sim_{uuid.uuid4().hex[:6]}"
    return result


# ── Route: Upload + Analyse ──
@app.post("/upload")
async def upload_policy(file: UploadFile = File(...)):
    try:
        text = await read_policy_text(file)
        ensure_government_policy(text)
        return analyse_policy(text)
    except PolicyInputError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": str(e)}


# ── Route: Health check ──
@app.get("/")
def root():
    return {"status": "Backend is running!"}


# ── Route: Compare Two Policies ──
# Both files go through exactly the same pipeline as /upload (one after the
# other, to stay inside Groq's rate limits); compare.py then compares the
# resulting numbers with fixed rules. No LLM decides the winner.
@app.post("/compare")
async def compare_policies(
    file1: UploadFile = File(...),
    file2: UploadFile = File(...)
):
    try:
        text1 = await read_policy_text(file1)
        text2 = await read_policy_text(file2)
        ensure_government_policy(text1)
        ensure_government_policy(text2)

        result1 = analyse_policy(text1, with_monte_carlo=False)
        result2 = analyse_policy(text2, with_monte_carlo=False)
        return build_comparison(result1, result2)
    except PolicyInputError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": str(e)}
