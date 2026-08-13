import itertools
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PLUGINS = ROOT / "plugins"
FENCE = re.compile(r"^\s*(`{3,}|~{3,})(.*)$")
HEADING = re.compile(r"^(#{1,6})\s+\S")


def templates_with_suffix(suffix: str) -> list[Path]:
    return sorted(path for path in PLUGINS.rglob(f"*{suffix}") if path.is_file())


def markdown_body(path: Path) -> list[str]:
    lines = path.read_text().splitlines()
    if not lines or lines[0] != "---":
        return lines

    try:
        delimiter = lines.index("---", 1)
    except ValueError:
        raise AssertionError(f"{path}: unclosed front matter") from None
    assert any(line.strip() for line in lines[1:delimiter]), path
    return lines[delimiter + 1 :]


def markdown_structure(lines: list[str]) -> tuple[list[int], list[list[str]]]:
    headings: list[int] = []
    text_fences: list[list[str]] = []
    open_fence: tuple[str, int, str] | None = None
    fenced_lines: list[str] = []

    for line in lines:
        fence = FENCE.match(line)
        if fence:
            marker, info = fence.groups()
            if open_fence is None:
                open_fence = (marker[0], len(marker), info.strip())
                fenced_lines = []
            elif marker[0] == open_fence[0] and len(marker) >= open_fence[1]:
                if open_fence[2] == "text":
                    text_fences.append(fenced_lines)
                open_fence = None
            else:
                fenced_lines.append(line)
            continue

        if open_fence is not None:
            fenced_lines.append(line)
            continue

        heading = HEADING.match(line)
        if heading:
            headings.append(len(heading.group(1)))

    assert open_fence is None
    return headings, text_fences


def test_markdown_templates_have_valid_document_structure() -> None:
    templates = templates_with_suffix(".template.md")
    assert templates

    for path in templates:
        headings, _ = markdown_structure(markdown_body(path))
        assert headings and headings[0] == 1, path
        assert headings.count(1) == 1, path
        assert all(
            current <= previous + 1
            for previous, current in itertools.pairwise(headings)
        ), path


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        assert key not in result
        result[key] = value
    return result


def test_json_templates_have_valid_object_structure() -> None:
    templates = templates_with_suffix(".template.json")
    assert templates

    for path in templates:
        document = json.loads(path.read_text(), object_pairs_hook=unique_object)
        assert isinstance(document, dict) and document, path


def test_commented_topologies_are_structurally_consistent() -> None:
    checked = 0
    for path in PLUGINS.rglob("*.md"):
        _, text_fences = markdown_structure(path.read_text().splitlines())
        for fence in text_fences:
            entries = [line for line in fence if line.strip()]
            if (
                not entries
                or " # " not in entries[0]
                or not any(re.search(r"[├└│]", line) for line in entries)
            ):
                continue

            checked += 1
            assert all(" # " in line for line in entries), path
            assert all(re.search(r"\S {2,}# ", line) for line in entries), path
            assert not any(re.search(r"/\s+#", line) for line in entries), path

    assert checked
