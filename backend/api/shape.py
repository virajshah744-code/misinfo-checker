"""
The wire format, in one place.

Both front doors — `main.py` (FastAPI, what the bot talks to) and
`flask_app.py` (Flask, what the browser talks to) — return the same
JSON for the same pipeline result. That only stays true if there is
one function that builds it, so this is it.

The shape is deliberately layered, because two very different callers
use it: a bot wants `verdict.summary` and nothing else, while a reviewer
wants the claims, the evidence and the graph. Nobody is forced to parse
what they do not need.
"""


# Product rule, applied here at the edge rather than in `backend.verdict`:
# a claim backed with less than this confidence is *reported* as false.
# Inside the pipeline it stays `unverified`, because that label is what
# sends the agentic evidence agent back out for a second round.
LOW_CONFIDENCE_FALSE = 0.30


def _low_confidence(claim):
    """One per-claim verdict, relabelled `false` if it is under the bar."""
    if claim["label"] == "false" or claim["confidence"] >= LOW_CONFIDENCE_FALSE:
        return claim

    return {
        **claim,
        "label": "false",
        "original_label": claim["label"],
        "explanation": (
            f"Confidence is below {LOW_CONFIDENCE_FALSE:.0%}, so this claim is "
            f"reported as false. {claim['explanation']}"
        ),
    }


def _overall(verdict, claims):
    """
    The packet verdict after the per-claim rule: the worst claim decides,
    as in `backend.verdict.decide`. A message with no check-worthy claims
    is left alone — "nothing to check" is not a false claim.
    """
    if not claims or verdict["label"] == "false":
        return verdict

    if not any(c["label"] == "false" and c.get("original_label") for c in claims):
        return verdict

    counts = {}

    for claim in claims:
        counts[claim["label"]] = counts.get(claim["label"], 0) + 1

    worst = min(
        (c for c in claims if c["label"] == "false"),
        key=lambda c: c["confidence"],
    )

    return {
        **verdict,
        "label": "false",
        "confidence": worst["confidence"],
        "summary": f"This message contains a false claim. {worst['explanation']}",
        "counts": counts,
    }


def respond(result, include_graph=False):
    """
    Shape one pipeline result for the wire.

    `results` is the per-claim list, one entry per check-worthy claim
    with its label, its confidence and the evidence behind it. `agents`
    and `explanation` appear only on an agentic run, so the default
    response is byte-for-byte what it has always been.
    """
    claims = [_low_confidence(claim) for claim in result["verdict"].get("claims", [])]
    verdict = _overall(result["verdict"], claims)

    return {
        "verdict": {
            "label": verdict["label"],
            "confidence": verdict["confidence"],
            "summary": verdict["summary"],
            "counts": verdict.get("counts", {}),
        },
        "results": [
            {
                "claim": claim.get("claim"),
                "claim_id": claim.get("claim_id"),
                "label": claim["label"],
                "confidence": claim["confidence"],
                "explanation": claim["explanation"],
                "reasons": claim.get("reasons", []),
                "evidence_ids": claim.get("evidence_ids", []),
                "demo_only": claim.get("demo_only", False),
                **({"original_label": claim["original_label"]}
                   if claim.get("original_label") else {}),
            }
            for claim in claims
        ],
        "packet": result["packet"],
        "claims": result["claims"],
        "timeline": result.get("timeline", []),
        "open_claims": result.get("open_claims", []),
        "stages": result["stages"],
        "ms": result["ms"],
        **({"graph": result["graph"]} if include_graph else {}),
        **({"agents": result["agents"]} if result.get("agents") else {}),
        **({"explanation": result["explanation"]} if result.get("explanation") else {}),
    }
