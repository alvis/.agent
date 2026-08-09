# RST-ASYNC-04: No `block_on` Inside an Async Context

**Tool Coverage:** clippy:disallowed_methods (partial — set `tokio::runtime::Handle::block_on`, `tokio::runtime::Runtime::block_on`, `futures::executor::block_on`, `async_std::task::block_on`, `smol::block_on` as disallowed; runtime authors may name their own equivalents that the reviewer MUST recognise).

## Intent

`block_on` parks the current OS thread until the inner future resolves. Calling it from inside an `async fn` (or any code running on an executor thread) blocks the executor — exactly the behaviour RST-ASYNC-01 forbids — and on a current-thread runtime causes immediate deadlock because the inner future and the parked future need the same single thread. The principle is runtime-agnostic: `tokio::runtime::Handle::block_on`, `async_std::task::block_on`, `smol::block_on`, `futures::executor::block_on`, and `pollster::block_on` are all banned inside `async fn`. Use `.await`; if you need to bridge a sync API into an async one, route through `spawn_blocking` (RST-ASYNC-01) and `.await` the join handle.

## Fix

```rust
// ✅ GOOD: stay in async land — just await the inner future
pub async fn fetch_user(id: UserId) -> Result<User, RepoError> {
    repo().load(id).await
}

// ✅ GOOD: bridging a sync callback into async — `spawn_blocking` then `.await`
use tokio::task;

pub async fn run_legacy_callback<F, T>(work: F) -> Result<T, JoinError>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    // The sync closure runs on a blocking worker. We do NOT call `block_on` here.
    task::spawn_blocking(work).await
}

// ✅ GOOD: `block_on` lives only at the binary entrypoint, before the runtime is async
fn main() -> anyhow::Result<()> {
    let runtime = tokio::runtime::Runtime::new()?;
    runtime.block_on(async {
        my_crate::run().await
    })
}
```

```rust
// ❌ BAD: `block_on` inside `async fn` — deadlocks on a current-thread runtime
pub async fn outer(handle: tokio::runtime::Handle) -> Result<User, RepoError> {
    handle.block_on(load_user()) // <- parks this worker; on `current_thread` this hangs forever
}

// ❌ BAD: re-entering the executor via `futures::executor::block_on`
pub async fn outer() -> Result<User, RepoError> {
    futures::executor::block_on(load_user()) // <- silently stalls every task on the worker
}

// ❌ BAD: bridging sync→async by blocking the executor
impl SyncTrait for MyService {
    fn do_thing(&self) -> Result<(), Error> {
        tokio::runtime::Handle::current().block_on(self.async_do_thing())
        // Two failure modes:
        //   1. Caller is on the runtime → deadlocks / starves the executor.
        //   2. Caller is on a blocking worker → exhausts the blocking pool.
    }
}
```

### What to Use Instead

| Situation                                              | Correct call                                                   |
|--------------------------------------------------------|----------------------------------------------------------------|
| You have a `Future`, you're inside `async fn`          | `future.await`                                                 |
| You need to run sync code from `async fn`              | `tokio::task::spawn_blocking(closure).await` (or runtime equiv)|
| You need to expose async behind a sync trait           | Don't. Restructure the trait to be `async fn`, or push the boundary out one layer so the caller is async too. |
| You're at the binary entrypoint (`main` is sync)       | One top-level `Runtime::block_on(async { ... })` is legitimate |
| You're inside a `#[tokio::main]` function              | Already async — just `.await`; never reach for `Handle::block_on` |

## Edge Cases

- **`#[tokio::main]` / `#[async_std::main]` macros** desugar into `Runtime::new().block_on(async { … })`. The one `block_on` they emit is the legitimate top-level entrypoint covered above. Anything **inside** that block is async context — the rule applies.
- **Tests** (`#[tokio::test]`) are async by construction; do not reach for `block_on` to "wait for a side task" — use `tokio::time::timeout` and `.await` instead.
- **Sync trait impls that must call async code** are a recurring pain point. The sanctioned routes are: (a) make the trait `async fn` (Rust 1.75+ supports it natively); (b) refactor so the caller of the sync trait is itself async; (c) if neither is possible, document the `// NOT CANCEL-SAFE:` reasoning and isolate the bridge in a single function that is never invoked from an executor thread (verified by a `debug_assert!(tokio::runtime::Handle::try_current().is_err())`).
- **`tokio::task::block_in_place`** is different — it tells the multi-threaded runtime to move the current task off the worker so the worker can keep scheduling. It is still a code smell (it doesn't work on the current-thread runtime), but it is **not** the same prohibition as `block_on`. Prefer `spawn_blocking` for any non-trivial sync work.

## Related

RST-ASYNC-01, RST-ASYNC-02, RST-ASYNC-03, RST-CORE-01
