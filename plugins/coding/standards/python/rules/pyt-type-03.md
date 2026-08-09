# PYT-TYPE-03: `Literal` over bare `str` for State Values

**Tool Coverage:** standard-only

## Intent

A bare `str` parameter accepts every string ever created. `Literal["pending", "paid", "refunded"]` constrains the set at the type level so the checker narrows in `match` / `if` branches and flags typos. Reach for `StrEnum` only when the values need methods or runtime iteration; prefer `Literal` for the common case of "one of these strings."

## Fix

```python
# ✅ GOOD: Literal constrains values and enables exhaustive matching
from typing import Literal, assert_never

InvoiceStatus = Literal["draft", "sent", "paid", "void"]

def describe(status: InvoiceStatus) -> str:
    match status:
        case "draft":  return "not sent"
        case "sent":   return "awaiting payment"
        case "paid":   return "settled"
        case "void":   return "cancelled"
        case _:        assert_never(status)  # type error if branch added

# ✅ GOOD: StrEnum when values need iteration / methods
from enum import StrEnum

class Region(StrEnum):
    EU = "eu"
    US = "us"
    def tax_rate(self) -> float: ...

# ❌ BAD: bare str — every string is legal, typos survive
def describe(status: str) -> str:
    if status == "pending":  # typo: should be "draft"
        return "not sent"
```

### Literal vs StrEnum

| Need | Use |
|---|---|
| Constrained set, no behavior | `Literal[...]` |
| Needs methods / `for r in Region` | `StrEnum` |
| Crosses trust boundary | Pydantic validates → narrows to `Literal` / `StrEnum` |

## Edge Cases

- `Literal` members must be literal expressions — no `Literal[get_status()]`.
- A `Literal` union of many (20+) values becomes noisy; switch to `StrEnum`.
- Do not mix: once a state value has methods, promote the whole API to `StrEnum` rather than carrying a helper function next to a `Literal`.
- Tooling cannot flag "should have been `Literal`" — it only verifies the constraint once declared.

## Related

PYT-TYPE-01, PYT-TYPE-04, PYT-TYPE-06
