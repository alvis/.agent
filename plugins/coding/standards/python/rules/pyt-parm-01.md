# PYT-PARM-01: Keyword-Only at Boundaries

**Tool Coverage:** ruff:FBT001, FBT002 (partial — FBT catches boolean positional traps; the `args ≥ 3` threshold is enforced here)

## Intent

At public/exported function boundaries, force keyword-only arguments using the `*` separator whenever the function takes **three or more parameters** OR **any parameter is a boolean**. Positional booleans are unreadable at call sites (`run(True, False, True)` tells the reader nothing), and long positional lists swap silently under refactor. Keyword-only arguments make every call site self-documenting.

## Fix

```python
# ✅ GOOD: keyword-only forced for booleans and for 3+ args
def deploy(
    service: str,
    *,
    dry_run: bool = False,
    verbose: bool = False,
    max_retries: int = 3,
) -> None:
    ...

deploy("billing", dry_run=True, verbose=False, max_retries=5)  # reads clearly
```

```python
# ❌ BAD: positional booleans, unreadable at call site
def deploy(service: str, dry_run: bool = False, verbose: bool = False) -> None:
    ...

deploy("billing", True, False)  # which flag is which?
```

### When to Force Keyword-Only

| Situation | Rule |
|-----------|------|
| Any `bool` parameter | Keyword-only, no exceptions |
| 3+ parameters | Everything after the first 1–2 "obvious" args goes keyword-only |
| 1–2 scalar args, no booleans | Positional is fine |

## Edge Cases

- Private helpers (names starting with `_`) may keep short positional signatures if they are called from one site in the same module — the boundary rule targets exported/public functions.
- When bundling into a config object becomes cleaner (see PYT-PARM-04), prefer the dataclass over a long keyword-only signature.
- `ruff` rule `FBT003` catches boolean positional *values at call sites*; pair it with this rule for enforcement on both sides.

## Related

PYT-PARM-02, PYT-PARM-03, PYT-PARM-04
