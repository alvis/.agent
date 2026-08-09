# RST-ASYNC-01: No Blocking I/O Inside `async fn`

**Tool Coverage:** clippy:disallowed_methods (partial — only flags calls you've explicitly listed under `[lints.clippy.disallowed_methods]`; arbitrary sync drivers, custom blocking wrappers, and CPU-heavy loops still slip through and require reviewer judgement).

## Intent

A blocking call inside an `async fn` stalls the executor thread for every task scheduled on it. On a single-threaded runtime the whole application freezes; on a multi-threaded runtime one worker is stolen for the duration. Route synchronous I/O (file system, sync DB drivers, blocking HTTP clients, `std::thread::sleep`) and CPU-bound work through the runtime's blocking-task primitive — `tokio::task::spawn_blocking`, `async_std::task::spawn_blocking`, `smol::unblock`, or the equivalent for embassy/glommio — and prefer a native async API whenever one exists for the library you are using. The rule is runtime-agnostic: the principle is "never block the executor", not "use tokio".

## Fix

```rust
// ✅ GOOD: native async I/O — no executor stall
use tokio::fs;

pub async fn read_config(path: &std::path::Path) -> Result<String, std::io::Error> {
    fs::read_to_string(path).await
}

// ✅ GOOD: unavoidable sync library routed through `spawn_blocking`
use tokio::task;

pub async fn parse_huge_csv(bytes: Vec<u8>) -> Result<Vec<Row>, ParseError> {
    // CPU-bound: the parser is pure compute, but it would still hog the executor.
    task::spawn_blocking(move || parse_sync(&bytes))
        .await
        .map_err(ParseError::JoinFailed)?
}

// ✅ GOOD: legacy sync driver with no async alternative
pub async fn legacy_lookup(id: i64) -> Result<Record, LookupError> {
    task::spawn_blocking(move || legacy_client::find(id))
        .await
        .map_err(LookupError::JoinFailed)?
        .map_err(LookupError::Driver)
}
```

```rust
// ❌ BAD: blocking filesystem call stalls every task on this worker
pub async fn read_config(path: &std::path::Path) -> Result<String, std::io::Error> {
    std::fs::read_to_string(path) // <- sync read inside `async fn`
}

// ❌ BAD: blocking sleep freezes the executor
pub async fn rate_limit() {
    std::thread::sleep(std::time::Duration::from_secs(1)); // use `tokio::time::sleep`
}

// ❌ BAD: sync HTTP client called from async context
pub async fn fetch(url: &str) -> Result<String, reqwest::Error> {
    reqwest::blocking::get(url)?.text() // use the async `reqwest::Client`
}
```

### Three Cases, Three Routes

| Situation                                    | Correct route                                                                  |
|----------------------------------------------|--------------------------------------------------------------------------------|
| Pure CPU work (parsing, crypto, compression) | `spawn_blocking` (or `rayon` if the runtime has no equivalent)                 |
| Blocking I/O with an async equivalent        | Use the runtime's async API (`tokio::fs`, `tokio::net`, `async-std::fs`, …)    |
| Sync library with no async alternative       | `spawn_blocking` — wrap the sync call, surface the join error as a typed variant |

The list of "what counts as blocking" is identical across runtimes: anything that does not yield to the executor between operations. `std::thread::sleep`, `std::fs::*`, `std::net::*`, sync database drivers, `subprocess` calls, and tight numeric loops are all blocking — the choice of executor does not change that.

## Edge Cases

- Startup code that runs before the runtime starts (e.g. loading a config file in `main` before `Runtime::block_on`) may use sync I/O safely — the executor is not running yet.
- Small, bounded computations (microseconds) are fine inline; the executor cannot preempt them anyway. Measure before reaching for `spawn_blocking` — moving a 5-µs hash into a blocking pool is a net loss.
- `spawn_blocking` pools are bounded (tokio defaults to 512 threads). Fan-out of millions of blocking tasks needs back-pressure — pair with a `Semaphore` or migrate the work onto a `rayon` thread pool sized to your CPUs.
- Async traits (Rust 1.75+) may be invoked from a sync context via `block_on`; that is RST-ASYNC-04's concern. The "no blocking inside async" rule still applies inside the trait implementation body.

## Related

RST-ASYNC-02, RST-ASYNC-03, RST-ASYNC-04, RST-ERRH-04
