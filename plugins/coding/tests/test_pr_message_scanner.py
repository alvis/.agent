import json
import subprocess
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
SCANNER = PLUGIN / "skills" / "pr" / "scripts" / "scan-pr-message.py"
HEAD_OID = "1" * 40
BASE_OID = "2" * 40


def message(*sections: tuple[str, str]) -> str:
    rendered = ["📌", "", "Separate observable standards from operating directions."]
    for heading, body in sections:
        rendered.extend(["", heading, "", body])
    return "\n".join(rendered) + "\n"


def run_scanner(
    tmp_path: Path,
    body: str,
    *,
    zone: str = "green",
    archetype: str = "mechanical-refactor",
    generated_files: tuple[str, ...] = (),
    template: Path | None = None,
    head_oid: str = HEAD_OID,
    base_oid: str = BASE_OID,
    allow_pending_reviewers: bool = True,
) -> tuple[subprocess.CompletedProcess[str], dict[str, object]]:
    body_path = tmp_path / "body.md"
    body_path.write_text(body, encoding="utf-8")
    command = [
        "uv",
        "run",
        "--python",
        "3.13",
        str(SCANNER),
        "--body-file",
        str(body_path),
        "--zone",
        zone,
        "--archetype",
        archetype,
        "--head-oid",
        head_oid,
        "--base-oid",
        base_oid,
    ]
    if template is not None:
        command.extend(["--template", str(template)])
    if allow_pending_reviewers:
        command.append("--allow-pending-reviewers")
    for path in generated_files:
        command.extend(["--generated-file", path])
    completed = subprocess.run(command, check=False, capture_output=True, text=True)
    return completed, json.loads(completed.stdout)


def rule_ids(result: dict[str, object]) -> set[str]:
    return {item["rule_id"] for item in result["violations"]}


def verification(
    reviewers: int = 0, *, reviewer_checked: bool = False
) -> tuple[str, str]:
    checks = ["- [x] Run the PR message scanner."]
    checkbox = "x" if reviewer_checked else " "
    for slot in range(1, reviewers + 1):
        checks.extend(
            [
                f"- [{checkbox}] Reviewer slot {slot} assigned",
                f"- [{checkbox}] Reviewer slot {slot} reviewed `{HEAD_OID}` against `{BASE_OID}`",
                f"- [{checkbox}] Reviewer slot {slot} approved `{HEAD_OID}` against `{BASE_OID}`",
            ]
        )
    return "## 🧪 Verification", "\n".join(checks)


def test_green_message_conforms_to_the_bundled_template(tmp_path: Path) -> None:
    completed, result = run_scanner(tmp_path, message(verification()))

    assert completed.returncode == 0
    assert result["valid"] is True
    assert result["violations"] == []


@pytest.mark.parametrize(
    ("body", "message_fragment"),
    [
        pytest.param(
            "📌\n\n{{summary_paragraph}}\n",
            "unresolved placeholders",
            id="placeholder",
        ),
        pytest.param(
            "📌\n\nSummary.\n\n<!-- author guidance -->\n",
            "guidance comments",
            id="comment",
        ),
        pytest.param(
            message(("## Unknown", "extra"), verification()),
            "not owned by the selected template",
            id="unknown-section",
        ),
        pytest.param(
            message(verification(), ("## Risk", "Specific risk.")),
            "out of order",
            id="section-order",
        ),
    ],
)
def test_template_shape_violations_report_git_pr_02(
    tmp_path: Path,
    body: str,
    message_fragment: str,
) -> None:
    completed, result = run_scanner(tmp_path, body)

    assert completed.returncode == 1
    assert "GIT-PR-02" in rule_ids(result)
    assert any(message_fragment in item["message"] for item in result["violations"])


@pytest.mark.parametrize(
    ("zone", "sections", "expected_rule"),
    [
        pytest.param("yellow", (verification(),), "GIT-PR-SIZE-02", id="yellow"),
        pytest.param(
            "red",
            (
                ("## Risk", "A stale reference can bypass the standard."),
                ("## Test plan", "Run contract and path tests."),
                verification(),
            ),
            "GIT-PR-SIZE-03",
            id="red",
        ),
        pytest.param("black", (verification(),), "GIT-PR-SIZE-04", id="black"),
    ],
)
def test_size_zone_evidence_reports_the_owning_rule(
    tmp_path: Path,
    zone: str,
    sections: tuple[tuple[str, str], ...],
    expected_rule: str,
) -> None:
    completed, result = run_scanner(tmp_path, message(*sections), zone=zone)

    assert completed.returncode == 1
    assert expected_rule in rule_ids(result)


@pytest.mark.parametrize(
    ("archetype", "expected_rule"),
    [
        pytest.param("migration", "GIT-PR-TYPE-03"),
        pytest.param("feature-flag", "GIT-PR-STACK-04"),
        pytest.param("ui", "GIT-PR-02"),
    ],
)
def test_archetype_evidence_reports_the_owning_rule(
    tmp_path: Path,
    archetype: str,
    expected_rule: str,
) -> None:
    completed, result = run_scanner(
        tmp_path,
        message(verification()),
        archetype=archetype,
    )

    assert completed.returncode == 1
    assert expected_rule in rule_ids(result)


def test_generated_paths_require_named_generated_evidence(tmp_path: Path) -> None:
    completed, result = run_scanner(
        tmp_path,
        message(
            ("## 🏭 Generated Files", "Generated output is included."),
            verification(),
        ),
        generated_files=("sdk/generated.ts",),
    )

    assert completed.returncode == 1
    assert "GIT-PR-TYPE-05" in rule_ids(result)


def test_generated_path_pattern_must_match_every_supplied_path(tmp_path: Path) -> None:
    completed, result = run_scanner(
        tmp_path,
        message(
            (
                "## 🏭 Generated Files",
                "`sdk/*.ts` is generated from `schema/openapi.yaml`.",
            ),
            verification(),
        ),
        generated_files=("sdk/client.ts", "docs/client.md"),
    )

    assert completed.returncode == 1
    assert any("docs/client.md" in item["message"] for item in result["violations"])
    assert all("sdk/client.ts" not in item["message"] for item in result["violations"])


def test_repository_template_controls_preamble_and_section_order(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "<!-- repository guidance remains verbatim -->\n"
        "Repository PR\n\n"
        "{{summary}}\n\n"
        "## Risk\n\n{{risk}}\n\n"
        "## Test plan\n\n{{test_plan}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "<!-- repository guidance remains verbatim -->\n"
        "Repository PR\n\n"
        "Keep version-control artifacts scannable.\n\n"
        "## Risk\n\nA stale consumer can load the old authority.\n\n"
        "## Test plan\n\nRun contract and path tests.\n\n"
        "## 🧪 Verification\n\n- [x] Run the selected-template scanner.\n"
        "- [ ] Reviewer slot 1 assigned\n"
        f"- [ ] Reviewer slot 1 reviewed `{HEAD_OID}` against `{BASE_OID}`\n"
        f"- [ ] Reviewer slot 1 approved `{HEAD_OID}` against `{BASE_OID}`\n"
    )

    completed, result = run_scanner(
        tmp_path,
        body,
        zone="yellow",
        template=template,
    )

    assert completed.returncode == 0
    assert result["valid"] is True


def test_repository_template_optional_sections_may_be_empty(tmp_path: Path) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "<!-- keep this comment -->\n"
        "Repository PR\n\n{{summary}}\n\n"
        "## Optional notes\n\n{{notes}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "<!-- keep this comment -->\n"
        "Repository PR\n\nSpecific summary.\n\n"
        "## Optional notes\n\nNone.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, template=template)

    assert completed.returncode == 0
    assert result["valid"] is True


def test_repository_template_optional_placeholders_remain_verbatim(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "<!-- keep this comment -->\n"
        "Repository PR\n\n{{summary}}\n\n"
        "## Optional notes\n\n{{optional_notes}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "<!-- keep this comment -->\n"
        "Repository PR\n\nSpecific summary.\n\n"
        "## Optional notes\n\n{{optional_notes}}\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, template=template)

    assert completed.returncode == 0
    assert result["valid"] is True


def test_repository_template_placeholder_cannot_supply_required_evidence(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "Repository PR\n\n{{summary}}\n\n"
        "## Risk\n\n{{risk}}\n\n"
        "## Test plan\n\n{{test_plan}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\nSpecific summary.\n\n"
        "## Risk\n\n{{risk}}\n\n"
        "## Test plan\n\nSpecific test plan.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(
        tmp_path, body, zone="yellow", template=template
    )

    assert completed.returncode == 1
    assert any(
        "missing specific evidence: ## Risk" in item["message"]
        for item in result["violations"]
    )


def test_repository_template_formatted_placeholder_cannot_supply_summary(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "**Summary:** {{summary}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "**Summary:** {{summary}}\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, template=template)

    assert completed.returncode == 1
    assert any("no summary" in item["message"] for item in result["violations"])


def test_repository_template_formatted_placeholder_cannot_supply_risk(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "Repository PR\n\n{{summary}}\n\n"
        "## Risk\n\n- {{risk}}\n\n"
        "## Test plan\n\n{{test_plan}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\nSpecific summary.\n\n"
        "## Risk\n\n- {{risk}}\n\n"
        "## Test plan\n\nSpecific test plan.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(
        tmp_path, body, zone="yellow", template=template
    )

    assert completed.returncode == 1
    assert any(
        "missing specific evidence: ## Risk" in item["message"]
        for item in result["violations"]
    )


@pytest.mark.parametrize(
    "risk_evidence",
    (
        "**Risk:** {{risk}}\n**Mitigation:** {{mitigation}}",
        "**Risk:** {{risk}} **Mitigation:** {{mitigation}}",
    ),
)
def test_repository_template_compound_placeholders_cannot_supply_risk(
    tmp_path: Path,
    risk_evidence: str,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "Repository PR\n\n{{summary}}\n\n"
        f"## Risk\n\n{risk_evidence}\n\n"
        "## Test plan\n\n{{test_plan}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\nSpecific summary.\n\n"
        f"## Risk\n\n{risk_evidence}\n\n"
        "## Test plan\n\nSpecific test plan.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(
        tmp_path, body, zone="yellow", template=template
    )

    assert completed.returncode == 1
    assert any(
        "missing specific evidence: ## Risk" in item["message"]
        for item in result["violations"]
    )


def test_repository_template_placeholder_with_specific_prose_is_evidence(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "Repository PR\n\n{{summary}}\n\n"
        "## Risk\n\n{{risk}}\n\n"
        "## Test plan\n\n{{test_plan}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\nSpecific summary.\n\n"
        "## Risk\n\n{{risk}} remains until the downstream cache expires.\n\n"
        "## Test plan\n\nExercise the cache boundary.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
        "- [ ] Reviewer slot 1 assigned\n"
        f"- [ ] Reviewer slot 1 reviewed `{HEAD_OID}` against `{BASE_OID}`\n"
        f"- [ ] Reviewer slot 1 approved `{HEAD_OID}` against `{BASE_OID}`\n"
    )

    completed, result = run_scanner(
        tmp_path, body, zone="yellow", template=template
    )

    assert completed.returncode == 0
    assert result["valid"] is True


def test_repository_template_comments_must_remain_verbatim(tmp_path: Path) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "<!-- repository guidance -->\n"
        "Repository PR\n\n{{summary}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\nSpecific summary.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, template=template)

    assert completed.returncode == 1
    assert any("comments verbatim" in item["message"] for item in result["violations"])


def test_complete_red_message_passes(tmp_path: Path) -> None:
    completed, result = run_scanner(
        tmp_path,
        message(
            ("## Risk", "A stale consumer can retain the former authority."),
            ("## Test plan", "Run scanner, contract, and documentation tests."),
            (
                "## Why this size",
                "Rules, consumers, and tests move together because they share one authority.",
            ),
            verification(2),
        ),
        zone="red",
    )

    assert completed.returncode == 0
    assert result["valid"] is True


def test_red_message_requires_two_reviewer_triplets(tmp_path: Path) -> None:
    completed, result = run_scanner(
        tmp_path,
        message(
            ("## Risk", "A stale consumer can retain the former authority."),
            ("## Test plan", "Run scanner, contract, and documentation tests."),
            (
                "## Why this size",
                "Rules, consumers, and tests move together because they share one authority.",
            ),
            verification(1),
        ),
        zone="red",
    )

    assert completed.returncode == 1
    assert any(
        "2 confirmed reviewer evidence triplet" in item["message"]
        for item in result["violations"]
    )


def test_reviewer_evidence_must_match_the_active_revision(tmp_path: Path) -> None:
    completed, result = run_scanner(
        tmp_path,
        message(
            ("## Risk", "A stale review could be credited to new code."),
            ("## Test plan", "Scan against the active revision."),
            verification(1),
        ),
        zone="yellow",
        head_oid="3" * 40,
    )

    assert completed.returncode == 1
    assert any("active revision" in item["message"] for item in result["violations"])


def test_review_scan_requires_confirmed_reviewer_triplets(tmp_path: Path) -> None:
    pending, pending_result = run_scanner(
        tmp_path,
        message(
            ("## Risk", "A large surface can hide defects."),
            ("## Test plan", "Require an independent review."),
            verification(1),
        ),
        zone="yellow",
        allow_pending_reviewers=False,
    )

    assert pending.returncode == 1
    assert any(
        "confirmed reviewer evidence" in item["message"]
        for item in pending_result["violations"]
    )

    confirmed, confirmed_result = run_scanner(
        tmp_path,
        message(
            ("## Risk", "A large surface can hide defects."),
            ("## Test plan", "Require an independent review."),
            verification(1, reviewer_checked=True),
        ),
        zone="yellow",
        allow_pending_reviewers=False,
    )

    assert confirmed.returncode == 0
    assert confirmed_result["valid"] is True


def test_placeholders_inside_code_are_literal_content(tmp_path: Path) -> None:
    completed, result = run_scanner(
        tmp_path,
        message(
            (
                "## 🧵 Context",
                "Use `{{inline_value}}` or:\n```yaml\nvalue: {{fenced_value}}\n```",
            ),
            verification(),
        ),
    )

    assert completed.returncode == 0
    assert result["valid"] is True


def test_indented_unknown_heading_is_rejected(tmp_path: Path) -> None:
    completed, result = run_scanner(
        tmp_path,
        message(("  ## Unknown", "Extra section."), verification()),
    )

    assert completed.returncode == 1
    assert any("not owned" in item["message"] for item in result["violations"])


@pytest.mark.parametrize("generic", ("None.", "N/A."))
def test_punctuated_generic_required_evidence_is_rejected(
    tmp_path: Path, generic: str
) -> None:
    completed, result = run_scanner(
        tmp_path,
        message(
            ("## Risk", generic),
            ("## Test plan", "Exercise the named risk."),
            verification(1),
        ),
        zone="yellow",
    )

    assert completed.returncode == 1
    assert any("missing specific evidence: ## Risk" in item["message"] for item in result["violations"])


def test_unquoted_generated_glob_matches_supplied_path(tmp_path: Path) -> None:
    completed, result = run_scanner(
        tmp_path,
        message(
            (
                "## 🏭 Generated Files",
                "sdk/*.ts is generated from schema/openapi.yaml.",
            ),
            verification(),
        ),
        generated_files=("sdk/client.ts",),
    )

    assert completed.returncode == 0
    assert result["valid"] is True


def test_fenced_heading_is_message_content_not_a_template_section(
    tmp_path: Path,
) -> None:
    completed, result = run_scanner(
        tmp_path,
        message(
            (
                "## 🧵 Context",
                "```markdown\n## Example heading\n```",
            ),
            verification(),
        ),
    )

    assert completed.returncode == 0
    assert result["valid"] is True
