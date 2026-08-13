"""Fixture-driven and loader smoke tests for the React Props scanner.

Run directly: `uvx pytest plugins/react/tests/test_scanner.py`.

The shared `scanlib` engine lives in the coding plugin; this test adds that
directory to `sys.path` exactly as the production shim does. Each
`fixtures/<dir>/` carrying an `expected.txt` is a fixture: it is scanned with
`--category <id>`, where `<id>` is read from an optional `category.txt` file
(for scenario fixtures whose directory name is not a rule id) or defaults to
the directory name. Scenario fixtures with zero matches act as true-negatives.
"""

import io
import os
import sys
from contextlib import redirect_stdout
from pathlib import Path

import pytest

TESTS_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = TESTS_DIR.parent / "scripts"
CODING_SCRIPTS = TESTS_DIR.parent.parent / "coding" / "scripts"
sys.path.insert(0, str(CODING_SCRIPTS))
sys.path.insert(0, str(SCRIPTS_DIR))

# both the coding and react plugins ship a top-level `scanners` package; in a
# single pytest process whichever loaded first would otherwise be reused from
# sys.modules, poisoning this file's rule set. purge any cached copy so
# load_rules() imports the react rules through the path inserted above.
for _cached in [m for m in sys.modules if m == "scanners" or m.startswith("scanners.")]:
    del sys.modules[_cached]

from scanlib.core import run
from scanlib.loader import load_rules
from scanlib.rule import Rule

FIXTURES_DIR = TESTS_DIR / "fixtures"
RULES = tuple(load_rules(package="scanners"))

# a fixture is any `fixtures/<dir>/` carrying an `expected.txt` golden;
# the scanned category comes from `category.txt` or the directory name.
FIXTURE_DIRS = sorted(
    p for p in FIXTURES_DIR.iterdir() if p.is_dir() and (p / "expected.txt").is_file()
)


@pytest.fixture(autouse=True)
def _own_scanners_package() -> None:
    # run() re-imports the `scanners` package on every call; purge any copy
    # cached by the coding plugin's scanner tests and keep this scripts dir at
    # the front of sys.path so every load resolves to the react rules.
    for cached in [
        m for m in sys.modules if m == "scanners" or m.startswith("scanners.")
    ]:
        del sys.modules[cached]
    path = str(SCRIPTS_DIR)
    if path in sys.path:
        sys.path.remove(path)
    sys.path.insert(0, path)


def _capture(argv: list[str], /) -> str:
    """Run the scanner with ``argv`` and return its captured stdout."""
    buffer = io.StringIO()
    with redirect_stdout(buffer):
        run(argv)
    return buffer.getvalue()


def _capture_from(directory: Path, extra: list[str], /) -> str:
    """Run the scanner with ``directory`` as cwd, scanning `.` — relative paths."""
    original = Path.cwd()
    os.chdir(directory)
    try:
        return _capture(["."] + extra)
    finally:
        os.chdir(original)


def _fixture_category(fixture: Path, /) -> str:
    """Return the --category for a fixture: `category.txt` if present, else dir name."""
    override = fixture / "category.txt"
    if override.is_file():
        return override.read_text(encoding="utf-8").strip()
    return fixture.name


# every `fixtures/<dir>/` golden file matches a fresh scan


def test_fixture_directories_are_discovered() -> None:
    assert FIXTURE_DIRS, "no rule fixture directories discovered"


@pytest.mark.parametrize("fixture", FIXTURE_DIRS, ids=lambda p: p.name)
def test_fixtures_match_expected(fixture: Path) -> None:
    category = _fixture_category(fixture)
    expected = (fixture / "expected.txt").read_text(encoding="utf-8")
    actual = _capture_from(fixture, ["--category", category])
    assert actual == expected, f"fixture drift for {fixture.name}"


# the auto-loader discovers a complete, well-formed React rule set


def test_rule_ids_are_unique() -> None:
    ids = [rule.id for rule in RULES]
    assert len(ids) == len(set(ids))


def test_rules_sorted_by_order_then_id() -> None:
    keys = [(rule.order, rule.id) for rule in RULES]
    assert keys == sorted(keys)


def test_blocks_helper_is_skipped() -> None:
    # `_blocks.py` exports no Rule and must not surface as a rule
    assert all(not rule.id.startswith("_") for rule in RULES)


@pytest.mark.parametrize("rule", RULES, ids=lambda r: r.id)
def test_every_rule_is_a_category_choice(rule: Rule) -> None:
    output = _capture([str(FIXTURES_DIR), "--category", rule.id])
    assert f"  {rule.id}:" in output
