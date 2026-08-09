# PYT-CORE-02: Forbid `Any` — Use `object`, `Never`, Generics, or Protocol

**Tool Coverage:** ruff:ANN401 (partial - ANN401 only flags Any in annotations; runtime Any usage via cast or explicit import escapes)

## Intent

`Any` disables checking in *both* directions: values flow in without validation and flow out without narrowing, poisoning every caller downstream. Reach for a precise alternative instead: `object` preserves the checker (callers must narrow before use), generics parameterise containers and functions, `Protocol` describes structural shape, and `Never` marks unreachable branches. `Any` is a last-resort hatch behind a PYT-CORE-03 ignore with a written justification.

## Fix

```python
# ✅ GOOD: `object` for opaque input — forces narrowing
def log_event(payload: object) -> None:
    if not isinstance(payload, dict):
        raise TypeError("payload must be a dict")
    ...

# ✅ GOOD: generic parameterisation
def first[T](items: list[T]) -> T | None:
    return items[0] if items else None

# ✅ GOOD: Protocol for duck-typed contract
from typing import Protocol

class SupportsClose(Protocol):
    def close(self) -> None: ...

def shutdown(resource: SupportsClose) -> None:
    resource.close()

# ✅ GOOD: Never for exhaustiveness
from typing import Never

def assert_never(x: Never) -> Never:
    raise AssertionError(f"unreachable: {x!r}")
```

```python
# ❌ BAD: Any disables the checker in both directions
from typing import Any

def log_event(payload: Any) -> None:  # callers can pass anything
    payload.whatever()                 # attribute access never verified
```

### `object` vs `Any` at a Glance

| You want...                              | Use        |
|------------------------------------------|------------|
| Accept anything, force narrowing         | `object`   |
| Accept anything, do nothing with it      | `object`   |
| Propagate a container's element type     | Generic    |
| Accept anything with method `.x()`       | `Protocol` |
| Mark a branch that cannot execute        | `Never`    |
| Silence the checker because you know best| `Any` (justify under PYT-CORE-03) |

## Edge Cases

- Interop with an untyped third-party library: isolate the `Any` at the adapter boundary and return a precise type to the rest of the codebase.
- `cast(T, value)` does not insert a runtime check — prefer `isinstance` narrowing when correctness matters.
- `**kwargs: object` is strictly better than `**kwargs: Any` when you do not need to forward them; the checker still treats each lookup as `object`.

## Related

PYT-CORE-01, PYT-CORE-03, PYT-TYPE-01, PYT-TYPE-03
