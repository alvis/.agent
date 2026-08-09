# RST-IMPT-03: Re-Export Public Surface from `lib.rs` Only

**Tool Coverage:** standard-only (no clippy lint; reviewer-enforced).

## Intent

The crate's public surface is declared in **one place**: `src/lib.rs`. Intermediate modules MUST NOT chain `pub use` re-exports to "flatten" their subtree — every `pub use crate::a::b::c::Type;` lives in `lib.rs`, alongside the rest of the public API. Chained re-exports through intermediate modules (`api/mod.rs` re-exporting from `api/handlers/v1`, then `lib.rs` re-exporting from `api`) create multiple equivalent paths to the same type (`crate::Type`, `crate::api::Type`, `crate::api::handlers::Type`, `crate::api::handlers::v1::Type`), making `rustdoc` noisier, import autocompletion ambiguous, and refactor diffs unreviewable. A single-source `lib.rs` makes the public API a single file the reader can scan.

## Fix

```rust
// ✅ GOOD: lib.rs is the only place re-exports happen
// src/lib.rs
//! Billing crate — charges invoices, records receipts.

pub mod api;
pub mod errors;
pub mod models;

pub use crate::api::handlers::v1::charge;
pub use crate::errors::BillingError;
pub use crate::models::{Invoice, Receipt, UserId};
```

```rust
// src/api.rs — intermediate module declares submodules ONLY, no chained re-exports
pub mod handlers;
```

```rust
// src/api/handlers.rs — same: declare submodules, no chained re-exports
pub mod v1;
```

```rust
// ❌ BAD: chained re-exports through intermediate modules
// src/api.rs
pub mod handlers;
pub use crate::api::handlers::v1::charge; // ← chained from here
pub use crate::api::handlers::v1::Receipt;

// src/api/handlers.rs
pub mod v1;
pub use crate::api::handlers::v1::charge; // ← and from here

// src/lib.rs
pub mod api;
pub use crate::api::charge; // ← and now three paths exist for the same symbol
```

### Why a Single Re-Export Site Matters

Every chained re-export creates an alias that callers can latch onto. Once `crate::charge` and `crate::api::charge` and `crate::api::handlers::charge` all resolve to the same item, refactoring (renaming the underlying module, moving the function) forces grepping all three forms across every dependent crate. With re-exports concentrated in `lib.rs`, there is exactly one alias to maintain and one place to read the public contract.

## Edge Cases

- A `prelude` module that exists specifically to be glob-imported (`use crate::prelude::*`) may re-export from sibling modules — its purpose IS to flatten. Treat `prelude` as a peer of `lib.rs` for this rule, not as an intermediate module.
- Test-only or `pub(crate)` re-exports inside intermediate modules are fine — they do not enter the public surface. Only `pub use` outside the `pub(crate)` boundary is forbidden.
- A workspace member crate's `lib.rs` is still its own single-source re-export site; the rule applies per-crate, not per-workspace.

## Related

RST-IMPT-01, RST-IMPT-02, RST-MODL-04
