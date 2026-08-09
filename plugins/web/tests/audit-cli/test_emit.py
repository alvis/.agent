"""Round-trip a Report through asdict → json → parse and assert equality."""

import json
from pathlib import Path

from audit_cli.report.emit import report_to_dict, write_report
from audit_cli.types import (
    Evidence,
    Finding,
    Page,
    Recommendation,
    Report,
    Viewport,
)


def _sample_report() -> Report:
    finding = Finding(
        rule_id="DES-CONS-01",
        severity="p1",
        selector=".hero h1",
        evidence=Evidence(dom_value="<h1>Hi</h1>", crop_path="crops/hero.png"),
        recommendation=Recommendation(
            action="Tighten heading hierarchy",
            code_suggestion="use a single h1",
            rule_ref="DES-CONS-01",
        ),
        needs_ai_review=True,
        ai_prompt="Does the heading hierarchy read correctly?",
        hypothesis="The visual h2 outranks the h1.",
    )
    page = Page(
        url="https://example.com/",
        title="Home",
        viewports=(Viewport(label="desktop", width=1440, height=900),),
        areas=(),
        findings=(finding,),
    )
    return Report(
        contract_version="3.0",
        target="https://example.com/",
        generated_at="2026-04-15T00:00:00Z",
        overall_score=82,
        risk="MEDIUM",
        pages=(page,),
        findings=(finding,),
        recurring_elements=(),
        cross_origin_candidates=("https://partner.com/login",),
        warnings=(),
    )


def test_report_round_trip_preserves_primitive_fields(tmp_path: Path) -> None:
    report = _sample_report()
    final_path = write_report(report, tmp_path)
    assert final_path == tmp_path / "report.json"

    raw = json.loads(final_path.read_text(encoding="utf-8"))
    assert {
        "contract_version": raw["contract_version"],
        "overall_score": raw["overall_score"],
        "risk": raw["risk"],
        "page_url": raw["pages"][0]["url"],
        "needs_ai_review": raw["findings"][0]["needs_ai_review"],
        "ai_prompt": raw["findings"][0]["ai_prompt"],
    } == {
        "contract_version": "3.0",
        "overall_score": 82,
        "risk": "MEDIUM",
        "page_url": "https://example.com/",
        "needs_ai_review": True,
        "ai_prompt": "Does the heading hierarchy read correctly?",
    }
    assert "crops" in [p.name for p in tmp_path.iterdir()]


def test_report_to_dict_prunes_none_values() -> None:
    report = _sample_report()
    payload = report_to_dict(report)
    finding_payload = payload["findings"][0]
    assert "ai_verdict" not in finding_payload
