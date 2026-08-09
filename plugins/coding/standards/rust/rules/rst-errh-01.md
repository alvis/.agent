# RST-ERRH-01: Library Errors Derive `thiserror::Error`

**Tool Coverage:** standard-only — clippy does not enforce `Error` impl presence.

## Intent

Every error type exposed by a library MUST implement `std::error::Error` so callers can chain it, log it via `{:#}`, and downcast across crate boundaries. Hand-rolled `impl Error` is busywork and easy to get wrong (missing `source()`, missing `Display`); deriving `thiserror::Error` produces a correct implementation from per-variant `#[error("…")]` annotations and `#[source]` / `#[from]` markers. Plain wrapper structs that only carry a `String` lose the source chain (RST-ERRH-04) and break interop with `anyhow`, `tracing`, and the wider ecosystem.

## Fix

```rust
// ✅ GOOD: thiserror-derived enum with per-variant messages and source chaining
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

pub fn charge(id: uuid::Uuid) -> Result<Receipt, BillingError> {
    /* ... */
    # unimplemented!()
}
```

```rust
// ❌ BAD: stringly-typed wrapper with no Error impl, no source chain
pub struct BillingError(String);

impl BillingError {
    pub fn new(msg: impl Into<String>) -> Self {
        Self(msg.into())
    }
}

pub fn charge(id: uuid::Uuid) -> Result<Receipt, BillingError> {
    Err(BillingError::new(format!("invoice {id} not found")))
}
```

### Why Derive Beats Hand-Roll

`#[derive(thiserror::Error)]` generates `impl Display`, `impl std::error::Error`, and the correct `source()` plumbing from `#[source]` / `#[from]` markers. Hand-written `impl Error` invariably forgets `source()`, which silently breaks `tracing::error!(error = ?e)` formatting and `anyhow::Error::chain()` traversal at the binary boundary.

## Edge Cases

- A single-variant error MAY still be a `struct` (e.g. `#[derive(Debug, Error)] #[error("…")] pub struct ConfigLoadError { #[from] source: io::Error }`); the derive still applies.
- Errors carrying non-`'static` data (lifetime-bearing references) cannot satisfy `std::error::Error: 'static` for downcasting — clone or own the borrowed data at the error boundary.
- `thiserror` 2.x supports `#[error(transparent)]` for pure source-forwarding wrappers; use it only when no extra context is added (otherwise the message is empty and RST-ERRH-05 is violated).
- For FFI / `no_std` libraries where `thiserror` cannot be used, hand-implement `Display` + `Error` and document the deviation with a `// reason:` per RST-CORE-03.

## Related

RST-ERRH-02, RST-ERRH-03, RST-ERRH-04, RST-ERRH-05, RST-NAME-03
