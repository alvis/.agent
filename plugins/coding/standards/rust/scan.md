# Rust: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md` to confirm the violation and follow its fix guidance.

> **During linting**: Only apply a rule's fix if it is a mechanical correction — formatting, naming, documentation, casing, import ordering, or field/function reordering. If the fix would add new logic, change control flow, introduce runtime validation, or alter program behavior, report the violation without fixing it.

## Quick Scan

- DO NOT call `.unwrap()` or `.expect(...)` in `src/lib.rs` paths; propagate with `?` and typed errors [`RST-CORE-01`]
- DO NOT open an `unsafe { ... }` block without an immediately preceding `// SAFETY:` comment listing the invariants [`RST-CORE-02`]
- DO NOT use `#[allow(lint)]` without a `// reason: <text>` postfix on the same or preceding line [`RST-CORE-03`]
- DO NOT omit a `[lints]` table denying `clippy::all` + `clippy::pedantic` at workspace `Cargo.toml` [`RST-CORE-04`]
- DO NOT use `Box<dyn Any>`, `Box<dyn Error + Send + Sync + 'static>` as an internal API type, or other type-erased escape hatches [`RST-CORE-05`]
- DO NOT take `&String`/`&Vec<T>`/`&PathBuf` as parameters; borrow with `&str`/`&[T]`/`&Path` [`RST-OWNS-01`]
- DO NOT force callers to allocate at API boundaries that may borrow — use `Cow<'a, T>` for maybe-owned returns/params [`RST-OWNS-02`]
- DO NOT reach for `Rc<RefCell<T>>` (or `Arc<Mutex<T>>`) where `&mut` ownership or message passing fits [`RST-OWNS-03`]
- DO NOT use `'a`/`'b` lifetimes on public boundaries; name them meaningfully (`'src`, `'tx`, `'req`) [`RST-OWNS-04`]
- DO NOT define a library error type without deriving `thiserror::Error` and implementing `std::error::Error` [`RST-ERRH-01`]
- DO NOT use `anyhow::Error` / `anyhow::Result` in library public APIs — restrict it to binary `main`/CLI handlers [`RST-ERRH-02`]
- DO NOT use `.unwrap()` / `panic!` for recoverable failures; use `?` and typed errors [`RST-ERRH-03`]
- DO NOT lose error provenance — chain sources via `#[source]` / `#[from]` instead of stringifying [`RST-ERRH-04`]
- DO NOT raise errors without identifying context (record id, operation, tenant); `"not found"` alone is useless [`RST-ERRH-05`]
- DO NOT share a primitive type across sibling IDs (`user_id: Uuid`, `order_id: Uuid`); use newtypes [`RST-TYPE-01`]
- DO NOT use bare `&str` / `String` for finite state values — use an `enum` (with `strum` if string parsing required) [`RST-TYPE-02`]
- DO NOT leak concrete iterator/future types at API boundaries; return `impl Iterator<Item = T>` / `impl Future<Output = T>` [`RST-TYPE-03`]
- DO NOT inline two or more generic bounds in angle brackets; move them to a `where` clause [`RST-TYPE-04`]
- DO NOT model finite domains with `String` parsing logic — use `enum` + `strum::EnumString` derive [`RST-TYPE-05`]
- DO NOT perform blocking I/O inside an `async fn` — route through `tokio::task::spawn_blocking` (or your runtime's equivalent) [`RST-ASYNC-01`]
- DO NOT fan out async work with loose `tokio::spawn` calls; use `JoinSet` or `try_join!` for structured concurrency [`RST-ASYNC-02`]
- DO NOT leave non-obvious cancellation behaviour undocumented; mark cancel-safe boundaries with `// CANCEL-SAFE:` notes [`RST-ASYNC-03`]
- DO NOT call `block_on` / `Handle::block_on` from inside an async context [`RST-ASYNC-04`]
- DO NOT place application logic inside `src/main.rs`; keep `main.rs` thin and put logic in `src/lib.rs` [`RST-MODL-01`]
- DO NOT omit `resolver = "2"` (or `"3"` on edition 2024) from a workspace `Cargo.toml` [`RST-MODL-02`]
- DO NOT create `mod.rs` files; use the `foo.rs` + `foo/` directory layout [`RST-MODL-03`]
- DO NOT place logic in `src/lib.rs` beyond `pub mod` / `pub use` declarations and crate-level docs [`RST-MODL-04`]
- DO NOT take boolean positional arguments at public functions; use an `enum` variant or a builder [`RST-PARM-01`]
- DO NOT take `&Path`/`PathBuf` directly when a generic `impl AsRef<Path>` is appropriate; use `impl Into<String>` only when ownership is taken [`RST-PARM-02`]
- DO NOT declare a function signature with more than five parameters; bundle into a request struct (builder if optional fields) [`RST-PARM-03`]
- DO NOT consume `self` for fluent chains; use `&mut self -> &mut Self` (consuming `self` is reserved for `Builder::build`) [`RST-PARM-04`]
- DO NOT use glob `use foo::*` imports outside of `tests` modules or an explicit `prelude` module [`RST-IMPT-01`]
- DO NOT mix import groups; order is std → external crates → crate-local, separated by blank lines [`RST-IMPT-02`]
- DO NOT chain re-exports through intermediate modules; re-export the public surface from `lib.rs` only [`RST-IMPT-03`]
- DO NOT use `camelCase`/`PascalCase` for functions/variables/modules/files; types and enum variants are `PascalCase` [`RST-NAME-01`]
- DO NOT use `SCREAMING_SNAKE_CASE` outside of `const`/`static` items [`RST-NAME-02`]
- DO NOT name error types without an `Error` suffix (`PaymentDeclinedError`, not `PaymentDeclined`) [`RST-NAME-03`]
- DO NOT invent ad-hoc trait names; capability traits are adjectives (`Readable`), conversion traits use `From*`/`Into*`/`As*` [`RST-NAME-04`]
- DO NOT omit `rust-toolchain.toml` pinning channel and components (`rustfmt`, `clippy`) [`RST-TOOL-01`]
- DO NOT use `cargo test` in CI scripts or documentation; use `cargo nextest run` [`RST-TOOL-02`]
- DO NOT use `cargo watch` for the dev loop; use `bacon` with a checked-in `bacon.toml` [`RST-TOOL-03`]
- DO NOT skip the `[lints]` table in `Cargo.toml` — deny `clippy::all` + `clippy::pedantic`, allow curated subset with `// reason:` [`RST-TOOL-04`]

## Rule Matrix

| Rule ID | Summary | Tool Coverage | Review Signal |
|---|---|---|---|
| `RST-CORE-01` | `.unwrap()` / `.expect(...)` used in library source paths. | clippy:unwrap_used,expect_used | `let user = repo.find(id).unwrap();` |
| `RST-CORE-02` | `unsafe { ... }` block lacks a preceding `// SAFETY:` comment. | clippy:undocumented_unsafe_blocks | `unsafe { ptr.offset(1) }` with no SAFETY note |
| `RST-CORE-03` | `#[allow(lint)]` attribute without a `// reason: <text>` postfix. | standard-only | `#[allow(clippy::too_many_arguments)]` (no reason) |
| `RST-CORE-04` | Workspace `Cargo.toml` `[lints]` table does not deny `clippy::all` + `clippy::pedantic`. | standard-only | `Cargo.toml` missing `[workspace.lints.clippy]` |
| `RST-CORE-05` | Type-erased escape hatch used (`Box<dyn Any>`, `Box<dyn Error + Send + Sync>` in API). | standard-only | `fn handle(payload: Box<dyn Any>)` |
| `RST-OWNS-01` | Parameter takes owned collection where a borrow would do (`&String`, `&Vec<T>`, `&PathBuf`). | clippy:ptr_arg | `fn parse(s: &String)`; `fn render(items: &Vec<Item>)` |
| `RST-OWNS-02` | API boundary forces caller allocation instead of returning/accepting `Cow<'a, T>`. | standard-only | `fn normalize(s: &str) -> String` that often returns `s` unchanged |
| `RST-OWNS-03` | `Rc<RefCell<T>>` / `Arc<Mutex<T>>` used where `&mut` ownership or message passing would fit. | standard-only | `Rc<RefCell<Graph>>` threaded through every function |
| `RST-OWNS-04` | Public boundary uses anonymous lifetimes (`'a`, `'b`) instead of meaningful names. | standard-only | `fn parse<'a>(src: &'a str) -> Node<'a>` (should be `'src`) |
| `RST-ERRH-01` | Library error type does not derive `thiserror::Error` / implement `std::error::Error`. | standard-only | `pub struct BillingError(String);` with no `Error` impl |
| `RST-ERRH-02` | `anyhow::Error` / `anyhow::Result` used in a library public API. | standard-only | `pub fn charge(id: Uuid) -> anyhow::Result<Receipt>` |
| `RST-ERRH-03` | `.unwrap()` or `panic!` used for a recoverable failure path. | clippy:unwrap_used,panic | `let cfg = serde_json::from_str(&raw).unwrap();` |
| `RST-ERRH-04` | Error wrapping drops the source chain instead of using `#[source]` / `#[from]`. | standard-only | `BillingError::Db(format!("{e}"))` instead of `#[from] DbError` |
| `RST-ERRH-05` | Error message lacks identifying context (record id, operation, tenant). | standard-only | `return Err(BillingError::NotFound);` (no id, no op) |
| `RST-TYPE-01` | Sibling ID parameters share primitive types without newtype distinction. | standard-only | `fn charge(order_id: Uuid, user_id: Uuid)` |
| `RST-TYPE-02` | Bare `&str` / `String` used for a finite state value instead of an `enum`. | standard-only | `fn describe(status: &str)` for a closed set of values |
| `RST-TYPE-03` | Concrete iterator/future type leaked at API boundary instead of `impl Trait`. | standard-only | `fn rows(&self) -> std::slice::Iter<'_, Row>` |
| `RST-TYPE-04` | Generic function inlines 2+ bounds in angle brackets instead of using `where`. | clippy:multiple_bound_locations (partial) | `fn run<T: Read + Write + Send + Sync>(io: T)` |
| `RST-TYPE-05` | `String` parsed as a finite enum domain instead of using `enum` + `strum::EnumString`. | standard-only | `if status == "active" { ... } else if status == "paused" { ... }` |
| `RST-ASYNC-01` | Blocking I/O (`std::fs`, `std::thread::sleep`, sync DB driver) called inside an `async fn`. | clippy:disallowed_methods (partial) | `async fn load() { std::fs::read("a.txt").unwrap(); }` |
| `RST-ASYNC-02` | Fan-out uses loose `tokio::spawn` calls instead of `JoinSet` / `try_join!`. | standard-only | `for url in urls { tokio::spawn(fetch(url)); }` (no join handle held) |
| `RST-ASYNC-03` | Non-obvious cancellation behaviour at an async boundary lacks a `// CANCEL-SAFE:` note. | standard-only | `async fn flush(&mut self)` interacting with a buffered sink, no doc |
| `RST-ASYNC-04` | `block_on` / `Handle::block_on` invoked from within an async context. | clippy:disallowed_methods (partial) | `async fn outer() { runtime.block_on(inner()); }` |
| `RST-MODL-01` | Application logic placed inside `src/main.rs` instead of `src/lib.rs`. | standard-only | `src/main.rs` with 500 lines of handlers |
| `RST-MODL-02` | Workspace `Cargo.toml` missing `resolver = "2"` (or `"3"` on edition 2024). | standard-only | `[workspace]` with no `resolver` key |
| `RST-MODL-03` | `mod.rs` file present in the source tree. | standard-only | `src/billing/mod.rs` exists (should be `src/billing.rs` + `src/billing/`) |
| `RST-MODL-04` | `src/lib.rs` contains logic beyond `pub mod` / `pub use` declarations and crate-level docs. | standard-only | `pub fn helper(...) { ... }` defined directly in `lib.rs` |
| `RST-PARM-01` | Public function takes boolean positional argument(s) instead of an enum or builder. | clippy:fn_params_excessive_bools (partial) | `pub fn deploy(service: &str, dry_run: bool, verbose: bool)` |
| `RST-PARM-02` | Path parameter uses `&Path`/`PathBuf` instead of `impl AsRef<Path>`. | standard-only | `pub fn load(path: &Path)` |
| `RST-PARM-03` | Function signature has more than five parameters. | clippy:too_many_arguments | `fn deploy(service, version, env, dry_run, verbose, max_retries, timeout)` |
| `RST-PARM-04` | Fluent chain consumes `self` instead of returning `&mut Self`. | standard-only | `pub fn with_limit(self, limit: u32) -> Self` outside a `Builder` |
| `RST-IMPT-01` | Glob `use foo::*` import outside a `tests` module or named `prelude`. | clippy:wildcard_imports | `use crate::models::*;` in non-test, non-prelude module |
| `RST-IMPT-02` | Import groups not ordered std → external → crate-local, or not blank-line separated. | rustfmt | mixed `use serde::Deserialize;` / `use std::fs;` / `use crate::x;` with no blank lines |
| `RST-IMPT-03` | Chained re-export through intermediate modules instead of single-source `lib.rs` re-exports. | standard-only | `pub use crate::api::handlers::v1::charge;` inside `api/mod.rs` |
| `RST-NAME-01` | `camelCase`/`PascalCase` used for a function, variable, module, or file; or `snake_case` used for a type/variant. | clippy:non_snake_case,non_camel_case_types | `fn createUser()`; `struct user_id;` |
| `RST-NAME-02` | `SCREAMING_SNAKE_CASE` used outside `const`/`static` items. | clippy:non_upper_case_globals (partial) | `let MAX_RETRIES = 5;`; `fn DO_THING()` |
| `RST-NAME-03` | Error type name does not end in `Error`. | standard-only | `enum PaymentDeclined { ... }` (should be `PaymentDeclinedError`) |
| `RST-NAME-04` | Trait name does not follow the capability-adjective or `From*`/`Into*`/`As*` conventions. | standard-only | `trait DoesIO`; `trait UserStuff` |
| `RST-TOOL-01` | `rust-toolchain.toml` missing, or does not pin channel and `rustfmt`/`clippy` components. | standard-only | repo root with no `rust-toolchain.toml` |
| `RST-TOOL-02` | `cargo test` invoked in CI scripts or documentation. | standard-only | `.github/workflows/ci.yml` step running `cargo test --all` |
| `RST-TOOL-03` | `cargo watch` invoked anywhere, or `bacon.toml` missing from repo root. | standard-only | `README.md` instructing `cargo watch -x check` |
| `RST-TOOL-04` | `Cargo.toml` `[lints]` table missing or does not deny `clippy::all` + `clippy::pedantic`. | standard-only | `Cargo.toml` with no `[workspace.lints]` block |

## Review Signals Legend

- **clippy:CODE** — clippy detects the violation under the listed lint(s); lint catches it mechanically.
- **clippy:CODE (partial)** — clippy flags a subset of cases; the remaining cases (architectural intent, runtime paths, policy decisions) require reviewer judgement.
- **rustfmt** — rustfmt enforces the rule mechanically as part of formatting.
- **standard-only** — no tool coverage; the rule is enforced exclusively in code review against this standard.
