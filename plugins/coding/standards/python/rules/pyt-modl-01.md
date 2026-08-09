# PYT-MODL-01: Use `src/` Layout for Distributable Packages

**Tool Coverage:** standard-only

## Intent

Distributable packages MUST live under `src/<package_name>/` with an `__init__.py`. The `src/` layout forces the test suite and tooling to import the **installed** package instead of the in-tree copy, which immediately catches missing `pip install -e .`, missing `__init__.py` files, and packaging misconfigurations that would otherwise hide until the wheel ships.

## Fix

```
# ✅ GOOD: src layout — tests cannot accidentally import the in-repo source
myproject/
├── pyproject.toml
├── src/
│   └── myproject/
│       ├── __init__.py
│       ├── api.py
│       └── services/
│           ├── __init__.py
│           └── billing.py
└── tests/
    └── test_billing.py
```

```toml
# pyproject.toml
[tool.hatch.build.targets.wheel]
packages = ["src/myproject"]

[tool.pytest.ini_options]
testpaths = ["tests"]
# no sys.path manipulation needed — install the package
```

```
# ❌ BAD: flat layout — Python imports from cwd, hiding packaging bugs
myproject/
├── pyproject.toml
├── myproject/
│   ├── __init__.py
│   └── api.py
└── tests/
    └── test_api.py
# `pytest` from the repo root works even when the package is not installed,
# so CI green-lights a release that breaks the moment a user `pip install`s it.
```

### Why `src/` Catches Bugs

- `import myproject` from the test directory fails loudly if the package is not installed — CI must run `pip install -e .` first.
- Tooling (`ruff`, `ty`, `pytest`) sees the same import graph users will see post-install.
- Implicit namespace packages (PYT-MODL-04) are detected earlier because `src/` removes the accidental `sys.path` entry.
- Editable installs work identically to wheel installs, eliminating "works on my machine" packaging drift.

## Edge Cases

- Applications that are **never** distributed as a package (single-file scripts, one-off automation) may use a flat layout — but any codebase with tests, a `pyproject.toml`, or cross-module imports should adopt `src/`.
- Monorepos host one `src/<package>/` per distributable unit; shared tooling lives above `src/` (e.g. at the repo root).
- Existing flat-layout projects migrate by moving `<package>/` under `src/` and adding the packaging config above — no import path changes required.

## Related

PYT-MODL-02, PYT-MODL-04, PYT-IMPT-01
