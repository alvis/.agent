import json
import runpy
import string
import subprocess
from pathlib import Path
from typing import TypedDict

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
SCANNER = PLUGIN / "skills" / "pr" / "scripts" / "scan-pr-message.py"
MESSAGE_TEMPLATE = PLUGIN / "skills" / "pr" / "templates" / "message.md"
HEAD_OID = "1" * 40
BASE_OID = "2" * 40
TEMPLATE_HEADINGS = [
    line for line in MESSAGE_TEMPLATE.read_text().splitlines() if line.startswith("## ")
]


class Violation(TypedDict):
    message: str
    rule_id: str


class ScanResult(TypedDict):
    valid: bool
    violations: list[Violation]


def section_name(heading: str) -> str:
    words = heading.removeprefix("## ").removesuffix(" [ Optional ]").split()
    label = words[1:] if words and not words[0][0].isascii() else words
    return " ".join(label).casefold()


BUNDLED_HEADING_BY_NAME = {
    section_name(heading): heading.removesuffix(" [ Optional ]")
    for heading in TEMPLATE_HEADINGS
}
REPOSITORY_REQUIRED_TEMPLATE = (
    "📌\n\n{{summary}}\n\n"
    "## 🎯 Goal\n\n{{goal}}\n\n"
    "## ✅ Requirements\n\n{{requirements}}\n\n"
    "## 🧵 Context\n\n{{context}}\n\n"
)
REPOSITORY_REQUIRED_BODY = (
    "📌\n\nSpecific summary.\n\n"
    "## 🎯 Goal\n\nMake repository PR intent explicit.\n\n"
    "## ✅ Requirements\n\n- Readers can identify the PR's observable behavior.\n\n"
    "## 🧵 Context\n\nRepository authors need a stable contract.\n\n"
)


def message(*sections: tuple[str, str]) -> str:
    rendered = [
        "📌",
        "",
        "Separate observable standards from operating directions.",
        "",
        "## 🎯 Goal",
        "",
        "Make PR intent explicit to authors and reviewers.",
        "",
        "## ✅ Requirements",
        "",
        "- Render each required PR contract section in the published message.",
        "",
        "## 🧵 Context",
        "",
        "Authors need PR messages whose intent and behavior are explicit.",
    ]
    for heading, body in sections:
        name = section_name(heading)
        rendered.extend(["", BUNDLED_HEADING_BY_NAME.get(name, heading), "", body])
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
) -> tuple[subprocess.CompletedProcess[str], ScanResult]:
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


def rule_ids(result: ScanResult) -> set[str]:
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


def test_bundled_message_requires_goal_and_behavioral_requirements(
    tmp_path: Path,
) -> None:
    missing_goal = message(verification()).replace(
        "\n## 🎯 Goal\n\nMake PR intent explicit to authors and reviewers.\n", ""
    )
    generic_requirements = message(verification()).replace(
        "- Render each required PR contract section in the published message.",
        "- Pass the tests.\n- Follow the standards.\n- Keep CI green.",
    )

    _, missing_result = run_scanner(tmp_path, missing_goal)
    _, generic_result = run_scanner(tmp_path, generic_requirements)

    assert any(
        "missing required section: ## 🎯 Goal" in item["message"]
        for item in missing_result["violations"]
    )
    assert any(
        "generic process gates" in item["message"]
        for item in generic_result["violations"]
    )


def test_mixed_behavioral_and_process_requirement_is_not_process_only(
    tmp_path: Path,
) -> None:
    body = message(verification()).replace(
        "- Render each required PR contract section in the published message.",
        "- Users can view order history, and tests pass.",
    )

    completed, result = run_scanner(tmp_path, body)

    assert completed.returncode == 0
    assert result["valid"] is True


def test_process_only_requirement_grammar_is_rejected_programmatically(
    tmp_path: Path,
) -> None:
    subjects = [
        "tests",
        "CI",
        "checks",
        "build",
        "pytest",
        "compilation",
        "pipeline",
    ]
    qualifiers = [
        "",
        "unit ",
        "integration ",
        "repository local ",
        "unit and integration ",
    ]
    requirements = [
        f"- All {qualifier}{subject} must {outcome}."
        for subject in subjects
        for qualifier in qualifiers
        for outcome in ("pass", "succeed")
    ]

    for requirement in requirements:
        body = message(verification()).replace(
            "- Render each required PR contract section in the published message.",
            requirement,
        )
        completed, result = run_scanner(tmp_path, body)

        assert completed.returncode == 1, requirement
        assert any(
            "generic process gates" in item["message"] for item in result["violations"]
        ), requirement


def test_process_state_grammar_is_rejected_programmatically(tmp_path: Path) -> None:
    subjects = ["tests", "CI", "checks", "build", "pytest", "linting"]
    state_phrases = [
        f"{modal}{state} {outcome}"
        for modal, states in (
            ("", ("is", "stays", "remains")),
            ("must ", ("be", "stay", "remain")),
            ("should ", ("be", "stay", "remain")),
            ("shall ", ("be", "stay", "remain")),
        )
        for state in states
        for outcome in ("green", "clean")
    ]
    requirements = [
        requirement
        for subject in subjects
        for requirement in (
            *(f"- {subject} {state_phrase}." for state_phrase in state_phrases),
            f"- No {subject} fail.",
            f"- {subject} do not fail.",
        )
    ] + [
        f"- There are no {qualifier}test failures."
        for qualifier in ("", "unit ", "integration ")
    ]

    for requirement in requirements:
        body = message(verification()).replace(
            "- Render each required PR contract section in the published message.",
            requirement,
        )
        completed, result = run_scanner(tmp_path, body)

        assert completed.returncode == 1, requirement
        assert any(
            "generic process gates" in item["message"] for item in result["violations"]
        ), requirement


def test_markdown_list_markers_do_not_become_behavioral_evidence(
    tmp_path: Path,
) -> None:
    for marker in ("-", "*", "+", "1.", "2)"):
        body = message(verification()).replace(
            "- Render each required PR contract section in the published message.",
            f"{marker} All tests must pass.",
        )
        completed, result = run_scanner(tmp_path, body)

        assert completed.returncode == 1, marker
        assert any(
            "generic process gates" in item["message"] for item in result["violations"]
        ), marker


@pytest.mark.parametrize("invalid_heading", ("## Risk", "## ⚠️ Risk [ Optional ]"))
def test_bundled_final_heading_requires_emoji_without_optional_suffix(
    tmp_path: Path, invalid_heading: str
) -> None:
    body = message(("## Risk", "A concrete failure mode."), verification()).replace(
        "## ⚠️ Risk", invalid_heading
    )

    completed, result = run_scanner(tmp_path, body)

    assert completed.returncode == 1
    assert any(
        "not owned by the selected template" in item["message"]
        for item in result["violations"]
    )


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
        + REPOSITORY_REQUIRED_TEMPLATE
        + "## ⚠️ Risk [ Optional ]\n\n{{risk}}\n\n"
        "## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "<!-- repository guidance remains verbatim -->\n"
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_BODY
        + "## ⚠️ Risk [ Optional ]\n\nA stale consumer can load the old authority.\n\n"
        "## 🧭 Test Plan [ Optional ]\n\nRun contract and path tests.\n\n"
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


def test_repository_template_must_include_the_message_heading_contract(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "Repository PR\n\n{{summary}}\n\n"
        "## Risk\n\n{{risk}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\nSpecific summary.\n\n"
        "## Risk\n\nSpecific risk.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, template=template)

    assert completed.returncode == 1
    messages = {item["message"] for item in result["violations"]}
    body_headings = {line for line in body.splitlines() if line.startswith("## ")}
    expected_missing = {
        heading
        for heading in TEMPLATE_HEADINGS
        if not heading.endswith(" [ Optional ]") and heading not in body_headings
    }
    assert {
        f"missing required section: {heading}" for heading in expected_missing
    }.issubset(messages)
    assert "section lacks an emoji prefix: ## Risk" in messages


def test_repository_template_may_define_a_mandatory_custom_section(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        REPOSITORY_REQUIRED_TEMPLATE + "## 🔐 Security\n\n{{security}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        REPOSITORY_REQUIRED_BODY
        + "## 🔐 Security\n\nAuthorize access before returning records.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, template=template)

    assert completed.returncode == 0
    assert result["valid"] is True


def test_ascii_punctuation_is_not_an_emoji_prefix(tmp_path: Path) -> None:
    template = tmp_path / "pull-request-template.md"
    headings = [
        f"## {prefix} Notes {index} [ Optional ]"
        for index, prefix in enumerate(string.punctuation)
    ]
    template.write_text(
        REPOSITORY_REQUIRED_TEMPLATE
        + "\n\n".join(
            f"{heading}\n\n{{{{notes_{index}}}}}"
            for index, heading in enumerate(headings)
        )
        + "\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        REPOSITORY_REQUIRED_BODY
        + "\n\n".join(f"{heading}\n\nSpecific notes." for heading in headings)
        + "\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, template=template)

    assert completed.returncode == 1
    messages = {item["message"] for item in result["violations"]}
    assert all(
        f"section lacks an emoji prefix: {heading}" in messages for heading in headings
    )


def test_emoji_ranges_and_keycaps_are_checked_programmatically() -> None:
    scanner = runpy.run_path(str(SCANNER), run_name="scanner_contract")
    is_emoji_prefix = scanner["is_emoji_prefix"]
    ranges = scanner["EMOJI_RANGES"]

    for start, end in ranges:
        for codepoint in range(start, end + 1):
            assert is_emoji_prefix(chr(codepoint)) is True
    for base in "#*" + string.digits:
        assert is_emoji_prefix(f"{base}\ufe0f\u20e3") is True


def test_non_emoji_unicode_symbols_are_rejected_programmatically() -> None:
    scanner = runpy.run_path(str(SCANNER), run_name="scanner_contract")
    is_emoji_prefix = scanner["is_emoji_prefix"]

    for character in "⌘あ♙☇":
        assert is_emoji_prefix(character) is False


def test_every_bundled_heading_has_a_programmatically_valid_emoji() -> None:
    scanner = runpy.run_path(str(SCANNER), run_name="scanner_contract")
    is_emoji_prefix = scanner["is_emoji_prefix"]

    prefixes = [
        heading.removeprefix("## ").split(maxsplit=1)[0]
        for heading in TEMPLATE_HEADINGS
    ]

    assert all(is_emoji_prefix(prefix) for prefix in prefixes)


def test_keycap_emoji_prefix_scans_as_a_complete_sequence(tmp_path: Path) -> None:
    template = tmp_path / "pull-request-template.md"
    heading = "## 1️⃣ Steps [ Optional ]"
    template.write_text(
        REPOSITORY_REQUIRED_TEMPLATE + f"{heading}\n\n{{{{steps}}}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        REPOSITORY_REQUIRED_BODY + f"{heading}\n\nDescribe the review sequence.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, template=template)

    assert completed.returncode == 0
    assert result["valid"] is True


def test_repository_template_optional_sections_may_be_empty(tmp_path: Path) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "<!-- keep this comment -->\n"
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_TEMPLATE
        + "## 📝 Optional Notes [ Optional ]\n\n{{notes}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "<!-- keep this comment -->\n"
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_BODY
        + "## 📝 Optional Notes [ Optional ]\n\nNone.\n\n"
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
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_TEMPLATE
        + "## 📝 Optional Notes [ Optional ]\n\n{{optional_notes}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "<!-- keep this comment -->\n"
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_BODY
        + "## 📝 Optional Notes [ Optional ]\n\n{{optional_notes}}\n\n"
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
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_TEMPLATE
        + "## ⚠️ Risk [ Optional ]\n\n{{risk}}\n\n"
        "## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_BODY
        + "## ⚠️ Risk [ Optional ]\n\n{{risk}}\n\n"
        "## 🧭 Test Plan [ Optional ]\n\nSpecific test plan.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, zone="yellow", template=template)

    assert completed.returncode == 1
    assert any(
        "missing specific evidence: ## ⚠️ Risk [ Optional ]" in item["message"]
        for item in result["violations"]
    )


def test_repository_template_formatted_placeholder_cannot_supply_summary(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "## 📌 Summary\n\n**Summary:** {{summary}}\n\n"
        "## 🎯 Goal\n\n{{goal}}\n\n"
        "## ✅ Requirements\n\n{{requirements}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "## 📌 Summary\n\n**Summary:** {{summary}}\n\n"
        "## 🎯 Goal\n\nMake intent explicit.\n\n"
        "## ✅ Requirements\n\n- Readers can identify observable behavior.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, template=template)

    assert completed.returncode == 1
    assert any(
        "missing specific evidence: ## 📌 Summary" in item["message"]
        for item in result["violations"]
    )


def test_repository_template_summary_section_supplies_summary_evidence(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "## 📌 Summary\n\n{{summary}}\n\n"
        + REPOSITORY_REQUIRED_TEMPLATE
        + "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "## 📌 Summary\n\nDescribe the selected repository contract.\n\n"
        + REPOSITORY_REQUIRED_BODY
        + "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, template=template)

    assert completed.returncode == 0
    assert result["valid"] is True


def test_optional_summary_section_falls_back_to_preamble(tmp_path: Path) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "Repository PR\n\n{{summary}}\n\n"
        "## 📌 Summary [ Optional ]\n\n{{section_summary}}\n\n"
        + REPOSITORY_REQUIRED_TEMPLATE
        + "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\nConcrete preamble summary.\n\n"
        + REPOSITORY_REQUIRED_BODY
        + "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, template=template)

    assert completed.returncode == 0
    assert result["valid"] is True


def test_preserved_placeholder_cannot_mask_process_only_requirements(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "Repository PR\n\n{{summary}}\n\n"
        "## 🎯 Goal\n\n{{goal}}\n\n"
        "## ✅ Requirements\n\n{{requirements}}\n\nAll unit tests must pass.\n\n"
        "## 🧵 Context\n\n{{context}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\nConcrete summary.\n\n"
        "## 🎯 Goal\n\nKeep the repository contract explicit.\n\n"
        "## ✅ Requirements\n\n{{requirements}}\n\nAll unit tests must pass.\n\n"
        "## 🧵 Context\n\nAuthors need deterministic evidence.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, template=template)

    assert completed.returncode == 1
    assert any(
        "generic process gates" in item["message"] for item in result["violations"]
    )


def test_repository_template_formatted_placeholder_cannot_supply_risk(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_TEMPLATE
        + "## ⚠️ Risk [ Optional ]\n\n- {{risk}}\n\n"
        "## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_BODY
        + "## ⚠️ Risk [ Optional ]\n\n- {{risk}}\n\n"
        "## 🧭 Test Plan [ Optional ]\n\nSpecific test plan.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, zone="yellow", template=template)

    assert completed.returncode == 1
    assert any(
        "missing specific evidence: ## ⚠️ Risk [ Optional ]" in item["message"]
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
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_TEMPLATE
        + f"## ⚠️ Risk [ Optional ]\n\n{risk_evidence}\n\n"
        "## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_BODY
        + f"## ⚠️ Risk [ Optional ]\n\n{risk_evidence}\n\n"
        "## 🧭 Test Plan [ Optional ]\n\nSpecific test plan.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
    )

    completed, result = run_scanner(tmp_path, body, zone="yellow", template=template)

    assert completed.returncode == 1
    assert any(
        "missing specific evidence: ## ⚠️ Risk [ Optional ]" in item["message"]
        for item in result["violations"]
    )


def test_repository_template_placeholder_with_specific_prose_is_evidence(
    tmp_path: Path,
) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_TEMPLATE
        + "## ⚠️ Risk [ Optional ]\n\n{{risk}}\n\n"
        "## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n"
        "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_BODY
        + "## ⚠️ Risk [ Optional ]\n\n{{risk}} remains until the downstream cache expires.\n\n"
        "## 🧭 Test Plan [ Optional ]\n\nExercise the cache boundary.\n\n"
        "## 🧪 Verification\n\n- [x] Run the scanner.\n"
        "- [ ] Reviewer slot 1 assigned\n"
        f"- [ ] Reviewer slot 1 reviewed `{HEAD_OID}` against `{BASE_OID}`\n"
        f"- [ ] Reviewer slot 1 approved `{HEAD_OID}` against `{BASE_OID}`\n"
    )

    completed, result = run_scanner(tmp_path, body, zone="yellow", template=template)

    assert completed.returncode == 0
    assert result["valid"] is True


def test_repository_template_comments_must_remain_verbatim(tmp_path: Path) -> None:
    template = tmp_path / "pull-request-template.md"
    template.write_text(
        "<!-- repository guidance -->\n"
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_TEMPLATE
        + "## 🧪 Verification\n\n{{verification}}\n",
        encoding="utf-8",
    )
    body = (
        "Repository PR\n\n"
        + REPOSITORY_REQUIRED_BODY
        + "## 🧪 Verification\n\n- [x] Run the scanner.\n"
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
                "## 🛠️ Implementation",
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
    assert any(
        "missing specific evidence: ## ⚠️ Risk" in item["message"]
        for item in result["violations"]
    )


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
                "## 🛠️ Implementation",
                "```markdown\n## Example heading\n```",
            ),
            verification(),
        ),
    )

    assert completed.returncode == 0
    assert result["valid"] is True
