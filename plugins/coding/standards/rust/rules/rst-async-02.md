# RST-ASYNC-02: Structured Fan-Out, Never Loose `spawn`

**Tool Coverage:** `standard-only` — clippy has no lint for "dropped `JoinHandle`"; reviewers MUST confirm every spawned task is tracked through a `JoinSet`, `try_join!`, `FuturesUnordered`, or an equivalent scope primitive.

## Intent

A loose `tokio::spawn(...)` (or `async_std::task::spawn`, `smol::spawn`, …) whose `JoinHandle` is dropped leaks the task: errors are silently swallowed, cancellation does not propagate when the parent scope exits, and the task may outlive the data it borrowed. Structured concurrency requires every spawned future to be **owned by a parent scope** — `tokio::task::JoinSet` for dynamic homogeneous sets, `tokio::try_join!` (or `futures::try_join!`) for fixed heterogeneous sets, and `futures::stream::FuturesUnordered` / `StreamExt::buffer_unordered` for bounded streaming fan-out. The rule is runtime-agnostic: async-std exposes `JoinHandle`-collection patterns, smol uses `async_executor::Task`, embassy uses the static task pool — but the principle is the same: spawn into a scope, await the scope, propagate errors.

## Fix

```rust
// ✅ GOOD: dynamic fan-out via `JoinSet`
use tokio::task::JoinSet;

pub async fn fetch_all(urls: Vec<String>) -> Result<Vec<Bytes>, FetchError> {
    let mut set: JoinSet<Result<Bytes, FetchError>> = JoinSet::new();
    for url in urls {
        set.spawn(fetch_one(url));
    }
    let mut out = Vec::with_capacity(set.len());
    while let Some(result) = set.join_next().await {
        out.push(result.map_err(FetchError::JoinFailed)??);
    }
    Ok(out)
}

// ✅ GOOD: fixed heterogeneous fan-out via `try_join!`
pub async fn load_dashboard(user_id: UserId) -> Result<Dashboard, LoadError> {
    let (profile, invoices, alerts) = tokio::try_join!(
        load_profile(user_id),
        load_invoices(user_id),
        load_alerts(user_id),
    )?;
    Ok(Dashboard { profile, invoices, alerts })
}

// ✅ GOOD: bounded streaming via `buffer_unordered`
use futures::stream::{self, StreamExt, TryStreamExt};

pub async fn fetch_bounded(urls: Vec<String>) -> Result<Vec<Bytes>, FetchError> {
    stream::iter(urls)
        .map(fetch_one)
        .buffer_unordered(16)
        .try_collect()
        .await
}
```

```rust
// ❌ BAD: handles dropped — errors and cancellation lost
pub async fn fetch_all(urls: Vec<String>) {
    for url in urls {
        tokio::spawn(fetch_one(url)); // <- JoinHandle discarded
    }
    // function returns; tasks may still be running, errors disappear into the void
}

// ❌ BAD: hand-rolled Vec<JoinHandle> with `unwrap`
pub async fn fetch_all(urls: Vec<String>) -> Vec<Bytes> {
    let handles: Vec<_> = urls.into_iter().map(|u| tokio::spawn(fetch_one(u))).collect();
    let mut out = Vec::new();
    for handle in handles {
        out.push(handle.await.unwrap().unwrap()); // panics swallow both join + inner errors
    }
    out
}
```

### Why a Scope Primitive Wins

| Concern                  | `JoinSet` / `try_join!`                                 | Loose `spawn` + dropped handle               |
|--------------------------|---------------------------------------------------------|----------------------------------------------|
| First failure            | Cancels siblings (drop of `JoinSet`), surfaces error    | Siblings keep running; errors silently lost  |
| Join guarantee           | Enforced — scope cannot exit with unawaited children    | Caller must remember to `await` each handle  |
| Cancellation propagation | Dropping the scope drops every child                    | No back-channel; children leak                |
| Borrow lifetimes         | Scope-bound; children cannot outlive the parent future  | `'static` bound required, forces `Arc` clones |

## Edge Cases

- **Fire-and-forget background tasks** (e.g. a metrics flusher launched at startup) MAY use a bare `spawn` — but the `JoinHandle` MUST be stored on a long-lived owner (the `App` struct), not dropped. On shutdown the owner awaits or aborts the handle.
- Non-tokio runtimes have equivalents: `async-std` uses `Vec<JoinHandle>` + `futures::future::join_all`; `smol` returns `Task<T>` whose `Drop` cancels the task — both still require the handle to be held somewhere with a clear lifetime.
- `tokio::join!` (non-`try_`) suppresses the panic-on-error behaviour `try_join!` gives you; pick `try_join!` whenever any branch is fallible.
- For **unbounded** fan-out (millions of items), `JoinSet` exhausts memory. Use `buffer_unordered(n)` or a `Semaphore` with explicit concurrency.

## Related

RST-ASYNC-01, RST-ASYNC-03, RST-ASYNC-04, RST-ERRH-04
