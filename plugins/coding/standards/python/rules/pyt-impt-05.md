# PYT-IMPT-05: Declare `__all__` in Public Package `__init__.py`

**Tool Coverage:** ruff:F822 (partial — F822 flags undefined names *inside* `__all__`, but does not flag a package that omits `__all__` entirely)

## Intent

Every public package `__init__.py` MUST declare `__all__` as a tuple or list of string names. `__all__` defines the re-export surface for `from pkg import *`, drives documentation generators (Sphinx, pdoc) and IDE completion, and makes "what is public" a code-reviewable artifact rather than "whatever happens to be named without a leading underscore".

## Fix

```python
# ✅ GOOD: myapp/services/__init__.py
from myapp.services.billing import InvoiceService
from myapp.services.users import UserService

__all__ = (
    "InvoiceService",
    "UserService",
)
```

```python
# ❌ BAD: no __all__, public surface is implicit and drifts
from myapp.services.billing import InvoiceService, _InternalHelper
from myapp.services.users import UserService
# what's public? whoever reads this has to guess based on underscores
```

### What Belongs in `__all__`

- Classes, functions, and constants that external callers should depend on.
- Listed in the same order as the imports above, so the file reads top-to-bottom.
- Names prefixed with `_` (private) never appear — they stay module-local.

## Edge Cases

- Leaf modules (non-package files) do not require `__all__`; this rule targets package `__init__.py` files where re-export is the whole point.
- Private packages (those whose name starts with `_`) still benefit from `__all__` for internal hygiene, but it is optional.
- Use a tuple (`__all__ = ("A", "B")`) over a list when the surface is fixed — it signals immutability and slightly reduces memory.
- Ruff's `F822` will flag if a name listed in `__all__` is not actually defined; combine with code review for the "missing entirely" case.

## Related

PYT-MODL-02, PYT-MODL-03, PYT-IMPT-01
