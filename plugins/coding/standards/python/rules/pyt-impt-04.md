# PYT-IMPT-04: Lazy Imports and `TYPE_CHECKING` Guards

**Tool Coverage:** ruff:TC001, TC002, TC003, TC004 (partial — tools move typing-only imports behind the guard but cannot tell whether you are using the guard to paper over a real architectural cycle)

## Intent

Use `if TYPE_CHECKING:` to defer imports that exist only for annotations, and use function-local imports sparingly for (a) genuine expensive-at-import modules that most callers never need, or (b) breaking a true runtime cycle that cannot be restructured. Never use `TYPE_CHECKING` as a band-aid for a circular dependency caused by layering mistakes — fix the cycle by moving the shared type into a lower-level module.

## Fix

```python
# ✅ GOOD: typing-only import hidden behind TYPE_CHECKING
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from myapp.services.billing import InvoiceService

def render(service: "InvoiceService") -> str:
    ...
```

```python
# ✅ GOOD: expensive import deferred to the one function that needs it
def export_to_parquet(path: str, rows: list[dict]) -> None:
    import pyarrow  # 200ms+ import, only loaded when export is actually called
    import pyarrow.parquet as pq
    ...
```

```python
# ❌ BAD: TYPE_CHECKING used to mask a real runtime cycle
# billing.py imports users.py at runtime; users.py hides `from billing import X`
# behind TYPE_CHECKING only to silence the ImportError — the cycle is still there
# and will bite the next refactor. Move the shared type to a neutral module instead.
```

## Edge Cases

- Values used at runtime (default arguments, `isinstance` checks, `cast()`, decorators) must stay as normal imports — `TC004` flags runtime use of a `TYPE_CHECKING` import.
- When a module is only expensive for a single rarely-used function, prefer the function-local import over a top-level one; document with a brief comment why it is deferred.
- Quote the annotation (`"InvoiceService"`) when it appears in a runtime-evaluated context (e.g., `@dataclass` field types on Python where the class is needed for introspection), or move the shared type up.

## Related

PYT-IMPT-01, PYT-IMPT-03, PYT-MODL-02
