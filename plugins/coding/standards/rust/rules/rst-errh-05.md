# RST-ERRH-05: Error Messages Carry Identifying Context

**Tool Coverage:** standard-only — message quality is not statically checkable.

## Intent

Backtraces show where the error was raised; the **message** must show *which* record, tenant, file, URL, or operation was involved. A message of `"not found"` produces a log line that is indistinguishable from every other "not found" in the service and forces an engineer to reconstruct context from surrounding lines (which during an incident may not exist). Every variant's `#[error("…")]` template MUST interpolate the identifying fields the variant carries; if the variant carries none, add the fields. Mirrors PYT-EXCP-05 ("not found" alone is forbidden) for Rust.

## Fix

```rust
// ✅ GOOD: every variant interpolates identifying fields
use thiserror::Error;

#[derive(Debug, Error)]
pub enum BillingError {
    #[error("invoice {invoice_id} not found for tenant {tenant_id}")]
    InvoiceNotFound {
        invoice_id: uuid::Uuid,
        tenant_id: uuid::Uuid,
    },

    #[error("payment declined for invoice {invoice_id}: provider={provider} code={code}")]
    PaymentDeclined {
        invoice_id: uuid::Uuid,
        provider: &'static str,
        code: u16,
    },

    #[error("database failure during {op} for tenant {tenant_id}")]
    Database {
        op: &'static str,
        tenant_id: uuid::Uuid,
        #[source]
        source: sqlx::Error,
    },
}

// raise-site carries the context — no stringly reconstruction needed
return Err(BillingError::InvoiceNotFound {
    invoice_id: id,
    tenant_id: ctx.tenant,
});
```

```rust
// ❌ BAD: message restates the class name, drops the identifier
#[derive(Debug, Error)]
pub enum BillingError {
    #[error("not found")]                     // which invoice? which tenant?
    InvoiceNotFound,
    #[error("declined")]                      // declined what? declined why?
    PaymentDeclined,
    #[error("db error")]                      // during which operation?
    Database(#[from] sqlx::Error),
}
```

### What to Include

- **Who**: tenant, user, account id.
- **What**: record id, file path, URL, field name.
- **Which value failed**: the input (redacted if sensitive — last-4, hashed, or id-only).
- **Which operation**: only if not obvious from the variant name (`Database { op: "load_user" }`).

### What to Exclude

- Stack-trace words (`at …`, `in function …`) — the backtrace already has them.
- Secrets, tokens, full PII — log an identifier, not the value.
- Redundant restatement of the variant name (`"InvoiceNotFound: not found"`).

## Edge Cases

- Sensitive inputs (passwords, raw card numbers, tokens) — never include the value; reference by id, hash, or last-4.
- Very long inputs (full HTTP payload) — truncate inside `Display` via a helper: `{}` of a wrapper that prints the first N characters plus `…`.
- Variants that genuinely identify themselves by name alone (e.g. `BadMagicByte` in a binary-format parser) MAY skip context if the position is captured in a sibling variant — but in practice, every interesting parser variant carries a byte offset.
- For `#[error(transparent)]` variants the inner error supplies the message; ensure the *inner* error already meets this rule.

## Related

RST-ERRH-01, RST-ERRH-03, RST-ERRH-04, RST-TYPE-01, RST-NAME-03
