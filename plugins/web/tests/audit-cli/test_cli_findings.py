"""Regression coverage for collecting findings from interaction follow-up states."""

from audit_cli import cli as cli_module
from audit_cli.types import PageAuditResult


def test_collect_page_findings_includes_triggered_reports() -> None:
    result = PageAuditResult(
        url="https://example.com",
        viewport_reports={
            "Mobile 390x844": {
                "categories": {
                    "text": {
                        "issues": [],
                    }
                }
            }
        },
        triggered_reports=[
            (
                "menu-open",
                {
                    "categories": {
                        "text": {
                            "issues": [
                                {
                                    "ruleId": "contrast",
                                    "severity": "high",
                                    "selector": "a.mobile-nav-link.mobile-nav-link-active",
                                    "summary": "Contrast ratio 1 is below the required minimum of 4.5.",
                                    "details": "Contrast ratio 1 is below the required minimum of 4.5.",
                                    "evidence": {
                                        "contrast": 1,
                                        "minimum": 4.5,
                                        "color": "rgb(31, 36, 40)",
                                        "background": "rgb(31, 36, 40)",
                                    },
                                }
                            ]
                        }
                    }
                },
            )
        ],
    )

    findings = cli_module._collect_page_findings(result)

    assert ("contrast", "a.mobile-nav-link.mobile-nav-link-active") in findings
