"""Fixture-driven and loader smoke tests for the coding standard scanner.

Run directly: `uvx pytest plugins/coding/tests/test_scanner.py`.

Each `fixtures/<rule-id>/` directory holds an `input.*` tree plus an
`expected.txt` golden file. The fixture test scans the directory with
`--category <rule-id>` and asserts byte-identical stdout. Further suites cover
loader discovery, the auto-loader's broken-module isolation, prefix derivation,
and the byte-identical CLI-variant output contract.
"""

import io
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import pytest

TESTS_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = TESTS_DIR.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

# both the coding and react plugins ship a top-level `scanners` package; in a
# single pytest process whichever loaded first would otherwise be reused from
# sys.modules, poisoning this file's rule set. purge any cached copy so
# load_rules() imports the coding rules through the path inserted above.
for _cached in [m for m in sys.modules if m == "scanners" or m.startswith("scanners.")]:
    del sys.modules[_cached]

from scanlib.core import run
from scanlib.loader import load_rules
from scanlib.prefixes import FALLBACK_PREFIXES, derive_rule_id_prefixes
from scanlib.rule import Rule

FIXTURES_DIR = TESTS_DIR / "fixtures"
RULES = tuple(load_rules())


@pytest.fixture(autouse=True)
def _own_scanners_package() -> None:
    # run() re-imports the `scanners` package on every call; purge any copy
    # cached by the react plugin's scanner tests and keep this scripts dir at
    # the front of sys.path so every load resolves to the coding rules.
    for cached in [
        m for m in sys.modules if m == "scanners" or m.startswith("scanners.")
    ]:
        del sys.modules[cached]
    path = str(SCRIPTS_DIR)
    if path in sys.path:
        sys.path.remove(path)
    sys.path.insert(0, path)


# a rule fixture is any `fixtures/<dir>/` carrying an `expected.txt` golden —
# other directories (legacy ad-hoc fixtures) are ignored.
FIXTURE_DIRS = sorted(
    p for p in FIXTURES_DIR.iterdir() if p.is_dir() and (p / "expected.txt").is_file()
)

CORPUS = FIXTURES_DIR / "_corpus"


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


# every `fixtures/<rule-id>/` golden file matches a fresh scan


def test_rule_fixture_directories_are_discovered() -> None:
    assert FIXTURE_DIRS, "no rule fixture directories discovered"


@pytest.mark.parametrize("fixture", FIXTURE_DIRS, ids=lambda p: p.name)
def test_fixtures_match_expected(fixture: Path) -> None:
    rule_id = fixture.name
    expected = (fixture / "expected.txt").read_text(encoding="utf-8")
    # the golden file is generated from inside the fixture dir with `.`
    actual = _capture_from(fixture, ["--category", rule_id])
    assert actual == expected, f"fixture drift for {rule_id}"


# the auto-loader discovers a complete, well-formed rule set


def test_rule_ids_are_unique() -> None:
    ids = [rule.id for rule in RULES]
    assert len(ids) == len(set(ids))


def test_rules_sorted_by_order_then_id() -> None:
    keys = [(rule.order, rule.id) for rule in RULES]
    assert keys == sorted(keys)


def test_underscore_modules_are_skipped() -> None:
    # no rule should carry an id starting with an underscore
    assert all(not rule.id.startswith("_") for rule in RULES)


@pytest.mark.parametrize("rule", RULES, ids=lambda r: r.id)
def test_every_rule_is_a_category_choice(rule: Rule) -> None:
    # running with each id as --category must not raise SystemExit(2)
    output = _capture([str(FIXTURES_DIR), "--category", rule.id])
    assert f"  {rule.id}:" in output


# a malformed dropped-in rule module must not crash the advisory loader


def test_broken_module_is_isolated(tmp_path: Path) -> None:
    # build a throwaway package: one module raises at import time, one is
    # a valid rule. load_rules() must skip the broken one and keep the good
    # one — no exception may propagate to the caller.
    pkg_dir = tmp_path / "broken_pkg"
    pkg_dir.mkdir()
    (pkg_dir / "__init__.py").write_text("", encoding="utf-8")
    (pkg_dir / "boom.py").write_text(
        'raise RuntimeError("intentional import-time failure")\n',
        encoding="utf-8",
    )
    (pkg_dir / "good.py").write_text(
        "from pathlib import Path\n"
        "from scanlib.core import Match\n"
        "from scanlib.rule import Rule\n"
        "def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:\n"
        "    return None\n"
        'RULE = Rule(id="ok-rule", label="OK", scan=scan, order=0)\n',
        encoding="utf-8",
    )
    sys.path.insert(0, str(tmp_path))
    stderr = io.StringIO()
    try:
        with redirect_stderr(stderr):
            rules = load_rules(package="broken_pkg")
    finally:
        sys.path.remove(str(tmp_path))
        for name in ("broken_pkg", "broken_pkg.boom", "broken_pkg.good"):
            sys.modules.pop(name, None)
    assert [r.id for r in rules] == ["ok-rule"]
    assert "failed to load rule module boom" in stderr.getvalue()


# step 7 — rule-ID prefix whitelist is derived, not hardcoded


def test_derives_live_standard_prefixes() -> None:
    prefixes = derive_rule_id_prefixes()
    assert prefixes
    assert all(
        prefix.isupper() and prefix.replace("_", "").isalnum() for prefix in prefixes
    )


def test_empty_glob_falls_back(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # point the deriver at an empty directory: the metadata glob yields nothing,
    # so it must return the hardcoded FALLBACK_PREFIXES. this is the
    # branch that runs when the scanner executes outside the .claude repo.
    from scanlib import prefixes

    monkeypatch.setattr(prefixes, "_plugins_root", lambda: tmp_path)
    derived = prefixes.derive_rule_id_prefixes()
    assert derived == FALLBACK_PREFIXES


def test_tiered_standard_without_rule_guides_contributes_prefix(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    standard = tmp_path / "alpha/standards/example"
    standard.mkdir(parents=True)
    (standard / "meta.md").write_text(
        "## Rule Groups\n\n- `NEW-CORE-*`: example rules.\n",
        encoding="utf-8",
    )

    from scanlib import prefixes

    monkeypatch.setattr(prefixes, "_plugins_root", lambda: tmp_path)
    derived = prefixes.derive_rule_id_prefixes()
    assert derived == ("NEW",)


def test_profile_standards_extend_live_prefixes_and_ignore_missing_meta(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    plugins_root = tmp_path / "plugins"
    live_standard = plugins_root / "alpha/standards/example"
    live_standard.mkdir(parents=True)
    (live_standard / "meta.md").write_text(
        "## Rule Groups\n\n- `LIVE-CORE-*`: built-in rules.\n",
        encoding="utf-8",
    )
    first_profile_standard = tmp_path / "external/standards/first"
    first_profile_standard.mkdir(parents=True)
    (first_profile_standard / "meta.md").write_text(
        "## Rule Groups\n\n- `EXT-CORE-*`: example rules.\n",
        encoding="utf-8",
    )
    second_profile_standard = tmp_path / "external/standards/second"
    second_profile_standard.mkdir(parents=True)
    (second_profile_standard / "meta.md").write_text(
        "## Rule Groups\n\n- `MORE-DATA-*`: more rules.\n",
        encoding="utf-8",
    )
    missing_meta_standard = tmp_path / "external/standards/no-meta"
    missing_meta_standard.mkdir(parents=True)

    from scanlib import prefixes

    monkeypatch.setattr(prefixes, "_plugins_root", lambda: plugins_root)
    monkeypatch.setenv(
        "CODING_LINT_STANDARD_ROOTS",
        os.pathsep.join(
            (
                str(first_profile_standard),
                str(missing_meta_standard),
                str(second_profile_standard),
            )
        ),
    )
    derived = prefixes.derive_rule_id_prefixes()
    assert derived == ("EXT", "LIVE", "MORE")


def test_fallback_matches_live_standards() -> None:
    # the hardcoded fallback must agree with the live standards so an
    # off-repo run produces the same answer as an in-repo run.
    assert FALLBACK_PREFIXES == derive_rule_id_prefixes()


# lock the byte-identical CLI-variant output contract via the corpus fixture


def test_category_all_lists_every_rule_in_order() -> None:
    output = _capture_from(CORPUS, ["--category", "all"])
    positions = [output.index(f"  {rule.id}:") for rule in RULES]
    assert positions == sorted(positions), "summary order drifted"


def test_no_tests_drops_spec_let_matches() -> None:
    # honor_no_tests path: `let` in a spec file is counted by default but
    # skipped under --no-tests; non-spec `let` matches are unaffected.
    with_tests = _capture_from(CORPUS, ["--category", "let"])
    without_tests = _capture_from(CORPUS, ["--category", "let", "--no-tests"])
    assert "feature.spec.ts" in with_tests
    assert "feature.spec.ts" not in without_tests
    assert "source.ts" in without_tests


def test_empty_match_renders_no_matches() -> None:
    # a category with zero hits must render the literal "(no matches)" block.
    output = _capture_from(CORPUS / "clean", ["--category", "let"])
    assert "(no matches)" in output


def test_spec_only_rules_skip_non_spec_files() -> None:
    # test-hooks / test-mock-stub gate on is_spec_file: a non-spec source
    # file carrying hook-shaped text must NOT be flagged.
    hooks = _capture_from(CORPUS, ["--category", "test-hooks"])
    assert "not-a-spec.ts" not in hooks
    assert "feature.spec.ts" in hooks
