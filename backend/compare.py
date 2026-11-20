"""
compare.py
----------
Head-to-head comparison of two analysed policies. Nothing here calls an LLM:
both policies go through the same pipeline as a single upload (rubric raters,
formula, real state baselines) and this module only compares the NUMBERS that
pipeline produced, using fixed, stated rules.

Per sector   net-benefit = 50 + signed_impact / 2   (0 = strongly harmful,
             50 = no effect, 100 = strongly beneficial; higher is better).
             The higher net-benefit wins; a gap under SECTOR_TIE_MARGIN is a tie.
Overall      1. If the overall risk scores differ by RISK_MARGIN or more, the
                LOWER risk wins.
             2. Otherwise the higher average sector net-benefit wins if it
                differs by SECTOR_TIE_MARGIN or more.
             3. Otherwise it is a tie.
"""

from monte_carlo import run_monte_carlo
from risk_engine import WEIGHTS
from state_data import SECTORS

SECTOR_TIE_MARGIN = 5
RISK_MARGIN = 5
COMPARE_TRIALS = 3000

DIM_LABELS = {
    "severity": "severity of side-effects",
    "plausibility": "likelihood of those side-effects",
    "magnitude": "number of people affected",
    "vulnerable_population": "exposure of vulnerable groups",
}


def net_benefit(sector: dict) -> int:
    return int(round(50 + sector.get("signed_impact", 0) / 2))


def _pick(a: float, b: float, margin: float, higher_is_better: bool) -> str:
    if abs(a - b) < margin:
        return "tie"
    a_better = a > b if higher_is_better else a < b
    return "policy1" if a_better else "policy2"


def _risk_block(res: dict) -> dict:
    mc = run_monte_carlo(res["risk_dimensions"], res.get("stakeholders", []),
                         n_trials=COMPARE_TRIALS)["risk_score"]
    return {
        "overall_risk_score": res["overall_risk_score"],
        "risk_level": res.get("risk_level"),
        "confidence": res.get("risk_confidence"),
        "range": {"p5": mc["p5"], "p95": mc["p95"]},
        "dimensions": res["risk_dimensions"],
    }


def build_comparison(a: dict, b: dict) -> dict:
    sec_a = {s["name"]: s for s in a["sectors"]}
    sec_b = {s["name"]: s for s in b["sectors"]}

    comparison = {}
    for name in SECTORS:
        sa, sb = sec_a[name], sec_b[name]
        na, nb = net_benefit(sa), net_benefit(sb)
        comparison[name] = {
            "policy1_score": na,
            "policy2_score": nb,
            "policy1_summary": sa.get("reason", ""),
            "policy2_summary": sb.get("reason", ""),
            "winner": _pick(na, nb, SECTOR_TIE_MARGIN, True),
            "policy1_sentiment": sa["sentiment"],
            "policy2_sentiment": sb["sentiment"],
            "policy1_confidence": sa.get("confidence"),
            "policy2_confidence": sb.get("confidence"),
            "policy1_evidence": sa.get("evidence"),
            "policy2_evidence": sb.get("evidence"),
        }

    risk1, risk2 = _risk_block(a), _risk_block(b)
    dim_winners = {
        d: _pick(risk1["dimensions"][d], risk2["dimensions"][d], 1, higher_is_better=False)
        for d in WEIGHTS
    }

    mean_a = sum(c["policy1_score"] for c in comparison.values()) / len(comparison)
    mean_b = sum(c["policy2_score"] for c in comparison.values()) / len(comparison)
    ra, rb = a["overall_risk_score"], b["overall_risk_score"]

    if abs(ra - rb) >= RISK_MARGIN:
        winner = "policy1" if ra < rb else "policy2"
        driver = max(WEIGHTS, key=lambda d: abs(WEIGHTS[d] * (a["risk_dimensions"][d] - b["risk_dimensions"][d])))
        title = a["policy_title"] if winner == "policy1" else b["policy_title"]
        reason = (
            f"{title} carries the lower overall risk ({min(ra, rb)} vs {max(ra, rb)} out of 100); "
            f"the biggest difference is the {DIM_LABELS[driver]} "
            f"({a['risk_dimensions'][driver]} vs {b['risk_dimensions'][driver]})."
        )
        rule = "risk_gap"
    elif abs(mean_a - mean_b) >= SECTOR_TIE_MARGIN:
        winner = "policy1" if mean_a > mean_b else "policy2"
        title = a["policy_title"] if winner == "policy1" else b["policy_title"]
        reason = (
            f"Overall risk is similar ({ra} vs {rb}), so the average sector effect decides: "
            f"{title} scores {round(max(mean_a, mean_b))} vs {round(min(mean_a, mean_b))} "
            f"(50 = no effect)."
        )
        rule = "sector_average"
    else:
        winner = "tie"
        reason = (
            f"No clear winner: overall risk is {ra} vs {rb} and the average sector effect "
            f"is {round(mean_a)} vs {round(mean_b)}, both within the tie margins."
        )
        rule = "tie"

    def top_states(res):
        ranked = sorted(res["states"], key=lambda s: s["impact_score"], reverse=True)[:3]
        return [{"state": s["state"], "impact_score": s["impact_score"]} for s in ranked]

    return {
        "policy1_title": a["policy_title"],
        "policy2_title": b["policy_title"],
        "common_fields": list(SECTORS),
        "comparison": comparison,
        "risk": {"policy1": risk1, "policy2": risk2, "dimension_winners": dim_winners},
        "top_states": {"policy1": top_states(a), "policy2": top_states(b)},
        "overall_winner": winner,
        "overall_winner_reason": reason,
        "method": {
            "rule": rule,
            "risk_margin": RISK_MARGIN,
            "sector_tie_margin": SECTOR_TIE_MARGIN,
            "note": ("Both policies are scored by the same rubric raters and formula. Winners "
                     "are decided by fixed rules on those scores; they are structured "
                     "estimates, not validated against real outcomes."),
        },
    }
