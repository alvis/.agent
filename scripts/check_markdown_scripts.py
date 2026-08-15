#!/usr/bin/env python3
"""Reject long executable shell fences in Markdown."""

import argparse
from dataclasses import dataclass
from pathlib import Path

SHELL_LANGUAGES = frozenset({"bash", "sh", "shell", "zsh"})
MAX_SCRIPT_LINES = 10


@dataclass(frozen=True, slots=True)
class Violation:
    path: Path
    line: int
    language: str
    lines: int


def violations(path: Path, /) -> list[Violation]:
    found: list[Violation] = []
    fence_marker = ""
    fence_length = 0
    language = ""
    start = 0
    count = 0
    for line_number, line in enumerate(path.read_text().splitlines(), 1):
        stripped = line.lstrip(" ")
        indentation = len(line) - len(stripped)
        marker = stripped[:1]
        marker_length = len(stripped) - len(stripped.lstrip(marker)) if marker else 0
        if (
            not fence_marker
            and indentation <= 3
            and marker in {"`", "~"}
            and marker_length >= 3
        ):
            fence_marker = marker
            fence_length = marker_length
            info = stripped[marker_length:].strip()
            language = info.split(maxsplit=1)[0].lower() if info else ""
            start = line_number
            count = 0
        elif (
            fence_marker
            and indentation <= 3
            and marker == fence_marker
            and marker_length >= fence_length
            and not stripped[marker_length:].strip(" \t")
        ):
            if language in SHELL_LANGUAGES and count > MAX_SCRIPT_LINES:
                found.append(Violation(path, start, language, count))
            fence_marker = ""
        elif fence_marker:
            count += 1
    if fence_marker and language in SHELL_LANGUAGES and count > MAX_SCRIPT_LINES:
        found.append(Violation(path, start, language, count))
    return found


def markdown_files(paths: list[Path], /) -> list[Path]:
    files: set[Path] = set()
    for path in paths:
        if path.is_dir():
            files.update(path.rglob("*.md"))
        elif path.suffix == ".md":
            files.add(path)
    return sorted(files)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()
    found = [item for path in markdown_files(args.paths) for item in violations(path)]
    for item in found:
        print(f"{item.path}:{item.line}: {item.language} fence has {item.lines} lines")
    return bool(found)


if __name__ == "__main__":
    raise SystemExit(main())
