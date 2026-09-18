"""
The API's low-confidence rule: a claim under 30% confidence is reported
as false, while the pipeline's own labels are left alone.
"""

from backend.api.shape import respond


def result(*claims, label=None, confidence=None):
    claims = list(claims)
    worst = claims[0] if claims else None

    return {
        "verdict": {
            "label": label or (worst["label"] if worst else "unverified"),
            "confidence": confidence if confidence is not None else (
                worst["confidence"] if worst else 0.0
            ),
            "summary": "pipeline summary",
            "counts": {},
            "claims": claims,
        },
        "packet": {},
        "claims": [],
        "stages": {},
        "ms": 1.0,
    }


def claim(label, confidence, claim_id="c1"):
    return {
        "claim_id": claim_id,
        "claim": "some claim",
        "label": label,
        "confidence": confidence,
        "explanation": "why",
        "reasons": [],
        "evidence_ids": [],
    }


def test_an_unverified_claim_under_30_percent_is_reported_false():
    out = respond(result(claim("unverified", 0.2)))

    assert out["verdict"]["label"] == "false"
    assert out["verdict"]["confidence"] == 0.2
    assert out["verdict"]["counts"] == {"false": 1}
    assert out["results"][0]["label"] == "false"
    assert out["results"][0]["original_label"] == "unverified"
    assert "below 30%" in out["results"][0]["explanation"]


def test_a_claim_at_or_above_30_percent_keeps_its_label():
    out = respond(result(claim("disputed", 0.4)))

    assert out["verdict"]["label"] == "disputed"
    assert out["verdict"]["summary"] == "pipeline summary"
    assert "original_label" not in out["results"][0]


def test_a_confident_true_claim_is_untouched():
    out = respond(result(claim("true", 0.85)))

    assert out["verdict"]["label"] == "true"


def test_no_claims_is_not_a_false_claim():
    out = respond(result(label="unverified", confidence=0.0))

    assert out["verdict"]["label"] == "unverified"
    assert out["results"] == []


def test_one_low_claim_makes_the_message_false():
    out = respond(result(claim("true", 0.8, "a"), claim("unverified", 0.2, "b")))

    assert out["verdict"]["label"] == "false"
    assert out["verdict"]["counts"] == {"true": 1, "false": 1}
    assert [r["label"] for r in out["results"]] == ["true", "false"]


def test_the_pipeline_result_is_not_mutated():
    raw = result(claim("unverified", 0.2))
    respond(raw)

    assert raw["verdict"]["label"] == "unverified"
    assert raw["verdict"]["claims"][0]["label"] == "unverified"
