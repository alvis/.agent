"""Shared scanner engine — Match, file iteration, rendering, and the run() entry."""

import argparse
import sys
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from scanlib.loader import load_rules
from scanlib.predicates import PY_SUFFIXES, RUST_SUFFIXES, SOURCE_SUFFIXES, is_spec_file
from scanlib.rule import Rule

# every suffix the engine ingests — TS/JS, Python, and Rust; per-rule
# `applies_to` predicates then narrow each rule to the files it cares about.
SCANNED_SUFFIXES = SOURCE_SUFFIXES | PY_SUFFIXES | RUST_SUFFIXES

SKIP_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "coverage",
    "__pycache__",
    ".turbo",
    ".cache",
    "out",
}


@dataclass(frozen=True, slots=True)
class Match:
    path: Path
    lineno: int
    line: str


def iter_files(root: Path, /) -> Iterator[Path]:
    if root.is_file():
        yield root
        return
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in SCANNED_SUFFIXES:
            continue
        yield path


def render(label: str, *, matches: list[Match], lines_by_path: dict[Path, list[str]],
           before: int, after: int) -> str:
    out: list[str] = []
    out.append(f"=== {label} ===")
    out.append("")
    if not matches:
        out.append("(no matches)")
        out.append("")
        return "\n".join(out)
    by_file: dict[Path, list[Match]] = {}
    for m in matches:
        by_file.setdefault(m.path, []).append(m)
    for path, items in by_file.items():
        for idx, m in enumerate(items):
            out.append(f"{path}:{m.lineno}  {m.line.strip()}")
            file_lines = lines_by_path[path]
            start = max(1, m.lineno - before)
            end = min(len(file_lines), m.lineno + after)
            for ln in range(start, end + 1):
                marker = ">" if ln == m.lineno else " "
                out.append(f"  {marker} {ln:>4}: {file_lines[ln - 1].rstrip()}")
            if idx + 1 < len(items):
                out.append("")
                out.append("  --- next match ---")
                out.append("")
        out.append("")
    return "\n".join(out)


def parse_args(argv: list[str], /, *, choices: tuple[str, ...]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", default=["."], help="files or directories to scan (default: cwd)")
    parser.add_argument("--category", choices=("all",) + choices, default="all",
                        help="which scanner(s) to run (default: all)")
    parser.add_argument("--before", type=int, default=5, help="context lines before each match (default 5)")
    parser.add_argument("--after", type=int, default=10, help="context lines after each match (default 10)")
    parser.add_argument("--no-tests", action="store_true",
                        help="skip JS/TS test files for the `let` category (others unaffected)")
    return parser.parse_args(argv)


def run(argv: list[str] | None = None, *, package: str = "scanners") -> int:
    """Discover rules, scan the requested paths, and print grouped results."""
    rules: list[Rule] = load_rules(package=package)
    by_id: dict[str, Rule] = {rule.id: rule for rule in rules}
    choices: tuple[str, ...] = tuple(by_id)

    args = parse_args(argv if argv is not None else sys.argv[1:], choices=choices)
    selected: list[Rule] = (
        rules if args.category == "all" else [by_id[args.category]]
    )

    results: dict[str, list[Match]] = {rule.id: [] for rule in selected}
    lines_by_path: dict[Path, list[str]] = {}

    for raw_path in args.paths:
        root = Path(raw_path)
        if not root.exists():
            print(f"warn: path not found: {root}", file=sys.stderr)
            continue
        for file_path in iter_files(root):
            text: str | None = None
            for rule in selected:
                if not rule.applies_to(file_path):
                    continue
                if rule.honor_no_tests and args.no_tests and is_spec_file(file_path):
                    continue
                if text is None:
                    try:
                        text = file_path.read_text(encoding="utf-8", errors="replace")
                    except OSError:
                        text = ""
                    lines_by_path[file_path] = text.splitlines()
                rule.scan(path=file_path, lines=lines_by_path[file_path], matches=results[rule.id])

    out_chunks: list[str] = []
    summary: list[str] = []
    for rule in selected:
        matches = results[rule.id]
        out_chunks.append(render(
            rule.label,
            matches=matches,
            lines_by_path=lines_by_path,
            before=args.before,
            after=args.after,
        ))
        files = {m.path for m in matches}
        summary.append(f"  {rule.id}: {len(matches)} matches in {len(files)} files")

    print("\n".join(out_chunks))
    print("=== Summary ===")
    print("\n".join(summary))
    return 0
