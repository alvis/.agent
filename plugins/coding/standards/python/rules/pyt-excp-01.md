# PYT-EXCP-01: Domain-Rooted Exception Hierarchy

**Tool Coverage:** ruff:TRY002 (partial — flags raising vanilla `Exception`, not absence of hierarchy)

## Intent

Every domain-level error must inherit from a single domain base class (e.g. `BillingError`). Callers can then write `except BillingError:` to catch "anything this module throws" without enumerating subclasses, and cross-domain failures stay visually distinct from `ValueError` / `RuntimeError`.

## Fix

```python
# ✅ GOOD: single domain root, specific leaves
class BillingError(Exception):
    """Base for all billing-domain failures."""

class InvoiceNotFoundError(BillingError): ...
class PaymentDeclinedError(BillingError): ...
class InvalidCurrencyError(BillingError, ValueError): ...  # multi-inherit ok

# caller: one clause covers the whole domain
try:
    charge(invoice_id)
except BillingError as exc:
    logger.warning("billing failed", exc_info=exc)

# ❌ BAD: raising bare Exception — uncatchable except via generic Exception
def load_invoice(id: str) -> Invoice:
    raise Exception(f"invoice {id} not found")   # TRY002

# ❌ BAD: flat hierarchy — no common root
class InvoiceNotFoundError(Exception): ...
class PaymentDeclinedError(Exception): ...
```

### Naming

- Base class: `<Domain>Error` (singular, title-cased).
- Leaves: `<Condition>Error` — always end with `Error`.
- Never name an exception class `Exception` or `Base…` alone.

## Edge Cases

- A leaf MAY multiply inherit from the domain base and a stdlib exception (e.g. `ValueError`) when callers genuinely want both hooks — use sparingly; it complicates `except` ordering.
- Do not inherit from `BaseException` directly (see PYT-EXCP-02).
- `ruff TRY002` flags `raise Exception(...)` literally; it cannot verify the domain base exists or is used — that check is policy-enforced in review.

## Related

PYT-EXCP-02, PYT-EXCP-03, PYT-EXCP-05
