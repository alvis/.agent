# Rust: Compliant Code Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Key Principles

- Borrow over clone — accept `&str`/`&[T]`/`&Path` at boundaries; allocate only when ownership is genuinely taken.
- Typed errors with `thiserror` in libraries; `anyhow` lives at the binary boundary only, never in a library's public API.
- Every rule declares a **Tool Coverage** line — the standard exists only where tooling cannot enforce judgment.
- Target Rust 1.95+ on the 2024 edition: `let-else`, async `fn` in traits, GATs, `[lints]` table, edition-2024 prelude.
- `cargo nextest run` is the only test command; `bacon` is the only dev loop. `cargo test`/`cargo watch` are forbidden.
- `clippy::all` + `clippy::pedantic` are denied at workspace level; the curated allow-list below is the only sanctioned relaxation.
- `unsafe` requires a `// SAFETY:` block; `#[allow(...)]` requires a `// reason:` postfix.
- Async is runtime-agnostic: principles target structured concurrency, cancellation safety, and no blocking I/O regardless of executor.

## Core Rules Summary

### Core Safety (RST-CORE)

- **RST-CORE-01**: No `.unwrap()` / `.expect(...)` in `src/lib.rs` paths; propagate with `?` and typed errors.
- **RST-CORE-02**: Every `unsafe { ... }` block carries a preceding `// SAFETY:` comment enumerating invariants.
- **RST-CORE-03**: `#[allow(lint)]` requires a `// reason: <text>` postfix on the same or preceding line.
- **RST-CORE-04**: Workspace `Cargo.toml` `[lints]` table denies `clippy::all` + `clippy::pedantic`, with the curated allow-list documented below.
- **RST-CORE-05**: No `Box<dyn Any>` / `Box<dyn Error + Send + Sync + 'static>` (as internal API types) or other type-erased escape hatches.

### Ownership & Borrowing (RST-OWNS)

- **RST-OWNS-01**: Borrow over clone — `&str` over `&String`, `&[T]` over `&Vec<T>`, `&Path` over `&PathBuf`.
- **RST-OWNS-02**: Use `Cow<'a, T>` at API boundaries that may borrow, so callers don't pay for allocation by default.
- **RST-OWNS-03**: No `Rc<RefCell<T>>` / `Arc<Mutex<T>>` for shared mutability where `&mut` ownership or message passing fits.
- **RST-OWNS-04**: Lifetimes on public boundaries are named meaningfully (`'src`, `'tx`, `'req`) — never `'a`/`'b`.

### Error Handling (RST-ERRH)

- **RST-ERRH-01**: Library error types derive `thiserror::Error` and implement `std::error::Error`.
- **RST-ERRH-02**: `anyhow::Error` / `anyhow::Result` only at the binary `main` / CLI handler boundary — never in library APIs.
- **RST-ERRH-03**: `?` over `.unwrap()`; `panic!` only on truly unrecoverable invariants.
- **RST-ERRH-04**: Source-chain via `#[source]` / `#[from]`; never stringify the inner error.
- **RST-ERRH-05**: Error messages carry identifying context (record id, op, tenant) — never `"not found"` alone.

### Type Shape (RST-TYPE)

- **RST-TYPE-01**: Newtypes (`struct UserId(Uuid)`) for sibling IDs; block accidental cross-domain mixing.
- **RST-TYPE-02**: `enum` for finite state, never bare `&str`/`String`.
- **RST-TYPE-03**: Prefer `impl Trait` returns at boundaries instead of leaking concrete iterator/future types.
- **RST-TYPE-04**: Generic bounds move to a `where` clause once there are 2+ bounds.
- **RST-TYPE-05**: No `String`-as-enum; use `strum::EnumString` if parsing is genuinely required.

### Async (RST-ASYNC)

- **RST-ASYNC-01**: No blocking I/O inside an `async fn` — route through `spawn_blocking` (or your runtime's equivalent).
- **RST-ASYNC-02**: Structured fan-out via `JoinSet` / `tokio::try_join!`, never loose `tokio::spawn` whose handles are dropped.
- **RST-ASYNC-03**: Cancellation safety — drops must leave invariants intact; document non-obvious cases with `// CANCEL-SAFE:`.
- **RST-ASYNC-04**: No `block_on` / `Handle::block_on` from inside an async context.

### Module Structure (RST-MODL)

- **RST-MODL-01**: Binary crate is a thin `src/main.rs`; all logic lives in `src/lib.rs` (or a sibling library crate).
- **RST-MODL-02**: Workspace uses `resolver = "2"` (or `"3"` on edition 2024).
- **RST-MODL-03**: `mod.rs` is banned — use `foo.rs` + `foo/` directory layout.
- **RST-MODL-04**: `src/lib.rs` contains only `pub mod` / `pub use` declarations and crate-level docs; no logic.

### Parameters (RST-PARM)

- **RST-PARM-01**: No boolean positional arguments at public functions; use an `enum` variant or a builder.
- **RST-PARM-02**: `impl AsRef<Path>` for path parameters; `impl Into<String>` only when ownership is taken.
- **RST-PARM-03**: No signature with more than five parameters — bundle into a request struct (builder if many optionals).
- **RST-PARM-04**: Fluent chains return `&mut Self` from `&mut self`; consuming `self` is reserved for `Builder::build`.

### Imports (RST-IMPT)

- **RST-IMPT-01**: No glob `use foo::*` outside `tests` modules or a named `prelude` module.
- **RST-IMPT-02**: `use` ordering is std → external crates → crate-local, blank-line separated, rustfmt-enforced.
- **RST-IMPT-03**: Re-export the public surface from `lib.rs` only — no chained re-exports through intermediate modules.

### Naming (RST-NAME)

- **RST-NAME-01**: `snake_case` for fns/vars/modules/files; `PascalCase` for types/traits/enum variants.
- **RST-NAME-02**: `SCREAMING_SNAKE_CASE` reserved for `const` / `static` items.
- **RST-NAME-03**: Error types end in `Error` (`PaymentDeclinedError`, not `PaymentDeclined`).
- **RST-NAME-04**: Capability traits are adjectives (`Readable`); conversion traits use `From*` / `Into*` / `As*`.

### Tooling (RST-TOOL)

- **RST-TOOL-01**: `rust-toolchain.toml` pins channel and components (`rustfmt`, `clippy`).
- **RST-TOOL-02**: `cargo nextest run` is the canonical test command; `cargo test` is forbidden in CI scripts and docs.
- **RST-TOOL-03**: `bacon` configured via a checked-in `bacon.toml`; `cargo watch` is forbidden.
- **RST-TOOL-04**: `Cargo.toml` `[lints]` table denies `clippy::all` + `clippy::pedantic`, allowing the curated subset below with `// reason:` justifications.

## Patterns

### Error Hierarchy

Libraries declare typed errors with `thiserror`; the binary boundary upgrades them to `anyhow::Error` for top-level reporting. Sources chain via `#[from]`, never via `format!("{e}")`.

```rust
// lib.rs (library crate)
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

// main.rs (binary crate) — anyhow is fine here
fn main() -> anyhow::Result<()> {
    let cfg = config::load()?;
    billing::run(&cfg)?;
    Ok(())
}
```

### Newtype for Sibling IDs

Two `Uuid` fields with different meanings get distinct types so the compiler blocks accidental swaps.

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct UserId(pub uuid::Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct OrderId(pub uuid::Uuid);

pub fn charge(order_id: OrderId, user_id: UserId) -> Result<Receipt, BillingError> { /* ... */ }
```

### Builder for Optional Params

Functions with >5 parameters, or many optional ones, become a `*Request` struct with a fluent builder. The builder uses `&mut self -> &mut Self` for chaining and consumes `self` only on `build`.

```rust
pub struct DeployRequest {
    service: String,
    version: String,
    environment: Environment,
    dry_run: bool,
    verbose: bool,
    max_retries: u32,
    timeout: std::time::Duration,
}

#[derive(Default)]
pub struct DeployRequestBuilder {
    /* fields mirror DeployRequest as Option<T> */
}

impl DeployRequestBuilder {
    pub fn service(&mut self, s: impl Into<String>) -> &mut Self { /* ... */; self }
    pub fn version(&mut self, v: impl Into<String>) -> &mut Self { /* ... */; self }
    pub fn build(self) -> Result<DeployRequest, BuildError> { /* ... */ }
}
```

### Structured Async Fan-Out

Use a runtime-provided structured fan-out primitive (`JoinSet` for dynamic sets, `try_join!` for fixed heterogeneous sets). Loose `spawn` whose `JoinHandle` is dropped is forbidden — it loses cancellation and error propagation.

```rust
use tokio::task::JoinSet;

pub async fn fetch_all(urls: Vec<String>) -> Result<Vec<Bytes>, FetchError> {
    let mut set = JoinSet::new();
    for url in urls {
        set.spawn(fetch_one(url));
    }
    let mut out = Vec::with_capacity(set.len());
    while let Some(res) = set.join_next().await {
        out.push(res??);
    }
    Ok(out)
}
```

For non-tokio runtimes, the same principle applies: every spawned task must be tracked, awaited, and cancelled together with its parent scope.

### Curated `clippy::pedantic` Allow-List

`RST-CORE-04` and `RST-TOOL-04` together require the workspace `Cargo.toml` `[lints]` table to deny `clippy::all` + `clippy::pedantic`, then explicitly allow the following lints, each with a `// reason:` justification. Adding to this list requires team review.

| Lint                                       | Allow reason (matches our principle)                                                                 |
|--------------------------------------------|------------------------------------------------------------------------------------------------------|
| `clippy::module_name_repetitions`          | Mirrors PYT-MODL-03 / TYP-MODL-01 — one public symbol per module makes `foo::FooClient` idiomatic.   |
| `clippy::missing_errors_doc`               | Errors are typed; per RST-ERRH-01 the type itself documents failure modes. `///` docs are mandatory at the *type*, not every `Result` return site. |
| `clippy::missing_panics_doc`               | Per RST-CORE-01 we already forbid `panic!` in libs; the rare allowed panic is documented at the call site. |
| `clippy::must_use_candidate`               | `#[must_use]` is opinionated; we mandate it only for builders and `Result`-like value objects.       |
| `clippy::return_self_not_must_use`         | Same — fluent chains (`&mut Self`) per RST-PARM-04 don't need `#[must_use]`.                         |
| `clippy::implicit_hasher`                  | Permits ergonomic `HashMap<K, V>` in API surfaces; security-sensitive code uses explicit hasher.     |
| `clippy::similar_names`                    | Domain vocabulary (`user_id` vs `order_id`) often collides legitimately; RST-TYPE-01 newtypes solve the actual risk. |
| `clippy::struct_excessive_bools`           | Per RST-PARM-01 booleans become enum variants when behavioural — but pure config DTOs may carry flags. |
| `clippy::too_many_arguments`               | Superseded by RST-PARM-03 (>5 → request struct); clippy's threshold differs and would double-fire.   |
| `clippy::doc_markdown`                     | Generates noise on legitimate proper nouns (`PostgreSQL`, `OpenAPI`); reviewers catch real prose bugs. |

**Denied without exception** (these catch real bugs and align with PYT/TYP strictness):

- `clippy::unwrap_used`, `clippy::expect_used` — enforce RST-CORE-01.
- `clippy::panic` — enforce RST-CORE-01.
- `clippy::dbg_macro`, `clippy::print_stdout`, `clippy::print_stderr` — observability via tracing only (mirrors TYP-CORE / Python `print` discipline).
- `clippy::todo`, `clippy::unimplemented` — mirror our "no half-finished implementations" rule.
- `clippy::indexing_slicing` — mirrors Python's narrow-exception discipline; panics-as-control-flow forbidden.
- `clippy::float_cmp`, `clippy::lossy_float_literal` — correctness.
- `clippy::large_enum_variant`, `clippy::large_stack_arrays` — perf correctness.
- `clippy::shadow_unrelated` — naming hygiene mirroring PYT-NAME / TYP-NAME clarity.

Any team-level override beyond this list requires the `// reason:` postfix per `RST-CORE-03`.

## Anti-Patterns

- `cargo test` invoked in CI scripts or docs — use `cargo nextest run`.
- `src/billing/mod.rs` — use `src/billing.rs` + `src/billing/` directory layout.
- `let x = repo.find(id).unwrap();` inside a library — propagate with `?` against a typed error.
- `pub fn charge(id: Uuid) -> anyhow::Result<Receipt>` in a library API — return a `thiserror`-derived enum instead.
- `fn handle(payload: Box<dyn Any>)` — model the payload with an `enum` or generics.
- `use crate::models::*;` outside a `tests` or `prelude` module — list imports explicitly.
- `cargo watch -x check` in onboarding docs — switch to `bacon` with a checked-in `bacon.toml`.
- `unsafe { ptr.offset(1) }` with no `// SAFETY:` comment — every `unsafe` site documents its invariants.
- `Rc<RefCell<Graph>>` threaded through every function — restructure ownership or use message passing.
- `if status == "active" { ... } else if status == "paused" { ... }` — define an `enum` (with `strum::EnumString` if parsing is needed).

## Quick Decision Tree

**"I need to represent failure — what do I use?"**

1. **Is this a library API?** → typed `enum` deriving `thiserror::Error` (`RST-ERRH-01`); chain sources via `#[source]` / `#[from]` (`RST-ERRH-04`).
2. **Is this the binary `main` / CLI handler boundary?** → `anyhow::Result<()>` is fine (`RST-ERRH-02`).
3. **Is this truly unrecoverable (broken invariant, not user/IO error)?** → `panic!` with context, plus a `// reason:` if `#[allow(clippy::panic)]` is needed (`RST-CORE-01`, `RST-ERRH-03`).
4. **Do I need to silence a clippy lint?** → add `#[allow(lint)]` with a `// reason: <text>` postfix (`RST-CORE-03`); confirm the lint isn't in the deny-without-exception list (`RST-CORE-04`).
5. **Am I writing `unsafe`?** → preceding `// SAFETY:` block listing every invariant the caller must uphold (`RST-CORE-02`).
6. **Am I about to fan out async work?** → `JoinSet` for dynamic sets, `try_join!` for fixed heterogeneous sets — never loose `tokio::spawn` with dropped handles (`RST-ASYNC-02`).
7. **Am I adding a parameter and the signature already has 5?** → stop; bundle into a request struct, builder if many optional fields (`RST-PARM-03`).
8. **Two parameters share a primitive type but mean different things?** → newtype each (`struct UserId(Uuid)`) so the compiler blocks the swap (`RST-TYPE-01`).
