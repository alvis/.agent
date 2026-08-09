# PYT-CORE-01: Type Hints at Public Boundaries

**Tool Coverage:** ruff:ANN001,ANN201,ANN202 (partial - ruff flags missing annotations but cannot distinguish public vs private API contract)

## Intent

Public functions, methods, module-level variables, and class attributes of public classes MUST carry explicit type hints. The reviewer asserts the API contract at the boundary; letting inference leak through exposes implementation details (concrete types, accidental `Any`) as part of the public surface. Private (underscore-prefixed) helpers may rely on inference because they do not cross a contract boundary.

## Fix

```python
# ✅ GOOD: explicit hints on every public surface
from dataclasses import dataclass

DEFAULT_RETRIES: int = 3  # module-level constant is public API

@dataclass(frozen=True, slots=True)
class Invoice:
    id: str            # public attribute — annotated
    amount: int
    _raw: bytes | None = None  # private — inference acceptable

def charge(invoice: Invoice, *, retries: int = DEFAULT_RETRIES) -> bool:
    return _attempt(invoice, retries)

def _attempt(invoice, retries):  # private helper, inference ok
    return retries > 0
```

```python
# ❌ BAD: public boundary relies on inference
DEFAULT_RETRIES = 3  # type leaks from literal

def charge(invoice, *, retries=DEFAULT_RETRIES):  # contract invisible
    return _attempt(invoice, retries)
```

### Why Inference Is Not Enough at the Boundary

A reader of `charge(invoice, *, retries=DEFAULT_RETRIES)` cannot tell whether `invoice` is an `Invoice`, a dict, or an ID string. The checker can usually figure it out from call sites, but callers in other packages cannot — they see only the signature. Explicit hints at the boundary are the contract; inference is a local optimisation.

## Edge Cases

- Private helpers (`_name`) inside a module may skip hints when the call graph is small and local. Once a helper is imported outside the module, promote it and annotate it.
- `__init__` still needs parameter annotations; `-> None` return is required by ANN201 and makes the constructor's intent explicit.
- When a type is genuinely too complex to spell out, extract a `type` alias (PEP 695) rather than fall back to `Any` — see PYT-CORE-02.
- For escape hatches use the mandated `# type: ignore[code]  # reason: <text>` form from PYT-CORE-03; never a bare ignore.

## Related

PYT-CORE-02, PYT-CORE-03, PYT-CORE-05, PYT-TYPE-06
