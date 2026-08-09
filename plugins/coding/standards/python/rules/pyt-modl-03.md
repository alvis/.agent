# PYT-MODL-03: One Public Symbol Per Module

**Tool Coverage:** standard-only

## Intent

Each module exposes one public class or function, plus tightly cohesive helpers (small private dataclasses, local exceptions, internal constants) that exist only to support that public symbol. Large `utils.py` / `helpers.py` / `common.py` grab bags are a smell — they destroy cohesion, attract unrelated code, and become import-order landmines as unrelated subsystems accrete in the same file.

## Fix

```
# ✅ GOOD: one public symbol per module, named after the symbol
src/myproject/services/
├── __init__.py
├── billing_service.py        # class BillingService + _Invoice dataclass (private helper)
├── user_service.py           # class UserService + _UserRow dataclass
└── notification_service.py   # class NotificationService
```

```python
# src/myproject/services/billing_service.py
from dataclasses import dataclass

from myproject.repository import BillingRepository

__all__ = ["BillingService"]

@dataclass(frozen=True, slots=True)
class _Invoice:                                    # private helper, not exported
    id: str
    amount_cents: int

class BillingService:                              # single public symbol
    def __init__(self, repo: BillingRepository) -> None:
        self._repo = repo

    def invoice(self, user_id: str, amount_cents: int) -> _Invoice: ...
```

```python
# ❌ BAD: utils.py grab bag
# src/myproject/utils.py
def slugify(text: str) -> str: ...
def parse_iso_date(value: str) -> date: ...
def retry(fn: Callable[..., T], attempts: int) -> T: ...
class EmailClient: ...
class CacheWrapper: ...
CURRENCY_DIGITS = {"USD": 2, "JPY": 0}
# Six unrelated symbols. Importing one drags in all five others, their transitive deps,
# and any future additions. Refactoring becomes terrifying.
```

### Refactor Path from `utils.py`

| Symbol kind                          | New home                                    |
|--------------------------------------|---------------------------------------------|
| Pure text helper (`slugify`)         | `myproject/text/slugify.py`                 |
| Date parsing                         | `myproject/time/iso_date.py`                |
| Retry decorator                      | `myproject/resilience/retry.py`             |
| Email client class                   | `myproject/email/email_client.py`           |
| Domain constants                     | `myproject/currency/constants.py`           |

## Edge Cases

- Tightly cohesive helpers — a private dataclass used only by the public class, a module-local `Protocol`, a single `_validate(...)` function — belong in the same module. The test is whether removing the public symbol would orphan the helpers; if yes, keep them together.
- Enums and `Literal` unions that name a public concept deserve their own module (`order_status.py`) when they are imported independently from the class that consumes them.
- Small adjacent functions that share a single data type (e.g. four serializers for one dataclass) may colocate — aim for ≤ ~150 lines of public surface per module as a soft cap.

## Related

PYT-MODL-01, PYT-MODL-02, PYT-IMPT-05
