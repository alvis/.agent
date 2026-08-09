# RST-ASYNC-03: Cancellation Safety Is Documented

**Tool Coverage:** `standard-only` — cancel-safety is a semantic property of how a future behaves when dropped at an `.await` point; no clippy lint can infer it. Reviewers MUST verify the invariant against a `// CANCEL-SAFE:` note at every non-obvious boundary.

## Intent

In a structured-concurrency world an `async fn` can be cancelled at any `.await` by its parent scope dropping the future. Cancellation safety means: **dropping the future mid-way leaves observable invariants intact** (no partially written records, no half-released locks, no orphan in-flight requests). Most leaf futures are trivially cancel-safe; the dangerous cases are the ones with internal state that mutates across `.await` points — buffered writers, transactional sinks, batched RPC clients. The rule is runtime-agnostic: tokio, async-std, smol, and embassy all surface cancellation as `Drop` on the future, so the same discipline applies everywhere.

Every non-obvious cancel boundary MUST carry a comment of the form `// CANCEL-SAFE: <invariant>` (or `// NOT CANCEL-SAFE: <reason>` with the call sites that must wrap it in `tokio::pin!` + `select!`-guarded branches, or shield it with `tokio::task::spawn`).

## Fix

```rust
// ✅ GOOD: explicit cancel-safe boundary; the invariant is documented and enforced
use tokio::select;
use tokio::sync::mpsc;

pub struct BufferedSink<W> {
    inner: W,
    buf: Vec<Record>,
}

impl<W: AsyncRecordWriter> BufferedSink<W> {
    /// Drains the in-memory buffer and writes it to `inner`.
    ///
    /// CANCEL-SAFE: on drop the buffer is preserved (the field is owned), so a
    /// subsequent call retries the same records. We never partially commit:
    /// the write happens under `select!` so a cancel from the outer scope
    /// short-circuits BEFORE the inner write is initiated.
    pub async fn flush(&mut self, cancel: &mut mpsc::Receiver<()>) -> Result<(), FlushError> {
        loop {
            // CANCEL-SAFE: branch completes invariant work before drop —
            // either we observe cancel and leave `self.buf` intact, or we
            // commit the batch atomically.
            select! {
                biased;
                _ = cancel.recv() => return Ok(()), // buffer retained for next call
                result = self.inner.write_batch(&self.buf) => {
                    result?;
                    self.buf.clear();
                    return Ok(());
                }
            }
        }
    }
}

// ✅ GOOD: leaf future is trivially cancel-safe — no internal state crosses `.await`
pub async fn get_user(id: UserId) -> Result<User, RepoError> {
    // CANCEL-SAFE: single `.await`, drop discards only the in-flight HTTP request.
    client().get(format!("/users/{id}")).send().await?.json().await
}
```

```rust
// ❌ BAD: non-obvious cancel hazard with no documentation
pub struct LedgerWriter<W> {
    inner: W,
    pending: Vec<Entry>,
}

impl<W: AsyncWriter> LedgerWriter<W> {
    // Reader cannot tell: if the caller drops this future after `write_header`
    // completes but before `write_body`, the ledger is left half-written.
    // No `// CANCEL-SAFE:` note → reviewer rejects.
    pub async fn commit(&mut self) -> Result<(), WriteError> {
        self.inner.write_header(&self.pending).await?;
        self.inner.write_body(&self.pending).await?; // cancel here corrupts the ledger
        self.pending.clear();
        Ok(())
    }
}

// ❌ BAD: cancel mid-way leaves the lock half-released
pub async fn rotate(lock: &Mutex<State>) -> Result<(), RotateError> {
    let mut guard = lock.lock().await;
    let snapshot = guard.snapshot();
    publish(snapshot).await?; // cancel here — guard drops, but nothing flushed
    guard.advance();          // never runs
    Ok(())
}
```

### The `// CANCEL-SAFE:` Comment Format

`// CANCEL-SAFE: <invariant the function preserves when dropped at any .await>`

The note answers one question for the reviewer: *what does the caller observe if I drop this future right now?* Acceptable answers:

- "buffer retained for retry — no observable state change"
- "select! branch completes before yielding — atomic commit-or-rollback"
- "operation is idempotent — partial completion is safe to repeat"

If the function is **not** cancel-safe, mark it `// NOT CANCEL-SAFE: <reason>` and document the call-site discipline (`tokio::pin!` + `select!` with explicit cleanup, `spawn` to detach, or `AbortHandle::abort_and_wait` guards).

## Edge Cases

- **`finally`-style cleanup** runs naturally on drop via `Drop` impls on owned state; pair `// CANCEL-SAFE:` notes with a `Drop` impl when the invariant requires teardown (closing a transaction, returning a connection to a pool).
- **Holding a `MutexGuard` across `.await`** is almost always wrong — the guard drops on cancel but the protected mutation is incomplete. Restructure to keep the critical section synchronous, or use a `tokio::sync::Mutex` with an explicit transactional API.
- **`tokio::select!` branches** are individually cancelled when another branch wins; each branch's future MUST itself be cancel-safe. Document the per-branch invariant at the call site, not at the macro.
- **Detaching a non-cancel-safe future with `tokio::task::spawn`** moves cancellation responsibility to the `JoinHandle`'s owner — pair with an `AbortHandle` stored on a long-lived struct so shutdown is explicit.

## Related

RST-ASYNC-01, RST-ASYNC-02, RST-ASYNC-04, RST-ERRH-04
