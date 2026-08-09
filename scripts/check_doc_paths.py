"""Verify repository documentation paths and reference-tree structure.

Scans every repository Markdown document for links and backticked path tokens,
resolves each against the containing file's directory, every ancestor directory
up to the repository root, and the owning plugin root, and reports every mention
that resolves to nothing. It also rejects ``templates``, ``examples``, or
``scripts`` nested anywhere below a ``references`` directory. This catches the
real defects prose assertions cannot: stale documentation and ambiguous artifact
ownership.

Example code in standards and skill references names paths from invented
project trees (``services/user.ts``); those are recognized by an explicit
allowlist of example first segments, never by whether a directory happens
to exist — so a renamed or deleted real directory still fails the gate.
A line carrying ``doc-path-gate: ignore`` in an HTML comment is skipped;
it marks a deliberate mention of a path that must not exist.

Exit 0 when every mention resolves; exit 1 listing ``file:line → path``.
"""

import argparse
import re
import subprocess
import sys
from bisect import bisect_left
from pathlib import Path
from typing import NamedTuple

# link labels and destinations need stateful parsing: their closing
# delimiters are escape-aware, and bare destinations balance parentheses.
# backticked token that may be a repo path; the character class excludes
# spaces, globs, and shell metacharacters, while is_skipped rejects bare prose
BACKTICK_PATTERN = re.compile(r"`([A-Za-z0-9_./{}-]+)`")
FILE_SUFFIX = re.compile(r"\.[A-Za-z][A-Za-z0-9]*/*$")
# link schemes and in-page anchors are not repo files
NON_FILE_LINK = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|#)", re.IGNORECASE)
# <placeholder>, {{variable}}, and single-brace {variable} segments mark
# illustrative paths; {{PLUGIN_DIR}} is the one variable with a known
# substitution
PLACEHOLDER = re.compile(
    r"<[^>]*>|\{\{(?!PLUGIN_DIR\}\})[^}]*\}\}|(?<!\{)\{(?!\{)[^{}]*\}"
)
# documents that are themselves templates or worked examples describe the
# layout of a *generated* tree, so their relative links never resolve here;
# the marker appears mid-name too (README.example.cli.md)
ILLUSTRATIVE_DOCUMENT = re.compile(r"\.(?:template|example)\.")
# runtime artifacts of a user checkout, never files this repository ships:
# docs/ and .state/ hold promoted and in-flight work state, .claude/ holds
# per-user agent memory and settings, and the bare segments are the
# documented work-directory and agent-memory layouts (state/journal.md,
# reviews/quality.md, archive/YYYY-MM.md, ...) that exist only at runtime
RUNTIME_ROOTS = (
    "docs/",
    ".state/",
    ".claude/",
    "state/",
    "reviews/",
    "archive/",
    "topics/",
    "rounds/",
    "changes/",
)
# a *target* repository's PR/issue templates, looked up at runtime by
# write-pr — deliberately narrow so this repo's own .github/ stays checked
TARGET_REPO_TEMPLATES = (
    ".github/PULL_REQUEST_TEMPLATE",
    ".github/pull_request_template",
    ".github/ISSUE_TEMPLATE",
)
# first segments of invented example trees used across standards and skill
# references (project-structure rules, naming examples, generated-package
# walkthroughs, agent-template convention snippets); an explicit list so a
# renamed real directory can never silently reclassify as an example
EXAMPLE_ROOTS = frozenset(
    (
        "app",
        "apps",
        "api",
        "auth",
        "components",
        "composites",
        "domain",
        "features",
        "fastify",
        "frontmatter",
        "foo",
        "myapp",
        "myproject",
        "packages",
        "previews",
        "prisma",
        "repositories",
        "services",
        "source",
        "spec",
        "src",
        "store",
        "styles",
        "UserProfile",
    )
)
# a line-level opt-out for deliberate mentions of paths that must not exist
# (e.g. a catalog of forbidden fake standard citations)
IGNORE_MARKER = "doc-path-gate: ignore"
# generated or runtime-only trees are not repository documentation or shipped
# source; excluding their internals also prevents VCS metadata from becoming input
EXCLUDED_TREE_NAMES = frozenset((".git", ".state", "__pycache__"))
FORBIDDEN_REFERENCE_SEGMENTS = frozenset(("examples", "scripts", "templates"))
REPOSITORY_PATH_ROOTS = frozenset(
    (
        ".github",
        "agents",
        "assets",
        "bin",
        "hooks",
        "plugins",
        "references",
        "rules",
        "scripts",
        "skills",
        "standards",
        "templates",
        "tests",
    )
)


class LinkCandidate(NamedTuple):
    """A parsed link and the extent of its visible label."""

    target: str | None
    start: int
    end: int
    destination_line: int
    label_end: int
    is_image: bool


class ReferenceDefinitionCandidate(NamedTuple):
    """A parsed reference definition projected onto its source block."""

    label: str
    target: str
    destination_line: int
    start: int
    end: int


class BareDestinationIndex(NamedTuple):
    """Precomputed bounds and parenthesis depths for bare destinations."""

    token_ends: list[int]
    invalid_ends: list[bool]
    depths: list[int]
    next_lower: list[int | None]
    newlines: list[int]


def repository_source_paths(root: Path) -> list[Path]:
    """Return tracked and nonignored untracked repository source paths."""
    git_files = subprocess.run(
        (
            "git",
            "-C",
            str(root),
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
        ),
        check=False,
        capture_output=True,
    )
    if git_files.returncode == 0:
        return sorted(
            path
            for name in git_files.stdout.split(b"\0")
            if name
            if (path := root / name.decode("utf-8", errors="surrogateescape")).is_file()
        )
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file()
        if EXCLUDED_TREE_NAMES.isdisjoint(path.relative_to(root).parts)
    )


def iter_documents(source_paths: list[Path]) -> list[Path]:
    return sorted(path for path in source_paths if path.suffix.casefold() == ".md")


def forbidden_reference_nesting(root: Path, source_paths: list[Path]) -> list[str]:
    """Returns forbidden paths nested beneath any references directory."""
    forbidden_paths: set[Path] = set()
    for path in source_paths:
        relative = path.relative_to(root)
        for index, segment in enumerate(relative.parts):
            if segment != "references":
                continue
            for nested_index in range(index + 1, len(relative.parts)):
                if relative.parts[nested_index] in FORBIDDEN_REFERENCE_SEGMENTS:
                    forbidden_paths.add(Path(*relative.parts[: nested_index + 1]))
                    break
    return [
        f"{path} → forbidden path segment nested under references"
        for path in sorted(forbidden_paths)
    ]


def plugin_root(root: Path, document: Path) -> Path:
    """The owning plugin directory, or the repo root for top-level docs."""
    relative = document.relative_to(root)
    if relative.parts[0] == "plugins" and len(relative.parts) > 2:
        return root / relative.parts[0] / relative.parts[1]
    return root


def closed_code_spans(text: str, end: int) -> list[tuple[int, int]]:
    """Return closed code spans whose opening delimiter begins before end."""
    runs = []
    index = 0
    while index < len(text):
        if text[index] != "`":
            index += 1
            continue
        run_end = index + 1
        while run_end < len(text) and text[run_end] == "`":
            run_end += 1
        runs.append((index, run_end))
        index = run_end

    next_matching: list[int | None] = [None] * len(runs)
    next_by_length: dict[int, int] = {}
    for run_index in range(len(runs) - 1, -1, -1):
        run_start, run_end = runs[run_index]
        delimiter_length = run_end - run_start
        next_matching[run_index] = next_by_length.get(delimiter_length)
        next_by_length[delimiter_length] = run_index

    spans = []
    run_index = 0
    while run_index < len(runs) and runs[run_index][0] < end:
        run_start, _ = runs[run_index]
        if is_escaped(text, run_start):
            run_index += 1
            continue
        closing_index = next_matching[run_index]
        if closing_index is None:
            run_index += 1
            continue
        spans.append((run_start, runs[closing_index][1]))
        run_index = closing_index + 1
    return spans


def skip_closed_code_span(
    index: int, spans: list[tuple[int, int]], *, cursor: int
) -> tuple[int, int]:
    """Advance a monotonic scanner beyond the closed code span at its cursor."""
    while cursor < len(spans) and spans[cursor][1] <= index:
        cursor += 1
    if cursor < len(spans) and spans[cursor][0] <= index:
        return spans[cursor][1], cursor
    return index, cursor


def link_text_endings(text: str, code_spans: list[tuple[int, int]]) -> dict[int, int]:
    """Map balanced link-text openings to their following source indexes."""
    endings = {}
    openings = []
    span_cursor = 0
    index = 0
    while index < len(text):
        next_index, span_cursor = skip_closed_code_span(
            index, code_spans, cursor=span_cursor
        )
        if next_index != index:
            index = next_index
            continue
        if text[index] == "[" and not is_escaped(text, index):
            openings.append(index)
        elif text[index] == "]" and not is_escaped(text, index) and openings:
            endings[openings.pop()] = index + 1
        index += 1
    return endings


def reference_label(text: str, start: int) -> tuple[str, int] | None:
    """Return escape-aware reference-label contents and the following index."""
    if start >= len(text) or text[start] != "[" or is_escaped(text, start):
        return None
    index = start + 1
    while index < len(text):
        if text[index] == "[" and not is_escaped(text, index):
            return None
        if text[index] == "]" and not is_escaped(text, index):
            return text[start + 1 : index], index + 1
        index += 1
    return None


def normalize_reference_label(label: str) -> str:
    """Apply CommonMark case and whitespace normalization to a label."""
    return re.sub(r"[ \t\r\n]+", " ", label).strip(" ").casefold()


def inline_link_candidates(
    line: str,
    code_spans: list[tuple[int, int]] | None = None,
    text_endings: dict[int, int] | None = None,
) -> list[LinkCandidate]:
    """Return every valid inline-link candidate outside closed code spans."""
    if code_spans is None:
        code_spans = closed_code_spans(line, len(line))
    if text_endings is None:
        text_endings = link_text_endings(line, code_spans)
    destination_index = bare_destination_index(line)
    candidates = []
    index = 0
    span_cursor = 0
    while index < len(line):
        next_index, span_cursor = skip_closed_code_span(
            index, code_spans, cursor=span_cursor
        )
        if next_index != index:
            index = next_index
            continue
        if line[index] != "[" or is_escaped(line, index):
            index += 1
            continue
        label_end = text_endings.get(index)
        if label_end is None:
            index += 1
            continue
        if label_end >= len(line) or line[label_end] != "(":
            index += 1
            continue
        parsed = parse_link_components(
            line,
            label_end + 1,
            closing_parenthesis=True,
            destination_index=destination_index,
        )
        if parsed is None:
            index += 1
            continue
        target, destination_line, end = parsed
        is_image = (
            index > 0 and line[index - 1] == "!" and not is_escaped(line, index - 1)
        )
        candidates.append(
            LinkCandidate(target, index, end, destination_line, label_end, is_image)
        )
        index += 1
    return candidates


def reference_definition(line: str) -> tuple[str, int] | None:
    """Return a normalized label and destination start for a definition."""
    line = strip_markdown_containers(line)
    index = len(line) - len(line.lstrip(" "))
    if index > 3 or index >= len(line) or line[index] != "[":
        return None
    parsed = reference_label(line, index)
    if parsed is None:
        return None
    label, end = parsed
    if end >= len(line) or line[end] != ":":
        return None
    return normalize_reference_label(label), end + 1


def skip_link_whitespace(text: str, index: int) -> tuple[int, bool] | None:
    """Skip spaces, tabs, and at most one line ending."""
    start = index
    line_endings = 0
    while index < len(text) and text[index] in " \t\n":
        if text[index] == "\n":
            line_endings += 1
            if line_endings > 1:
                return None
        index += 1
    return index, index > start


def bare_destination_index(text: str) -> BareDestinationIndex:
    """Index bare-destination token bounds and parenthesis balance once."""
    token_ends = [0] * len(text)
    invalid_ends = [False] * len(text)
    depths = [0] * (len(text) + 1)
    next_lower: list[int | None] = [None] * (len(text) + 1)
    newlines = [index for index, character in enumerate(text) if character == "\n"]
    token_start = 0
    while token_start < len(text):
        if (
            text[token_start] in " \t\n"
            or ord(text[token_start]) < 32
            or ord(text[token_start]) == 127
        ):
            token_start += 1
            continue
        token_end = token_start
        while (
            token_end < len(text)
            and text[token_end] not in " \t\n"
            and ord(text[token_end]) >= 32
            and ord(text[token_end]) != 127
        ):
            depths[token_end + 1] = depths[token_end]
            if text[token_end] == "(" and not is_escaped(text, token_end):
                depths[token_end + 1] += 1
            elif text[token_end] == ")" and not is_escaped(text, token_end):
                depths[token_end + 1] -= 1
            token_end += 1

        invalid_end = (
            token_end < len(text)
            and text[token_end] not in " \t\n"
            and (ord(text[token_end]) < 32 or ord(text[token_end]) == 127)
        )
        decreasing_positions = []
        for position in range(token_end, token_start - 1, -1):
            while (
                decreasing_positions
                and depths[decreasing_positions[-1]] >= depths[position]
            ):
                decreasing_positions.pop()
            if decreasing_positions:
                next_lower[position] = decreasing_positions[-1]
            decreasing_positions.append(position)
        for position in range(token_start, token_end):
            token_ends[position] = token_end
            invalid_ends[position] = invalid_end
        token_start = token_end + 1
    return BareDestinationIndex(token_ends, invalid_ends, depths, next_lower, newlines)


def parse_destination(
    text: str,
    index: int,
    *,
    destination_index: BareDestinationIndex | None = None,
) -> tuple[str, int] | None:
    """Parse an angle or balanced bare link destination."""
    if index >= len(text):
        return None
    start = index
    if text[index] == "<":
        index += 1
        start = index
        while index < len(text):
            if text[index] == ">" and not is_escaped(text, index):
                return text[start:index], index + 1
            if text[index] == "\n" or (
                text[index] == "<" and not is_escaped(text, index)
            ):
                return None
            index += 1
        return None

    if ord(text[index]) < 32 or ord(text[index]) == 127:
        return None
    if destination_index is None:
        depth = 0
        while index < len(text):
            character = text[index]
            if character in " \t\n":
                break
            if ord(character) < 32 or ord(character) == 127:
                return None
            if character == "(" and not is_escaped(text, index):
                depth += 1
            elif character == ")" and not is_escaped(text, index):
                if depth == 0:
                    break
                depth -= 1
            index += 1
        if index == start or depth:
            return None
        return text[start:index], index
    token_end = destination_index.token_ends[start]
    lower = destination_index.next_lower[start]
    if lower is not None and lower <= token_end:
        index = lower - 1
    else:
        if destination_index.invalid_ends[start]:
            return None
        index = token_end
    if (
        index == start
        or destination_index.depths[index] != destination_index.depths[start]
    ):
        return None
    return text[start:index], index


def parse_title(text: str, index: int) -> int | None:
    """Return the position after an escape-aware Markdown link title."""
    if index >= len(text) or text[index] not in "\"'(":
        return None
    opening = text[index]
    closing = ")" if opening == "(" else opening
    index += 1
    while index < len(text):
        if text[index] == closing and not is_escaped(text, index):
            return index + 1
        if opening == "(" and text[index] == "(" and not is_escaped(text, index):
            return None
        if text[index] == "\n" and re.match(r"[ \t]*\n", text[index + 1 :]):
            return None
        index += 1
    return None


def parse_link_components(
    text: str,
    index: int,
    *,
    closing_parenthesis: bool,
    destination_index: BareDestinationIndex | None = None,
) -> tuple[str, int, int] | None:
    """Parse a destination and optional title from an inline/reference link."""
    leading = skip_link_whitespace(text, index)
    if leading is None:
        return None
    index, _ = leading
    if destination_index is None:
        destination_index = bare_destination_index(text)
    destination_line = bisect_left(destination_index.newlines, index)
    destination = parse_destination(text, index, destination_index=destination_index)
    if destination is None:
        return None
    target, index = destination

    trailing = skip_link_whitespace(text, index)
    if trailing is None:
        return None
    next_index, had_whitespace = trailing
    expected_end = ")" if closing_parenthesis else ""
    if (
        closing_parenthesis
        and next_index < len(text)
        and text[next_index] == expected_end
    ):
        return target, destination_line, next_index + 1
    if not closing_parenthesis and next_index == len(text):
        return target, destination_line, next_index
    if not had_whitespace:
        return None

    title_end = parse_title(text, next_index)
    if title_end is None:
        return None
    after_title = skip_link_whitespace(text, title_end)
    if after_title is None:
        return None
    end, _ = after_title
    if closing_parenthesis:
        if end >= len(text) or text[end] != expected_end:
            return None
        end += 1
    elif end != len(text):
        return None
    return target, destination_line, end


def parse_reference_components(
    text: str,
    index: int,
    definition_start: int,
    *,
    destination_index: BareDestinationIndex | None = None,
) -> tuple[str, int, int] | None:
    """Parse one reference destination and optional title within a source block."""
    leading = skip_link_whitespace(text, index)
    if leading is None:
        return None
    destination_start, _ = leading
    destination = parse_destination(
        text, destination_start, destination_index=destination_index
    )
    if destination is None:
        return None
    target, destination_end = destination
    destination_line = int(text.find("\n", definition_start, destination_start) != -1)
    destination_line_end = text.find("\n", destination_end)
    if destination_line_end == -1:
        destination_line_end = len(text)
    destination_only = not text[destination_end:destination_line_end].strip(" \t")

    trailing = skip_link_whitespace(text, destination_end)
    if trailing is not None:
        title_start, had_whitespace = trailing
        if had_whitespace and title_start < len(text) and text[title_start] in "\"'(":
            title_end = parse_title(text, title_start)
            if title_end is not None:
                title_line_end = text.find("\n", title_end)
                if title_line_end == -1:
                    title_line_end = len(text)
                if not text[title_end:title_line_end].strip(" \t"):
                    return target, destination_line, title_line_end
    if destination_only:
        return target, destination_line, destination_line_end
    return None


def is_escaped(text: str, index: int) -> bool:
    """Return whether the character at index has an odd backslash prefix."""
    backslashes = 0
    cursor = index - 1
    while cursor >= 0 and text[cursor] == "\\":
        backslashes += 1
        cursor -= 1
    return backslashes % 2 == 1


def normalize_destination(target: str) -> str:
    """Remove CommonMark backslash escapes for ASCII punctuation."""
    return re.sub(r"\\([!\"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])", r"\1", target)


def reference_link_candidates(
    text: str,
    labels: frozenset[str],
    code_spans: list[tuple[int, int]] | None = None,
    text_endings: dict[int, int] | None = None,
) -> list[LinkCandidate]:
    """Return valid full, collapsed, and shortcut reference-link candidates."""
    if code_spans is None:
        code_spans = closed_code_spans(text, len(text))
    if text_endings is None:
        text_endings = link_text_endings(text, code_spans)
    candidates = []
    index = 0
    span_cursor = 0
    while index < len(text):
        next_index, span_cursor = skip_closed_code_span(
            index, code_spans, cursor=span_cursor
        )
        if next_index != index:
            index = next_index
            continue
        visible_end = text_endings.get(index)
        if visible_end is None:
            index += 1
            continue
        visible_label = text[index + 1 : visible_end - 1]
        if visible_end < len(text) and text[visible_end] in "(:":
            index += 1
            continue
        end = visible_end
        label = visible_label
        if visible_end < len(text) and text[visible_end] == "[":
            explicit = reference_label(text, visible_end)
            if explicit is None:
                index += 1
                continue
            explicit_label, end = explicit
            label = explicit_label or visible_label
        if normalize_reference_label(label) in labels:
            is_image = (
                index > 0 and text[index - 1] == "!" and not is_escaped(text, index - 1)
            )
            candidates.append(LinkCandidate(None, index, end, 0, visible_end, is_image))
        index += 1
    return candidates


def destination_contained_candidates(candidates: list[LinkCandidate]) -> set[int]:
    """Return candidates beginning inside another link's destination syntax."""
    intervals = sorted((candidate.label_end, candidate.end) for candidate in candidates)
    ordered = sorted(
        enumerate(candidates), key=lambda indexed: (indexed[1].start, indexed[0])
    )
    contained = set()
    interval_index = 0
    furthest_end = -1
    for candidate_index, candidate in ordered:
        while (
            interval_index < len(intervals)
            and intervals[interval_index][0] <= candidate.start
        ):
            furthest_end = max(furthest_end, intervals[interval_index][1])
            interval_index += 1
        if candidate.start < furthest_end:
            contained.add(candidate_index)
    return contained


def containing_non_image_links(candidates: list[LinkCandidate]) -> set[int]:
    """Return non-image links whose labels contain another non-image link."""
    ordered = sorted(
        enumerate(candidates), key=lambda indexed: indexed[1].start, reverse=True
    )
    containing = set()
    minimum_nested_end: int | None = None
    group_start = 0
    while group_start < len(ordered):
        candidate_start = ordered[group_start][1].start
        group_end = group_start
        while (
            group_end < len(ordered) and ordered[group_end][1].start == candidate_start
        ):
            group_end += 1
        for candidate_index, candidate in ordered[group_start:group_end]:
            if (
                not candidate.is_image
                and minimum_nested_end is not None
                and minimum_nested_end <= candidate.label_end
            ):
                containing.add(candidate_index)
        for _, candidate in ordered[group_start:group_end]:
            if not candidate.is_image:
                minimum_nested_end = min(
                    minimum_nested_end
                    if minimum_nested_end is not None
                    else candidate.end,
                    candidate.end,
                )
        group_start = group_end
    return containing


def selected_link_candidates(text: str, labels: frozenset[str]) -> list[LinkCandidate]:
    """Select innermost links because CommonMark links cannot contain links."""
    code_spans = closed_code_spans(text, len(text))
    text_endings = link_text_endings(text, code_spans)
    candidates = inline_link_candidates(
        text,
        code_spans=code_spans,
        text_endings=text_endings,
    )
    candidates.extend(
        reference_link_candidates(
            text, labels, code_spans=code_spans, text_endings=text_endings
        )
    )
    candidates = list(dict.fromkeys(candidates))
    excluded = destination_contained_candidates(candidates)
    excluded.update(containing_non_image_links(candidates))
    return [
        candidate
        for candidate_index, candidate in enumerate(candidates)
        if candidate_index not in excluded
    ]


def inline_links(text: str, labels: frozenset[str]) -> list[tuple[str, int, int, int]]:
    """Return selected inline-link targets and spans."""
    return [
        (candidate.target, candidate.start, candidate.end, candidate.destination_line)
        for candidate in selected_link_candidates(text, labels)
        if candidate.target is not None
    ]


def mask_spans(text: str, spans: list[tuple[int, int]]) -> str:
    """Mask parsed Markdown spans without changing physical line positions."""
    merged = []
    for start, end in sorted(spans):
        if not merged or start > merged[-1][1]:
            merged.append((start, end))
            continue
        previous_start, previous_end = merged[-1]
        merged[-1] = (previous_start, max(previous_end, end))

    # assembling fragments once avoids copying the full block for every span
    fragments = []
    cursor = 0
    for start, end in merged:
        fragments.append(text[cursor:start])
        fragments.append(
            "".join("\n" if character == "\n" else " " for character in text[start:end])
        )
        cursor = end
    fragments.append(text[cursor:])
    return "".join(fragments)


def display_spans(text: str, reference_labels: frozenset[str]) -> list[tuple[int, int]]:
    """Return parsed link spans whose code is display prose."""
    links = selected_link_candidates(text, reference_labels)
    return [(link.start, link.end) for link in links]


def mentions(
    line: str,
    reference_labels: frozenset[str],
    carried_spans: list[tuple[int, int]],
) -> list[tuple[str, int]]:
    found: set[tuple[str, int]] = set()
    links = inline_links(line, reference_labels)
    for target, _, _, destination_line in links:
        normalized = normalize_destination(target)
        if not NON_FILE_LINK.match(normalized):
            # drop an in-page anchor suffix; the file is what must exist
            found.add((normalized.split("#", 1)[0], destination_line))
    # a backticked label inside link text is display prose; the link target
    # above is the claim that gets checked
    spans = display_spans(line, reference_labels)
    spans.extend(carried_spans)
    without_links = mask_spans(line, spans)
    line_offset = 0
    previous_match = 0
    for match in BACKTICK_PATTERN.finditer(without_links):
        line_offset += without_links.count("\n", previous_match, match.start())
        previous_match = match.start()
        target = match.group(1)
        if is_backticked_path(target):
            found.add((target, line_offset))
    return [(mention, offset) for mention, offset in found if mention]


def is_backticked_path(target: str) -> bool:
    """Returns whether a safe backticked token claims a repository path."""
    if target.startswith(("./", "../", "{{PLUGIN_DIR}}/")):
        return True
    if target.split("/", 1)[0] in REPOSITORY_PATH_ROOTS:
        return True
    if target.startswith("."):
        return False
    return FILE_SUFFIX.search(target) is not None


def is_skipped(mention: str) -> bool:
    if PLACEHOLDER.search(mention):
        return True
    if mention.startswith(RUNTIME_ROOTS) or any(
        f"/{runtime_root}" in mention for runtime_root in RUNTIME_ROOTS
    ):
        return True
    if mention.startswith(TARGET_REPO_TEMPLATES):
        return True
    # a single directory name describes an artifact category, not a unique
    # repository location; nested directory paths retain enough context
    if mention.endswith("/") and mention.count("/") == 1:
        return True
    # a bare filename carries no directory context — resolving it against
    # every directory would be guesswork and pure noise
    if "/" not in mention:
        return True
    # absolute paths point at a user's machine, not this repository
    return mention.startswith("/")


def resolution_bases(root: Path, document: Path) -> list[Path]:
    """The containing directory, its ancestors up to the repository root,
    and the owning plugin root — a doc may address any level of its own
    subtree (skill root, plugin root, repo root)."""
    bases = []
    directory = document.parent
    while True:
        bases.append(directory)
        if directory == root:
            break
        directory = directory.parent
    owner = plugin_root(root, document)
    if owner not in bases:
        bases.append(owner)
    # standards prose addresses paths relative to the owning plugin's
    # standards directory (`testing/write.md`)
    standards = owner / "standards"
    if standards.is_dir() and standards not in bases:
        bases.append(standards)
    return bases


def strip_markdown_containers(line: str) -> str:
    """Remove CommonMark quote and list markers while retaining line identity."""
    remaining = line
    while True:
        quote = re.match(r" {0,3}>[ \t]?", remaining)
        if quote is not None:
            remaining = remaining[quote.end() :]
            continue
        list_item = re.match(r" {0,3}(?:[-+*]|[0-9]{1,9}[.)])(?:[ \t]+|$)", remaining)
        if list_item is None:
            return remaining
        remaining = remaining[list_item.end() :]


def continuation_lines(lines: list[str], start: int) -> list[str]:
    """Return the contiguous nonblank Markdown source beginning at start."""
    source = []
    for line_index in range(start, len(lines)):
        line = lines[line_index]
        if not line.strip() or IGNORE_MARKER in line or line.lstrip().startswith("```"):
            break
        source.append(strip_markdown_containers(line))
    return source


def block_reference_definitions(
    source_lines: list[str],
) -> list[ReferenceDefinitionCandidate]:
    """Parse all reference definitions in a contiguous source block once."""
    source = "\n".join(source_lines)
    definitions = []
    line_start = 0
    for relative_line, line in enumerate(source_lines):
        definition = reference_definition(line)
        if definition is not None:
            label, destination_start = definition
            parsed = parse_reference_components(
                source,
                line_start + destination_start,
                line_start,
            )
            if parsed is not None:
                target, destination_line, end = parsed
                label_start = len(line) - len(line.lstrip(" "))
                definitions.append(
                    ReferenceDefinitionCandidate(
                        label,
                        target,
                        relative_line + destination_line,
                        line_start + label_start,
                        end,
                    )
                )
        line_start += len(line) + 1
    return definitions


def block_mentions(
    source_lines: list[str],
    labels: frozenset[str],
    definitions: list[ReferenceDefinitionCandidate],
) -> list[tuple[str, int]]:
    """Parse one contiguous source block and project claims to physical lines."""
    source = "\n".join(source_lines)
    definition_spans = [
        (definition.start, definition.end) for definition in definitions
    ]
    definition_mentions = []
    for definition in definitions:
        normalized = normalize_destination(definition.target)
        if not NON_FILE_LINK.match(normalized):
            definition_mentions.append(
                (normalized.split("#", 1)[0], definition.destination_line)
            )
    return mentions(source, labels, definition_spans) + definition_mentions


def content_blocks(lines: list[str]) -> list[tuple[int, list[str]]]:
    """Return eligible nonblank source blocks with their physical start lines."""
    blocks = []
    in_fence = False
    line_index = 0
    while line_index < len(lines):
        line = lines[line_index]
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            line_index += 1
            continue
        if in_fence or not line.strip() or IGNORE_MARKER in line:
            line_index += 1
            continue
        source_lines = continuation_lines(lines, line_index)
        blocks.append((line_index, source_lines))
        line_index += len(source_lines)
    return blocks


def classify(bases: list[Path], mention: str, owner: Path) -> str:
    """Return ``resolved``, ``illustrative``, or ``unresolved``."""
    # the injection hook substitutes {{PLUGIN_DIR}} with the plugin root,
    # yielding an absolute path checked directly
    if "{{PLUGIN_DIR}}" in mention:
        substituted = mention.replace("{{PLUGIN_DIR}}", str(owner))
        return "resolved" if Path(substituted).exists() else "unresolved"

    # ../-relative mentions are anchored to the containing file alone
    if mention.startswith(("./", "../")):
        if (bases[0] / mention).resolve().exists():
            return "resolved"
        relative_parts = tuple(
            part for part in Path(mention).parts if part not in (".", "..")
        )
        if relative_parts and relative_parts[0] in EXAMPLE_ROOTS:
            return "illustrative"
        return "unresolved"

    if any((base / mention).exists() for base in bases):
        return "resolved"
    # only an allowlisted example segment may classify as illustrative; a
    # missing real directory must fail, not silently become an "example"
    if mention.split("/", 1)[0] in EXAMPLE_ROOTS:
        return "illustrative"
    return "unresolved"


def check(root: Path) -> list[str]:
    source_paths = repository_source_paths(root)
    findings = forbidden_reference_nesting(root, source_paths)
    for document in iter_documents(source_paths):
        if ILLUSTRATIVE_DOCUMENT.search(document.name):
            continue
        bases = resolution_bases(root, document)
        owner = plugin_root(root, document)
        lines = document.read_text(encoding="utf-8").splitlines()
        blocks = [
            (line_index, source_lines, block_reference_definitions(source_lines))
            for line_index, source_lines in content_blocks(lines)
        ]
        labels = frozenset(
            definition.label
            for _, _, definitions in blocks
            for definition in definitions
        )
        for line_index, source_lines, definitions in blocks:
            for mention, line_offset in sorted(
                set(block_mentions(source_lines, labels, definitions))
            ):
                if is_skipped(mention):
                    continue
                if classify(bases, mention, owner) == "unresolved":
                    findings.append(
                        f"{document.relative_to(root)}:{line_index + line_offset + 1} → {mention}"
                    )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "root",
        nargs="?",
        default=Path(__file__).resolve().parents[1],
        type=Path,
        help="repository root to scan (defaults to this script's repository)",
    )
    arguments = parser.parse_args()
    findings = check(arguments.root.resolve())
    for finding in findings:
        print(finding)
    if findings:
        print(f"\n{len(findings)} unresolved path mention(s)", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
