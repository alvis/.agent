# RST-NAME-03: Error Types End in `Error`

**Tool Coverage:** standard-only — no clippy lint catches missing `Error` suffix on Rust error types.

## Intent

Every type that represents a failure mode — whether a `struct` wrapping a single cause or an `enum` enumerating variants — MUST end in `Error`. The suffix is the contract: a reader scanning `pub enum PaymentDeclined` cannot tell whether they are looking at a failure type, a status enum, or a domain event. `pub enum PaymentDeclinedError` removes that ambiguity instantly and matches the convention used by `std::io::Error`, `std::fmt::Error`, `serde_json::Error`, and every well-behaved crate in the ecosystem. This rule mirrors PYT-NAME-02's exception-naming convention.

## Fix

```rust
// ✅ GOOD: every error type ends in `Error`
use thiserror::Error;

#[derive(Debug, Error)]
pub enum BillingError {
    #[error("invoice {id} not found")]
    InvoiceNotFound { id: uuid::Uuid },

    #[error("payment declined for invoice {id}: {reason}")]
    PaymentDeclined { id: uuid::Uuid, reason: String },

    #[error("database failure during {op}")]
    Database {
        op: &'static str,
        #[source]
        source: sqlx::Error,
    },
}

#[derive(Debug, Error)]
#[error("malformed configuration at {path}")]
pub struct ConfigParseError {
    pub path: std::path::PathBuf,
    #[source]
    pub source: toml::de::Error,
}
```

```rust
// ❌ BAD: error types missing the `Error` suffix
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Billing {                           // ambiguous — type or domain object?
    #[error("invoice {id} not found")]
    InvoiceNotFound { id: uuid::Uuid },

    #[error("payment declined for invoice {id}")]
    PaymentDeclined { id: uuid::Uuid },
}

#[derive(Debug, Error)]
#[error("malformed configuration")]
pub struct ConfigParseFailure {              // `Failure` is not `Error` — break convention
    pub path: std::path::PathBuf,
}

#[derive(Debug, Error)]
pub enum Reject { /* ... */ }                // single-word, no suffix
```

### The Suffix Is the Contract

`Result<T, E>` is the most common return type in Rust, and `E` is almost always read at a glance — `fn charge(...) -> Result<Receipt, BillingError>` tells you immediately that `BillingError` is the failure surface. `Result<Receipt, Billing>` reads as "succeeds with `Receipt` or returns a `Billing`" — the latter sounds like a value, not a fault. The suffix is not optional cosmetic noise; it is the type's job description.

## Edge Cases

- A single-variant error wrapper around an underlying source (`pub struct ParseError(#[from] std::num::ParseIntError);`) still keeps the suffix — it is still an error type.
- Domain *events* that report failure-shaped business outcomes (`PaymentRefused`, `OrderRejected`) are NOT error types when they are returned in the `Ok` branch of a `Result`. They are domain values; do not suffix them with `Error` just because they sound negative.
- Re-exports for backwards compatibility may keep an old non-suffixed name with `#[deprecated]`: `#[deprecated = "use BillingError"] pub type Billing = BillingError;`.
- Sealed/private error types inside a module follow the same rule — readability of `Result<T, _>` matters even within a crate.

## Related

RST-NAME-01, RST-NAME-02, RST-ERRH-01, RST-ERRH-04
