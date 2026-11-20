"""
impact_scoring.py
-----------------
Turns the raters' rubric answers (see risk_ensemble.py) plus real state
baselines (state_data.py) into the sector, stakeholder and state scores.

The rule of the whole module: the LLM only RATES things that need reading
(how strongly does this policy touch a sector / a group / which states does it
name). Every number shown on the dashboard is then COMPUTED here.

SECTORS      score = |median of raters' signed impact (-100..+100)|
             sentiment = sign of that median (|x| < 15 -> neutral)
STAKEHOLDERS severity_score = median exposure x (1 - 0.5 x adaptability)
             adaptability = fixed prior per group type (simulation.py)
             high >= 60, medium >= 35, else low
STATES       score = scope_factor x vulnerability x (0.4 + 0.6 x intensity/100)
             vulnerability = sector-weighted real baseline (state_data.py)
             intensity     = sum(strength^2) / sum(strength)   over sectors
             scope_factor  = 1 for every state if the policy is national;
                             1 for named states and 0.25 for the others
                             if it only applies to named states

The constants below are expert-assigned choices, NOT fitted to outcomes.
"""

import re
import statistics

from state_data import SECTORS, canon, load_baselines, vulnerability
from simulation import _agent_adaptability

NEUTRAL_BAND = 10          # |impact| below this is reported as "neutral"
ADAPT_DISCOUNT = 0.5       # how much adaptability lowers a group's severity
HIGH_AT, MEDIUM_AT = 60, 35
OUT_OF_SCOPE_FACTOR = 0.25  # state not named by a state-specific policy
INTENSITY_FLOOR, INTENSITY_SPAN = 0.4, 0.6

_CONF_ORDER = {"low": 0, "medium": 1, "high": 2}


def _clamp(x, lo=0, hi=100):
    return max(lo, min(hi, x))


def _norm(s: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", (s or "").lower()).split())


def _confidence(spread: float, verified: int, n: int) -> str:
    """Same thresholds as the four risk dimensions (risk_ensemble)."""
    if n < 2:
        return "low"
    if spread <= 15 and verified >= 2:
        return "high"
    if spread <= 30:
        return "medium"
    return "low"


def _closest_reason(ratings: list, target: float) -> dict:
    """The rater whose score is nearest the median supplies the reason/quote."""
    return min(ratings, key=lambda r: abs(r["score"] - target))


# ------------------------------------------------------------------ sectors
def aggregate_sectors(rater_extras: list) -> list:
    """
    rater_extras: one dict per successful rater,
      {"sectors": {name: {"score": signed int, "reason", "evidence", "evidence_verified"}}, ...}
    Returns the dashboard's `sectors` list (strength score + sentiment + audit trail).
    """
    out = []
    for sector in SECTORS:
        ratings = [e["sectors"][sector] for e in rater_extras if sector in e.get("sectors", {})]
        if not ratings:
            out.append({
                "name": sector, "score": 0, "signed_impact": 0, "sentiment": "neutral",
                "confidence": "low", "method": "unavailable", "reason": "No rater returned a rating.",
                "evidence": "NO_DIRECT_EVIDENCE", "evidence_verified": None, "ratings": [],
            })
            continue
        scores = [r["score"] for r in ratings]
        med = statistics.median(scores)
        spread = max(scores) - min(scores)
        verified = sum(1 for r in ratings if r["evidence_verified"] is True)
        pick = _closest_reason(ratings, med)
        sentiment = sentiment = "neutral" if abs(med) <= NEUTRAL_BAND else ("positive" if med > 0 else "negative")
        out.append({
            "name": sector,
            "score": int(round(abs(med))),
            "signed_impact": int(round(med)),
            "sentiment": sentiment,
            "spread": int(spread),
            "confidence": _confidence(spread, verified, len(ratings)),
            "method": "rubric_ensemble_median",
            "reason": pick["reason"],
            "evidence": pick["evidence"],
            "evidence_verified": pick["evidence_verified"],
            "ratings": ratings,
        })
    return out


# ------------------------------------------------------------- stakeholders
def _severity_label(score: float) -> str:
    return "high" if score >= HIGH_AT else "medium" if score >= MEDIUM_AT else "low"


def aggregate_stakeholders(groups: list, rater_extras: list) -> list:
    """
    groups: the stakeholder dicts from the main analysis call ({"group", "impact", ...}).
    Adds computed score / severity / audit trail to each; the descriptive
    `impact` text from the analysis call is kept.
    """
    out = []
    for g in groups:
        name = str(g.get("group", ""))
        key = _norm(name)
        ratings = []
        for e in rater_extras:
            r = e.get("stakeholders", {}).get(key)
            if r:
                ratings.append(r)
        item = dict(g)
        adapt = _agent_adaptability(name)
        item["adaptability"] = round(adapt, 2)
        if not ratings:
            # Keep whatever severity the analysis call gave, but say so.
            item["severity"] = str(g.get("severity", "medium")).lower()
            item["method"] = "unavailable"
            item["confidence"] = "low"
            out.append(item)
            continue
        scores = [r["score"] for r in ratings]
        exposure = statistics.median(scores)
        spread = max(scores) - min(scores)
        verified = sum(1 for r in ratings if r["evidence_verified"] is True)
        pick = _closest_reason(ratings, exposure)
        effects = [r["effect"] for r in ratings]
        top = max(set(effects), key=effects.count)
        effect = top if effects.count(top) > len(effects) / 2 else "mixed"
        sev_score = exposure * (1 - ADAPT_DISCOUNT * adapt)
        item.update({
            "exposure": int(round(exposure)),
            "severity_score": int(round(sev_score)),
            "severity": _severity_label(sev_score),
            "effect": effect,
            "spread": int(spread),
            "confidence": _confidence(spread, verified, len(ratings)),
            "method": "rubric_ensemble_median",
            "reason": pick["reason"],
            "evidence": pick["evidence"],
            "evidence_verified": pick["evidence_verified"],
        })
        out.append(item)
    return out


# -------------------------------------------------------------------- scope
def aggregate_scope(rater_extras: list, policy_text: str) -> dict:
    """
    Majority vote on 'national' vs 'state_specific'. Named states count only
    if the state name really occurs in the policy text (checked in code).
    """
    votes = [e["scope"] for e in rater_extras if e.get("scope")]
    if not votes:
        return {"type": "national", "states": [], "method": "default"}
    specific = [v for v in votes if v["type"] == "state_specific"]
    if len(specific) * 2 <= len(votes):
        return {"type": "national", "states": [], "method": "majority_vote"}
    text = _norm(policy_text)
    counts = {}
    for v in specific:
        for s in v["states"]:
            c = canon(s)
            if c and _norm(c) in text:
                counts[c] = counts.get(c, 0) + 1
    named = sorted(s for s, n in counts.items() if n * 2 > len(specific) or len(specific) == 1)
    if not named:
        return {"type": "national", "states": [], "method": "unverified_states_ignored"}
    return {"type": "state_specific", "states": named, "method": "majority_vote_verified_in_text"}


# ------------------------------------------------------------------- states
def policy_intensity(sectors: list) -> float:
    """sum(s^2)/sum(s): the strength of the sectors the policy mainly acts on."""
    strengths = [s["score"] for s in sectors]
    total = sum(strengths)
    return sum(x * x for x in strengths) / total if total else 0.0


def score_states(sectors: list, scope: dict, state_names: list) -> list:
    """Code-computed state exposure; every state carries its data basis + drivers."""
    base = load_baselines()
    strengths = {s["name"]: s["score"] for s in sectors}
    total = sum(strengths.values())
    weights = {k: (v / total if total else 1 / len(strengths)) for k, v in strengths.items()}
    intensity = policy_intensity(sectors)
    multiplier = INTENSITY_FLOOR + INTENSITY_SPAN * intensity / 100
    named = set(scope.get("states", [])) if scope.get("type") == "state_specific" else None

    out = []
    for state in state_names:
        parts, vuln, any_proxy = [], 0.0, False
        for sector, w in weights.items():
            if w == 0:   # a sector the policy does not touch plays no part (or in the label)
                continue
            v = vulnerability(state, sector, base)
            if v["value"] is None:
                continue
            vuln += w * v["value"]
            any_proxy = any_proxy or v["basis"] == "proxy"
            parts.append({
                "sector": sector, "weight": round(w, 2), "vulnerability": v["value"],
                "basis": v["basis"], "indicator": v["indicator"],
                "contribution": round(w * v["value"], 1),
            })
        if not parts:
            out.append({"state": state, "impact_score": 0, "data_basis": "missing", "drivers": []})
            continue
        # weights of sectors with no data were dropped: renormalise
        covered = sum(p["weight"] for p in parts) or 1
        vuln /= covered
        factor = 1.0 if named is None or state in named else OUT_OF_SCOPE_FACTOR
        score = _clamp(factor * vuln * multiplier)
        parts.sort(key=lambda p: p["contribution"], reverse=True)
        out.append({
            "state": state,
            "impact_score": int(round(score)),
            "vulnerability": round(vuln, 1),
            "scope_factor": factor,
            "data_basis": "proxy" if any_proxy and all(p["basis"] == "proxy" for p in parts)
                          else "mixed" if any_proxy else "real",
            "drivers": parts[:3],
        })
    return out


def summarise_method(scope: dict, sectors: list) -> dict:
    """Small block the dashboard / paper can quote verbatim."""
    return {
        "scope": scope,
        "policy_intensity": round(policy_intensity(sectors), 1),
        "constants": {
            "neutral_band": NEUTRAL_BAND, "adaptability_discount": ADAPT_DISCOUNT,
            "high_at": HIGH_AT, "medium_at": MEDIUM_AT,
            "out_of_scope_factor": OUT_OF_SCOPE_FACTOR,
            "intensity_floor": INTENSITY_FLOOR, "intensity_span": INTENSITY_SPAN,
        },
        "note": ("LLM raters supply sector impact, stakeholder exposure and scope with "
                 "verified quotes; state scores are computed from real baselines. "
                 "Constants are expert-assigned and not validated against outcomes."),
    }
