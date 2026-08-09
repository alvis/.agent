"""Behavior tests for the doc-path resolution gate.

Every case builds a throwaway repository fixture and asserts on the
checker's findings — never on the content of any real document, which
would recreate the change-detector antipattern the gate replaces.
"""

import importlib.util
from pathlib import Path

import pytest

MODULE_PATH = Path(__file__).resolve().parent / "check_doc_paths.py"
SPEC = importlib.util.spec_from_file_location("check_doc_paths", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
check_doc_paths = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(check_doc_paths)


@pytest.fixture
def root(tmp_path: Path) -> Path:
    """A throwaway repository root with the plugins/ dir the checker expects."""
    resolved = tmp_path.resolve()
    (resolved / "plugins").mkdir()
    return resolved


def write(root: Path, relative: str, content: str) -> Path:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def check(root: Path) -> list[str]:
    return check_doc_paths.check(root)


def test_resolves_relative_to_the_containing_file(root: Path) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/references/doc.md",
        "see [target](target.md) and `references/target.md`",
    )

    assert check(root) == []


def test_resolves_against_ancestors_and_plugin_root(root: Path) -> None:
    write(root, "plugins/alpha/skills/demo/scripts/tool.py", "x")
    write(root, "plugins/alpha/references/shared.md", "x")
    # mentions addressed to the skill root and the plugin root, written
    # from a doc nested one level below each
    write(
        root,
        "plugins/alpha/skills/demo/references/doc.md",
        "run `scripts/tool.py` per `references/shared.md`",
    )

    assert check(root) == []


def test_reports_a_missing_target_with_file_and_line(root: Path) -> None:
    write(
        root,
        "plugins/alpha/references/doc.md",
        "fine line\nsee [gone](../references/missing.md)\n",
    )

    findings = check(root)

    assert findings == ["plugins/alpha/references/doc.md:2 → ../references/missing.md"]


def test_substitutes_plugin_dir_before_resolving(root: Path) -> None:
    write(root, "plugins/alpha/references/hook.md", "x")
    write(
        root,
        "plugins/alpha/hooks/ALLAGENT.md",
        "read `{{PLUGIN_DIR}}/references/hook.md` "
        "but not `{{PLUGIN_DIR}}/references/gone.md`",
    )

    findings = check(root)

    assert findings == [
        "plugins/alpha/hooks/ALLAGENT.md:1 → {{PLUGIN_DIR}}/references/gone.md"
    ]


def test_skips_fenced_code_blocks(root: Path) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        "```bash\ncat plugins/alpha/nowhere.md\n[x](missing/gone.md)\n```\n",
    )

    assert check(root) == []


def test_skips_runtime_placeholder_bare_and_absolute_mentions(root: Path) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        "state under `.state/works/demo/goal.md`\n"
        "promoted to `docs/architecture/README.md`\n"
        "memory in `.claude/agent-memory/lead/MEMORY.md`\n"
        "work state in `state/working.md`\n"
        "review detail in `reviews/quality.md`\n"
        "a target repo's `.github/PULL_REQUEST_TEMPLATE.md`\n"
        "each `plugins/<p>/skills/<name>/SKILL.md`\n"
        "template `references/{{SLUG}}.md`\n"
        "generated `operations/{operationName}.ts`\n"
        "the bare `SKILL.md` file\n"
        "a machine path `/usr/local/bin/tool.sh`",
    )

    assert check(root) == []


def test_skips_illustrative_paths_and_documents(root: Path) -> None:
    # `services` is on the example-segment allowlist: a naming example
    write(root, "plugins/alpha/doc.md", "name it `services/user.ts`")
    # template/example documents describe a generated tree
    write(root, "plugins/alpha/references/plan.template.md", "[s](../state.md)")
    write(root, "plugins/alpha/references/README.example.cli.md", "[l](./LICENSE)")

    assert check(root) == []


def test_reports_a_missing_directory_not_on_the_example_allowlist(root: Path) -> None:
    # a renamed or deleted real directory must fail the gate, never
    # silently reclassify as an example
    write(root, "plugins/alpha/doc.md", "see `renamed-dir/tool.py`")

    assert check(root) == ["plugins/alpha/doc.md:1 → renamed-dir/tool.py"]


def test_checks_this_repos_own_github_directory(root: Path) -> None:
    write(root, ".github/workflows/ci.yml", "x")
    write(
        root,
        "AGENTS.md",
        "CI in `.github/workflows/ci.yml`, not `.github/workflows/gone.yml`",
    )

    assert check(root) == ["AGENTS.md:1 → .github/workflows/gone.yml"]


def test_ignore_marker_skips_the_line(root: Path) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        "never cite `fake-dir/ghost.md` <!-- doc-path-gate: ignore -->\n"
        "but `fake-dir/other.md` is still checked\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:2 → fake-dir/other.md"]


def test_link_labels_are_display_prose_not_claims(root: Path) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    # the backticked label names a package-internal path; the link
    # target is the claim, and it resolves
    write(
        root,
        "plugins/alpha/doc.md",
        "[`inner/module.py`](references/target.md) explains it",
    )

    assert check(root) == []


def test_resolves_against_the_plugin_standards(root: Path) -> None:
    write(root, "plugins/alpha/standards/testing/write.md", "x")
    write(
        root,
        "plugins/alpha/skills/demo/references/doc.md",
        "read `testing/write.md` and `standards/testing/write.md`",
    )

    assert check(root) == []


def test_checks_root_documents_and_strips_anchors(root: Path) -> None:
    write(root, "scripts/tool.py", "x")
    write(root, "AGENTS.md", "see [tool](scripts/tool.py#usage)")
    write(root, "README.md", "see [gone](scripts/gone.py)")

    assert check(root) == ["README.md:1 → scripts/gone.py"]


def test_ignores_external_links_and_pure_anchors(root: Path) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        "[a](https://example.com/x.md) [b](mailto:x@y.z) [c](#section)",
    )

    assert check(root) == []


def test_this_repository_has_no_unresolved_doc_paths() -> None:
    """The gate itself, over the real tree — `uvx pytest` is the only command."""
    assert check(Path(__file__).resolve().parents[1]) == []
