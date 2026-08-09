# PYT-CORE-05: Prefer `X | None` — No `Optional`, No Implicit-Optional Defaults

**Tool Coverage:** ruff:RUF013,UP007 (partial - RUF013 catches implicit Optional from =None default; UP007 rewrites Optional[X] to X | None; neither enforces authoring discipline)

## Intent

On Python 3.13+, optional values are spelled `X | None` (PEP 604), not `Optional[X]`. Two failure modes must be avoided at authoring time: (1) reaching for `Optional[X]` out of habit, and (2) writing `def f(x: int = None)` which the checker treats as `int | None` only because the default forced it — the *annotation* still lies. Make `None` explicit in the annotation so readers and refactors do not have to reconstruct intent from the default.

## Fix

```python
# ✅ GOOD: PEP 604 union, None-ness visible in the annotation
def find_user(user_id: str) -> User | None:
    ...

def send(
    message: str,
    *,
    reply_to: str | None = None,
    deadline_ms: int | None = None,
) -> None:
    ...

# ✅ GOOD: type alias (PEP 695) when the union is reused
type MaybeUser = User | None

def resolve(user_id: str) -> MaybeUser:
    ...
```

```python
# ❌ BAD #1: legacy Optional import — verbose, pre-PEP 604 idiom
from typing import Optional

def find_user(user_id: str) -> Optional[User]:
    ...

# ❌ BAD #2: implicit Optional — annotation says int, default says otherwise
def send(message: str, reply_to: str = None) -> None:  # checker infers str|None
    ...

# ❌ BAD #3: mixing the two forms in one codebase
def a(x: Optional[int]) -> None: ...
def b(x: int | None) -> None: ...
```

### Two Failure Modes, One Rule

| Failure mode                          | Caught by | Fix                                        |
|---------------------------------------|-----------|--------------------------------------------|
| `Optional[X]` annotation              | ruff UP007| rewrite to `X \| None`                     |
| `def f(x: int = None)` (implicit)     | ruff RUF013 | declare `x: int \| None = None`          |
| `from typing import Optional` still present | grep      | remove the import after rewriting usages |

## Edge Cases

- A parameter that legitimately has no default but is still nullable is annotated `X | None` — the `| None` signals "I accept None", independent of whether a default exists.
- Do not write `None | X`; the convention is `X | None` so the "real" type appears first and searches (`grep "int | None"`) stay consistent.
- For multi-type unions that include `None`, keep `None` last: `int | str | None`, not `None | int | str`.
- Forward references to a later class: quote only the forward part (`"Node" | None`), do not reach for `from __future__ import annotations` (forbidden by PYT-IMPT-03).

## Related

PYT-CORE-01, PYT-CORE-02, PYT-IMPT-03, PYT-TYPE-06
