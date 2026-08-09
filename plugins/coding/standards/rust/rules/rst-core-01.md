# RST-CORE-01: No `unwrap` / `expect` in Library Paths

**Tool Coverage:** clippy:unwrap_used,expect_used,panic

## Intent

`.unwrap()` and `.expect("…")` collapse a recoverable failure into a process abort. Inside a library (`src/lib.rs` and every module reachable from it) the caller — not the library — owns the recovery policy, so the library MUST surface the failure as a typed `Result` and propagate with `?`. The same applies to bare `panic!` on user/IO error paths. Aborts belong only at the binary boundary (where `main` may choose to die) or behind a guarded invariant the surrounding type makes locally provable.

## Fix

```rust
// ✅ GOOD: propagate with `?` against a typed error
use thiserror::Error;

#[derive(Debug, Error)]
pub enum RepoError {
    #[error("user {id} not found")]
    UserNotFound { id: uuid::Uuid },
    #[error("database failure during {op}")]
    Database {
        op: &'static str,
        #[source]
        source: sqlx::Error,
    },
}

pub async fn load_user(id: uuid::Uuid) -> Result<User, RepoError> {
    let row = sqlx::query_as::<_, User>("select * from users where id = $1")
        .bind(id)
        .fetch_optional(pool())
        .await
        .map_err(|source| RepoError::Database { op: "load_user", source })?;
    let Some(user) = row else {
        return Err(RepoError::UserNotFound { id });
    };
    Ok(user)
}
```

```rust
// ❌ BAD: library aborts the process on a recoverable failure
pub async fn load_user(id: uuid::Uuid) -> User {
    let row = sqlx::query_as::<_, User>("select * from users where id = $1")
        .bind(id)
        .fetch_optional(pool())
        .await
        .unwrap();              // <- aborts on DB outage
    row.expect("user exists")   // <- aborts on missing row
}
```

### Why `expect("…")` Is Not Enough

`expect` looks documentary but is identical to `unwrap` at runtime: it aborts. The message lands in the panic log, not in the caller's error chain, so the calling service cannot retry, redact, or translate the failure. Treat both `unwrap` and `expect` as the same prohibition; reach for `?` and a typed variant instead.

## Edge Cases

- **Test code** (`#[cfg(test)]` modules, integration tests under `tests/`) MAY use `.unwrap()` / `.expect()` — failures there are test failures, not user-facing aborts. The clippy deny is scoped to library sources via `#![cfg_attr(not(test), deny(clippy::unwrap_used))]` or a `[lints]` table entry.
- **`const` / `static` initialisers** sometimes legitimately need `.unwrap()` on a constant input (e.g. `Regex::new(...).unwrap()`). Wrap in `std::sync::OnceLock` + a checked constructor, or add `#[allow(clippy::unwrap_used)] // reason: <text>` per RST-CORE-03.
- **Provably-infallible operations** (e.g. `u32::try_from(literal_in_range)`) should use `let-else` + `unreachable!()` with a `// reason:` annotation, or restructure to avoid the conversion. Do not paper over with `.unwrap()`.
- **Binary `main` / CLI entrypoints** MAY use `?` against `anyhow::Result<()>` (RST-ERRH-02); they still avoid `.unwrap()` because the trace is more useful than an abort.

## Related

RST-CORE-02, RST-CORE-03, RST-CORE-04, RST-ERRH-01, RST-ERRH-02, RST-ERRH-03
