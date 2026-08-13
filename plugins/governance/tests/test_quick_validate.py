import importlib.util
from pathlib import Path

import pytest

MODULE_PATH = (
    Path(__file__).resolve().parent.parent
    / "skills/write-skill/scripts/quick_validate.py"
)
SPEC = importlib.util.spec_from_file_location("quick_validate", MODULE_PATH)
assert SPEC and SPEC.loader
quick_validate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(quick_validate)


class RecordingRun:
    """Stand-in for subprocess.run that records calls and replays outcomes."""

    def __init__(self, outcomes: list[object]) -> None:
        self.outcomes = list(outcomes)
        self.calls: list[tuple[object, ...]] = []

    def __call__(self, *args: object, **kwargs: object) -> object:
        self.calls.append(args)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


def write_skill(root: Path, name: str, description: str, body: str) -> Path:
    path = root / "skills" / name / "SKILL.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f'---\nname: {name}\ndescription: "{description}"\n---\n\n{body}\n',
        encoding="utf-8",
    )
    return path


def yaml_lines(*lines: str) -> str:
    return "\n".join(lines)


def collect_skill_policy_failures(skills: list[Path]) -> dict[str, object]:
    return {
        str(report["path"]): report["errors"]
        for report in (quick_validate.validate_policy(skill) for skill in skills)
        if report["errors"]
    }


def test_discovers_skills_from_plugins_directory(tmp_path: Path) -> None:
    first = write_skill(
        tmp_path / "plugins" / "one",
        "first",
        "Use when creating a focused reusable capability for a known workflow.",
        "# First\n\n## Workflow\n\nDo the work.",
    )
    second = write_skill(
        tmp_path / "plugins" / "two",
        "second",
        "Use when maintaining a focused reusable capability for an existing workflow.",
        "# Second\n\n## Workflow\n\nDo the work.",
    )

    assert quick_validate.discover_skills(tmp_path / "plugins") == [
        first.resolve(),
        second.resolve(),
    ]


def test_accepts_minimal_skill_without_ceremony(tmp_path: Path) -> None:
    skill = write_skill(
        tmp_path,
        "minimal",
        "Use when a concise reusable workflow needs clear boundaries and verification.",
        "# Minimal\n\n## Boundaries\n\nStay scoped.\n\n"
        "## Inputs\n\nA target.\n\n## Workflow\n\nPerform it.\n\n"
        "## Verification\n\nCheck the result.\n\n## Completion\n\nReport it.",
    )

    report = quick_validate.validate_policy(skill)

    assert report["errors"] == []
    messages = "\n".join(issue["message"] for issue in report["warnings"])
    assert "diagram" not in messages.lower()
    assert "subagent" not in messages.lower()
    assert "coherence mandate" not in messages.lower()


def test_reports_allowed_tools_failure_by_shared_skill_path(tmp_path: Path) -> None:
    skill = tmp_path / "skills" / "shared" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text(
        "---\n"
        "name: shared\n"
        'description: "Use when validating shared skill metadata across supported runtime harnesses."\n'
        "allowed-tools: Read, Write\n"
        "---\n\n"
        "# Shared\n\n## Workflow\n\nDo the work.\n",
        encoding="utf-8",
    )

    failures = collect_skill_policy_failures([skill])

    assert failures == {
        str(skill): [
            {
                "message": (
                    "Shared skills must not declare allowed-tools: Codex does not support "
                    "this field; shared skills inherit runtime capabilities."
                ),
                "line": 4,
            }
        ]
    }


@pytest.mark.parametrize(
    "allowed_tools_key",
    ("allowed-tools :", "'allowed-tools':", '"allowed-tools":'),
)
def test_rejects_yaml_variants_of_allowed_tools_in_shared_skill_frontmatter(
    tmp_path: Path, allowed_tools_key: str
) -> None:
    skill = tmp_path / "skills" / "shared" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text(
        "---\n"
        "name: shared\n"
        'description: "Use when validating shared skill metadata across supported runtime harnesses."\n'
        f"{allowed_tools_key} Read\n"
        "---\n\n"
        "# Shared\n\n## Workflow\n\nDo the work.\n",
        encoding="utf-8",
    )

    report = quick_validate.validate_policy(skill)

    assert report["errors"] == [
        {
            "message": (
                "Shared skills must not declare allowed-tools: Codex does not support "
                "this field; shared skills inherit runtime capabilities."
            ),
            "line": 4,
        }
    ]


@pytest.mark.parametrize(
    ("frontmatter", "expected_line"),
    (
        (
            yaml_lines(
                "name: shared",
                'description: "Use when validating shared skill metadata across supported runtime harnesses."',
                r'"allowed\u002dtools": Read',
            ),
            4,
        ),
        (
            yaml_lines(
                "name: shared",
                'description: "Use when validating shared skill metadata across supported runtime harnesses."',
                r'"allowed\x2dtools": Read',
            ),
            4,
        ),
        (
            yaml_lines(
                "name: shared",
                'description: "Use when validating shared skill metadata across supported runtime harnesses."',
                r'"allowed\U0000002dtools": Read',
            ),
            4,
        ),
        (
            "{name: shared, description: cross-harness metadata, allowed-tools: Read}",
            2,
        ),
        ('{"allowed-tools":Read}', 2),
        ("{? allowed-tools}", 2),
        ("{allowed-tools}", 2),
        (
            yaml_lines(
                "{name: shared,",
                " description: cross-harness metadata,",
                r' "allowed\u002dtools": Read}',
            ),
            4,
        ),
        (
            yaml_lines(
                "name: shared",
                'description: "Use when validating shared skill metadata across supported runtime harnesses."',
                "? allowed-tools",
                ": Read",
            ),
            4,
        ),
    ),
)
def test_rejects_semantic_allowed_tools_mapping_keys(
    tmp_path: Path,
    frontmatter: str,
    expected_line: int,
) -> None:
    skill = tmp_path / "skills" / "shared" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text(
        f"---\n{frontmatter}\n---\n\n# Shared\n\n## Workflow\n\nDo the work.\n",
        encoding="utf-8",
    )

    report = quick_validate.validate_policy(skill)

    assert report["errors"] == [
        {
            "message": (
                "Shared skills must not declare allowed-tools: Codex does not support "
                "this field; shared skills inherit runtime capabilities."
            ),
            "line": expected_line,
        }
    ]


@pytest.mark.parametrize(
    ("frontmatter", "expected_line"),
    (
        (
            yaml_lines(
                "name: &forbidden allowed-tools",
                "? *forbidden",
                ": Read",
            ),
            3,
        ),
        (yaml_lines("? |-", "  allowed-tools", ": Read"), 2),
        (yaml_lines('? "allowed-\\', '  tools"', ": Read"), 2),
        ("{name: &forbidden allowed-tools, ? *forbidden}", 2),
        (yaml_lines('{"allowed-\\', '  tools": Read}'), 2),
    ),
)
def test_rejects_unsupported_complex_root_mapping_keys(
    tmp_path: Path,
    frontmatter: str,
    expected_line: int,
) -> None:
    skill = tmp_path / "skills" / "shared" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text(
        f"---\n{frontmatter}\n---\n\n# Shared\n\n## Workflow\n\nDo the work.\n",
        encoding="utf-8",
    )

    report = quick_validate.validate_policy(skill)

    assert report["errors"] == [
        {
            "message": (
                "Shared skill frontmatter uses an unsupported complex root mapping "
                "key; use a plain or quoted scalar key."
            ),
            "line": expected_line,
        }
    ]


@pytest.mark.parametrize(
    ("frontmatter", "expected_line"),
    (
        ("!!map {allowed-tools: Read}", 2),
        ("&catalog {allowed-tools: Read}", 2),
        (
            yaml_lines(
                "  name: shared",
                "  allowed-tools: Read",
            ),
            2,
        ),
        (
            yaml_lines(
                "defaults: &defaults {allowed-tools: Read}",
                "<<: *defaults",
            ),
            3,
        ),
        (
            yaml_lines(
                "defaults: &defaults {allowed-tools: Read}",
                "!!merge inherited: *defaults",
            ),
            3,
        ),
        (
            yaml_lines(
                "defaults: &defaults {allowed-tools: Read}",
                "!<tag:yaml.org,2002:merge> inherited: *defaults",
            ),
            3,
        ),
        ("{defaults: &defaults {allowed-tools: Read}, <<: *defaults}", 2),
    ),
)
def test_rejects_unsupported_root_mapping_syntax(
    tmp_path: Path,
    frontmatter: str,
    expected_line: int,
) -> None:
    skill = tmp_path / "skills" / "shared" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text(
        f"---\n{frontmatter}\n---\n\n# Shared\n\n## Workflow\n\nDo the work.\n",
        encoding="utf-8",
    )

    report = quick_validate.validate_policy(skill)

    assert report["errors"] == [
        {
            "message": (
                "Shared skill frontmatter must use a plain, unwrapped root mapping "
                "without merge keys."
            ),
            "line": expected_line,
        }
    ]


@pytest.mark.parametrize(
    "frontmatter",
    (
        (
            yaml_lines(
                "name: shared",
                'description: "Use when validating nested skill metadata handling."',
                "metadata:",
                "  allowed-tools: Read",
            )
        ),
        (
            yaml_lines(
                "name: shared",
                'description: "Use when validating nested skill metadata handling."',
                "metadata: {allowed-tools: Read}",
            )
        ),
        "{name: shared, metadata: {allowed-tools: Read}}",
        "allowed-tools",
        "allowed-tools:not-a-mapping",
        "{allowed-tools:Read}",
    ),
)
def test_ignores_allowed_tools_outside_root_mapping_keys(
    tmp_path: Path,
    frontmatter: str,
) -> None:
    skill = tmp_path / "skills" / "shared" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text(
        f"---\n{frontmatter}\n---\n\n# Shared\n\n## Workflow\n\nDo the work.\n",
        encoding="utf-8",
    )

    report = quick_validate.validate_policy(skill)

    assert report["errors"] == []


def test_reports_placeholders_long_body_and_missing_local_reference(
    tmp_path: Path,
) -> None:
    skill = write_skill(
        tmp_path,
        "broken",
        "Use when checking a deliberately invalid repository policy fixture.",
        "# Broken\n\nSee [missing](references/missing.md).\n\n[TODO]\n"
        + "\n".join("line" for _ in range(501)),
    )

    report = quick_validate.validate_policy(skill)
    messages = "\n".join(issue["message"] for issue in report["errors"])

    assert "Unresolved local reference" in messages
    assert "Placeholder" in messages
    assert "500 lines" in messages


def test_local_link_policy_skips_examples_and_checks_real_files(
    tmp_path: Path,
) -> None:
    references = tmp_path / "skills" / "links" / "references"
    references.mkdir(parents=True)
    (references / "present.md").write_text("present", encoding="utf-8")
    skill = write_skill(
        tmp_path,
        "links",
        "Use when validating conservative local Markdown destination handling in skill policy checks.",
        "# Links\n\n"
        "Examples: [label](url), [label](…), and [section](#anchor).\n\n"
        "Read [present](references/present.md) and "
        "[missing](references/missing.md).",
    )

    report = quick_validate.validate_policy(skill)
    messages = [item["message"] for item in report["errors"]]

    assert messages == ["Unresolved local reference: references/missing.md"]


def test_portable_policy_rejects_existing_reference_outside_skill_root(
    tmp_path: Path,
) -> None:
    shared = tmp_path / "skills" / "shared.md"
    shared.parent.mkdir(parents=True)
    shared.write_text("shared", encoding="utf-8")
    skill = write_skill(
        tmp_path,
        "portable",
        "Use when validating that portable skills keep every required reference inside their root.",
        "# Portable\n\nRead [shared](../shared.md).",
    )

    assert quick_validate.validate_policy(skill)["errors"] == []

    report = quick_validate.validate_policy(skill, portable=True)

    assert [item["message"] for item in report["errors"]] == [
        "Reference escapes skill root in SKILL.md: ../shared.md"
    ]
    assert quick_validate.run(["--policy-only", "--portable", str(skill.parent)]) == 1


def test_portable_policy_rejects_angle_wrapped_reference_outside_skill_root(
    tmp_path: Path,
) -> None:
    shared = tmp_path / "skills" / "shared file.md"
    shared.parent.mkdir(parents=True)
    shared.write_text("shared", encoding="utf-8")
    skill = write_skill(
        tmp_path,
        "portable-angle",
        "Use when validating portable skills that use angle-wrapped Markdown destinations containing spaces.",
        "# Portable\n\nRead [shared](<../shared file.md>).",
    )

    report = quick_validate.validate_policy(skill, portable=True)

    assert [item["message"] for item in report["errors"]] == [
        "Reference escapes skill root in SKILL.md: <../shared file.md>"
    ]


def test_local_link_policy_skips_angle_wrapped_urls_and_placeholder_destinations(
    tmp_path: Path,
) -> None:
    skill = write_skill(
        tmp_path,
        "link-examples",
        "Use when validating external URLs and illustrative destinations in Markdown link examples.",
        "# Examples\n\n"
        "Browse [docs](<https://example.com/skill guide>) and "
        "replace [example]([path/to/file.md]).",
    )

    report = quick_validate.validate_policy(skill, portable=True)

    assert report["errors"] == []


def test_portable_policy_rejects_absolute_reference_without_suffix(
    tmp_path: Path,
) -> None:
    shared = tmp_path / "shared"
    shared.write_text("shared", encoding="utf-8")
    skill = write_skill(
        tmp_path,
        "portable",
        "Use when validating that absolute Markdown destinations cannot escape a portable skill root.",
        f"# Portable\n\nRead [shared]({shared}).",
    )

    report = quick_validate.validate_policy(skill, portable=True)

    assert [item["message"] for item in report["errors"]] == [
        f"Reference escapes skill root in SKILL.md: {shared}"
    ]


def test_portable_policy_checks_links_in_supporting_references(
    tmp_path: Path,
) -> None:
    skill = write_skill(
        tmp_path,
        "portable",
        "Use when validating root-relative links throughout a portable skill's supporting references.",
        "# Portable\n\nRead [guide](references/guide.md).",
    )
    guide = skill.parent / "references" / "guide.md"
    guide.parent.mkdir()
    guide.write_text("Read [missing](references/missing.md).", encoding="utf-8")

    report = quick_validate.validate_policy(skill, portable=True)

    assert [item["message"] for item in report["errors"]] == [
        "Unresolved local reference in references/guide.md: references/missing.md"
    ]


def test_portable_policy_checks_markdown_reference_definitions(
    tmp_path: Path,
) -> None:
    shared = tmp_path / "skills" / "shared.md"
    shared.parent.mkdir(parents=True)
    shared.write_text("shared", encoding="utf-8")
    shared_with_spaces = tmp_path / "skills" / "shared file.md"
    shared_with_spaces.write_text("shared", encoding="utf-8")
    skill = write_skill(
        tmp_path,
        "portable-definitions",
        "Use when validating portable handling of local, external, and illustrative Markdown reference definitions.",
        "# Portable\n\n"
        "Read the [guide][guide].\n\n"
        "[guide]: references/guide.md\n"
        "[shared]: ../shared.md\n"
        "[external]: https://example.com/shared.md\n"
        "[example]: [path/to/file.md]",
    )
    guide = skill.parent / "references" / "guide.md"
    guide.parent.mkdir()
    guide.write_text(
        "[shared]: <../shared file.md>\n"
        "[external]: https://example.com/shared.md\n"
        "[example]: [path/to/file.md]\n",
        encoding="utf-8",
    )

    report = quick_validate.validate_policy(skill, portable=True)

    assert [item["message"] for item in report["errors"]] == [
        "Reference escapes skill root in SKILL.md: ../shared.md",
        "Reference escapes skill root in references/guide.md: <../shared file.md>",
    ]


def test_marketplace_validation_uses_the_marketplace_root_once(
    tmp_path: Path,
) -> None:
    marketplace = tmp_path / ".claude-plugin" / "marketplace.json"
    marketplace.parent.mkdir()
    marketplace.write_text("{}", encoding="utf-8")
    for name in ("one", "two"):
        manifest = tmp_path / "plugins" / name / ".claude-plugin" / "plugin.json"
        manifest.parent.mkdir(parents=True)
        manifest.write_text("{}", encoding="utf-8")

    assert quick_validate.claude_targets(tmp_path) == [tmp_path.resolve()]


def test_cli_runs_official_validator_once_for_a_marketplace(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    marketplace = tmp_path / ".claude-plugin" / "marketplace.json"
    marketplace.parent.mkdir()
    marketplace.write_text("{}", encoding="utf-8")
    for name in ("one", "two"):
        plugin = tmp_path / "plugins" / name
        manifest = plugin / ".claude-plugin" / "plugin.json"
        manifest.parent.mkdir(parents=True)
        manifest.write_text("{}", encoding="utf-8")
        write_skill(
            plugin,
            name,
            "Use when testing official validation execution for every discovered plugin target.",
            f"# {name.title()}\n\n## Workflow\n\nValidate it.",
        )

    result = quick_validate.subprocess.CompletedProcess([], 0, "marketplace ok", "")
    subprocess_run = RecordingRun([result])
    monkeypatch.setattr(quick_validate.subprocess, "run", subprocess_run)

    exit_status = quick_validate.run([str(tmp_path)])

    assert exit_status == 0
    assert [call[0] for call in subprocess_run.calls] == [
        ["claude", "plugin", "validate", "--strict", str(tmp_path.resolve())],
    ]


def test_cli_validates_the_containing_plugin_for_a_skill_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    plugin = tmp_path / "plugin"
    manifest = plugin / ".claude-plugin" / "plugin.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text("{}", encoding="utf-8")
    skill = write_skill(
        plugin,
        "portable",
        "Use when testing containing-plugin resolution from a documented skill-directory target.",
        "# Portable\n\n## Workflow\n\nValidate it.",
    )
    result = quick_validate.subprocess.CompletedProcess([], 0, "plugin ok", "")
    subprocess_run = RecordingRun([result])
    monkeypatch.setattr(quick_validate.subprocess, "run", subprocess_run)

    exit_status = quick_validate.run([str(skill.parent)])

    assert exit_status == 0
    assert [call[0] for call in subprocess_run.calls] == [
        ["claude", "plugin", "validate", "--strict", str(plugin.resolve())],
    ]


def test_unavailable_claude_is_structured_and_other_targets_continue(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    targets = [Path("/plugin/one"), Path("/plugin/two")]
    completed = quick_validate.subprocess.CompletedProcess([], 0, "ok", "")
    subprocess_run = RecordingRun([FileNotFoundError("claude not found"), completed])
    monkeypatch.setattr(quick_validate.subprocess, "run", subprocess_run)

    status, results = quick_validate.run_claude_validation(targets)

    assert status == 1
    assert len(subprocess_run.calls) == 2
    assert results[0]["status"] == "fail"
    assert "Unable to launch Claude validator" in results[0]["output"]
    assert results[1]["status"] == "pass"


def test_timed_out_claude_is_structured_and_other_targets_continue(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    targets = [Path("/plugin/one"), Path("/plugin/two")]
    timed_out = quick_validate.subprocess.TimeoutExpired(["claude"], 30)
    completed = quick_validate.subprocess.CompletedProcess([], 0, "ok", "")
    subprocess_run = RecordingRun([timed_out, completed])
    monkeypatch.setattr(quick_validate.subprocess, "run", subprocess_run)

    status, results = quick_validate.run_claude_validation(targets)

    assert status == 1
    assert len(subprocess_run.calls) == 2
    assert results[0]["status"] == "fail"
    assert "timed out" in results[0]["output"]
    assert results[1]["status"] == "pass"


def test_this_repository_passes_the_skill_policy_gate() -> None:
    """The gate itself, over the real tree — `uvx pytest` is the only command.

    Warnings (description length) are deliberately not asserted on: they do not
    fail the gate, so promoting them here would make the suite stricter than
    the rule it enforces.
    """
    root = Path(__file__).resolve().parents[3]
    failures = collect_skill_policy_failures(quick_validate.discover_skills(root))

    assert failures == {}
