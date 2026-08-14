"""File-gate predicates for rules — replace per-rule glob and suffix guards."""

from pathlib import Path

# the coding monolith iterated 6 suffixes; the react monolith only 4. the
# shared engine keeps all 6 to preserve coding byte-identity — react rules gate
# on `ts_only`/`index_files`, so the extra `.mjs`/`.cjs` files never match there.
SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
# Python source files — gated by the `python_files` predicate so the `py-*`
# rules see `.py` files while TS/JS rules (`source_files`) never match them.
PY_SUFFIXES = {".py"}
RUST_SUFFIXES = {".rs"}
TS_SUFFIXES = {".ts", ".tsx"}
SPEC_PATTERNS = ("*.spec.*",)
PYTHON_TEST_PATTERNS = ("test_*.py", "*_test.py")
INDEX_NAMES = {"index.ts", "index.tsx"}


def is_spec_file(path: Path, /) -> bool:
    """Return whether ``path`` matches a sanctioned JavaScript test pattern."""
    return path.suffix.lower() in SOURCE_SUFFIXES and any(
        path.match(pattern) for pattern in SPEC_PATTERNS
    )


def is_test_file(path: Path, /) -> bool:
    """Return whether ``path`` follows a supported spec or Python test name."""
    return any(path.match(pattern) for pattern in SPEC_PATTERNS) or any(
        path.match(pattern) for pattern in PYTHON_TEST_PATTERNS
    )


def source_files(path: Path, /) -> bool:
    """Match any TypeScript or JavaScript source file."""
    return path.suffix.lower() in SOURCE_SUFFIXES


def spec_files(path: Path, /) -> bool:
    """Match sanctioned JavaScript test files."""
    return is_spec_file(path)


def python_files(path: Path, /) -> bool:
    """Match any Python source file — used by the ``py-*`` rules."""
    return path.suffix.lower() in PY_SUFFIXES


def ts_only(path: Path, /) -> bool:
    """Match only ``.ts`` / ``.tsx`` files — used by React Props rules."""
    return path.suffix.lower() in TS_SUFFIXES


def index_files(path: Path, /) -> bool:
    """Match only barrel files named ``index.ts`` / ``index.tsx``."""
    return path.name in INDEX_NAMES
