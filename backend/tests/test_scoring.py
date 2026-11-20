"""Tests for state baselines, sector/stakeholder/state scoring and compare.
No network and no API key: raters are faked."""
import json
import sys
import types

import pytest

import state_data as sd
import impact_scoring as isc
from risk_ensemble import rate_risk_dimensions, DIMENSIONS
from compare import build_comparison

POLICY = (
    "The Scheme provides Rs 6000 per year to every small farmer family in three equal instalments. "
    "Tenant farmers without land records are not covered by the scheme guidelines. "
    "Implementation is the responsibility of State Governments through Aadhaar-linked accounts."
)
QUOTE_OK = "provides Rs 6000 per year to every small farmer family"
QUOTE_BAD = "this sentence appears nowhere in the policy at all"


# ------------------------------------------------------------ state baselines
def test_baselines_load_from_real_files():
    b = sd.load_baselines()
    assert len(b["udise"]) >= 30 and len(b["niti"]) >= 20 and len(b["percapita"]) >= 28
    # spot-check values transcribed from the RBI table 9 / NITI / UDISE files
    assert b["percapita"]["Goa"] == 542341 and b["percapita"]["Bihar"] == 62204
    assert b["niti"]["Kerala"] == 82.2 and b["niti"]["Uttar Pradesh"] == 30.57
    assert b["udise"]["Bihar"]["internet"] == 18.5


def test_vulnerability_orders_states_sensibly_and_flags_basis():
    assert sd.vulnerability("Bihar", "Healthcare")["value"] > sd.vulnerability("Kerala", "Healthcare")["value"]
    assert sd.vulnerability("Bihar", "Economy")["value"] == 100.0
    assert sd.vulnerability("Bihar", "Economy")["basis"] == "real"
    assert sd.vulnerability("Bihar", "Agriculture")["basis"] == "proxy"
    # Goa is not in the NITI file: falls back to the economy proxy and says so
    assert sd.vulnerability("Goa", "Healthcare")["basis"] == "proxy"
    for st in sd.KNOWN_NAMES[:28]:
        for sec in sd.SECTORS:
            v = sd.vulnerability(st, sec)["value"]
            assert v is not None and 0 <= v <= 100


# ------------------------------------------------------- fake rater plumbing
def _reply(payload):
    msg = types.SimpleNamespace(content=json.dumps(payload))
    return types.SimpleNamespace(choices=[types.SimpleNamespace(message=msg)])


def _rater_json(sev, plaus, mag, vuln, agri, quote=QUOTE_OK, scope=None, exposure=70):
    def dim(x):
        return {"score": x, "reason": "r", "evidence": quote}
    return {
        "severity": dim(sev), "plausibility": dim(plaus), "magnitude": dim(mag),
        "vulnerable_population": dim(vuln),
        "sector_impacts": {
            "Agriculture": {"score": agri, "reason": "helps farmers", "evidence": quote},
            "Economy": {"score": 10, "reason": "small", "evidence": "NO_DIRECT_EVIDENCE"},
            "Healthcare": {"score": 0, "reason": "none", "evidence": "NO_DIRECT_EVIDENCE"},
            "Education": {"score": -5, "reason": "none", "evidence": "NO_DIRECT_EVIDENCE"},
            "Infrastructure": {"score": 0, "reason": "none", "evidence": "NO_DIRECT_EVIDENCE"},
        },
        "stakeholder_exposure": [
            {"group": "Small farmers", "score": exposure, "effect": "benefit", "reason": "gets money", "evidence": quote},
            {"group": "Tenant farmers", "score": 80, "effect": "harm", "reason": "excluded", "evidence": quote},
            {"group": "Not a listed group", "score": 99, "effect": "harm", "reason": "x", "evidence": quote},
        ],
        "scope": scope or {"type": "national", "states": []},
    }


def make_create_fn(payloads):
    """Return create_fn handing out the payloads in call order (thread-safe enough: indexed by call)."""
    import itertools, threading
    counter, lock = itertools.count(), threading.Lock()

    def create_fn(**kwargs):
        with lock:
            i = next(counter)
        p = payloads[i % len(payloads)]
        if isinstance(p, Exception):
            raise p
        return _reply(p)
    return create_fn


GROUPS = ["Small farmers", "Tenant farmers"]


def run(payloads, text=POLICY):
    return rate_risk_dimensions("ctx", text, make_create_fn(payloads), group_names=GROUPS)


# --------------------------------------------------------------- aggregation
def test_sector_scores_are_median_signed_impact():
    ens = run([_rater_json(60, 60, 60, 60, 60), _rater_json(60, 60, 60, 60, 80), _rater_json(60, 60, 60, 60, 40)])
    sectors = isc.aggregate_sectors(ens["rater_extras"])
    agri = next(s for s in sectors if s["name"] == "Agriculture")
    assert agri["signed_impact"] == 60 and agri["score"] == 60 and agri["sentiment"] == "positive"
    assert agri["spread"] == 40 and agri["confidence"] == "low"          # raters disagree
    assert next(s for s in sectors if s["name"] == "Education")["sentiment"] == "neutral"  # |-5| <= 10


def test_negative_impact_gives_negative_sentiment_with_positive_strength():
    ens = run([_rater_json(60, 60, 60, 60, -70)] * 3)
    agri = next(s for s in isc.aggregate_sectors(ens["rater_extras"]) if s["name"] == "Agriculture")
    assert agri["score"] == 70 and agri["sentiment"] == "negative" and agri["signed_impact"] == -70


def test_fabricated_quotes_are_not_counted_as_verified():
    ens = run([_rater_json(60, 60, 60, 60, 60, quote=QUOTE_BAD)] * 3)
    agri = next(s for s in isc.aggregate_sectors(ens["rater_extras"]) if s["name"] == "Agriculture")
    assert agri["evidence_verified"] is False and agri["confidence"] != "high"
    good = run([_rater_json(60, 60, 60, 60, 60)] * 3)
    agri = next(s for s in isc.aggregate_sectors(good["rater_extras"]) if s["name"] == "Agriculture")
    assert agri["evidence_verified"] is True and agri["confidence"] == "high"


def test_stakeholder_severity_is_computed_and_unlisted_groups_ignored():
    ens = run([_rater_json(60, 60, 60, 60, 60, exposure=70)] * 3)
    groups = [{"group": "Small farmers", "impact": "text"}, {"group": "Tenant farmers", "impact": "text"}]
    out = isc.aggregate_stakeholders(groups, ens["rater_extras"])
    assert [g["group"] for g in out] == ["Small farmers", "Tenant farmers"]
    farmers = out[0]
    # farmers adaptability prior 0.25 -> 70 * (1 - 0.5*0.25) = 61.25 -> 61 -> high
    assert farmers["exposure"] == 70 and farmers["severity_score"] == 61 and farmers["severity"] == "high"
    assert farmers["effect"] == "benefit" and out[1]["effect"] == "harm"
    assert farmers["impact"] == "text"                       # descriptive text kept


def test_unrated_group_falls_back_and_is_flagged():
    ens = run([_rater_json(60, 60, 60, 60, 60)] * 3)
    out = isc.aggregate_stakeholders([{"group": "Mystery group", "impact": "x", "severity": "low"}], ens["rater_extras"])
    assert out[0]["method"] == "unavailable" and out[0]["severity"] == "low"


def test_malformed_extras_do_not_kill_the_risk_dimensions():
    broken = _rater_json(60, 60, 60, 60, 60)
    broken["sector_impacts"] = "garbage"
    broken["stakeholder_exposure"] = [{"nonsense": 1}]
    ens = run([broken] * 3)
    assert ens["risk_dimensions"]["severity"] == 60
    sectors = isc.aggregate_sectors(ens["rater_extras"])
    assert all(s["method"] == "unavailable" for s in sectors)


def test_one_rater_failing_is_tolerated():
    ens = run([_rater_json(60, 60, 60, 60, 60), RuntimeError("boom"), _rater_json(70, 70, 70, 70, 60)])
    assert len(ens["rater_extras"]) <= 3 and ens["risk_dimensions"]["severity"] in (60, 65, 70)


# --------------------------------------------------------------------- scope
def test_scope_national_by_default_and_state_specific_needs_text_proof():
    ens = run([_rater_json(60, 60, 60, 60, 60, scope={"type": "state_specific", "states": ["Punjab"]})] * 3)
    # "Punjab" is not in POLICY -> ignored -> national
    assert isc.aggregate_scope(ens["rater_extras"], POLICY)["type"] == "national"
    text = POLICY + " This scheme applies only to Punjab and Haryana."
    sc = isc.aggregate_scope(ens["rater_extras"], text)
    assert sc["type"] == "state_specific" and sc["states"] == ["Punjab"]


def test_scope_minority_vote_stays_national():
    ens = run([_rater_json(60, 60, 60, 60, 60, scope={"type": "state_specific", "states": ["Punjab"]}),
               _rater_json(60, 60, 60, 60, 60), _rater_json(60, 60, 60, 60, 60)])
    assert isc.aggregate_scope(ens["rater_extras"], POLICY + " Punjab")["type"] == "national"


# -------------------------------------------------------------------- states
SECTORS_HEALTH = [
    {"name": "Agriculture", "score": 0}, {"name": "Economy", "score": 0},
    {"name": "Healthcare", "score": 80}, {"name": "Education", "score": 0},
    {"name": "Infrastructure", "score": 0},
]


def test_state_scores_follow_real_vulnerability():
    out = {s["state"]: s for s in isc.score_states(SECTORS_HEALTH, {"type": "national", "states": []}, sd.KNOWN_NAMES[:28])}
    assert out["Uttar Pradesh"]["impact_score"] > out["Kerala"]["impact_score"]
    # health-only policy: score = vulnerability x (0.4 + 0.6 x 80/100) = (100-30.57) x 0.88
    assert out["Uttar Pradesh"]["impact_score"] == round((100 - 30.57) * 0.88)
    assert out["Uttar Pradesh"]["drivers"][0]["sector"] == "Healthcare"
    assert out["Uttar Pradesh"]["data_basis"] == "real"
    assert out["Goa"]["data_basis"] == "proxy"               # not in NITI file


def test_state_specific_scope_damps_other_states():
    nat = {s["state"]: s["impact_score"] for s in isc.score_states(SECTORS_HEALTH, {"type": "national", "states": []}, ["Bihar", "Kerala"])}
    spec = {s["state"]: s["impact_score"] for s in isc.score_states(SECTORS_HEALTH, {"type": "state_specific", "states": ["Bihar"]}, ["Bihar", "Kerala"])}
    assert spec["Bihar"] == nat["Bihar"]
    assert spec["Kerala"] == round(nat["Kerala"] * 0.25) or abs(spec["Kerala"] - nat["Kerala"] * 0.25) <= 1


def test_all_zero_sectors_do_not_crash():
    zero = [{"name": n, "score": 0} for n in sd.SECTORS]
    out = isc.score_states(zero, {"type": "national", "states": []}, ["Bihar"])
    assert 0 <= out[0]["impact_score"] <= 100


# ------------------------------------------------------------------- compare
def _fake_result(title, risk_dims, agri, health, states=None):
    from risk_engine import compute_risk_score
    risk = compute_risk_score(risk_dims)
    sectors = []
    for n in sd.SECTORS:
        v = {"Agriculture": agri, "Healthcare": health}.get(n, 0)
        sectors.append({"name": n, "score": abs(v), "signed_impact": v,
                        "sentiment": "positive" if v > 10 else "negative" if v < -10 else "neutral",
                        "reason": f"{title} {n}", "confidence": "high", "evidence": "q"})
    return {"policy_title": title, "overall_risk_score": risk["overall_risk_score"], "risk_level": risk["risk_level"],
            "risk_dimensions": risk["dimensions"], "risk_confidence": "high", "sectors": sectors,
            "stakeholders": [{"group": "Farmers", "severity": "high"}],
            "states": states or isc.score_states(sectors, {"type": "national", "states": []}, ["Bihar", "Kerala", "Goa"])}


LOW = {"severity": 30, "plausibility": 30, "magnitude": 30, "vulnerable_population": 30}
HIGH = {"severity": 80, "plausibility": 80, "magnitude": 80, "vulnerable_population": 80}


def test_compare_lower_risk_wins_and_sector_winners_follow_net_benefit():
    a = _fake_result("A", LOW, agri=60, health=0)
    b = _fake_result("B", HIGH, agri=20, health=40)
    r = build_comparison(a, b)
    assert r["overall_winner"] == "policy1" and r["method"]["rule"] == "risk_gap"
    assert r["comparison"]["Agriculture"]["policy1_score"] == 80 and r["comparison"]["Agriculture"]["winner"] == "policy1"
    assert r["comparison"]["Healthcare"]["winner"] == "policy2"
    assert r["comparison"]["Economy"]["winner"] == "tie"
    assert r["risk"]["policy1"]["range"]["p5"] <= r["risk"]["policy1"]["overall_risk_score"] <= r["risk"]["policy1"]["range"]["p95"] + 1
    assert set(r["common_fields"]) == set(sd.SECTORS) and len(r["top_states"]["policy1"]) == 3


def test_compare_similar_risk_falls_back_to_sector_average_then_tie():
    a = _fake_result("A", LOW, agri=60, health=60)
    b = _fake_result("B", LOW, agri=0, health=0)
    r = build_comparison(a, b)
    assert r["overall_winner"] == "policy1" and r["method"]["rule"] == "sector_average"
    same = build_comparison(a, _fake_result("C", LOW, agri=60, health=60))
    assert same["overall_winner"] == "tie"


# ------------------------------------------------ whole pipeline, LLM + RAG faked
@pytest.fixture
def pipeline(monkeypatch):
    sys.modules.setdefault("chromadb", types.ModuleType("chromadb"))
    fake_rag = types.ModuleType("rag")
    fake_rag.build_rag = lambda text, collection_name: None
    fake_rag.retrieve_chunks = lambda q, c: POLICY
    monkeypatch.setitem(sys.modules, "rag", fake_rag)
    monkeypatch.setenv("GROQ_API_KEY", "test")
    import importlib
    import main
    importlib.reload(main)

    analysis = {
        "policy_title": "Farm Support Scheme",
        "two_stage_scenario": {"stage1_before": "b", "stage2_after": "a"},
        "stakeholders": [{"group": "Small farmers", "impact": "gets money"},
                         {"group": "Tenant farmers", "impact": "excluded"}],
        "recommendations": [{"title": "t", "description": "d", "priority": "high", "sector": "Agriculture"}] * 4,
    }
    raters = [_rater_json(70, 60, 80, 75, 70)] * 3

    def fake_create(**kw):
        sysmsg = kw["messages"][0]["content"]
        if "policy risk rater" in sysmsg:
            return _reply(raters[0])
        return _reply(analysis)
    monkeypatch.setattr(main, "_groq_create", fake_create)
    return main


def test_full_pipeline_end_to_end(pipeline):
    res = pipeline.analyse_policy(POLICY)
    # formula: 70*.35 + 60*.30 + 80*.20 + 75*.15 = 69.75 -> 70
    assert res["overall_risk_score"] == 70 and res["risk_level"] == "High"
    agri = next(s for s in res["sectors"] if s["name"] == "Agriculture")
    assert agri["score"] == 70 and agri["sentiment"] == "positive" and agri["data_grounded"] is True
    assert agri["state_data_basis"] == "proxy"
    assert {s["group"] for s in res["stakeholders"]} == {"Small farmers", "Tenant farmers"}
    assert all(s["severity"] in ("high", "medium", "low") and "reason" in s for s in res["stakeholders"])
    assert len(res["states"]) == 28 and all(0 <= s["impact_score"] <= 100 for s in res["states"])
    assert res["scope"]["type"] == "national"
    assert len(res["timeline"]) == 5 and res["monte_carlo"]["n_trials"] > 0
    assert "scoring_warnings" not in res


def test_full_pipeline_deterministic_numbers(pipeline):
    a, b = pipeline.analyse_policy(POLICY), pipeline.analyse_policy(POLICY)
    for k in ("overall_risk_score", "sectors", "states", "timeline"):
        assert a[k] == b[k]


def test_compare_pipeline(pipeline):
    r = pipeline.build_comparison(pipeline.analyse_policy(POLICY, False), pipeline.analyse_policy(POLICY, False))
    assert r["overall_winner"] == "tie" and r["policy1_title"] == "Farm Support Scheme"
