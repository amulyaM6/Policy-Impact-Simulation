# PolicySim: Policy Impact Simulation for India

PolicySim reads an Indian government policy document (PDF, DOCX or TXT) and shows how it may play out: an overall risk score, sector and stakeholder impacts, a score for each of 28 states, a 5-year timeline, and Monte Carlo uncertainty bands. You can also compare two policies side by side and export a PDF report.

**The core idea:** the AI only *reads and rates* the policy text. Every number on the dashboard is then computed by fixed, documented formulas in code, so the same ratings always give the same result, and every rating comes with a quote that is checked against the policy.

> PolicySim is decision support, not a prediction. Weights and uncertainty spreads are expert-assigned and have not been validated against real outcomes.

---

## Features

- **Upload and analyse** a policy (PDF, DOCX, TXT, up to 10 MB)
- **Overall risk score (0-100)** from four rated dimensions, with a High / Medium / Low level
- **Evidence panel:** each rating shows the reason, a quoted sentence and whether the quote was found in the policy text
- **Sector impact** for Agriculture, Economy, Healthcare, Education and Infrastructure (green = helps, yellow = no meaningful effect, red = harms)
- **Stakeholder groups** with exposure, severity and effect (benefit, harm or mixed)
- **State-wise exposure** for 28 states, built from real RBI, NITI Aayog and UDISE+ data
- **5-year timeline** based on how quickly the affected groups adapt
- **Monte Carlo analysis** (10,000 trials): percentile fan chart, probabilities, worst case and sensitivity
- **Compare mode:** two policies, with fixed rules to pick the lower-risk option
- **PDF export** of the full report
- **Sign-in** with Clerk, plus browser voice input and read-aloud

---

## How it works

```
Upload -> text extraction -> "is this a policy?" check (small model, in parallel)
       -> RAG: chunk (500 chars), embed (MiniLM), retrieve top chunks
       -> narrative call (gpt-oss-120b): title, before/after story, stakeholders, recommendations
       -> 3 raters (120b @ T0, 20b @ T0, 120b @ T0.6) score a written rubric
       -> quotes verified against the full policy text, median taken, confidence from rater spread
       -> formulas compute: risk, sectors, stakeholder severity, state scores, timeline, Monte Carlo
       -> JSON result -> dashboard
```

A normal upload makes about 5 Groq calls (1 narrative, 3 raters, 1 policy check). Compare mode makes about 10.

### The formulas

| Output | Rule |
| --- | --- |
| Overall risk | `0.35 x severity + 0.30 x plausibility + 0.20 x magnitude + 0.15 x vulnerable_population`. High at 70 or above, Medium at 40 or above, otherwise Low. |
| Confidence | Based on the spread between raters and the number of verified quotes. High: spread 15 or less and 2 or more verified quotes. Medium: spread 30 or less. Otherwise low. |
| Sector score | Raters give a signed impact from -100 to +100. The median is used. Above +10 is positive, below -10 is negative, otherwise neutral. |
| Stakeholder severity | `exposure x (1 - 0.5 x adaptability)`. High at 60 or above, medium at 35 or above. Adaptability is a fixed prior per group type. |
| State score | `scope x vulnerability x (0.4 + 0.6 x intensity / 100)`. Vulnerability comes from real state data weighted by how strongly the policy touches each sector. |
| Timeline | `score(t) = eq + (base - eq) x exp(-rate x t)`, where `eq = base x (1 - 0.55a)` and `rate = 0.15 + 0.5a`. |
| Monte Carlo | Risk dimensions ~ Normal(rated value, 12) with correlation 0.30; adaptability sigma 0.15; model constants jittered 15%. Seeded from the inputs, so results are repeatable. |

### Real data used (`backend/datasets/`)

| Sector | Source | Note |
| --- | --- | --- |
| Economy | RBI Handbook of Statistics, Table 9, per-capita NSDP 2023-24 | Real |
| Healthcare | NITI Aayog Health Index 2019-20 | Real, 25 states and UTs |
| Education | UDISE+ 2023-24 | Real |
| Infrastructure | UDISE+ 2023-24 school infrastructure | Real |
| Agriculture | No state-level file yet | Uses the Economy value and is labelled **proxy** |

---

## Tech stack

- **Backend:** FastAPI, Groq API (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`), LangChain text splitter, Chroma (in memory), sentence-transformers (`all-MiniLM-L6-v2`), NumPy, PyPDF2, python-docx
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, Recharts, Leaflet, Framer Motion, jsPDF, Clerk
- **Deployment:** Docker (nginx + supervisord running FastAPI and Next.js in one service)

---

## Project structure

```
backend/
  main.py             FastAPI app and the analysis pipeline (/upload, /compare)
  rag.py              chunking, embeddings, in-memory vector store
  risk_ensemble.py    rubric prompt, 3 raters, quote verification, median, confidence
  risk_engine.py      overall risk formula
  impact_scoring.py   sector, stakeholder, scope and state scores
  state_data.py       real state baselines -> vulnerability scores
  simulation.py       5-year timeline model
  monte_carlo.py      uncertainty analysis
  monte_carlo_api.py  POST /simulate
  compare.py          two-policy comparison rules
  datasets.py         reference data text for the prompts
  datasets/           RBI, NITI Aayog and UDISE+ source files
  tests/              pytest tests (AI calls are mocked)
frontend/
  app/                pages: landing, upload, dashboard, compare, sign-in, sign-up
  components/         charts, cards, map, PDF export, voice assistant
  lib/                API helpers, types, demo data
deploy/               nginx and supervisord configuration
Dockerfile
DEPLOY-ONE-SERVICE.md
```

---

## Getting started (local)

### Requirements

- Python 3.10 or newer
- Node.js 20 or newer
- A [Groq API key](https://console.groq.com)
- A [Clerk](https://clerk.com) application (publishable and secret keys)

### 1. Backend

```bash
cd backend
python -m venv venv
# Windows:  venv\Scripts\activate
# macOS/Linux:  source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```
GROQ_API_KEY=your_groq_key_here
```

Run it:

```bash
uvicorn main:app --reload --port 8000
```

The first run downloads the MiniLM embedding model, so the first analysis can be slow. Open http://localhost:8000 to check that it returns `{"status": "Backend is running!"}`.

### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
# Optional. Defaults to http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Run it:

```bash
npm run dev
```

Open http://localhost:3000, sign in, go to **Upload**, and choose a policy file. An analysis normally takes about 20 to 40 seconds.

> Never commit `.env` files or API keys. Only use `NEXT_PUBLIC_` for values that are safe to expose to the browser.

### 3. Tests

```bash
cd backend
pytest
```

The tests check the maths and the pipeline with the AI calls mocked, so they do not use your Groq quota.

---

## API

| Method | Route | What it does |
| --- | --- | --- |
| GET | `/` | Health check |
| POST | `/upload` | Form field `file`. Returns the full analysis JSON. |
| POST | `/compare` | Form fields `file1` and `file2`. Returns a head-to-head comparison. |
| POST | `/simulate` | JSON `{risk_dimensions, stakeholders, n_trials, seed?}`. Re-runs Monte Carlo (100 to 100,000 trials). |

Errors from `/upload` and `/compare` are returned as `{"error": "..."}`.

---

## Deployment

The app can run as one Docker service. See [DEPLOY-ONE-SERVICE.md](DEPLOY-ONE-SERVICE.md) for the steps. In that setup nginx serves the website and forwards `/api` to FastAPI. Set `GROQ_API_KEY` and the Clerk keys as environment variables on the host. The machine-learning dependencies (PyTorch) can be too heavy for free hosting tiers, so check memory use.

---

## Tips for good results

- Use text-based PDFs (you can select the text). Scanned PDFs are not supported.
- Policies of 5 to 20 pages work best. For long documents, upload the relevant sections.
- The free Groq tier has rate limits. Avoid running many analyses back to back.

---

## Limitations

- **Not validated against real outcomes.** The weights, adaptability priors and Monte Carlo spreads are expert-assigned.
- **The three raters are one model family**, so their agreement shows stability, not correctness. A verified quote proves the sentence exists in the policy, not that the score is right.
- **Sector raters see retrieved excerpts**, not the whole policy.
- **State scores show exposure** (how vulnerable a state already is in the affected sectors), not measured harm. The same vulnerable states tend to rank high for most policies.
- **Agriculture state data is a proxy.** NITI health data covers 25 states and UTs and is from 2019-20.
- **The dashboard maps 28 states**, not union territories.
- **No OCR**, so scanned PDFs fail.
- The AI writes the policy title and recommendations, and they may not match the official wording.

---

## Roadmap

- Backtest the model on past policies and calibrate the weights
- Use raters from different model families
- Add OCR for scanned documents
- Add state-level agriculture data and cover union territories
- Return proper HTTP error codes and add API rate limiting

---

## Data sources and credits

- Reserve Bank of India, Handbook of Statistics on Indian States
- NITI Aayog, Health Index 2019-20
- Ministry of Education, UDISE+ 2023-24
- Language models served through the Groq API

## License

Add your license here (for example MIT), and the names of the team members.
