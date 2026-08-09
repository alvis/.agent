# RST-MODL-01: Thin `main.rs`, Logic in `lib.rs`

**Tool Coverage:** `standard-only` — clippy does not enforce the binary/library split; reviewers MUST check that `src/main.rs` is a thin wrapper and that every reusable item lives in the sibling library crate.

## Intent

A binary crate (`src/main.rs`) MUST be a thin entrypoint that parses CLI/env, constructs the runtime, and delegates to a `pub fn run(...) -> Result<(), E>` (or an `async fn run`) defined in the sibling library crate (`src/lib.rs`). Logic that lives directly inside `main.rs` is unreachable from integration tests (`tests/` can only see items exported by `lib.rs`), unreachable from benchmarks (`benches/`), and unreachable from doc-tests — so it ships untested by definition. Keeping `main.rs` thin also makes it trivial to add additional binaries (`src/bin/*.rs`) that share the same library surface without duplicating glue code.

## Fix

```rust
// ✅ GOOD: src/main.rs — thin wrapper that delegates to the library
fn main() -> anyhow::Result<()> {
    my_crate::run()
}
```

```rust
// ✅ GOOD: src/lib.rs — exposes a single `run` entrypoint plus the module tree
//! my_crate — billing service library and CLI.

pub mod cli;
pub mod config;
pub mod error;
pub mod service;

pub use crate::error::MyError;

/// Boot the application: parse CLI, load config, hand off to the service layer.
///
/// # Errors
///
/// Returns [`MyError`] if configuration loading or service startup fails.
pub fn run() -> Result<(), MyError> {
    let args = cli::parse();
    let cfg = config::load(&args.config_path)?;
    service::start(cfg)
}
```

```rust
// ❌ BAD: 500 lines of handlers inside src/main.rs — no integration test can reach them
fn main() -> anyhow::Result<()> {
    let args = std::env::args().collect::<Vec<_>>();
    let cfg = serde_json::from_reader(std::fs::File::open(&args[1])?)?; // logic here

    let pool = sqlx::PgPool::connect(&cfg.database_url).await?;          // logic here
    for record in pool.fetch_all("...").await? {                          // logic here
        process(record).await?;
    }
    Ok(())
}

fn process(record: Row) -> anyhow::Result<()> {                          // can't be tested
    // 200 lines of business logic stranded inside the binary crate
}
```

### Why the Library Crate Is the Right Home

- **Integration tests** under `tests/` can `use my_crate::run;` and run end-to-end scenarios. They cannot reach symbols defined only in `main.rs`.
- **Benchmarks** under `benches/` link against the library crate, not the binary crate. Performance work requires the library split.
- **Doc-tests** in `///` examples on public items run against the library — putting public surface in `main.rs` strands them.
- **Additional binaries** (`src/bin/admin.rs`, `src/bin/migrate.rs`) can each import `my_crate::*` and reuse setup helpers. Without the split each binary would duplicate the boot code.
- **`anyhow` at the boundary, `thiserror` underneath** (RST-ERRH-01/02): `main.rs` may return `anyhow::Result<()>`, `lib::run` returns the typed `MyError`. The conversion is explicit and one-shot.

## Edge Cases

- **Single-file binary with no library surface** (e.g. a 50-line dev tool, a one-off migration script) MAY skip the library split — but only if the binary will never grow tests, benchmarks, or additional sibling binaries. The moment a second `src/bin/*.rs` appears, promote the shared code into `src/lib.rs`.
- **Workspace with a dedicated `bin/` crate** is the preferred layout for non-trivial services: `crates/foo` is the library, `crates/foo-cli` depends on it and contains the thin `main.rs`. The principle is the same; the boundary is a workspace boundary rather than a file boundary.
- **Async `main`** is fine via `#[tokio::main]` or an explicit `Runtime::new()?.block_on(async { my_crate::run().await })`; the rule constrains *content*, not the sync/async shape of `main` itself.
- **CLI parsing crates** (clap, argh) emit their derive macros in the binary crate when the CLI struct is binary-only. If multiple binaries share a CLI type, move it into `lib.rs::cli` and re-export.

## Related

RST-MODL-02, RST-MODL-03, RST-MODL-04, RST-IMPT-03, RST-ERRH-02
