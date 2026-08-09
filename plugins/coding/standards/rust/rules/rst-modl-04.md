# RST-MODL-04: `lib.rs` Is Declarations Only

**Tool Coverage:** `standard-only` — clippy does not measure "logic density" in a file; reviewers MUST verify that `src/lib.rs` contains only crate-level docs, `pub mod` / `pub use` declarations, and (rarely) crate-level attribute configuration.

## Intent

`src/lib.rs` is the crate root and the entry point every consumer's `use my_crate::…` resolves through. Keeping it free of logic — no `fn`, no `const`, no `static`, no top-level statement bodies — makes the public surface readable at a glance: a reviewer scrolling `lib.rs` sees the module tree and the re-export list, nothing else. Logic that drifts into `lib.rs` becomes orphaned (no obvious module to test it under), creates circular-import hazards (every submodule already imports through the crate root), and conflates "what is exported" with "how it works". RST-MODL-01 already requires the binary's `main` to delegate to a `pub fn run` defined in a submodule; this rule extends the same discipline to the library crate.

## Fix

```rust
// ✅ GOOD: src/lib.rs — crate docs, module declarations, curated re-exports
//! my_crate — billing service library.
//!
//! # Quickstart
//!
//! ```no_run
//! # use my_crate::run;
//! run()?;
//! # Ok::<(), my_crate::MyError>(())
//! ```

#![warn(missing_docs)]

pub mod auth;
pub mod billing;
pub mod config;
pub mod error;
pub mod service;

pub use crate::auth::User;
pub use crate::billing::{Invoice, Receipt};
pub use crate::error::MyError;
pub use crate::service::run;
```

```rust
// ❌ BAD: src/lib.rs carries logic, constants, and helpers
//! my_crate — billing service library.

pub mod billing;

pub const DEFAULT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30); // ← move to billing or config
pub static SHARED: once_cell::sync::OnceCell<Pool> = once_cell::sync::OnceCell::new(); // ← move to service::pool

/// Orchestrates the billing run — should live in service::run.
pub fn run(cfg: Config) -> Result<(), MyError> { // ← move to src/service.rs
    let pool = SHARED.get_or_init(|| Pool::connect(&cfg.db_url));
    billing::process(pool)?;
    Ok(())
}

fn validate(input: &Input) -> Result<(), MyError> { // ← orphaned helper
    if input.id.is_empty() { return Err(MyError::Invalid); }
    Ok(())
}
```

### What May Live in `lib.rs`

| Allowed                                                       | Forbidden                                                |
|---------------------------------------------------------------|----------------------------------------------------------|
| `//!` crate-level rustdoc                                     | `fn` definitions (move to a submodule)                   |
| `pub mod foo;` declarations                                   | `const` / `static` items (move to the module that owns them) |
| `pub use crate::foo::Bar;` curated re-exports (RST-IMPT-03)   | `impl` blocks (move alongside the type)                  |
| Crate-level attributes (`#![warn(missing_docs)]`, `#![deny(unsafe_code)]`) | `use` of external crates beyond what re-exports demand   |
| `type` aliases that *belong* to the public surface and have no obvious owning module (rare — prefer a `prelude` submodule) | macro definitions (move to a `macros` submodule)         |
| `extern crate` declarations for sysroot crates (almost never needed in 2024-edition) | Test modules (`#[cfg(test)] mod tests` belongs in the implementation module) |

### Why a Strict Crate Root Helps

- **Single source of truth for the public surface** — `cat src/lib.rs` is the API summary. No hunting through helpers to discover what was exported.
- **No circular-import hazards** — submodules `use crate::error::MyError;` directly; if `lib.rs` itself contained `fn` bodies, those would compete for the same `crate::` namespace and create accidental coupling.
- **Predictable refactoring** — moving a module is a one-line `pub mod` rename in `lib.rs`; moving logic that lives in `lib.rs` requires touching every call site that imported it via `my_crate::helper`.
- **Pairs with RST-IMPT-03** — re-exports flow through `lib.rs` only. Chained re-exports through intermediate modules are independently forbidden; combining the two rules makes `lib.rs` the unique crate-level surface.

## Edge Cases

- **Trivial helper crates** (a 50-line "constants" crate, a 30-line FFI wrapper) MAY have a small body in `lib.rs` simply because there is no second module to split into. The moment a second concern appears, factor into modules.
- **`prelude` modules** are the sanctioned home for "everything a downstream user wants in scope" — `pub mod prelude;` declared in `lib.rs`, with re-exports curated inside `src/prelude.rs`. Do not invert this by putting the prelude items in `lib.rs` directly.
- **Crate-level macro_rules! definitions** with `#[macro_export]` historically had to live in `lib.rs`; with the 2018+ macro path system they can live in any module and be re-exported. Prefer a `macros` submodule.
- **`#![no_std]` / `#![no_main]` attributes** are configuration, not logic — they belong on `lib.rs` even though they affect the whole crate. The principle is "no executable code"; attributes that *constrain* the crate are fine.

## Related

RST-MODL-01, RST-MODL-02, RST-MODL-03, RST-IMPT-03, RST-CORE-04
