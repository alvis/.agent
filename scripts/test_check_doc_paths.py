"""Behavior tests for the doc-path resolution gate.

Every case builds a throwaway repository fixture and asserts on the
checker's findings — never on the content of any real document, which
would recreate the change-detector antipattern the gate replaces.
"""

import importlib.util
import operator
import subprocess
from collections.abc import Iterator
from pathlib import Path
from typing import Self, SupportsIndex, overload

import pytest

MODULE_PATH = Path(__file__).resolve().parent / "check_doc_paths.py"
SPEC = importlib.util.spec_from_file_location("check_doc_paths", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
check_doc_paths = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(check_doc_paths)


class SliceCountingString(str):
    """Tracks aggregate slice width while preserving shared counter state."""

    sliced_width: list[int]
    slice_budget: int

    def __new__(cls, value: str, sliced_width: list[int], slice_budget: int) -> Self:
        instance = super().__new__(cls, value)
        instance.sliced_width = sliced_width
        instance.slice_budget = slice_budget
        return instance

    def __getitem__(self, key: SupportsIndex | slice) -> str:
        result = super().__getitem__(key)
        if not isinstance(key, slice):
            return result
        start, stop, step = key.indices(len(self))
        self.sliced_width[0] += len(range(start, stop, step))
        assert self.sliced_width[0] <= self.slice_budget
        return type(self)(result, self.sliced_width, self.slice_budget)

    def __add__(self, value: str) -> "SliceCountingString":
        return type(self)(super().__add__(value), self.sliced_width, self.slice_budget)


class PrefixCountingString(str):
    """Counts aggregate width searched by line-attribution calls."""

    counted_width: list[int]
    count_budget: int

    def __new__(cls, value: str, counted_width: list[int], count_budget: int) -> Self:
        instance = super().__new__(cls, value)
        instance.counted_width = counted_width
        instance.count_budget = count_budget
        return instance

    def __getitem__(self, key: SupportsIndex | slice) -> str:
        result = super().__getitem__(key)
        if not isinstance(key, slice):
            return result
        return type(self)(result, self.counted_width, self.count_budget)

    def count(
        self,
        sub: str,
        start: SupportsIndex | None = 0,
        end: SupportsIndex | None = None,
    ) -> int:
        start_index = 0 if start is None else operator.index(start)
        end_index = len(self) if end is None else operator.index(end)
        self.counted_width[0] += max(0, end_index - start_index)
        assert self.counted_width[0] <= self.count_budget
        return super().count(sub, start_index, end_index)


class IterationCountingList[T](list[T]):
    """Counts yielded items and rejects traversal beyond a fixed budget."""

    def __init__(self, values: list[T], iterations: list[int], budget: int) -> None:
        super().__init__(values)
        self.iterations = iterations
        self.budget = budget

    def __iter__(self) -> Iterator[T]:
        for value in super().__iter__():
            self.iterations[0] += 1
            assert self.iterations[0] <= self.budget
            yield value


class SliceCountingLines:
    """Counts aggregate list-slice width while exposing line-sequence behavior."""

    def __init__(self, values: list[str], sliced_width: list[int], budget: int) -> None:
        self.values = values
        self.sliced_width = sliced_width
        self.budget = budget

    def __len__(self) -> int:
        return len(self.values)

    @overload
    def __getitem__(self, key: int) -> str: ...

    @overload
    def __getitem__(self, key: slice) -> list[str]: ...

    def __getitem__(self, key: int | slice) -> str | list[str]:
        if isinstance(key, slice):
            start, stop, step = key.indices(len(self.values))
            self.sliced_width[0] += len(range(start, stop, step))
            assert self.sliced_width[0] <= self.budget
        return self.values[key]


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


def test_skips_relative_paths_into_an_illustrative_tree(root: Path) -> None:
    write(root, "plugins/alpha/rules/doc.md", "place it in `../components/item.ts`")

    assert check(root) == []


def test_reports_a_missing_directory_not_on_the_example_allowlist(root: Path) -> None:
    # a renamed or deleted real directory must fail the gate, never
    # silently reclassify as an example
    write(root, "plugins/alpha/doc.md", "see `renamed-dir/tool.py`")

    assert check(root) == ["plugins/alpha/doc.md:1 → renamed-dir/tool.py"]


@pytest.mark.parametrize("directory", ("operations", "types", "utilities"))
def test_reports_missing_paths_under_removed_example_roots(
    root: Path, directory: str
) -> None:
    write(root, "plugins/alpha/doc.md", f"see `{directory}/missing.py`")

    assert check(root) == [f"plugins/alpha/doc.md:1 → {directory}/missing.py"]


@pytest.mark.parametrize(
    "missing_path",
    (
        "config/tool.toml",
        "config/pytest.ini",
        "scripts/check-docs",
        "plugins/alpha/unknown/",
    ),
)
def test_reports_missing_backticked_paths_regardless_of_suffix(
    root: Path, missing_path: str
) -> None:
    write(root, "guides/setup.md", f"use `{missing_path}`")

    assert check(root) == [f"guides/setup.md:1 → {missing_path}"]


def test_resolves_extensionless_files_and_directory_mentions(root: Path) -> None:
    write(root, "scripts/check-docs", "executable")
    (root / "plugins/alpha/active").mkdir(parents=True)
    write(
        root,
        "guides/setup.md",
        "use `scripts/check-docs` and `plugins/alpha/active/`",
    )

    assert check(root) == []


def test_skips_generic_slash_syntax_that_is_not_a_repository_path(root: Path) -> None:
    write(
        root,
        "guides/setup.md",
        "branch `feat/work-id` and standard `testing/write` and choice `N/A`",
    )

    assert check(root) == []


def test_skips_bare_artifact_directory_categories(root: Path) -> None:
    write(root, "guides/setup.md", "a skill may have `assets/` and `references/`")

    assert check(root) == []


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


@pytest.mark.parametrize(
    ("usage", "label", "title"),
    (
        ("[full text][full]", "full", '"double quoted"'),
        ("[collapsed][]", "collapsed", "'single quoted'"),
        ("[shortcut]", "shortcut", "(parenthesized)"),
    ),
)
def test_reference_links_resolve_definitions_and_report_missing_destinations(
    root: Path, usage: str, label: str, title: str
) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        f"{usage}\n"
        f"[{label}]: references/target.md {title}\n"
        "[missing]\n"
        f"[missing]: references/missing.md {title}\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:4 → references/missing.md"]


@pytest.mark.parametrize(
    ("usage", "definition"),
    (
        ("[`missing/display.py`][full]", "[full]"),
        ("[`missing/display.py`][]", "[`missing/display.py`]"),
        ("[`missing/display.py`]", "[`missing/display.py`]"),
    ),
)
def test_reference_link_code_labels_are_display_prose(
    root: Path, usage: str, definition: str
) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        f"{usage}\n{definition}: references/target.md\n",
    )

    assert check(root) == []


def test_same_line_reference_definition_title_is_display_metadata(
    root: Path,
) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        '[valid]\n[valid]: references/target.md "see `missing/title.py`"\n',
    )

    assert check(root) == []


def test_multiline_reference_definition_title_masks_only_its_own_code_span(
    root: Path,
) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[valid]\n"
        '[valid]:\n references/target.md "title\n'
        ' `missing/title.py`\n closing"\n'
        "ordinary `missing/prose.py`\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:6 → missing/prose.py"]


def test_path_shaped_code_span_without_a_reference_definition_remains_a_claim(
    root: Path,
) -> None:
    write(root, "plugins/alpha/doc.md", "[`missing/display.py`]\n")

    assert check(root) == ["plugins/alpha/doc.md:1 → missing/display.py"]


def test_nested_explicit_reference_label_does_not_mask_a_path_claim(
    root: Path,
) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[`missing/display.py`][bad[nested]]\n[bad[nested]]: references/target.md\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:1 → missing/display.py"]


@pytest.mark.parametrize(
    "title",
    ('"double quoted"', "'single quoted'", "(parenthesized)"),
)
def test_inline_link_titles_do_not_become_part_of_destinations(
    root: Path, title: str
) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        f"[target](references/target.md {title}) "
        f"[missing](references/missing.md {title})",
    )

    assert check(root) == ["plugins/alpha/doc.md:1 → references/missing.md"]


def test_inline_links_support_nested_brackets_in_link_text(root: Path) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[valid [nested] text](references/target.md)\n"
        "ordinary prose\n"
        "[missing [nested] text](references/missing.md)\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:3 → references/missing.md"]


def test_inline_links_support_escaped_brackets_in_link_text(root: Path) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[valid \\] text](references/target.md)\n"
        "ordinary prose\n"
        "[missing \\] text](references/missing.md)\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:3 → references/missing.md"]


def test_open_bracket_in_closed_code_span_does_not_nest_link_text(root: Path) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[label `[` text](references/target.md)\n",
    )

    assert check(root) == []


def test_close_bracket_in_closed_code_span_does_not_end_link_text(root: Path) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        "[label `]` text](references/missing.md)\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:1 → references/missing.md"]


def test_link_shaped_text_in_closed_code_span_is_inert(root: Path) -> None:
    write(root, "plugins/alpha/references/existing.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[`[inner](references/missing.md)`](references/existing.md)\n",
    )

    assert check(root) == []


def test_escaped_backtick_does_not_hide_a_following_link(root: Path) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        r"\`[inner](references/missing.md)`" "\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:1 → references/missing.md"]


def test_valid_inner_link_takes_precedence_over_invalid_outer_link(root: Path) -> None:
    write(root, "plugins/alpha/references/outer.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[outer [inner](references/missing.md)](references/outer.md)\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:1 → references/missing.md"]


def test_invalid_outer_link_does_not_report_when_inner_link_resolves(
    root: Path,
) -> None:
    write(root, "plugins/alpha/references/inner.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[outer [inner](references/inner.md)](references/missing.md)\n",
    )

    assert check(root) == []


def test_valid_inner_reference_link_suppresses_outer_inline_link(root: Path) -> None:
    write(root, "plugins/alpha/references/existing.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[outer [inner][ref]](references/missing.md)\n[ref]: references/existing.md\n",
    )

    assert check(root) == []


def test_image_inside_link_text_does_not_suppress_outer_link(root: Path) -> None:
    write(root, "plugins/alpha/references/existing.png", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[outer ![img](references/existing.png)](references/missing.md)\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:1 → references/missing.md"]


def test_image_target_inside_link_text_is_still_validated(root: Path) -> None:
    write(root, "plugins/alpha/references/existing.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[outer ![img](references/missing.png)](references/existing.md)\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:1 → references/missing.png"]


def test_link_inside_image_description_does_not_suppress_image_target(
    root: Path,
) -> None:
    write(root, "plugins/alpha/references/existing.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "![outer [inner](references/existing.md)](references/missing.png)\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:1 → references/missing.png"]


@pytest.mark.parametrize(
    ("valid_destination", "missing_destination", "missing_path"),
    (
        (
            "references/target(guide).md",
            "references/missing(guide).md",
            "references/missing(guide).md",
        ),
        (
            r"references/target\(guide\).md",
            r"references/missing\(guide\).md",
            "references/missing(guide).md",
        ),
    ),
)
def test_bare_destinations_support_balanced_and_escaped_parentheses(
    root: Path,
    valid_destination: str,
    missing_destination: str,
    missing_path: str,
) -> None:
    write(root, "plugins/alpha/references/target(guide).md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        f"[target]({valid_destination}) [missing]({missing_destination})",
    )

    assert check(root) == [f"plugins/alpha/doc.md:1 → {missing_path}"]


def test_bare_destination_cannot_escape_a_space(root: Path) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        r"[malformed](references/missing\ file.md)",
    )

    assert check(root) == []


def test_angle_destination_uses_the_final_unescaped_closing_bracket(
    root: Path,
) -> None:
    write(root, "plugins/alpha/references/target>file.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        r"[target](<references/target\>file.md>) "
        r"[missing](<references/missing\>file.md>)",
    )

    assert check(root) == ["plugins/alpha/doc.md:1 → references/missing>file.md"]


def test_malformed_angle_destination_with_an_internal_opener_is_not_a_path_claim(
    root: Path,
) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        "[malformed](<references/missing<file.md>)",
    )

    assert check(root) == []


@pytest.mark.parametrize(
    "title",
    (r'"a \" quote"', r"'a \' quote'", r"(a \) parenthesis)"),
)
def test_inline_link_titles_support_escaped_delimiters(root: Path, title: str) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        f"[target](references/target.md {title}) "
        f"[missing](references/missing.md {title})",
    )

    assert check(root) == ["plugins/alpha/doc.md:1 → references/missing.md"]


def test_inline_destination_and_title_may_be_separated_by_one_line_ending(
    root: Path,
) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        '[target](references/target.md\n "title")\n'
        '[missing](references/missing.md\n "title")\n',
    )

    assert check(root) == ["plugins/alpha/doc.md:3 → references/missing.md"]


@pytest.mark.parametrize(
    ("opening", "closing"),
    (('"', '"'), ("'", "'"), ("(", ")")),
)
def test_inline_link_titles_may_span_multiple_nonblank_lines(
    root: Path, opening: str, closing: str
) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        f"[valid](\n references/target.md {opening}valid\n title{closing})\n"
        f"[missing](\n references/missing.md {opening}missing\n title{closing})\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:5 → references/missing.md"]


@pytest.mark.parametrize(
    "title",
    (
        '"first\n\nsecond"',
        "'first\n\nsecond'",
        "(first\n\nsecond)",
        '"first\n \t \nsecond"',
    ),
)
def test_blank_line_ends_an_inline_link_title(root: Path, title: str) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        f"[invalid](references/missing.md {title})\n",
    )

    assert check(root) == []


@pytest.mark.parametrize(
    "title", ('"unclosed\ntitle', "'unclosed\ntitle", "(nested (title))")
)
def test_invalid_or_unclosed_inline_link_titles_are_not_path_claims(
    root: Path, title: str
) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        f"[invalid](references/missing.md {title})\n",
    )

    assert check(root) == []


def test_multiline_title_masks_only_its_own_path_shaped_code_span(
    root: Path,
) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        '[valid](\n references/target.md "title\n'
        ' `missing/title.py`\n closing") `missing/prose.py`\n',
    )

    assert check(root) == ["plugins/alpha/doc.md:4 → missing/prose.py"]


def test_continued_link_preserves_the_line_of_a_following_backticked_path(
    root: Path,
) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        '[target](references/target.md\n "title") `references/missing.md`\n',
    )

    assert check(root) == ["plugins/alpha/doc.md:2 → references/missing.md"]


def test_ignored_continuation_does_not_report_its_destination(root: Path) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        "[ignored](\n references/missing.md) <!-- doc-path-gate: ignore -->\n",
    )

    assert check(root) == []


def test_angle_bracket_destinations_support_spaces_and_report_missing_targets(
    root: Path,
) -> None:
    write(root, "plugins/alpha/references/target file.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[target](<references/target file.md>) [missing](<references/missing file.md>)",
    )

    assert check(root) == ["plugins/alpha/doc.md:1 → references/missing file.md"]


def test_reference_definition_destination_may_start_on_the_next_line(
    root: Path,
) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(
        root,
        "plugins/alpha/doc.md",
        "[valid]:\n  references/target.md\n[missing]:\n  references/missing.md\n",
    )

    assert check(root) == ["plugins/alpha/doc.md:4 → references/missing.md"]


@pytest.mark.parametrize(
    "content",
    (
        (
            "> [valid]:\n>   references/target.md\n"
            "> [missing]:\n>   references/missing.md\n"
        ),
        ("- [valid]:\n  references/target.md\n- [missing]:\n  references/missing.md\n"),
    ),
)
def test_container_reference_definitions_preserve_destination_lines(
    root: Path, content: str
) -> None:
    write(root, "plugins/alpha/references/target.md", "x")
    write(root, "plugins/alpha/doc.md", content)

    assert check(root) == ["plugins/alpha/doc.md:4 → references/missing.md"]


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


def test_checks_markdown_outside_plugins_and_named_root_documents(root: Path) -> None:
    write(root, "guides/target.md", "x")
    write(
        root,
        "guides/setup.md",
        "see [target](target.md) and [gone](missing/gone.md)",
    )

    assert check(root) == ["guides/setup.md:1 → missing/gone.md"]


def test_scans_untracked_markdown_but_excludes_git_ignored_trees(root: Path) -> None:
    subprocess.run(
        ("git", "init", "--quiet"),
        cwd=root,
        check=True,
    )
    write(root, ".gitignore", ".venv/\ncache/\n")
    write(root, ".venv/ignored.md", "see `missing/venv.md`")
    write(root, "cache/ignored.md", "see `missing/cache.md`")
    write(root, "guides/untracked.md", "see `missing/untracked.md`")

    assert check(root) == ["guides/untracked.md:1 → missing/untracked.md"]


@pytest.mark.parametrize("forbidden_segment", ("templates", "examples", "scripts"))
def test_reports_forbidden_directories_nested_under_references(
    root: Path, forbidden_segment: str
) -> None:
    write(
        root,
        f"plugins/alpha/references/nested/{forbidden_segment}/artifact.md",
        "content without path mentions",
    )

    assert check(root) == [
        (
            "plugins/alpha/references/nested/"
            f"{forbidden_segment} → forbidden path segment nested under references"
        )
    ]


def test_reports_a_forbidden_file_nested_under_references(root: Path) -> None:
    write(root, "plugins/alpha/references/scripts", "executable content")

    assert check(root) == [
        (
            "plugins/alpha/references/scripts "
            "→ forbidden path segment nested under references"
        )
    ]


def test_forbidden_nesting_is_not_hidden_by_document_exclusions(root: Path) -> None:
    write(
        root,
        "plugins/alpha/references/scripts/plan.template.md",
        "[generated](missing/file.md) <!-- doc-path-gate: ignore -->",
    )

    assert check(root) == [
        (
            "plugins/alpha/references/scripts "
            "→ forbidden path segment nested under references"
        )
    ]


def test_forbidden_nesting_excludes_git_ignored_trees(root: Path) -> None:
    subprocess.run(
        ("git", "init", "--quiet"),
        cwd=root,
        check=True,
    )
    write(root, ".gitignore", ".venv/\ncache/\n")
    write(root, ".venv/references/scripts/ignored.md", "x")
    write(root, "cache/references/templates/ignored.md", "x")
    write(root, "plugins/alpha/references/examples/source.md", "x")

    assert check(root) == [
        (
            "plugins/alpha/references/examples "
            "→ forbidden path segment nested under references"
        )
    ]


def test_ignores_external_links_and_pure_anchors(root: Path) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        "[a](https://example.com/x.md) [b](mailto:x@y.z) [c](#section)",
    )

    assert check(root) == []


def test_ignores_external_link_schemes_case_insensitively(root: Path) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        "[web](HtTpS://example.com/missing.md) "
        "[email](MAILTO:x@y.z) "
        "[repository](Git+SSH://example.com/missing.md)",
    )

    assert check(root) == []


def test_commonmark_escaped_scheme_separator_remains_external(root: Path) -> None:
    write(
        root,
        "plugins/alpha/doc.md",
        r"[external](https\://example.com/missing.md)",
    )

    assert check(root) == []


def test_large_nonblank_block_has_bounded_continuation_work(
    root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    line_count = 6_000
    work_budget = line_count * 12
    visited_lines = 0
    original = check_doc_paths.continuation_lines

    def counted_continuation_lines(lines: list[str], start: int) -> list[str]:
        nonlocal visited_lines
        result = original(lines, start)
        visited_lines += len(result)
        assert visited_lines <= work_budget
        return result

    monkeypatch.setattr(
        check_doc_paths, "continuation_lines", counted_continuation_lines
    )
    write(root, "plugins/alpha/doc.md", "ordinary prose\n" * line_count)

    assert check(root) == []
    assert visited_lines <= work_budget


def test_large_definition_block_parses_each_definition_from_its_own_line(
    root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    line_count = 6_000
    definitions = [
        f"[label-{line_index:04d}]: references/target.md"
        for line_index in range(line_count)
    ]
    expected_prefix_work = sum(line.index(":") + 1 for line in definitions)
    call_count = 0
    prefix_work = 0
    original = check_doc_paths.parse_reference_components

    def counted_parse_reference_components(
        text: str, index: int, definition_start: int
    ) -> tuple[str, int, int] | None:
        nonlocal call_count, prefix_work
        call_count += 1
        prefix_work += index - definition_start
        return original(text, index, definition_start)

    monkeypatch.setattr(
        check_doc_paths,
        "parse_reference_components",
        counted_parse_reference_components,
    )
    write(root, "plugins/alpha/references/target.md", "x")
    write(root, "plugins/alpha/doc.md", "\n".join(definitions))

    assert check(root) == []
    assert call_count == line_count
    assert prefix_work == expected_prefix_work


def test_mask_spans_has_bounded_total_slice_width() -> None:
    span_count = 6_000
    plain_text = "x\n" * span_count
    spans = [(offset, offset + 1) for offset in range(0, len(plain_text), 2)]
    sliced_width = [0]
    slice_budget = len(plain_text) + len(spans)
    text = SliceCountingString(plain_text, sliced_width, slice_budget)

    masked = check_doc_paths.mask_spans(text, spans)

    assert masked == " \n" * span_count
    assert masked.count("\n") == span_count
    assert sliced_width[0] <= slice_budget


def test_dense_link_selection_has_bounded_candidate_traversal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    link_count = 6_000
    text = " ".join(
        f"[link-{link_index:04d}](references/target.md)"
        for link_index in range(link_count)
    )
    code_spans = check_doc_paths.closed_code_spans(text, len(text))
    text_endings = check_doc_paths.link_text_endings(text, code_spans)
    candidates = check_doc_paths.inline_link_candidates(
        text, code_spans=code_spans, text_endings=text_endings
    )
    iterations = [0]
    iteration_budget = link_count * 8
    counted = IterationCountingList(candidates, iterations, iteration_budget)

    def counted_inline_candidates(
        _: str,
        *,
        code_spans: list[tuple[int, int]] | None = None,
        text_endings: dict[int, int] | None = None,
    ) -> list[check_doc_paths.LinkCandidate]:
        assert code_spans is not None
        assert text_endings is not None
        return counted

    monkeypatch.setattr(
        check_doc_paths, "inline_link_candidates", counted_inline_candidates
    )

    selected = check_doc_paths.selected_link_candidates(text, frozenset())

    assert len(selected) == link_count
    assert iterations[0] <= iteration_budget


def test_dense_multiline_links_have_bounded_line_attribution_work() -> None:
    link_count = 6_000
    plain_text = "\n".join(
        f"[link-{line_index:04d}](references/target.md)"
        for line_index in range(link_count)
    )
    counted_width = [0]
    count_budget = len(plain_text) * 8
    text = PrefixCountingString(plain_text, counted_width, count_budget)

    candidates = check_doc_paths.inline_link_candidates(text)

    assert len(candidates) == link_count
    assert candidates[0].destination_line == 0
    assert candidates[link_count // 2].destination_line == link_count // 2
    assert candidates[-1].destination_line == link_count - 1
    assert counted_width[0] <= count_budget


def test_dense_code_span_scan_has_bounded_span_traversal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    span_count = 6_000
    dense_spans = " ".join(
        f"`[hidden-{span_index:04d}](references/hidden.md)`"
        for span_index in range(span_count)
    )
    text = (
        f"{dense_spans} "
        r"\`[escaped](references/escaped.md) "
        "[outside](references/outside.md) `missing/outside.md` "
        "`[unclosed](references/unclosed.md)"
    )
    iterations = [0]
    iteration_budget = (span_count + 1) * 16
    original = check_doc_paths.closed_code_spans

    def counted_closed_code_spans(source: str, end: int) -> list[tuple[int, int]]:
        spans = original(source, end)
        return IterationCountingList(spans, iterations, iteration_budget)

    monkeypatch.setattr(check_doc_paths, "closed_code_spans", counted_closed_code_spans)

    found = check_doc_paths.mentions(text, frozenset(), [])

    assert sorted(found) == [
        ("missing/outside.md", 0),
        ("references/escaped.md", 0),
        ("references/outside.md", 0),
        ("references/unclosed.md", 0),
    ]
    assert iterations[0] <= iteration_budget


def test_dense_unmatched_brackets_have_bounded_escape_checks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bracket_count = 6_000
    text = (
        "[outside](references/outside.md) `missing/outside.md` " + "[" * bracket_count
    )
    escape_checks = 0
    escape_check_budget = (len(text) + bracket_count) * 4
    original = check_doc_paths.is_escaped

    def counted_is_escaped(source: str, index: int) -> bool:
        nonlocal escape_checks
        escape_checks += 1
        assert escape_checks <= escape_check_budget
        return original(source, index)

    monkeypatch.setattr(check_doc_paths, "is_escaped", counted_is_escaped)

    found = check_doc_paths.mentions(text, frozenset(), [])

    assert sorted(found) == [
        ("missing/outside.md", 0),
        ("references/outside.md", 0),
    ]
    assert escape_checks <= escape_check_budget


def test_dense_malformed_destinations_have_bounded_escape_checks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    malformed_count = 6_000
    text = "[](x" * malformed_count
    escape_checks = 0
    escape_check_budget = (len(text) + malformed_count) * 8
    original = check_doc_paths.is_escaped

    def counted_is_escaped(source: str, index: int) -> bool:
        nonlocal escape_checks
        escape_checks += 1
        assert escape_checks <= escape_check_budget
        return original(source, index)

    monkeypatch.setattr(check_doc_paths, "is_escaped", counted_is_escaped)

    candidates = check_doc_paths.inline_link_candidates(text)

    assert candidates == []
    assert escape_checks <= escape_check_budget


def test_alternating_content_blocks_have_bounded_line_slice_width() -> None:
    block_count = 6_000
    raw_lines = [line for _ in range(block_count) for line in ("content", "")]
    sliced_width = [0]
    slice_budget = len(raw_lines) * 8
    lines = SliceCountingLines(raw_lines, sliced_width, slice_budget)

    blocks = check_doc_paths.content_blocks(lines)

    assert len(blocks) == block_count
    assert blocks[0] == (0, ["content"])
    assert blocks[-1] == (len(raw_lines) - 2, ["content"])
    assert sliced_width[0] <= slice_budget


def test_this_repository_has_no_unresolved_doc_paths() -> None:
    """The gate itself, over the real tree — `uvx pytest` is the only command."""
    assert check(Path(__file__).resolve().parents[1]) == []
