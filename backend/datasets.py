"""
datasets.py
-----------
Background context for the LLM prompts, built from the files in ./datasets.

The numbers that drive the dashboard's state scores do NOT come from here;
they are computed in state_data.py. This module only produces a short,
readable reference block so the raters know the real-world baseline, and the
`data_grounded` flag the dashboard shows per sector.

Earlier versions pasted the first 900 characters of each file, which for the
NITI and UDISE text files was mostly the file's own header. The reference block
is now generated from the parsed data instead.
"""

import functools
import os

import PyPDF2

from state_data import DATA_DIR, national_snapshot

# RBI Handbook tables that have no state-level data in this repo are kept as
# national background for Agriculture and Infrastructure.
RBI_BACKGROUND = {
    "agriculture": "15T_",       # index numbers of agricultural production
    "infrastructure": "27T_",    # index of industrial production (manufacturing)
}
RBI_LABEL = {
    "agriculture": "RBI Handbook Table 15, national index of agricultural production",
    "infrastructure": "RBI Handbook Table 27, index of manufacturing output",
}

SECTORS = ["agriculture", "economy", "infrastructure", "healthcare", "education"]


@functools.lru_cache(maxsize=None)
def _pdf_text(prefix: str) -> str:
    if not os.path.isdir(DATA_DIR):
        return ""
    for fn in sorted(os.listdir(DATA_DIR)):
        if fn.startswith(prefix) and fn.endswith(".pdf"):
            try:
                with open(os.path.join(DATA_DIR, fn), "rb") as f:
                    reader = PyPDF2.PdfReader(f)
                    return " ".join((p.extract_text() or "") for p in reader.pages)
            except Exception as e:
                print(f"[datasets] could not read {fn}: {e}")
    return ""


def _summarise_rbi(sector: str, text: str) -> str:
    """National RBI series only: say what exists rather than pasting a flattened table."""
    return (f"A national time series is available ({RBI_LABEL[sector]}), but no state-level "
            f"figures for this sector are loaded, so judge this sector from the policy text.")


def get_sector_context(sectors: list) -> tuple[str, dict]:
    """Returns (context_string, {sector_name: has_real_reference_data})."""
    snapshot = national_snapshot()
    parts, grounded = [], {}

    for sector in sectors:
        key = sector.lower()
        line = snapshot.get(key)
        source = "state baselines"
        if not line and key in RBI_BACKGROUND:
            text = _pdf_text(RBI_BACKGROUND[key])
            if text:
                line = _summarise_rbi(key, " ".join(text.split()))
                source = RBI_LABEL[key]
        if line:
            parts.append(f"=== INDIA {key.upper()} ({source}) ===\n{line}")
        grounded[key] = bool(line)

    if not parts:
        return "No reference datasets available.", {s.lower(): False for s in sectors}
    return "\n\n".join(parts), grounded
