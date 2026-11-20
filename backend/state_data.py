"""
state_data.py
-------------
Real, state-level baselines turned into a 0-100 VULNERABILITY score per sector.
Everything here is computed in code from the files in ./datasets - no LLM.

  vulnerability 0   = state is well placed in this sector (little to lose)
  vulnerability 100 = state is poorly placed (policy shocks hurt the most)

Sector    | Source (real data in ./datasets)                  | Rule
----------|---------------------------------------------------|------------------------------
Economy   | RBI Handbook Table 9, per-capita NSDP 2023-24     | 100 x (1 - percentile rank)
Healthcare| NITI Aayog Health Index 2019-20                   | 100 - index score
Education | UDISE+ 2023-24                                    | mean of: no electricity %, no
          |                                                   | internet %, no computer %,
          |                                                   | pupil-teacher ratio (cap 40)
Infrastructure | UDISE+ 2023-24 school infrastructure          | mean of the first three above
Agriculture    | (no state-level file yet) economy proxy        | same as Economy, flagged proxy

Each value carries a `basis` of "real" or "proxy" so the dashboard never
passes a stand-in off as measured data. A state that lacks a source (e.g. six
states are missing from the NITI file) falls back to the economy value, again
flagged "proxy".
"""

import functools
import os
import re

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "datasets")

PERCAPITA_YEAR = "2023-24"   # latest year with a complete value for every state
PTR_CAP = 40.0               # pupil-teacher ratio treated as "worst" at 40+

SECTORS = ["Agriculture", "Economy", "Healthcare", "Education", "Infrastructure"]

KNOWN_NAMES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
    "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman & Nicobar Islands", "Chandigarh",
    "Dadra & Nagar Haveli and Daman & Diu", "Delhi", "Jammu & Kashmir", "Ladakh",
    "Lakshadweep", "Puducherry",
]


def _key(name: str) -> str:
    """Letters only, '&' -> 'and' (so 'Jammu & Kashmir' == 'Jammu and Kashmir')."""
    return re.sub(r"[^a-z]", "", (name or "").lower().replace("&", "and"))


_CANON = {_key(n): n for n in KNOWN_NAMES}


def canon(name: str):
    """Map any spelling in our data files to the canonical state/UT name."""
    k = _key(name)
    if k in _CANON:
        return _CANON[k]
    if k.startswith("andaman"):
        return "Andaman & Nicobar Islands"
    if k.startswith("dadra"):
        return "Dadra & Nagar Haveli and Daman & Diu"
    return None


def _num(s: str):
    s = (s or "").replace(",", "").replace("%", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


# ------------------------------------------------------------------ parsers
def _parse_udise(path: str) -> dict:
    """State rows of UDISE_education.txt (12 pipe-separated columns)."""
    out = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) != 12:
                continue
            state = canon(parts[0])
            vals = [_num(p) for p in parts[1:]]
            if state and all(v is not None for v in vals):
                out[state] = {
                    "ptr": vals[3], "electricity": vals[4],
                    "internet": vals[5], "computer": vals[6],
                }
    return out


def _parse_niti(path: str) -> dict:
    """'State | score | category' rows of the NITI Health Index file."""
    out = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) < 2:
                continue
            state, score = canon(parts[0].split("(")[0]), _num(parts[1])
            if state and score is not None and 0 <= score <= 100:
                out[state] = score
    return out


def _parse_percapita(path: str, year: str = PERCAPITA_YEAR) -> dict:
    """
    RBI Handbook Table 9 (per-capita NSDP). Each PDF page is a block of state
    columns; the header text is split across lines ("Chhattis- garh"), so the
    column order is recovered by locating each known state name in the
    letters-only header. A page is skipped unless the number of names found
    equals the number of values in the year row.
    """
    import PyPDF2

    out = {}
    reader = PyPDF2.PdfReader(path)
    for page in reader.pages:
        lines = (page.extract_text() or "").split("\n")
        idx = next((i for i, l in enumerate(lines) if re.fullmatch(r"\d+(\s+\d+){5,}", l.strip())), None)
        if idx is None:
            continue
        header = " ".join(lines[:idx])
        header = header.split("Territory", 1)[-1]
        hkey = re.sub(r"[^a-z]", "", header.lower().replace("&", "and"))

        found = []
        for name in KNOWN_NAMES + ["All India"]:
            pos = hkey.find(_key(name))
            if pos >= 0:
                found.append((pos, name))
        names = [n for _, n in sorted(found)]

        row = next((l for l in lines if l.startswith(year)), None)
        if not row:
            continue
        tokens = row.split()[1:]
        if len(tokens) != len(names) or not all(t.isdigit() for t in tokens):
            continue
        for n, t in zip(names, tokens):
            if n != "All India":
                out[n] = float(t)
    return out


# ------------------------------------------------------------------ loading
def _find(prefix: str, suffix: str):
    if not os.path.isdir(DATA_DIR):
        return None
    for fn in sorted(os.listdir(DATA_DIR)):
        if fn.startswith(prefix) and fn.endswith(suffix):
            return os.path.join(DATA_DIR, fn)
    return None


@functools.lru_cache(maxsize=1)
def load_baselines() -> dict:
    """{'percapita': {...}, 'niti': {...}, 'udise': {...}}  (cached; empty if a file is missing)."""
    base = {"percapita": {}, "niti": {}, "udise": {}}
    try:
        p = _find("9T_", ".pdf")
        if p:
            base["percapita"] = _parse_percapita(p)
    except Exception as e:  # a broken PDF must not take the app down
        print(f"[state_data] per-capita NSDP not loaded: {e}")
    try:
        p = _find("NITI_Aayog_Health", ".txt")
        if p:
            base["niti"] = _parse_niti(p)
    except Exception as e:
        print(f"[state_data] NITI index not loaded: {e}")
    try:
        p = _find("UDISE_", ".txt")
        if p:
            base["udise"] = _parse_udise(p)
    except Exception as e:
        print(f"[state_data] UDISE not loaded: {e}")
    return base


# ------------------------------------------------------------ vulnerability
def _economy_vuln(state, base):
    pc = base["percapita"]
    if state not in pc or len(pc) < 2:
        return None
    below = sum(1 for v in pc.values() if v < pc[state])
    pct = below / (len(pc) - 1)
    return 100.0 * (1.0 - pct), f"per-capita NSDP {PERCAPITA_YEAR}: Rs {pc[state]:,.0f}"


def _health_vuln(state, base):
    s = base["niti"].get(state)
    if s is None:
        return None
    return 100.0 - s, f"NITI Health Index 2019-20: {s:.1f}/100"


def _infra_parts(u):
    return [100 - u["electricity"], 100 - u["internet"], 100 - u["computer"]]


def _education_vuln(state, base):
    u = base["udise"].get(state)
    if not u:
        return None
    parts = _infra_parts(u) + [min(u["ptr"], PTR_CAP) / PTR_CAP * 100]
    return sum(parts) / 4, (
        f"UDISE+ 2023-24: internet {u['internet']:.0f}%, computers {u['computer']:.0f}%, "
        f"PTR {u['ptr']:.0f}"
    )


def _infra_vuln(state, base):
    u = base["udise"].get(state)
    if not u:
        return None
    parts = _infra_parts(u)
    return sum(parts) / 3, (
        f"school infrastructure (UDISE+): electricity {u['electricity']:.0f}%, "
        f"internet {u['internet']:.0f}%"
    )


_REAL = {
    "Economy": _economy_vuln,
    "Healthcare": _health_vuln,
    "Education": _education_vuln,
    "Infrastructure": _infra_vuln,
}


def state_basis(sector: str) -> str:
    """'real' if this sector has its own state-level source, else 'proxy'."""
    return "real" if sector in _REAL else "proxy"


def vulnerability(state: str, sector: str, base: dict = None):
    """
    Returns {"value": 0-100 or None, "basis": "real"|"proxy"|"missing", "indicator": str}.
    """
    base = base if base is not None else load_baselines()
    fn = _REAL.get(sector)
    if fn:
        got = fn(state, base)
        if got:
            return {"value": round(got[0], 1), "basis": "real", "indicator": got[1]}
    # Agriculture, or a state missing from this sector's source: economy proxy
    got = _economy_vuln(state, base)
    if got:
        label = "no state-level file for this sector; proxy = " if not fn else "state missing from source; proxy = "
        return {"value": round(got[0], 1), "basis": "proxy", "indicator": label + got[1]}
    return {"value": None, "basis": "missing", "indicator": "no data"}


def national_snapshot() -> dict:
    """Short facts for the LLM context (best/worst states per real indicator)."""
    base = load_baselines()
    snap = {}
    pc = base["percapita"]
    if pc:
        hi = max(pc, key=pc.get)
        lo = min(pc, key=pc.get)
        snap["economy"] = (
            f"Per-capita NSDP {PERCAPITA_YEAR} (RBI): highest {hi} Rs {pc[hi]:,.0f}, "
            f"lowest {lo} Rs {pc[lo]:,.0f}."
        )
    nt = base["niti"]
    if nt:
        hi = max(nt, key=nt.get)
        lo = min(nt, key=nt.get)
        snap["healthcare"] = (
            f"NITI Health Index 2019-20: best {hi} {nt[hi]:.1f}, worst {lo} {nt[lo]:.1f} "
            f"({len(nt)} states/UTs covered)."
        )
    ud = base["udise"]
    if ud:
        net = min(ud, key=lambda s: ud[s]["internet"])
        snap["education"] = (
            f"UDISE+ 2023-24: schools with internet range from {ud[net]['internet']:.0f}% ({net}) "
            f"to 100%; national secondary dropout 14.1%, internet in 53.9% of schools."
        )
    return snap
