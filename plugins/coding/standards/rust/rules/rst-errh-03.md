# RST-ERRH-03: `?` Over `.unwrap()`; `panic!` Only on Unrecoverable Invariants

**Tool Coverage:** clippy:unwrap_used,expect_used,panic — denied without exception per RST-CORE-04.

## Intent

The `?` operator threads a `Result`/`Option` through the call stack as data; `.unwrap()`, `.expect("…")`, and `panic!` abort the process. Aborts are appropriate **only** when an invariant the program itself maintains has been violated (an array index the function just computed; a value the type system should have made impossible). Every recoverable failure — I/O, parsing, network, missing record, user input, deserialization — MUST propagate via `?` against a typed `Result` (RST-ERRH-01). `panic!` on a user-driven failure path turns a recoverable error into a denial-of-service vector.

## Fix

```rust
// ✅ GOOD: ? propagates against a typed error
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("config file {path} unreadable")]
    Read {
        path: std::path::PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("config file {path} malformed")]
    Parse {
        path: std::path::PathBuf,
        #[source]
        source: serde_json::Error,
    },
}

pub fn load(path: &std::path::Path) -> Result<Config, ConfigError> {
    let raw = std::fs::read_to_string(path).map_err(|source| ConfigError::Read {
        path: path.to_path_buf(),
        source,
    })?;
    let cfg = serde_json::from_str(&raw).map_err(|source| ConfigError::Parse {
        path: path.to_path_buf(),
        source,
    })?;
    Ok(cfg)
}
```

```rust
// ❌ BAD: panics on a recoverable failure — bad config kills the process
pub fn load(path: &std::path::Path) -> Config {
    let raw = std::fs::read_to_string(path).unwrap();          // I/O failure
    let cfg: Config = serde_json::from_str(&raw).unwrap();      // parse failure
    cfg
}

// ❌ BAD: panic!() with a context-free message at a recoverable site
pub fn lookup(id: uuid::Uuid) -> User {
    let user = repo::find(id);
    if user.is_none() {
        panic!("user not found");   // should be Result::Err(UserNotFound { id })
    }
    user.unwrap()
}
```

### When `panic!` Is Genuinely Right

A `panic!` is correct when continuing would corrupt program state — for example, a `BTreeMap` whose comparator violated its contract, or a `let-else` branch the caller cannot reach because the previous statement encoded the invariant in the type. In those cases use `unreachable!()` with a message identifying the invariant, and add a `// reason:` comment per RST-CORE-03 if `#[allow(clippy::unreachable)]` is required.

## Edge Cases

- **Test code** (`#[cfg(test)]`, integration tests under `tests/`, `examples/`) MAY use `.unwrap()` / `.expect()` — failures there are test failures, not user aborts.
- **`const` evaluation** — `.unwrap()` in `const` context is checked at compile time, not runtime, and is acceptable.
- **`OnceLock::get_or_init`** closures that return non-`Result` values may panic on a one-shot initialiser that has truly no failure mode (e.g. compiling a regex from a string literal); annotate with `#[allow(clippy::unwrap_used)] // reason: regex literal is compile-time validated`.
- **`assert!`-style invariants** — `debug_assert!` is preferred for invariants that cost too much to check in release; reach for `assert!` only when the cost is acceptable everywhere.

## Related

RST-CORE-01, RST-ERRH-01, RST-ERRH-02, RST-ERRH-04, RST-ERRH-05
