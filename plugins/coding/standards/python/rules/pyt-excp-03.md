# PYT-EXCP-03: `raise ... from` for Intentional Chaining

**Tool Coverage:** ruff:B904 (fully covered — flags `raise` inside `except` without `from`)

## Intent

When translating one exception to another, always be explicit about the cause. `raise NewError(...) from e` preserves the original traceback under "The above exception was the direct cause…". `raise NewError(...) from None` deliberately suppresses it — use only when the original cause is implementation noise the caller should not see.

## Fix

```python
# ✅ GOOD: chain — preserve cause
def load_invoice(invoice_id: str) -> Invoice:
    try:
        raw = db.fetch(invoice_id)
    except db.RecordNotFound as exc:
        raise InvoiceNotFoundError(f"invoice {invoice_id}") from exc

# ✅ GOOD: suppress — translating driver noise to domain API
def read_config(path: Path) -> Config:
    try:
        return Config.model_validate_json(path.read_text())
    except (OSError, ValueError) as exc:
        raise ConfigLoadError(f"cannot load {path}: {exc}") from None

# ❌ BAD: implicit chaining (B904) — traceback still shows original but intent unclear
def load_invoice(invoice_id: str) -> Invoice:
    try:
        raw = db.fetch(invoice_id)
    except db.RecordNotFound:
        raise InvoiceNotFoundError(f"invoice {invoice_id}")

# ❌ BAD: dropping the cause by accident
raise InvoiceNotFoundError(...) from None   # only if cause truly is noise
```

### Decision

- Is the original exception useful for debugging the new one? → `from exc`
- Is the original exception a leaky implementation detail (e.g. `sqlite3.OperationalError` under a repository interface)? → `from None`
- Ambiguous? Default to `from exc` — preserving context is rarely wrong.

## Edge Cases

- `B904` fires on `raise NewError()` inside an `except` clause with no `from` — the fix is automatic conceptually but left to the author so intent is explicit.
- Re-raising the same exception uses a bare `raise`, not `raise exc` — see `ruff TRY201`.
- Inside `except*` (exception groups) each sub-exception should also use `from` — `B904` covers that path.

## Related

PYT-EXCP-01, PYT-EXCP-04, PYT-EXCP-05
