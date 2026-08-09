# PYT-MODL-04: Avoid Implicit Namespace Packages

**Tool Coverage:** ruff:INP001

## Intent

Every package directory MUST contain an `__init__.py`. PEP 420 implicit namespace packages (directories without `__init__.py`) silently merge contents across every matching directory on `sys.path`, which causes name collisions, duplicate module loads, and tests that pass locally but fail when two install paths overlap. Explicit `__init__.py` (even empty) keeps the package identity single-sourced.

## Fix

```
# ✅ GOOD: every package has __init__.py
src/myproject/
├── __init__.py
├── api/
│   ├── __init__.py
│   └── routes.py
└── services/
    ├── __init__.py
    └── billing.py
```

```python
# ✅ GOOD: empty __init__.py is enough to mark the directory as a regular package
# src/myproject/api/__init__.py
"""HTTP API for myproject."""
```

```
# ❌ BAD: missing __init__.py makes `api/` an implicit namespace package
src/myproject/
├── __init__.py
├── api/                      # ← no __init__.py; ruff INP001 fires
│   └── routes.py
└── services/
    ├── __init__.py
    └── billing.py

# If another distribution also ships an `api/` directory on sys.path, Python merges
# them. Imports resolve to whichever copy Python discovered first, and tests become
# a lottery.
```

### Why Regular Packages Beat Namespace Packages

- `import myproject.api` has exactly one source file — the `__init__.py` — so reviewers always know where package-level behaviour lives.
- Editable installs, wheels, and zipapps all agree on package identity.
- `ty`, `ruff`, and IDE jump-to-definition can resolve symbols without walking every `sys.path` entry.
- Future migration to a plugin system (the one legitimate use of namespace packages) becomes an explicit, intentional decision.

## Edge Cases

- **Intentional plugin surface**: frameworks that expose extension points (e.g. `myproject.plugins.*` where third parties ship their own `myproject.plugins.foo` subpackage) may use a namespace package on that *specific* subpackage — document it with a comment and a `# noqa: INP001` if ruff fires.
- **Tests directory**: `tests/` typically lacks `__init__.py` when pytest uses rootdir discovery; configure ruff to exempt `tests/` rather than adding an `__init__.py` that confuses pytest's import mode.
- **Stub-only packages** (`*-stubs`) follow PEP 561 and have their own conventions; INP001 should be disabled for those trees.

## Related

PYT-MODL-01, PYT-MODL-02, PYT-MODL-03
