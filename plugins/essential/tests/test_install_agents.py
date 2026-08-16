import json
import os
import shutil
import subprocess
import sys
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

import pytest
import tomllib

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "plugins/essential/skills/install-agents/scripts"
sys.path.insert(0, str(SCRIPTS))

import install_agents as install_agents_module
import stitch_agent as stitch_agent_module
from install_agents import discover_agent_templates, install_agents
from stitch_agent import (
    DESCRIPTION_LIMIT,
    INTELLIGENCE_LEVELS,
    PREFERRED_NAMES,
    AgentSources,
    AgentTemplateError,
    stitch_agent_definition,
    stitch_codex_agent_definition,
    validate_agent_contract,
)


def memory_section(name: str) -> str:
    return (
        f"\n## Memory\n\nI retain durable repository knowledge in "
        f"`.claude/agent-memory/{name}/MEMORY.md`. I follow "
        "`essential:templates/memory.md`. Current facts, reusable "
        "lessons, and watchpoints carry evidence and a last-verified date. "
        "Sources override memory; I replace contradictions "
        "and archive old claims before 150 lines or 20KB. I move detail only "
        "to `topics/<stable-area>/<specific-subject>.md`.\n"
    )


def write_template(
    plugin_root: Path,
    name: str,
    *,
    frontmatter: dict[str, object],
    body: str = "# Body\n",
) -> Path:
    template = plugin_root / "agents" / name
    (template / "frontmatter").mkdir(parents=True)
    frontmatter.setdefault(
        "description",
        "A test role. Preferably named Ava, Kit, or June when the main agent spawns this role.",
    )
    frontmatter.setdefault("intelligence", "inherit")
    frontmatter.setdefault("memory", "project")
    metadata = {
        field: frontmatter.pop(field)
        for field in ("name", "description", "intelligence")
        if field in frontmatter
    }
    (template / "frontmatter/meta.json").write_text(
        json.dumps(metadata), encoding="utf-8"
    )
    (template / "frontmatter/claude.json").write_text(
        json.dumps(frontmatter), encoding="utf-8"
    )
    (template / "frontmatter/codex.json").write_text("{}", encoding="utf-8")
    if "## Memory" not in body:
        body += memory_section(name)
    (template / "base.md").write_text(body, encoding="utf-8")
    return template


def write_legacy_template(
    plugin_root: Path,
    name: str,
    *,
    schema: str,
    intelligence: str = "high",
) -> Path:
    template = write_template(
        plugin_root,
        name,
        frontmatter={"name": name, "intelligence": intelligence},
    )
    metadata = json.loads(
        (template / "frontmatter/meta.json").read_text(encoding="utf-8")
    )
    claude = json.loads(
        (template / "frontmatter/claude.json").read_text(encoding="utf-8")
    )
    legacy = {
        "name": metadata["name"],
        "description": metadata["description"],
    }
    if schema == "intelligenceLevel":
        legacy["intelligenceLevel"] = intelligence
    elif schema == "model-effort":
        legacy.update(INTELLIGENCE_LEVELS[intelligence]["claude"])
    else:
        raise AssertionError(f"unsupported test schema: {schema}")
    legacy.update(claude)
    (template / "frontmatter/claude.json").write_text(
        json.dumps(legacy), encoding="utf-8"
    )
    (template / "frontmatter/meta.json").unlink()
    (template / "frontmatter/codex.json").unlink()
    return template


def sources_from_combined(
    frontmatter: dict[str, object],
    codex: dict[str, object] | None = None,
) -> AgentSources:
    combined = dict(frontmatter)
    metadata = {
        "name": combined.pop("name"),
        "description": combined.pop(
            "description",
            "A test role. Preferably named Ava, Kit, or June when the main agent spawns this role.",
        ),
        "intelligence": combined.pop("intelligence", "inherit"),
    }
    return AgentSources(metadata=metadata, claude=combined, codex=codex or {})


# stitch_agent_definition and validate_agent_contract


def test_stitches_nested_json_lists_and_multiline_strings_deterministically(
    tmp_path: Path,
) -> None:
    template = write_template(
        tmp_path,
        "test-agent",
        frontmatter={
            "name": "test-agent",
            "description": "first line\nsecond line. Preferably named Ava, Kit, or June when the main agent spawns this role.",
            "emptyObject": {},
            "emptyList": [],
        },
        body="\n\n# Test agent\n",
    )

    stitched = stitch_agent_definition(template)

    frontmatter_text = stitched.split("---\n", 2)[1]
    source = json.loads((template / "frontmatter/claude.json").read_text())
    rendered = json.loads(frontmatter_text)
    assert "intelligence" not in rendered
    assert "intelligenceLevel" not in rendered
    assert rendered["model"] == "inherit"
    assert rendered["emptyObject"] == source["emptyObject"]
    assert rendered["emptyList"] == source["emptyList"]
    assert "---\n\n# Test agent\n\nIntelligence level: inherit; resolve the effective harness level before accepting a skill.\n" in stitched
    assert stitched == stitch_agent_definition(template)


def test_stitches_native_codex_agent_toml_from_the_same_template(
    tmp_path: Path,
) -> None:
    template = write_template(
        tmp_path,
        "test-agent",
        frontmatter={
            "name": "test-agent",
            "description": "A test role. Preferably named Ava, Kit, or June when the main agent spawns this role.",
        },
        body="# Test agent\n\nCodex instructions.\n",
    )

    definition = stitch_codex_agent_definition(template)
    parsed = tomllib.loads(definition)

    assert parsed == {
        "name": "test-agent",
        "description": "A test role. Preferably named Ava, Kit, or June when the main agent spawns this role.",
        "nickname_candidates": ["Ava", "Kit", "June"],
        "developer_instructions": (
            "# Test agent\n\n"
            "Intelligence level: inherit; resolve the effective harness level "
            "before accepting a skill.\n\n"
            "Codex instructions.\n"
        ),
    }
    assert definition == stitch_codex_agent_definition(template)


def test_codex_projection_preserves_plugin_namespaces(
    tmp_path: Path,
) -> None:
    description = (
        "Writes code with coding:write-code. "
        "Preferably named Ava, Kit, or June when the main agent spawns this role."
    )
    body = (
        "# Test agent\n\n"
        "Use `coding:write-code` and standards at "
        "`coding:standards/function/`.\n"
    )
    template = write_template(
        tmp_path,
        "test-agent",
        frontmatter={"name": "test-agent", "description": description},
        body=body,
    )

    claude = stitch_agent_definition(template)
    codex = tomllib.loads(stitch_codex_agent_definition(template))

    assert json.loads(claude.split("---\n", 2)[1])["description"] == description
    assert "Intelligence level: inherit;" in claude
    assert codex["description"] == description
    assert "Intelligence level: inherit;" in codex["developer_instructions"]


@pytest.mark.parametrize("harness", ("claude", "codex"))
def test_standalone_stitch_requires_or_derives_essential_root(
    tmp_path: Path,
    harness: str,
) -> None:
    template = write_template(
        tmp_path / "external",
        "lead-agent",
        frontmatter={"name": "lead-agent"},
        body=("# Lead agent\n\n@essential:references/directions/lead-agent.md\n"),
    )
    stitch = (
        stitch_agent_definition
        if harness == "claude"
        else stitch_codex_agent_definition
    )
    with pytest.raises(AgentTemplateError, match="--essential-root"):
        stitch(template)

    essential = tmp_path / "essential"
    direction = essential / "references/directions/lead-agent.md"
    direction.parent.mkdir(parents=True)
    direction.write_text("# Shared lead direction\n", encoding="utf-8")
    direct = stitch(template, essential_root=essential)
    assert f"@{direction.resolve()}" in direct
    assert "@essential:" not in direct
    command = [
        sys.executable,
        str(SCRIPTS / "stitch_agent.py"),
        str(template),
        "--harness",
        harness,
    ]
    resolved = subprocess.run(
        [*command, "--essential-root", str(essential)],
        text=True,
        capture_output=True,
        check=False,
    )

    assert resolved.returncode == 0, resolved.stderr
    assert f"@{direction.resolve()}" in resolved.stdout
    assert "@essential:" not in resolved.stdout


@pytest.mark.parametrize("harness", ("claude", "codex"))
def test_standalone_stitch_derives_source_checkout_essential_root(
    tmp_path: Path,
    harness: str,
) -> None:
    output = tmp_path / ("tech-lead.md" if harness == "claude" else "tech-lead.toml")
    completed = subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "stitch_agent.py"),
            str(ROOT / "plugins/coding/agents/tech-lead"),
            "--harness",
            harness,
            "--output",
            str(output),
        ],
        text=True,
        capture_output=True,
        check=False,
    )

    assert completed.returncode == 0, completed.stderr
    installed = output.read_text(encoding="utf-8")
    assert (
        f"@{(ROOT / 'plugins/essential/references/directions/lead-agent.md').resolve()}"
        in installed
    )
    assert "@essential:" not in installed


@pytest.mark.parametrize("harness", ("claude", "codex"))
def test_standalone_stitch_derives_installed_cache_essential_root(
    tmp_path: Path,
    harness: str,
) -> None:
    essential = tmp_path / "cache/alvis/essential/1.0.0"
    shutil.copytree(
        ROOT / "plugins/essential/skills/install-agents",
        essential / "skills/install-agents",
    )
    direction = essential / "references/directions/lead-agent.md"
    direction.parent.mkdir(parents=True)
    direction.write_text("# Shared lead direction\n", encoding="utf-8")
    template = write_template(
        tmp_path / "cache/alvis/coding/1.0.0",
        "tech-lead",
        frontmatter={"name": "tech-lead"},
        body=("# Tech lead\n\n@essential:references/directions/lead-agent.md\n"),
    )
    stitch = (
        stitch_agent_definition
        if harness == "claude"
        else stitch_codex_agent_definition
    )

    direct = stitch(template)

    assert f"@{direction.resolve()}" in direct
    assert "@essential:" not in direct

    completed = subprocess.run(
        [
            sys.executable,
            str(essential / "skills/install-agents/scripts/stitch_agent.py"),
            str(template),
            "--harness",
            harness,
        ],
        text=True,
        capture_output=True,
        check=False,
    )

    assert completed.returncode == 0, completed.stderr
    assert f"@{direction.resolve()}" in completed.stdout
    assert "@essential:" not in completed.stdout


@pytest.mark.parametrize("intelligence_level", INTELLIGENCE_LEVELS)
def test_projects_intelligence_level_to_both_harnesses(
    tmp_path: Path,
    intelligence_level: str,
) -> None:
    template = write_template(
        tmp_path,
        "test-agent",
        frontmatter={
            "name": "test-agent",
            "intelligence": intelligence_level,
        },
    )

    claude_definition = stitch_agent_definition(template)
    codex_definition = stitch_codex_agent_definition(template)
    claude = json.loads(claude_definition.split("---\n", 2)[1])
    codex = tomllib.loads(codex_definition)

    for field, value in INTELLIGENCE_LEVELS[intelligence_level]["claude"].items():
        assert claude[field] == value
    for field, value in INTELLIGENCE_LEVELS[intelligence_level]["codex"].items():
        assert codex[field] == value
    for rendered in (claude, codex):
        assert "intelligence" not in rendered
        assert "intelligenceLevel" not in rendered
    if not INTELLIGENCE_LEVELS[intelligence_level]["codex"]:
        assert "model" not in codex
        assert "model_reasoning_effort" not in codex

    expected_line = (
        "Intelligence level: inherit; resolve the effective harness level "
        "before accepting a skill."
        if intelligence_level == "inherit"
        else f"Intelligence level: {intelligence_level}."
    )
    for definition in (claude_definition, codex["developer_instructions"]):
        assert definition.count("Intelligence level:") == 1
        assert expected_line in definition


def test_intelligence_matrix_has_contiguous_ranks_unique_examples_and_native_projections() -> None:
    concrete = [
        projection
        for projection in INTELLIGENCE_LEVELS.values()
        if projection["rank"] is not None
    ]
    ranks = [projection["rank"] for projection in concrete]
    examples = [
        example
        for projection in INTELLIGENCE_LEVELS.values()
        for example in projection["best_for"]
    ]

    assert sorted(ranks) == list(range(len(ranks)))
    assert len(ranks) == len(set(ranks))
    assert all(projection["best_for"] for projection in INTELLIGENCE_LEVELS.values())
    assert len(examples) == len(set(examples))
    assert INTELLIGENCE_LEVELS["inherit"]["rank"] is None

    expected_projections = {
        "mechanical": ({"model": "haiku"}, {"model": "gpt-5.6-luna", "model_reasoning_effort": "low"}),
        "low": ({"model": "opus", "effort": "low"}, {"model": "gpt-5.6-luna", "model_reasoning_effort": "max"}),
        "medium": ({"model": "opus", "effort": "medium"}, {"model": "gpt-5.6-sol", "model_reasoning_effort": "medium"}),
        "high": ({"model": "opus", "effort": "high"}, {"model": "gpt-5.6-sol", "model_reasoning_effort": "high"}),
        "xhigh": ({"model": "opus", "effort": "xhigh"}, {"model": "gpt-5.6-sol", "model_reasoning_effort": "xhigh"}),
        "max": ({"model": "opus", "effort": "max"}, {"model": "gpt-5.6-sol", "model_reasoning_effort": "max"}),
        "inherit": ({"model": "inherit"}, {}),
    }
    assert {
        level: (projection["claude"], projection["codex"])
        for level, projection in INTELLIGENCE_LEVELS.items()
    } == expected_projections


@pytest.mark.parametrize(
    ("mutation", "message"),
    (
        (lambda matrix: matrix["low"].update(rank=0), "unique"),
        (lambda matrix: matrix["max"].update(rank=7), "contiguous"),
        (lambda matrix: matrix["low"].update(best_for=[]), "best_for"),
        (
            lambda matrix: matrix["low"].update(
                best_for=matrix["mechanical"]["best_for"]
            ),
            "unique",
        ),
        (lambda matrix: matrix["inherit"].update(rank=6), "inherit"),
        (
            lambda matrix: matrix["high"]["codex"].update(effort="high"),
            "codex projection",
        ),
    ),
)
def test_rejects_invalid_intelligence_matrix_schema(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    mutation: object,
    message: str,
) -> None:
    matrix = json.loads(
        (ROOT / "plugins/essential/skills/install-agents/references/intelligence-levels.json").read_text(
            encoding="utf-8"
        )
    )
    mutation(matrix)
    matrix_path = tmp_path / "intelligence-levels.json"
    matrix_path.write_text(json.dumps(matrix), encoding="utf-8")
    monkeypatch.setattr(stitch_agent_module, "INTELLIGENCE_LEVELS_PATH", matrix_path)

    with pytest.raises(AgentTemplateError, match=message):
        stitch_agent_module._load_intelligence_levels()


def test_codex_projection_removes_claude_only_agent_behavior(
    tmp_path: Path,
) -> None:
    body = (
        "# Test agent\n\nShared behavior.\n\n"
        "I work in my own worktree. I escalate user decisions, and Workflow "
        "launches to the Project Manager. Harness-neutral behavior remains.\n\n"
        "## Memory\n\n"
        "I use `.claude/agent-memory/test-agent/MEMORY.md` and follow "
        "`essential:templates/memory.md` with durable evidence, a "
        "last-verified date, an archive before 150 lines or 20KB, and "
        "`topics/<stable-area>/<specific-subject>.md`.\n\n"
        "## Delegation Modes\n\n"
        "- **Direct persistent delegation** — I delegate bounded work to a "
        "known teammate and reuse the warm agent.\n"
        "- **Dynamic Workflow delegation** — I use Dynamic Workflow for "
        "bounded work.\n\n"
        "Workflow-only follow-up.\n\n"
        "## Collaboration\n\n"
        "I collaborate with the runtime roster.\n"
    )
    startup = "Greet the user and wait for a task."
    template = write_template(
        tmp_path,
        "test-agent",
        frontmatter={
            "name": "test-agent",
            "intelligence": "medium",
            "initialPrompt": startup,
        },
        body=body,
    )

    claude = stitch_agent_definition(template)
    codex = tomllib.loads(stitch_codex_agent_definition(template))
    instructions = codex["developer_instructions"]

    assert "# Test agent\n\nIntelligence level: medium.\n\nShared behavior." in claude
    assert startup in claude
    assert "## Memory" not in instructions
    assert ".claude/agent-memory/" not in instructions
    assert "## Delegation Modes" in instructions
    assert "Direct persistent delegation" in instructions
    assert "reuse the warm agent" in instructions
    assert "Dynamic Workflow" not in instructions
    assert "Workflow-only follow-up" not in instructions
    assert "worktree" not in instructions
    assert "Workflow launches" not in instructions
    assert "I escalate user decisions to the Project Manager." in instructions
    assert "Harness-neutral behavior remains." in instructions
    assert startup not in instructions
    assert "## Collaboration" in instructions


def test_codex_projection_preserves_direct_only_delegation_modes(
    tmp_path: Path,
) -> None:
    body = (
        "# Test agent\n\nShared behavior.\n\n"
        "## Delegation Modes\n\n"
        "- **Direct persistent delegation** — Reuse a warm teammate.\n\n"
        "## Collaboration\n\n"
        "I collaborate with the runtime roster.\n"
    )
    template = write_template(
        tmp_path,
        "test-agent",
        frontmatter={"name": "test-agent"},
        body=body,
    )

    instructions = tomllib.loads(stitch_codex_agent_definition(template))[
        "developer_instructions"
    ]

    assert "## Delegation Modes" in instructions
    assert "Direct persistent delegation" in instructions
    assert "Reuse a warm teammate." in instructions


def test_rejects_missing_base_invalid_json_and_directory_name_mismatch(
    tmp_path: Path,
) -> None:
    missing = write_template(tmp_path, "missing", frontmatter={"name": "missing"})
    (missing / "base.md").unlink()
    with pytest.raises(AgentTemplateError, match="base.md"):
        stitch_agent_definition(missing)

    invalid = write_template(tmp_path, "invalid", frontmatter={"name": "invalid"})
    (invalid / "frontmatter/claude.json").write_text("{", encoding="utf-8")
    with pytest.raises(AgentTemplateError, match="invalid JSON"):
        stitch_agent_definition(invalid)

    mismatch = write_template(
        tmp_path, "directory-name", frontmatter={"name": "other-name"}
    )
    with pytest.raises(AgentTemplateError, match="does not match"):
        stitch_agent_definition(mismatch)

    nonstandard_number = write_template(
        tmp_path,
        "nonstandard-number",
        frontmatter={"name": "nonstandard-number"},
    )
    (nonstandard_number / "frontmatter/claude.json").write_text(
        '{"maxTurns":NaN}', encoding="utf-8"
    )
    with pytest.raises(AgentTemplateError, match="invalid JSON"):
        stitch_agent_definition(nonstandard_number)


@pytest.mark.parametrize("source_file", ("meta.json", "claude.json", "codex.json"))
def test_requires_every_split_frontmatter_source(
    tmp_path: Path, source_file: str
) -> None:
    template = write_template(
        tmp_path, "test-agent", frontmatter={"name": "test-agent"}
    )
    (template / "frontmatter" / source_file).unlink()

    with pytest.raises(AgentTemplateError, match=source_file):
        stitch_agent_definition(template)


def test_requires_three_distinct_preferred_short_names(tmp_path: Path) -> None:
    missing = write_template(
        tmp_path,
        "missing-preferences",
        frontmatter={
            "name": "missing-preferences",
            "description": "A role without names.",
        },
    )
    with pytest.raises(AgentTemplateError, match="three distinct"):
        stitch_agent_definition(missing)

    duplicate = write_template(
        tmp_path,
        "duplicate-preferences",
        frontmatter={
            "name": "duplicate-preferences",
            "description": "A role. Preferably named Ava, Ava, or June when the main agent spawns this role.",
        },
    )
    with pytest.raises(AgentTemplateError, match="three distinct"):
        stitch_agent_definition(duplicate)


@pytest.mark.parametrize(
    ("frontmatter", "body", "message"),
    (
        (
            {
                "name": "test-agent",
                "description": "x" * (DESCRIPTION_LIMIT + 1),
            },
            "A role-specific body.",
            f"description exceeds {DESCRIPTION_LIMIT} characters",
        ),
        (
            {"name": "test-agent", "intelligence": "impossible"},
            "A role-specific body.",
            "invalid intelligence 'impossible'",
        ),
        (
            {"name": "test-agent", "intelligence": ["high"]},
            "A role-specific body.",
            "invalid intelligence \\['high'\\]",
        ),
        (
            {
                "name": "test-agent",
                "intelligence": "inherit",
                "permissionMode": "yolo",
            },
            "A role-specific body.",
            "invalid permissionMode 'yolo'",
        ),
        (
            {
                "name": "test-agent",
                "intelligence": "inherit",
                "tools": ["Read"],
            },
            "A role-specific body.",
            "must omit tools",
        ),
        (
            {"name": "test-agent", "intelligence": "inherit"},
            "I only spawn fixed-reviewer.",
            "fixed routing language conflicts with runtime discovery",
        ),
        (
            {
                "name": "test-agent",
                "intelligence": "inherit",
                "description": "Always route reviews to fixed-reviewer",
                "initialPrompt": "Only spawn fixed-reviewer for review",
            },
            "A role-specific body.",
            "fixed routing language conflicts with runtime discovery",
        ),
    ),
    ids=lambda value: value if isinstance(value, str) else None,
)
def test_rejects_invalid_field_values_fixed_routing_and_tool_mismatches(
    frontmatter: dict[str, object], body: str, message: str
) -> None:
    with pytest.raises(AgentTemplateError, match=message):
        validate_agent_contract(sources_from_combined(frontmatter), body)


@pytest.mark.parametrize(
    ("source_file", "field"),
    (
        ("meta.json", "intelligenceLevel"),
        ("claude.json", "intelligence"),
        ("claude.json", "model"),
        ("codex.json", "intelligenceLevel"),
        ("codex.json", "model"),
        ("codex.json", "nickname_candidates"),
    ),
)
def test_rejects_metadata_and_harness_overlay_boundary_violations(
    tmp_path: Path, source_file: str, field: str
) -> None:
    template = write_template(
        tmp_path, "test-agent", frontmatter={"name": "test-agent"}
    )
    source_path = template / "frontmatter" / source_file
    source = json.loads(source_path.read_text(encoding="utf-8"))
    source[field] = "invalid"
    source_path.write_text(json.dumps(source), encoding="utf-8")

    with pytest.raises(AgentTemplateError, match="exactly|derived field"):
        stitch_agent_definition(template)


def test_rejects_codex_overlay_values_without_toml_scalar_syntax(
    tmp_path: Path,
) -> None:
    template = write_template(
        tmp_path, "test-agent", frontmatter={"name": "test-agent"}
    )
    (template / "frontmatter/codex.json").write_text(
        json.dumps({"native": {"mode": "strict"}}),
        encoding="utf-8",
    )

    with pytest.raises(AgentTemplateError, match="TOML scalar"):
        stitch_codex_agent_definition(template)


@pytest.mark.parametrize(
    "phrase",
    (
        "current `Agent` roster",
        "When I need a Dynamic Workflow",
        "For changed code, I inspect",
        "REVIEWED: source=",
        "I hold the `Agent` tool",
        "I hold `Agent`",
        "spawn target",
        "spawned by",
    ),
)
def test_rejects_shared_delegation_policy_in_agent_body(phrase: str) -> None:
    with pytest.raises(AgentTemplateError, match="repeats shared delegation policy"):
        validate_agent_contract(
            sources_from_combined({"name": "test-agent", "intelligence": "inherit"}),
            phrase,
        )


VALID_MEMORY_BODY = memory_section("test-agent")
VALID_MEMORY_FRONTMATTER = {
    "name": "test-agent",
    "intelligence": "inherit",
    "memory": "project",
}


@pytest.mark.parametrize(
    ("frontmatter", "body", "message"),
    (
        (
            {
                "name": "test-agent",
                "intelligence": "inherit",
                "memory": "local",
            },
            VALID_MEMORY_BODY,
            "project-scoped",
        ),
        (VALID_MEMORY_FRONTMATTER, "# No memory\n", "exactly one ## Memory"),
        (
            VALID_MEMORY_FRONTMATTER,
            VALID_MEMORY_BODY + VALID_MEMORY_BODY,
            "exactly one ## Memory",
        ),
        (
            VALID_MEMORY_FRONTMATTER,
            VALID_MEMORY_BODY.replace("test-agent", "other-agent"),
            "must name exact path",
        ),
        (
            VALID_MEMORY_FRONTMATTER,
            VALID_MEMORY_BODY.replace("last-verified", "checked"),
            "missing maintenance marker: last-verified",
        ),
        (
            VALID_MEMORY_FRONTMATTER,
            VALID_MEMORY_BODY.replace(
                "topics/<stable-area>/<specific-subject>.md",
                "topics/<slug>.md",
            ),
            "missing maintenance marker: topics/",
        ),
    ),
    ids=lambda value: value if isinstance(value, str) else None,
)
def test_requires_project_memory_path_section_and_maintenance_contract(
    frontmatter: dict[str, object], body: str, message: str
) -> None:
    with pytest.raises(AgentTemplateError, match=message):
        validate_agent_contract(sources_from_combined(frontmatter), body)


# agent discovery
# Payload byte budgets belong to the plugin that ships them; essential
# declares its own in plugins/essential/tests/test_contract_footprint.py.


def test_mainagent_requires_canonical_state_without_duplicating_state_policy() -> None:
    prompt = (ROOT / "plugins/essential/hooks/MAINAGENT.md").read_text(encoding="utf-8")

    assert (
        "Before working on any project, MUST read\n"
        "`{{PLUGIN_DIR}}/references/state.md`."
    ) in prompt
    assert (
        "Local state is the working memory and\n"
        "project-management record throughout the work lifecycle."
    ) in prompt
    for duplicated_policy in (
        "resolve-state-workspace",
        "coordinator lease",
        "16,384 bytes",
    ):
        assert duplicated_policy not in prompt


def test_allagent_enforces_intelligence_eligibility_and_complete_handoff() -> None:
    prompt = (ROOT / "plugins/essential/hooks/ALLAGENT.md").read_text(
        encoding="utf-8"
    )

    for required_contract in (
        "requirements.intelligence",
        "skills/install-agents/references/intelligence-levels.json",
        "visible agent rank meets the skill rank",
        "Missing\n`requirements.intelligence` means eligible",
        "transfer the complete task with its identity, evidence",
        "constraints, acceptance criteria, and unresolved decisions",
        "Ask the main agent\n"
        "to staff a qualified agent",
        "recipient repeats this check",
        "main session without a level",
        "unresolved cases are ineligible",
        "does not own or invoke the higher-level skill",
    ):
        assert required_contract in prompt


def test_role_hooks_expand_the_state_reference() -> None:
    essential = ROOT / "plugins/essential"
    hooks_document = json.loads(
        (essential / "hooks/hooks.json").read_text(encoding="utf-8")
    )
    expected = str(essential / "references/state.md")

    for event in ("SessionStart", "SubagentStart"):
        commands = [
            hook["command"]
            for group in hooks_document["hooks"][event]
            for hook in group["hooks"]
            if hook["type"] == "command" and '.md"' in hook["command"]
        ]
        assert len(commands) == 2
        for command in commands:
            env = os.environ.copy()
            env["CLAUDE_PLUGIN_ROOT"] = str(essential)
            completed = subprocess.run(
                ["bash", "-c", command],
                text=True,
                capture_output=True,
                check=False,
                env=env,
            )
            assert completed.returncode == 0, (event, command, completed.stderr)
            context = json.loads(completed.stdout)["hookSpecificOutput"][
                "additionalContext"
            ]
            assert "{{PLUGIN_DIR}}" not in context, (event, command)
            assert expected in context, (event, command)


def test_session_start_emits_a_valid_session_context_payload() -> None:
    essential = ROOT / "plugins/essential"
    completed = subprocess.run(
        [
            str(essential / "hooks/scripts/session-start"),
            "--plugin-dir",
            str(essential),
            "--constitution-paths",
            str(essential),
        ],
        input='{"source":"startup"}',
        text=True,
        capture_output=True,
        check=False,
    )

    assert completed.returncode == 0, completed.stderr
    payload = json.loads(completed.stdout)["hookSpecificOutput"]
    assert payload["hookEventName"] == "SessionStart"
    assert payload["additionalContext"].strip()


@pytest.mark.parametrize(
    ("outcome", "message"),
    (
        pytest.param(OSError("missing"), "cannot list installed plugins", id="oserror"),
        pytest.param(
            subprocess.CompletedProcess([], 1, stdout="", stderr="failed"),
            "cannot list installed plugins: failed",
            id="nonzero-exit",
        ),
        pytest.param(
            subprocess.CompletedProcess([], 0, stdout="{", stderr=""),
            "invalid JSON from claude plugin list",
            id="invalid-json",
        ),
        pytest.param(
            subprocess.CompletedProcess([], 0, stdout="{}", stderr=""),
            "did not return a list",
            id="not-a-list",
        ),
    ),
)
def test_installed_mode_reports_plugin_list_failures(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    outcome: object,
    message: str,
) -> None:
    essential = tmp_path / "cache/alvis/essential/1"
    essential.mkdir(parents=True)

    def fake_run(*args: object, **kwargs: object) -> object:
        if isinstance(outcome, OSError):
            raise outcome
        return outcome

    monkeypatch.setattr(install_agents_module.subprocess, "run", fake_run)
    with pytest.raises(AgentTemplateError, match=message):
        discover_agent_templates(essential)


def test_each_distributed_agent_has_an_owner_routing_row() -> None:
    templates = discover_agent_templates(ROOT / "plugins/essential")
    routing: dict[str, str] = {}
    for owner in {template.owner for template in templates}:
        # NOTE: essential keeps its roster table in orchestration.md; every
        # other plugin carries a standalone ROUTING.md.
        candidates = (
            ROOT / "plugins" / owner / "references/ROUTING.md",
            ROOT / "plugins" / owner / "references/orchestration.md",
        )
        table = next((path for path in candidates if path.is_file()), None)
        assert table is not None, f"{owner} has no routing document"
        routing[owner] = table.read_text(encoding="utf-8")

    for template in templates:
        assert f"`{template.name}` |" in routing[template.owner], template.name


def test_distributed_agents_satisfy_the_delegation_contract() -> None:
    templates = discover_agent_templates(ROOT / "plugins/essential")

    for template in templates:
        stitch_agent_definition(template.path)


def test_install_skill_derives_smoke_expectations_from_the_matrix() -> None:
    skill = (ROOT / "plugins/essential/skills/install-agents/SKILL.md").read_text(
        encoding="utf-8"
    )
    codex_models = {
        projection["codex"]["model"]
        for projection in INTELLIGENCE_LEVELS.values()
        if "model" in projection["codex"]
    }

    assert "match the matrix rows" in skill
    assert all(model not in skill for model in codex_models)


def test_install_skill_resolves_codex_script_from_its_loaded_resource() -> None:
    skill = (ROOT / "plugins/essential/skills/install-agents/SKILL.md").read_text(
        encoding="utf-8"
    )
    codex_instructions = skill.split("# Codex", 1)[1].split("```", 1)[0]

    assert "absolute directory containing this loaded SKILL.md" in codex_instructions
    assert "PLUGIN_ROOT" not in codex_instructions
    assert "CLAUDE_PLUGIN_ROOT" not in codex_instructions


def test_install_skill_verifies_the_configured_codex_home() -> None:
    skill = (ROOT / "plugins/essential/skills/install-agents/SKILL.md").read_text(
        encoding="utf-8"
    )

    assert '"${CODEX_HOME:-$HOME/.codex}/agents/tech-lead.toml"' in skill


def test_governance_heuristic_does_not_use_a_cross_plugin_relative_link() -> None:
    heuristic = (
        ROOT
        / "plugins/governance/skills/create-agent/references"
        / "intelligence-level-heuristic.md"
    ).read_text(encoding="utf-8")

    assert "../../../../essential/" not in heuristic
    assert "essential:install-agents" in heuristic


@pytest.mark.parametrize("skill_name", ("create-agent", "update-agent"))
def test_agent_authoring_skills_verify_both_harness_projections(
    skill_name: str,
) -> None:
    skill = (ROOT / f"plugins/governance/skills/{skill_name}/SKILL.md").read_text(
        encoding="utf-8"
    )

    assert "--harness claude" in skill
    assert "--harness codex" in skill


def test_every_distributed_agent_has_project_memory() -> None:
    templates = discover_agent_templates(ROOT / "plugins/essential")
    # parity against the on-disk template directories, not a hardcoded
    # count that breaks whenever an agent is added or removed
    on_disk = {
        path.name for path in (ROOT / "plugins").glob("*/agents/*") if path.is_dir()
    }
    assert templates
    assert on_disk == {template.name for template in templates}

    for template in templates:
        metadata = json.loads(
            (template.path / "frontmatter/meta.json").read_text(encoding="utf-8")
        )
        claude = json.loads(
            (template.path / "frontmatter/claude.json").read_text(encoding="utf-8")
        )
        codex = json.loads(
            (template.path / "frontmatter/codex.json").read_text(encoding="utf-8")
        )
        body = (template.path / "base.md").read_text(encoding="utf-8")
        assert set(metadata) == {"name", "description", "intelligence"}, template.name
        assert metadata["name"] == template.name
        assert metadata["intelligence"] in INTELLIGENCE_LEVELS
        assert "intelligenceLevel" not in metadata
        assert claude.get("memory") == "project", template.name
        assert "tools" not in claude, template.name
        assert codex == {}, template.name
        assert body.count("\n## Memory\n") == 1, template.name
        assert f".claude/agent-memory/{template.name}/MEMORY.md" in body
        assert "essential:templates/memory.md" in body, template.name
        assert "plugins/essential/" + "templates/memory.md" not in body, template.name
        assert "topics/<stable-area>/<specific-subject>.md" in body, template.name
        assert (
            "rather than task IDs, dates, counters, result counts, or conclusions"
            in body
        ), template.name


def test_memory_template_is_essential_owned_bounded_and_covers_lifecycle_rules() -> (
    None
):
    path = ROOT / "plugins" / "essential" / "templates" / "memory.md"
    template = path.read_text(encoding="utf-8")

    assert not (
        ROOT / "plugins/governance/constitution/templates/agent-memory.md"
    ).exists()
    assert len(template.splitlines()) <= 150
    assert len(template.encode("utf-8")) <= 20 * 1024
    for heading in (
        "## Template Instructions — Remove After Initialization",
        "## Current Facts",
        "## Reusable Lessons",
        "## Watchpoints",
        "## Topic Index",
        "## Archive Index",
    ):
        assert heading in template
    assert "remove this entire" in template
    for marker in (
        "Evidence",
        "Last verified",
        "150 lines",
        "20KB",
        "topics/<stable-area>/<specific-subject>.md",
        "task IDs",
        "dates",
        "counters",
        "conclusion sentences",
        "never beside `MEMORY.md`",
    ):
        assert marker in template, marker


def test_memory_writers_add_no_new_write_hooks() -> None:
    templates = {
        template.name: template
        for template in discover_agent_templates(ROOT / "plugins/essential")
    }

    for name in ("security-champion", "test-runner", "workflow-optimizer"):
        frontmatter = json.loads(
            (templates[name].path / "frontmatter/claude.json").read_text(
                encoding="utf-8"
            )
        )
        assert "tools" not in frontmatter, name
        assert "Write" not in frontmatter.get("disallowedTools", []), name
        assert "Edit" not in frontmatter.get("disallowedTools", []), name
        assert "PreToolUse" not in frontmatter.get("hooks", {}), name


def test_distributed_collaboration_sections_are_point_form_only() -> None:
    templates = discover_agent_templates(ROOT / "plugins/essential")

    for template in templates:
        body = (template.path / "base.md").read_text(encoding="utf-8")
        collaboration = body.split("\n## Collaboration\n", 1)[1]
        lines = [line for line in collaboration.splitlines() if line.strip()]
        # a lead role wraps its delegation map in <IMPORTANT>; the tags
        # delimit the map without adding prose to it
        lines = [line for line in lines if line not in ("<IMPORTANT>", "</IMPORTANT>")]
        assert lines, template.name
        assert all(line.startswith("- ") for line in lines), (template.name, lines)
        assert all("): " not in line for line in lines), (template.name, lines)
        for line in (line for line in lines if line.startswith("- `")):
            assert "`: " in line, (template.name, line)
            assert "; " in line, (template.name, line)


def test_installed_mode_uses_only_enabled_plugins_from_essential_marketplace(
    tmp_path: Path,
) -> None:
    essential = tmp_path / "cache/alvis/essential/1"
    web = tmp_path / "cache/alvis/web/1"
    disabled = tmp_path / "cache/alvis/disabled/1"
    other = tmp_path / "cache/other/coding/1"
    for path in (essential, web, disabled, other):
        path.mkdir(parents=True)
    write_template(
        essential,
        "essential-agent",
        frontmatter={"name": "essential-agent"},
    )
    write_template(web, "web-agent", frontmatter={"name": "web-agent"})
    write_template(
        disabled,
        "disabled-agent",
        frontmatter={"name": "disabled-agent"},
    )
    write_template(other, "other-agent", frontmatter={"name": "other-agent"})
    records = [
        {"id": "essential@alvis", "enabled": True, "installPath": str(essential)},
        {"id": "web@alvis", "enabled": True, "installPath": str(web)},
        {"id": "disabled@alvis", "enabled": False, "installPath": str(disabled)},
        {"id": "coding@other", "enabled": True, "installPath": str(other)},
    ]

    templates = discover_agent_templates(essential, records)

    assert {f"{template.owner}:{template.name}" for template in templates} == {
        "essential:essential-agent",
        "web:web-agent",
    }


@pytest.mark.parametrize("harness", ("claude", "codex"))
def test_installed_mode_includes_explicitly_trusted_marketplace(
    tmp_path: Path,
    harness: str,
) -> None:
    essential = tmp_path / "cache/alvis/essential/1"
    external = tmp_path / "cache/external/analytics/1"
    for plugin_root in (essential, external):
        plugin_root.mkdir(parents=True)
    write_template(
        essential,
        "essential-agent",
        frontmatter={"name": "essential-agent"},
    )
    write_template(
        external,
        "analytics-agent",
        frontmatter={"name": "analytics-agent"},
    )
    records = [
        {
            "id": "essential@alvis",
            "enabled": True,
            "version": "1",
            "installPath": str(essential),
        },
        {
            "id": "analytics@external",
            "enabled": True,
            "version": "1",
            "installPath": str(external),
        },
    ]

    default_templates = discover_agent_templates(essential, records, harness)
    included_templates = discover_agent_templates(
        essential,
        records,
        harness,
        include_marketplaces=("external",),
    )

    assert {template.name for template in default_templates} == {"essential-agent"}
    assert {template.name for template in included_templates} == {
        "analytics-agent",
        "essential-agent",
    }


def test_installed_mode_rejects_invalid_included_marketplace(tmp_path: Path) -> None:
    essential = tmp_path / "cache/alvis/essential/1"
    essential.mkdir(parents=True)
    records = [
        {"id": "essential@alvis", "enabled": True, "installPath": str(essential)}
    ]

    with pytest.raises(AgentTemplateError, match="invalid included marketplace"):
        discover_agent_templates(
            essential,
            records,
            include_marketplaces=("../external",),
        )


@pytest.mark.parametrize("harness", ("claude", "codex"))
def test_cross_marketplace_duplicate_requires_original_plugin_disabled(
    tmp_path: Path,
    harness: str,
) -> None:
    essential = tmp_path / "cache/alvis/essential/1"
    original_plugin = tmp_path / "cache/alvis/analytics/1"
    external_plugin = tmp_path / "cache/external/analytics/1"
    for plugin_root, agent_name in (
        (essential, "essential-agent"),
        (original_plugin, "analytics-agent"),
        (external_plugin, "analytics-agent"),
    ):
        plugin_root.mkdir(parents=True)
        write_template(
            plugin_root,
            agent_name,
            frontmatter={"name": agent_name},
        )
    records = [
        {
            "id": "essential@alvis",
            "enabled": True,
            "version": "1",
            "installPath": str(essential),
        },
        {
            "id": "analytics@alvis",
            "enabled": True,
            "version": "1",
            "installPath": str(original_plugin),
        },
        {
            "id": "analytics@external",
            "enabled": True,
            "version": "1",
            "installPath": str(external_plugin),
        },
    ]

    with pytest.raises(
        AgentTemplateError, match="duplicate agent name 'analytics-agent'"
    ):
        install_agents(
            essential,
            tmp_path / "collision",
            records,
            harness,
            include_marketplaces=("external",),
        )

    records[1]["enabled"] = False
    assert (
        install_agents(
            essential,
            tmp_path / "migrated",
            records,
            harness,
            include_marketplaces=("external",),
        )
        == 2
    )


@pytest.mark.parametrize(
    ("harness", "suffix"),
    (("claude", ".md"), ("codex", ".toml")),
)
def test_installed_lead_reference_survives_cache_cleanup_and_refreshes(
    tmp_path: Path,
    harness: str,
    suffix: str,
) -> None:
    essential_v1 = tmp_path / "cache/alvis/essential/1.0.0"
    essential_v2 = tmp_path / "cache/alvis/essential/2.0.0"
    coding = tmp_path / "cache/alvis/coding/1.0.0"
    destination = tmp_path / harness / "agents"
    direction_relative = Path("references/directions/lead-agent.md")
    direction_v1 = essential_v1 / direction_relative
    direction_v1.parent.mkdir(parents=True)
    direction_v1.write_text("first direction\n", encoding="utf-8")
    write_template(
        coding,
        "tech-lead",
        frontmatter={"name": "tech-lead"},
        body=("# Tech lead\n\n@essential:references/directions/lead-agent.md\n"),
    )
    records = [
        {
            "id": "essential@alvis",
            "enabled": True,
            "version": "1.0.0",
            "installPath": str(essential_v1),
        },
        {
            "id": "coding@alvis",
            "enabled": True,
            "version": "1.0.0",
            "installPath": str(coding),
        },
    ]

    install_agents(essential_v1, destination, records, harness=harness)

    stable_direction = destination / ".essential" / direction_relative
    installed_agent = destination / f"tech-lead{suffix}"
    assert f"@{stable_direction.resolve()}" in installed_agent.read_text(
        encoding="utf-8"
    )
    assert stable_direction.read_text(encoding="utf-8") == "first direction\n"

    shutil.rmtree(essential_v1)

    assert installed_agent.is_file()
    assert stable_direction.read_text(encoding="utf-8") == "first direction\n"

    direction_v2 = essential_v2 / direction_relative
    direction_v2.parent.mkdir(parents=True)
    direction_v2.write_text("second direction\n", encoding="utf-8")
    records[0]["installPath"] = str(essential_v2)
    records[0]["version"] = "2.0.0"
    install_agents(essential_v2, destination, records, harness=harness)

    assert f"@{stable_direction.resolve()}" in installed_agent.read_text(
        encoding="utf-8"
    )
    assert stable_direction.read_text(encoding="utf-8") == "second direction\n"


@pytest.mark.parametrize("schema", ("intelligenceLevel", "model-effort"))
@pytest.mark.parametrize("harness", ("claude", "codex"))
def test_installed_mode_translates_recognized_legacy_frontmatter(
    tmp_path: Path,
    schema: str,
    harness: str,
) -> None:
    essential = tmp_path / "cache/alvis/essential/2"
    web = tmp_path / "cache/alvis/web/1"
    for path in (essential, web):
        path.mkdir(parents=True)
    write_template(
        essential,
        "essential-agent",
        frontmatter={"name": "essential-agent"},
    )
    write_legacy_template(web, "legacy-agent", schema=schema)
    records = [
        {
            "id": "essential@alvis",
            "enabled": True,
            "version": "2",
            "installPath": str(essential),
        },
        {
            "id": "web@alvis",
            "enabled": True,
            "version": "1",
            "installPath": str(web),
        },
    ]
    destination = tmp_path / f"{harness}-agents"

    count = install_agents(
        essential,
        destination,
        records,
        harness=harness,
    )

    assert count == 2
    if harness == "claude":
        installed = json.loads(
            (destination / "legacy-agent.md")
            .read_text(encoding="utf-8")
            .split("---\n", 2)[1]
        )
    else:
        installed = tomllib.loads(
            (destination / "legacy-agent.toml").read_text(encoding="utf-8")
        )
    for field, value in INTELLIGENCE_LEVELS["high"][harness].items():
        assert installed[field] == value


def test_source_checkout_rejects_legacy_frontmatter(tmp_path: Path) -> None:
    essential = tmp_path / "repo/plugins/essential"
    write_legacy_template(
        essential,
        "legacy-agent",
        schema="model-effort",
    )

    with pytest.raises(AgentTemplateError, match="meta.json"):
        install_agents(essential, tmp_path / "agents")


def test_codex_installed_mode_resolves_versioned_cache_not_marketplace_source(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    version = "10.20.30+build.7"
    essential = tmp_path / f"cache/alvis/essential/{version}"
    coding = tmp_path / f"cache/alvis/coding/{version}"
    essential_source = tmp_path / "marketplace/plugins/essential"
    coding_source = tmp_path / "marketplace/plugins/coding"
    for path in (essential, coding, essential_source, coding_source):
        path.mkdir(parents=True)
    write_template(
        essential,
        "essential-agent",
        frontmatter={"name": "essential-agent"},
    )
    write_template(coding, "coding-agent", frontmatter={"name": "coding-agent"})
    write_template(
        essential_source,
        "source-essential-agent",
        frontmatter={"name": "source-essential-agent"},
    )
    write_template(
        coding_source,
        "source-coding-agent",
        frontmatter={"name": "source-coding-agent"},
    )
    payload = {
        "installed": [
            {
                "pluginId": "essential@alvis",
                "enabled": True,
                "version": version,
                "source": {"source": "local", "path": str(essential_source)},
            },
            {
                "pluginId": "coding@alvis",
                "enabled": True,
                "version": version,
                "source": {"source": "local", "path": str(coding_source)},
            },
        ],
        "available": [],
    }
    monkeypatch.setattr(
        install_agents_module.subprocess,
        "run",
        lambda *args, **kwargs: subprocess.CompletedProcess(
            [], 0, stdout=json.dumps(payload), stderr=""
        ),
    )

    templates = discover_agent_templates(essential, harness="codex")

    assert {f"{template.owner}:{template.name}" for template in templates} == {
        "essential:essential-agent",
        "coding:coding-agent",
    }


@pytest.mark.parametrize("version", ("..", "../outside"))
def test_codex_installed_mode_rejects_cache_path_components(
    tmp_path: Path,
    version: str,
) -> None:
    essential = tmp_path / "cache/alvis/essential/1.0.0"
    essential.mkdir(parents=True)
    records = [
        {
            "id": "essential@alvis",
            "enabled": True,
            "version": version,
        }
    ]

    with pytest.raises(AgentTemplateError, match="cache coordinates"):
        discover_agent_templates(essential, records, harness="codex")


def test_installed_mode_keeps_only_latest_record_per_plugin_id(
    tmp_path: Path,
) -> None:
    essential = tmp_path / "cache/alvis/essential/2026-07-17"
    web_old = tmp_path / "cache/alvis/web/2026-07-16"
    web_new = tmp_path / "cache/alvis/web/2026-07-17"
    web_null = tmp_path / "cache/alvis/web/unknown"
    for path in (essential, web_old, web_new, web_null):
        path.mkdir(parents=True)
    write_template(
        essential,
        "essential-agent",
        frontmatter={"name": "essential-agent"},
    )
    write_template(web_old, "old-agent", frontmatter={"name": "old-agent"})
    write_template(web_new, "new-agent", frontmatter={"name": "new-agent"})
    write_template(web_null, "null-agent", frontmatter={"name": "null-agent"})
    records = [
        {
            "id": "essential@alvis",
            "enabled": True,
            "installPath": str(essential),
            "lastUpdated": "2026-07-17T00:00:00.000Z",
        },
        {
            "id": "web@alvis",
            "enabled": True,
            "installPath": str(web_old),
            "version": "9.9.9",
            "lastUpdated": "2026-07-16T00:00:00.000Z",
        },
        {
            "id": "web@alvis",
            "enabled": True,
            "installPath": str(web_new),
            "version": "1.0.0",
            "lastUpdated": "2026-07-17T00:00:00.000Z",
        },
        {
            "id": "web@alvis",
            "enabled": True,
            "installPath": str(web_null),
            "version": "8.8.8",
            "lastUpdated": None,
        },
    ]

    templates = discover_agent_templates(essential, records)

    assert {f"{template.owner}:{template.name}" for template in templates} == {
        "essential:essential-agent",
        "web:new-agent",
    }


def test_installed_mode_rejects_wrong_or_ambiguous_essential_identity(
    tmp_path: Path,
) -> None:
    essential = tmp_path / "cache/alvis/essential/1"
    essential.mkdir(parents=True)
    wrong_identity = [
        {"id": "other@alvis", "enabled": True, "installPath": str(essential)}
    ]
    with pytest.raises(AgentTemplateError, match="essential plugin"):
        discover_agent_templates(essential, wrong_identity)

    duplicate_identity = [
        {"id": "essential@alvis", "enabled": True, "installPath": str(essential)},
        {"id": "essential@alvis", "enabled": True, "installPath": str(essential)},
    ]
    with pytest.raises(AgentTemplateError, match="multiple essential"):
        discover_agent_templates(essential, duplicate_identity)


# install_agents


def test_template_symlink_cannot_escape_its_plugin(tmp_path: Path) -> None:
    essential = tmp_path / "repo/plugins/essential"
    templates = essential / "agents"
    templates.mkdir(parents=True)
    external = write_template(
        tmp_path / "external",
        "escaped-agent",
        frontmatter={"name": "escaped-agent"},
    )
    (templates / "escaped-agent").symlink_to(external, target_is_directory=True)

    with pytest.raises(AgentTemplateError, match="symlink"):
        install_agents(essential, tmp_path / "destination")


def test_existing_destination_symlink_is_replaced_not_followed(
    tmp_path: Path,
) -> None:
    essential = tmp_path / "repo/plugins/essential"
    destination = tmp_path / "destination"
    destination.mkdir()
    external = tmp_path / "external.md"
    external.write_text("do not overwrite", encoding="utf-8")
    target = destination / "current-agent.md"
    target.symlink_to(external)
    write_template(
        essential,
        "current-agent",
        frontmatter={"name": "current-agent"},
        body="# Current\n",
    )

    install_agents(essential, destination)

    assert not target.is_symlink()
    assert "# Current" in target.read_text(encoding="utf-8")
    assert external.read_text(encoding="utf-8") == "do not overwrite"


def test_shell_entrypoint_resolves_essential_plugin_root(tmp_path: Path) -> None:
    destination = tmp_path / "agents"
    expected_names = {
        f"{template.name}.md"
        for template in discover_agent_templates(ROOT / "plugins/essential")
    }
    completed = subprocess.run(
        [str(SCRIPTS / "install-agents.sh"), "--destination", str(destination)],
        text=True,
        capture_output=True,
        check=False,
    )

    assert completed.returncode == 0, completed.stderr
    assert {path.name for path in destination.glob("*.md")} == expected_names


def test_source_checkout_installs_every_discovered_agent(tmp_path: Path) -> None:
    with redirect_stdout(StringIO()):
        destination = tmp_path / "agents"
        expected_names = {
            f"{template.name}.md"
            for template in discover_agent_templates(ROOT / "plugins/essential")
        }

        count = install_agents(ROOT / "plugins/essential", destination)

    assert count == len(expected_names)
    assert {path.name for path in destination.glob("*.md")} == expected_names
    assert (destination / "frontend-implementer.md").is_file()
    for path in destination.glob("*.md"):
        agent = json.loads(path.read_text(encoding="utf-8").split("---\n", 2)[1])
        assert "intelligence" not in agent
        assert "intelligenceLevel" not in agent
    expected_direction = (
        f"@{destination.resolve()}/.essential/references/directions/lead-agent.md"
    )
    for name in ("tech-lead", "ai-research-lead", "design-lead"):
        installed = (destination / f"{name}.md").read_text(encoding="utf-8")
        assert expected_direction in installed
        assert "@essential:" not in installed


def test_source_checkout_installs_native_codex_agents(tmp_path: Path) -> None:
    with redirect_stdout(StringIO()):
        destination = tmp_path / "agents"
        expected_names = {
            f"{template.name}.toml"
            for template in discover_agent_templates(ROOT / "plugins/essential")
        }

        count = install_agents(
            ROOT / "plugins/essential",
            destination,
            harness="codex",
        )

    assert count == len(expected_names)
    assert {path.name for path in destination.glob("*.toml")} == expected_names
    tech_lead = tomllib.loads(
        (destination / "tech-lead.toml").read_text(encoding="utf-8")
    )
    assert tech_lead["name"] == "tech-lead"
    assert tech_lead["description"]
    for field, value in INTELLIGENCE_LEVELS["high"]["codex"].items():
        assert tech_lead[field] == value
    assert tech_lead["developer_instructions"].startswith("# Tech Lead")
    assert ".claude/agent-memory/" not in tech_lead["developer_instructions"]
    assert "Dynamic Workflow" not in tech_lead["developer_instructions"]
    expected_direction = (
        f"@{destination.resolve()}/.essential/references/directions/lead-agent.md"
    )
    for name in ("tech-lead", "ai-research-lead", "design-lead"):
        installed = tomllib.loads(
            (destination / f"{name}.toml").read_text(encoding="utf-8")
        )["developer_instructions"]
        assert expected_direction in installed
        assert "@essential:" not in installed
    test_runner = tomllib.loads(
        (destination / "test-runner.toml").read_text(encoding="utf-8")
    )
    for field, value in INTELLIGENCE_LEVELS["mechanical"]["codex"].items():
        assert test_runner[field] == value
    red_team = tomllib.loads(
        (destination / "adversarial-red-team.toml").read_text(encoding="utf-8")
    )
    red_team_contract = (
        red_team["description"] + "\n" + red_team["developer_instructions"]
    ).lower()
    for unsupported_claim in (
        "isolated worktree",
        "nothing i build there ships",
        "nothing you break can touch",
    ):
        assert unsupported_claim not in red_team_contract

    templates_by_file = {
        f"{template.name}.toml": template
        for template in discover_agent_templates(ROOT / "plugins/essential")
    }
    for path in destination.glob("*.toml"):
        agent = tomllib.loads(path.read_text(encoding="utf-8"))
        source_template = templates_by_file[path.name]
        metadata = json.loads(
            (source_template.path / "frontmatter/meta.json").read_text(encoding="utf-8")
        )
        expected_projection = INTELLIGENCE_LEVELS[metadata["intelligence"]]["codex"]
        preferred_names = PREFERRED_NAMES.search(metadata["description"])
        assert preferred_names is not None
        assert agent["nickname_candidates"] == list(preferred_names.groups())
        codex_contract = agent["description"] + "\n" + agent["developer_instructions"]
        assert "worktree" not in codex_contract.replace(expected_direction, "")
        assert "Workflow launches" not in codex_contract
        for field in ("model", "model_reasoning_effort"):
            if field in expected_projection:
                assert agent[field] == expected_projection[field]
            else:
                assert field not in agent
        assert "color" not in agent
        assert "permissionMode" not in agent
        assert "memory" not in agent
        assert "maxTurns" not in agent
        assert "initialPrompt" not in agent
        assert "hooks" not in agent
        assert "intelligence" not in agent
        assert "intelligenceLevel" not in agent


def test_duplicate_names_fail_before_any_destination_write(tmp_path: Path) -> None:
    essential = tmp_path / "repo/plugins/essential"
    web = tmp_path / "repo/plugins/web"
    destination = tmp_path / "home/.claude/agents"
    destination.mkdir(parents=True)
    existing = destination / "duplicate.md"
    existing.write_text("original", encoding="utf-8")
    write_template(
        essential,
        "duplicate",
        frontmatter={"name": "duplicate"},
        body="# Essential\n\nessential",
    )
    write_template(
        web,
        "duplicate",
        frontmatter={"name": "duplicate"},
        body="# Web\n\nweb",
    )

    with pytest.raises(AgentTemplateError, match="duplicate"):
        install_agents(essential, destination)

    assert existing.read_text(encoding="utf-8") == "original"
    assert list(destination.iterdir()) == [existing]


def test_rerun_overwrites_discovered_agents_without_pruning_other_files(
    tmp_path: Path,
) -> None:
    essential = tmp_path / "repo/plugins/essential"
    destination = tmp_path / "home/.claude/agents"
    destination.mkdir(parents=True)
    unrelated = destination / "personal-agent.md"
    stale = destination / "formerly-managed.md"
    unrelated.write_text("personal", encoding="utf-8")
    stale.write_text("stale", encoding="utf-8")
    template = write_template(
        essential,
        "current-agent",
        frontmatter={"name": "current-agent"},
        body="# Version one\n",
    )

    assert install_agents(essential, destination) == 1
    (template / "base.md").write_text(
        (template / "base.md")
        .read_text(encoding="utf-8")
        .replace("# Version one", "# Version two"),
        encoding="utf-8",
    )
    assert install_agents(essential, destination) == 1

    assert "# Version two" in (destination / "current-agent.md").read_text(
        encoding="utf-8"
    )
    assert unrelated.read_text(encoding="utf-8") == "personal"
    assert stale.read_text(encoding="utf-8") == "stale"


@pytest.mark.parametrize(
    "template",
    sorted(path for path in (ROOT / "plugins").glob("*/agents/*") if path.is_dir()),
    ids=lambda path: f"{path.parents[1].name}:{path.name}",
)
def test_every_distributed_agent_template_stitches(template: Path) -> None:
    """The stitch gate itself, over the real tree — `uvx pytest` is the only command.

    Stitching validates the whole agent contract: description limit, name
    regex, intelligence-level mapping, absent tools, project memory, and the single
    Memory section. A template that cannot stitch cannot be installed.
    """
    assert stitch_agent_definition(template).strip()
