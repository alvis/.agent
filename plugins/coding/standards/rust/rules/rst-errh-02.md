# RST-ERRH-02: `anyhow` Only at the Binary Boundary

**Tool Coverage:** standard-only — no clippy lint distinguishes "library API" from "binary main".

## Intent

`anyhow::Error` erases the concrete error type into a trait object. That is exactly what a top-level `main` / CLI handler / request handler wants — bubble anything, attach context, print a chain — and exactly what a library MUST NOT impose on its callers. A library that returns `anyhow::Result<T>` forces every downstream consumer to match by string, give up exhaustive `match` over variants, and lose the ability to react programmatically (retry on `DatabaseTimeout`, surface `InvoiceNotFound` as HTTP 404). Libraries return a typed error (RST-ERRH-01); binaries upgrade to `anyhow` at the outermost frame.

## Fix

```rust
// ✅ GOOD: library API returns a typed error; binary main uses anyhow
// lib.rs
use thiserror::Error;

#[derive(Debug, Error)]
pub enum BillingError {
    #[error("invoice {id} not found")]
    InvoiceNotFound { id: uuid::Uuid },
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

// main.rs (binary crate) — anyhow is welcome here
use anyhow::Context;

fn main() -> anyhow::Result<()> {
    let cfg = config::load().context("loading config")?;
    let receipt = billing::charge(cfg.invoice_id)
        .context("charging invoice")?;
    println!("{receipt:?}");
    Ok(())
}
```

```rust
// ❌ BAD: library API leaks anyhow — callers cannot match by variant
// lib.rs
pub fn charge(id: uuid::Uuid) -> anyhow::Result<Receipt> {
    let invoice = repo::load(id)?;
    /* ... */
    # unimplemented!()
}

// caller cannot write `match err { BillingError::InvoiceNotFound { .. } => 404, ... }`
// they get a stringly typed blob instead
```

### Where the Line Sits

The boundary is the **binary entrypoint** — `fn main`, an HTTP handler, a CLI subcommand dispatcher, a long-running task's outer loop. Everything below that line returns its own typed error. The boundary frame is where `anyhow::Context::context(...)` adds the human-readable trail and where the typed error is finally type-erased for reporting.

## Fix Edge

```rust
// ✅ GOOD: even an HTTP handler keeps the typed error inside, anyhow at the edge
async fn http_charge(Path(id): Path<uuid::Uuid>) -> Result<Json<Receipt>, ApiError> {
    let receipt = billing::charge(id)?;  // BillingError -> ApiError via #[from]
    Ok(Json(receipt))
}
```

## Edge Cases

- Internal binary crates (a CLI that does no library work) MAY use `anyhow` end-to-end — there is no library to protect.
- Integration tests under `tests/` MAY use `anyhow::Result<()>` as the test return type; tests are binaries.
- `examples/` files are binaries and MAY use `anyhow`.
- A library MAY depend on `anyhow` internally (e.g. inside a `build.rs`) as long as no public function signature mentions `anyhow::Error` / `anyhow::Result`.
- For libraries that genuinely need an open-ended "anything" error in their public API, define `pub enum FooError { Other(#[source] Box<dyn std::error::Error + Send + Sync>) }` — typed at the API, trait-object behind one variant. Do not reach for `anyhow`.

## Related

RST-ERRH-01, RST-ERRH-03, RST-ERRH-04, RST-CORE-05, RST-MODL-01
