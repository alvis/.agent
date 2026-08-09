# PYT-ASYNC-03: Never Swallow `asyncio.CancelledError`

**Tool Coverage:** standard-only

## Intent

`CancelledError` is the signal asyncio uses to tear down tasks — catching and suppressing it breaks cooperative cancellation and strands resources. A parent `TaskGroup`, timeout, or signal handler that issues a cancel depends on the child re-raising after cleanup. Always re-raise `CancelledError` at the end of any handler; never convert it to `return`, `pass`, or another exception.

## Fix

```python
# ✅ GOOD: clean up, then re-raise
import asyncio

async def stream_records(source: Queue, sink: Sink) -> None:
    try:
        async for record in source:
            await sink.write(record)
    except asyncio.CancelledError:
        await sink.flush()
        raise  # propagate so the parent TaskGroup can shut down cleanly

# ✅ GOOD: narrow except does not accidentally include CancelledError
try:
    await operation()
except TimeoutError:
    await fallback()

# ❌ BAD: swallowed cancel leaves the task un-killable
async def stream_records(source: Queue, sink: Sink) -> None:
    try:
        async for record in source:
            await sink.write(record)
    except asyncio.CancelledError:
        await sink.flush()  # no re-raise — parent TaskGroup hangs

# ❌ BAD: bare except catches CancelledError silently
try:
    await operation()
except Exception:  # pre-3.8 CancelledError was an Exception; modern code must still be explicit
    logger.exception("failed")
```

### Why This Matters

`CancelledError` inherits from `BaseException` (since Python 3.8), so `except Exception:` no longer swallows it accidentally. Code that explicitly lists `CancelledError` in a handler, however, **must** re-raise — otherwise:

- `TaskGroup.__aexit__` cannot complete its shutdown sweep.
- `asyncio.wait_for` / `asyncio.timeout` cannot enforce the deadline.
- Signal-driven shutdown (SIGINT) leaves orphan coroutines.

## Edge Cases

- A handler may legitimately **convert** `CancelledError` to a custom domain error — but only if the new exception is itself raised (not returned). The key invariant is *something* exits the frame via `raise`.
- `finally:` blocks run during cancellation; they may `await` cleanup but must not introduce new `await` points that check for cancellation and suppress it.
- Shielded sections (`asyncio.shield`) deliberately absorb cancellation from outside, but the inner coroutine still re-raises if cancelled directly.

## Related

PYT-ASYNC-01, PYT-ASYNC-04, PYT-EXCP-02
