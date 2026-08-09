# RST-ERRH-04: Source-Chain Via `#[source]` / `#[from]`

**Tool Coverage:** standard-only — clippy does not detect "stringified source".

## Intent

When one error wraps another, the wrapper MUST keep the original reachable through `std::error::Error::source()`. `thiserror`'s `#[source]` and `#[from]` attributes wire that plumbing automatically; stringifying the cause with `format!("{e}")` (or storing a `String` field) breaks the chain. A broken chain blinds `tracing::error!(error = ?err)` output, the `anyhow::Error::chain()` iterator, and `Error::downcast_ref` — every observability surface that walks `.source()` to find the underlying I/O / driver / protocol error loses information that was already in the program.

## Fix

```rust
// ✅ GOOD: #[from] auto-converts and chains; #[source] keeps the cause reachable
use thiserror::Error;

#[derive(Debug, Error)]
pub enum BillingError {
    // #[from] gives an automatic From<sqlx::Error> for BillingError
    #[error("database failure")]
    Database(#[from] sqlx::Error),

    // explicit #[source] when extra context fields are needed alongside the cause
    #[error("payment provider {provider} rejected charge for invoice {invoice_id}")]
    ProviderRejected {
        provider: &'static str,
        invoice_id: uuid::Uuid,
        #[source]
        source: reqwest::Error,
    },
}

pub async fn charge(id: uuid::Uuid) -> Result<Receipt, BillingError> {
    let row = sqlx::query!("...").fetch_one(pool()).await?;   // #[from] kicks in
    let resp = http_post(&row).await.map_err(|source| BillingError::ProviderRejected {
        provider: "stripe",
        invoice_id: id,
        source,
    })?;
    Ok(resp.into())
}
```

```rust
// ❌ BAD: stringifies the source — chain is gone
#[derive(Debug, Error)]
pub enum BillingError {
    #[error("database failure: {0}")]
    Database(String),                              // <- String, not the real error
}

pub async fn charge(id: uuid::Uuid) -> Result<Receipt, BillingError> {
    sqlx::query!("...")
        .fetch_one(pool())
        .await
        .map_err(|e| BillingError::Database(format!("{e}")))?;   // <- chain dropped
    /* ... */
    # unimplemented!()
}
```

### `#[from]` vs `#[source]`

- **`#[from]`** — exactly one source type per variant; `?` converts automatically. Use when the wrapping is unambiguous (one foreign error → one domain variant).
- **`#[source]`** — explicit, no auto-conversion. Use when the variant carries additional context fields (record id, op, tenant), or when multiple variants share the same source type.

`#[error(transparent)]` is a third option for pure pass-through wrappers; it forwards both `Display` and `source()` to the inner error. Use only when adding zero new context.

## Edge Cases

- A source type must implement `std::error::Error + 'static` to satisfy `#[source]` — wrap non-`'static` borrowed data into an owned form first.
- `#[from]` cannot be combined with extra non-source fields on the same variant — switch to `#[source]` plus explicit field construction (as in the `ProviderRejected` example above).
- For `Box<dyn std::error::Error + Send + Sync>` sources, store the boxed trait object and mark it `#[source]`; do not stringify even at the trait-object boundary.
- When converting between two of your own error types, prefer an explicit `From` impl over `#[from]` so reviewers see the conversion site.

## Related

RST-ERRH-01, RST-ERRH-02, RST-ERRH-03, RST-ERRH-05, RST-CORE-05
