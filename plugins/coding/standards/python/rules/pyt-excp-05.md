# PYT-EXCP-05: Exception Messages Carry Context

**Tool Coverage:** standard-only

## Intent

The traceback already shows the stack — an exception message should not repeat it. Carry the **identifiers, inputs, and state** needed to triage the failure from a log line alone: record IDs, tenant, user, the value that failed, the operation in flight. "Not found" is useless; "invoice `inv_42` not found for tenant `t_7`" is actionable.

## Fix

```python
# ✅ GOOD: context in the message
class InvoiceNotFoundError(BillingError):
    def __init__(self, invoice_id: str, tenant_id: str) -> None:
        super().__init__(f"invoice {invoice_id!r} not found for tenant {tenant_id!r}")
        self.invoice_id = invoice_id
        self.tenant_id = tenant_id

raise InvoiceNotFoundError(invoice_id=iid, tenant_id=tid)

# ✅ GOOD: structured fields for log pipelines
raise PaymentDeclinedError(
    f"payment declined: provider={provider} code={code} amount={amount}"
)

# ❌ BAD: message restates what the class name already says
raise InvoiceNotFoundError("not found")

# ❌ BAD: message duplicates the stack trace
raise InvoiceNotFoundError(f"at billing.service.load_invoice: invoice missing")
```

### What to Include

- **Who**: tenant, user, account
- **What**: record id, file path, URL, field name
- **Which value failed**: the input (redacted if sensitive)
- **Which operation**: if not obvious from the class name

### What to Exclude

- Stack-trace words (`at …`, `in function …`) — the traceback has them.
- Secrets, tokens, passwords, full PII — log an identifier instead.

## Edge Cases

- Sensitive inputs (passwords, tokens) — never include the value; reference by id or last-4.
- Long inputs (a full payload) — truncate: `f"payload (first 200 chars): {raw[:200]!r}"`.
- `ruff TRY003` discourages "long messages outside the exception class" — pushing formatting into the class `__init__` (as in the ✅ GOOD example above) satisfies both rules.
- Tooling cannot check "is this message useful?" — the judgement is policy-enforced in review.

## Related

PYT-EXCP-01, PYT-EXCP-03, PYT-EXCP-04
