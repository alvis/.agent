"""The PreToolUse hooks deny payloads that violate their rules file's format."""

import json
import os
import subprocess
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
HOOKS = json.loads((PLUGIN / "hooks/hooks.json").read_text(encoding="utf-8"))

VALID_TAGS = (
    "Architectural",
    "Ideal",
    "Recommended",
    "Pragmatic",
    "Hotfix",
    "Workaround",
)

COMPLIANT_PLAN = """# Enforce the documented formats

## Goal

One verifiable outcome and the bar that proves it.

## Requirements

- An observable condition the outcome must satisfy.

## Boundary

Inside: the three hook scripts. Outside: content heuristics.

## Direction

Write each check as a bash script, then swap the command entries.

## Context

- **Current state** — nothing implemented yet.
"""

COMPLIANT_PROMPT = """checkout-refunds

Goal: Restore refund totals so the ledger reconciles to the cent.

Requirements:
- Every refund path reconciles against the ledger fixture.

Boundary:
- Do not touch the payment capture path.

Directions:
- The rounding helper is the likely culprit.

Context:
Path: /work/checkout-refunds

Recent work:
- Parser migration landed; consumer conversion remains — state/journal.md
"""


def command_for(matcher: str) -> str:
    entries = [
        entry for entry in HOOKS["hooks"]["PreToolUse"] if entry["matcher"] == matcher
    ]
    assert len(entries) == 1, matcher
    return entries[0]["hooks"][0]["command"]


# Claude sets CLAUDE_PLUGIN_ROOT; Codex sets PLUGIN_ROOT, which
# hooks.json already uses as its harness discriminator.
HARNESS_ROOT_VARIABLES = ("CLAUDE_PLUGIN_ROOT", "PLUGIN_ROOT")


def harness_env(variable: str) -> dict:
    env = {
        name: value
        for name, value in os.environ.items()
        if name not in HARNESS_ROOT_VARIABLES
    }
    env[variable] = str(PLUGIN)
    return env


def run_hook(
    matcher: str, tool_input: dict, variable: str = "CLAUDE_PLUGIN_ROOT"
) -> dict:
    env = harness_env(variable)
    completed = subprocess.run(
        ["bash", "-c", command_for(matcher)],
        input=json.dumps({"tool_input": tool_input}),
        text=True,
        capture_output=True,
        check=False,
        env=env,
    )
    assert completed.returncode == 0, completed.stderr
    return json.loads(completed.stdout)["hookSpecificOutput"]


def assert_allowed(output: dict) -> None:
    assert "permissionDecision" not in output
    assert output["additionalContext"]


def assert_denied(output: dict) -> str:
    assert output["permissionDecision"] == "deny"
    assert "additionalContext" not in output
    return output["permissionDecisionReason"]


QUESTIONS = "AskUserQuestion|request_user_input"
PLANS = "ExitPlanMode|update_plan"
DISPATCH = "Agent|spawn_agent"


def question(*options: dict) -> dict:
    return {
        "questions": [
            {
                "question": "Which route should we take?",
                "header": "Route",
                "options": list(options),
                "multiSelect": False,
            }
        ]
    }


PLUGIN_ANCHOR = "${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}"


def test_every_pretooluse_hook_runs_an_executable_validator_script() -> None:
    for matcher in (QUESTIONS, PLANS, DISPATCH):
        command = command_for(matcher)
        # Quoted so a plugin root containing a space still resolves; an
        # unresolvable command fails open and silently stops validating.
        assert command.startswith(f'"{PLUGIN_ANCHOR}/hooks/scripts/validate-')
        assert command.endswith('"')
        script = PLUGIN / command.strip('"').replace(f"{PLUGIN_ANCHOR}/", "", 1)
        assert os.access(script, os.X_OK), script


@pytest.mark.parametrize("variable", HARNESS_ROOT_VARIABLES)
@pytest.mark.parametrize("matcher", (QUESTIONS, PLANS, DISPATCH))
def test_every_hook_command_resolves_under_both_harnesses(
    matcher: str, variable: str
) -> None:
    # Codex never sets CLAUDE_PLUGIN_ROOT, so a command anchored on it alone
    # expands to /hooks/scripts/... and silently stops validating there.
    assert_allowed(run_hook(matcher, {}, variable))


@pytest.mark.parametrize("variable", HARNESS_ROOT_VARIABLES)
def test_a_violation_is_denied_under_both_harnesses(variable: str) -> None:
    output = run_hook(DISPATCH, {"name": "Raj_TechLead", "task": "do it"}, variable)
    assert "Raj_TechLead" in assert_denied(output)


def test_an_option_without_any_tag_is_denied() -> None:
    output = run_hook(
        QUESTIONS,
        question({"label": "Consolidate purchasing", "description": "One supplier."}),
    )
    reason = assert_denied(output)
    assert "Consolidate purchasing" in reason
    for tag in VALID_TAGS:
        assert tag in reason


def test_a_tag_outside_the_closed_set_is_denied_by_name() -> None:
    output = run_hook(
        QUESTIONS,
        question(
            {"label": "Ship it [Fast]", "description": "Quick."},
            {"label": "Do it right [Recommended]", "description": "Slower."},
        ),
    )
    assert "[Fast]" in assert_denied(output)


def test_a_typo_tag_is_denied_by_name() -> None:
    output = run_hook(
        QUESTIONS,
        question({"label": "Do it right [Recommeded]", "description": "Slower."}),
    )
    assert "[Recommeded]" in assert_denied(output)


def test_a_question_without_a_recommended_option_is_allowed() -> None:
    # questions.md conditions the recommendation on "a material decision", and
    # materiality is not mechanically detectable, so it is not enforced.
    output = run_hook(
        QUESTIONS,
        question(
            {"label": "Patch now [Hotfix]", "description": "Restores service."},
            {"label": "Rebuild [Architectural]", "description": "Long-term."},
        ),
    )
    assert_allowed(output)


def test_tags_on_the_first_line_of_the_description_are_accepted() -> None:
    output = run_hook(
        QUESTIONS,
        question(
            {
                "label": "Consolidate vendors",
                "description": "[Pragmatic] [Recommended]\nMoves purchases to one supplier.",
            }
        ),
    )
    assert_allowed(output)


def test_tags_in_the_label_are_accepted() -> None:
    output = run_hook(
        QUESTIONS,
        question(
            {
                "label": "Consolidate purchasing [Pragmatic] [Recommended]",
                "description": "Moves purchases to one supplier.",
            }
        ),
    )
    assert_allowed(output)


def test_a_plan_missing_one_heading_names_only_that_heading() -> None:
    plan = COMPLIANT_PLAN.split("## Context")[0]
    reason = assert_denied(run_hook(PLANS, {"plan": plan}))
    assert "missing headings: Context." in reason


def test_the_harness_default_plan_shape_names_all_four_missing_headings() -> None:
    plan = "## Context\n\nThe module is slow.\n\n## Summary\n\nMake it fast.\n"
    reason = assert_denied(run_hook(PLANS, {"plan": plan}))
    assert "missing headings: Goal, Requirements, Boundary, Direction." in reason


def test_a_complete_plan_is_allowed() -> None:
    assert_allowed(run_hook(PLANS, {"plan": COMPLIANT_PLAN}))


def test_plan_headings_match_at_any_depth_and_any_case() -> None:
    plan = "# goal\na\n#### REQUIREMENTS\nb\n### Boundary\nc\n## direction\nd\n### context\ne\n"
    assert_allowed(run_hook(PLANS, {"plan": plan}))


def test_a_codex_step_list_plan_is_not_checked_for_headings() -> None:
    assert_allowed(run_hook(PLANS, {"plan": [{"step": "audit", "status": "pending"}]}))


TEAMMATE = "raj-tech-lead-fix-auth"


def test_a_named_prompt_without_the_interface_fields_names_all_five() -> None:
    output = run_hook(
        DISPATCH, {"prompt": "Please fix the auth bug.", "name": TEAMMATE}
    )
    reason = assert_denied(output)
    for field in ("Goal:", "Requirements:", "Boundary:", "Directions:", "Context:"):
        assert field in reason


def test_a_named_prompt_with_a_prose_first_line_is_denied() -> None:
    prompt = COMPLIANT_PROMPT.replace(
        "checkout-refunds", "Fix the refund totals please", 1
    )
    output = run_hook(DISPATCH, {"prompt": prompt, "name": TEAMMATE})
    assert "stable reference" in assert_denied(output)


def test_a_named_first_line_carrying_a_field_label_is_denied() -> None:
    prompt = COMPLIANT_PROMPT.split("\n", 1)[1].lstrip()
    output = run_hook(DISPATCH, {"prompt": prompt, "name": TEAMMATE})
    assert "stable reference" in assert_denied(output)


@pytest.mark.parametrize("name", (TEAMMATE, None))
def test_a_prompt_over_the_ceiling_names_its_character_count(name: str | None) -> None:
    # orchestration.md scopes the ceiling to every dispatch, named or not.
    prompt = COMPLIANT_PROMPT + "x" * 5000
    tool_input = {"prompt": prompt} | ({"name": name} if name else {})
    reason = assert_denied(run_hook(DISPATCH, tool_input))
    assert str(len(prompt)) in reason
    assert "4096" in reason


@pytest.mark.parametrize(
    "tool_input",
    (
        {"prompt": COMPLIANT_PROMPT, "name": "Raj_TechLead"},
        # Codex's spawn_agent carries a name and a task but no prompt.
        {"task": "do it", "name": "Raj_TechLead"},
    ),
)
def test_a_name_outside_the_kebab_format_is_denied(tool_input: dict) -> None:
    assert "Raj_TechLead" in assert_denied(run_hook(DISPATCH, tool_input))


@pytest.mark.parametrize(
    "reference",
    ("checkout-refunds", "00521233-550e-4441-9bb7-f0c705d79b0a", "#158", "a" * 40),
)
def test_every_stable_reference_shape_is_allowed(reference: str) -> None:
    prompt = COMPLIANT_PROMPT.replace("checkout-refunds", reference, 1)
    assert_allowed(run_hook(DISPATCH, {"prompt": prompt, "name": TEAMMATE}))


def test_the_handover_example_prompt_with_a_compliant_name_is_allowed() -> None:
    assert_allowed(run_hook(DISPATCH, {"prompt": COMPLIANT_PROMPT, "name": TEAMMATE}))


def test_a_leading_indent_on_the_stable_reference_is_allowed() -> None:
    output = run_hook(DISPATCH, {"prompt": "  " + COMPLIANT_PROMPT, "name": TEAMMATE})
    assert_allowed(output)


@pytest.mark.parametrize(
    "prompt",
    (
        "Find every caller of parseRefund across the repo.",
        COMPLIANT_PROMPT,
        "",
    ),
)
def test_an_unnamed_nested_spawn_is_not_held_to_the_handover_format(
    prompt: str,
) -> None:
    # orchestration.md: a permitted one-off nested spawn supplies only its
    # subagent_type, task, and context. Only the main agent assigns a name.
    assert_allowed(run_hook(DISPATCH, {"prompt": prompt, "subagent_type": "Explore"}))


def test_bracketed_prose_beside_a_valid_tag_is_not_read_as_a_tag() -> None:
    output = run_hook(
        QUESTIONS,
        question(
            {
                "label": "Use Postgres [Recommended]",
                "description": "[Note] requires a migration.",
            }
        ),
    )
    assert_allowed(output)


@pytest.mark.parametrize(
    ("matcher", "tool_input"),
    (
        (QUESTIONS, {}),
        (QUESTIONS, {"questions": []}),
        (PLANS, {}),
        (DISPATCH, {}),
        # Codex tool variants share these matchers and carry other shapes.
        (PLANS, {"plan": [{"step": "audit", "status": "pending"}]}),
        (DISPATCH, {"task": "audit the parser"}),
    ),
)
def test_a_payload_without_a_checkable_shape_falls_through_to_allow(
    matcher: str, tool_input: dict
) -> None:
    assert_allowed(run_hook(matcher, tool_input))


@pytest.mark.parametrize("matcher", (QUESTIONS, PLANS, DISPATCH))
def test_malformed_stdin_fails_open_without_an_error(matcher: str) -> None:
    completed = subprocess.run(
        ["bash", "-c", command_for(matcher)],
        input="not json at all",
        text=True,
        capture_output=True,
        check=False,
        env=harness_env("CLAUDE_PLUGIN_ROOT"),
    )
    assert completed.returncode == 0, completed.stderr
    assert_allowed(json.loads(completed.stdout)["hookSpecificOutput"])
