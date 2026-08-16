import re
import textwrap
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[1]
DIRECTION = PLUGIN / "references/directions/subagent-handover.md"
REFERENCE = "subagent-handover.md"
FIELDS = ("Goal", "Requirements", "Boundary", "Directions", "Context")


def _top_level_fields(prompt: str, /) -> tuple[str, ...]:
    normalized = textwrap.dedent(prompt)
    without_reports = re.sub(r"```.*?```", "", normalized, flags=re.DOTALL)
    before_context, separator, _ = without_reports.partition("Context:")
    assert separator
    fields = re.findall(r"^([A-Z][A-Za-z ]+):", before_context, flags=re.MULTILINE)
    return (*fields, "Context")


def _text_blocks(document: str, /) -> list[str]:
    return re.findall(r"```text\n(.*?)```", document, flags=re.DOTALL)


def _first_line(prompt: str, /) -> str:
    return textwrap.dedent(prompt).strip().splitlines()[0]


def test_canonical_prompt_owns_exact_field_names_and_order() -> None:
    direction = DIRECTION.read_text(encoding="utf-8")
    prompt = _text_blocks(direction)[0]

    assert "[naming.md](../naming.md)" in direction
    assert _first_line(prompt) == "<stable-reference>"
    assert _top_level_fields(prompt) == FIELDS


def test_context_contract_covers_extensibility_items_and_path_compression() -> None:
    direction = DIRECTION.read_text(encoding="utf-8")
    _, shared_context, subsection_context = _text_blocks(direction)

    assert "authors may add subsections" in direction
    assert "`Decisions` and `Recent work` may each contain multiple" in direction
    assert "Each item summary contains 1–19 words" in direction
    assert "Omit an empty Context subsection" in direction
    assert "Items without a shared container carry absolute paths" in direction

    assert "Path: /absolute/path/to/work" in shared_context
    assert shared_context.count("decisions/") == 2
    assert shared_context.count("state/") == 1
    assert shared_context.count("reviews/") == 1

    assert "Path: /absolute/path/to/work/decisions" in subsection_context
    assert "— event-model.md" in subsection_context
    assert "— import-identifiers.md" in subsection_context
    assert "— /another/path/journal.md" in subsection_context

    item_summaries = re.findall(r"^- (.*?) — ", direction, flags=re.MULTILINE)
    for summary in item_summaries:
        words = re.findall(r"\b[\w'-]+\b", summary)
        assert 1 <= len(words) <= 19, summary


def test_generic_authorities_and_dispatching_skills_reference_direction() -> None:
    generic_authorities = (
        PLUGIN / "README.md",
        PLUGIN / "references/orchestration.md",
        PLUGIN / "references/team-lifecycle.md",
        PLUGIN / "references/scripted-execution.md",
        PLUGIN / "hooks/MAINAGENT.md",
        PLUGIN / "hooks/SUBAGENT.md",
    )
    dispatching_skills = (
        PLUGIN / "skills/takeover/SKILL.md",
        PLUGIN / "skills/handoff/SKILL.md",
        PLUGIN / "skills/handover/references/decision-consultation.md",
        PLUGIN / "skills/deep-research/SKILL.md",
        PLUGIN / "skills/deep-research/references/claim-verification.md",
        PLUGIN / "skills/autoresearch/SKILL.md",
        PLUGIN / "skills/autoresearch/references/loop-workflow.md",
        PLUGIN / "skills/autoresearch/references/eval-backends.md",
    )

    for path in (*generic_authorities, *dispatching_skills):
        assert REFERENCE in path.read_text(encoding="utf-8"), path


def test_autoresearch_first_prompt_blocks_use_the_canonical_fields() -> None:
    loop = (PLUGIN / "skills/autoresearch/references/loop-workflow.md").read_text(
        encoding="utf-8"
    )
    evaluator = (PLUGIN / "skills/autoresearch/references/eval-backends.md").read_text(
        encoding="utf-8"
    )
    role_prompts = re.findall(
        r"^    >>>\n(.*?)^    <<<$", loop, flags=re.MULTILINE | re.DOTALL
    )
    evaluator_prompt = _text_blocks(evaluator)[0]

    assert len(role_prompts) == 3
    for prompt in (*role_prompts, evaluator_prompt):
        assert _top_level_fields(prompt) == FIELDS


def test_shipped_first_prompts_enforce_item_and_shared_path_rules() -> None:
    workflow = (PLUGIN / "references/scripted-execution.md").read_text(encoding="utf-8")
    loop = (PLUGIN / "skills/autoresearch/references/loop-workflow.md").read_text(
        encoding="utf-8"
    )
    evaluator = (PLUGIN / "skills/autoresearch/references/eval-backends.md").read_text(
        encoding="utf-8"
    )
    workflow_prompts = re.findall(r"agent\(`(.*?)`, \{", workflow, flags=re.DOTALL)
    role_prompts = re.findall(
        r"^    >>>\n(.*?)^    <<<$", loop, flags=re.MULTILINE | re.DOTALL
    )
    prompts = (*workflow_prompts, *role_prompts, _text_blocks(evaluator)[0])

    assert len(workflow_prompts) == 2
    for prompt in prompts:
        assert _first_line(prompt) in {"${args.work_id}", "<work-id>"}
        assert _top_level_fields(prompt) == FIELDS
        context = textwrap.dedent(prompt).partition("Context:")[2]
        items = re.findall(r"^- (.*?) — (.+)$", context, flags=re.MULTILINE)
        for summary, _ in items:
            assert "${" not in summary
            assert 1 <= len(re.findall(r"\b[\w'-]+\b", summary)) <= 19
        if len(items) >= 2:
            assert re.search(r"^Path: (?:/|<absolute )", context, flags=re.MULTILINE)
            for _, path in items:
                assert not path.startswith(("/", "<absolute "))


def test_parallel_adapter_uses_one_intelligence_option_contract() -> None:
    adapter = (PLUGIN / "references/scripted-execution.md").read_text(
        encoding="utf-8"
    )
    loop = (PLUGIN / "skills/autoresearch/references/loop-workflow.md").read_text(
        encoding="utf-8"
    )

    assert "agent(task, opts?)" in adapter
    assert "`intelligence` (a concrete mapping level" in adapter
    assert "adapter applies only that level's native model and effort projection" in adapter
    assert "export default async function" not in loop
    assert (
        "const { brief, run_dir, baseline_score, resume_state, seed } = args;"
        in loop
    )
    assert "agent({ intelligence" not in loop
    assert loop.count("{ intelligence:") == 4
    assert "slots.map((slot) =>\n      () => agent(" in loop
    assert "candidates.map((c) =>\n          () => agent(" in loop
    assert ".map((t) => () => agent(" in loop


def test_legacy_prompt_shape_no_longer_competes_with_the_direction() -> None:
    legacy_phrases = (
        "mission capsule",
        "continuation capsule",
        "The first message names the objective",
    )

    for path in PLUGIN.rglob("*.md"):
        if path == DIRECTION:
            continue
        document = path.read_text(encoding="utf-8")
        for phrase in legacy_phrases:
            assert phrase not in document, f"{phrase!r} remains in {path}"


def test_hook_references_use_runtime_plugin_path() -> None:
    hook_reference = "{{PLUGIN_DIR}}/references/directions/subagent-handover.md"

    for name in ("MAINAGENT.md", "SUBAGENT.md"):
        hook = (PLUGIN / "hooks" / name).read_text(encoding="utf-8")
        assert hook_reference in hook
