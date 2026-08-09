#  PYT-ASYNC-01: Prefer `asyncio.TaskGroup` Over `asyncio.gather`

**Tool Coverage:** standard-only

## Intent

Use `asyncio.TaskGroup` for concurrent fan-out. `TaskGroup` enforces structured concurrency: it raises `ExceptionGroup` on any child failure, cancels all sibling tasks automatically, and guarantees every task is joined before the `async with` block exits. `asyncio.gather` has sharp edges — `return_exceptions=False` leaves siblings running after one fails, `return_exceptions=True` silently hides errors inside the result list — both invite orphaned tasks and lost exceptions.

## Fix

```python
# ✅ GOOD: structured concurrency via TaskGroup
import asyncio

async def fetch_all(urls: list[str]) -> list[bytes]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch(url)) for url in urls]
    return [task.result() for task in tasks]

# ❌ BAD: gather leaks tasks on partial failure
async def fetch_all(urls: list[str]) -> list[bytes]:
    return await asyncio.gather(*(fetch(url) for url in urls))

# ❌ BAD: return_exceptions hides errors in the result list
async def fetch_all(urls: list[str]) -> list[bytes | BaseException]:
    return await asyncio.gather(*(fetch(url) for url in urls), return_exceptions=True)
```

### Why TaskGroup Wins

| Concern              | `TaskGroup`                           | `gather`                                  |
|----------------------|---------------------------------------|-------------------------------------------|
| First failure        | Cancels siblings, raises `ExceptionGroup` | Siblings keep running (or errors hidden) |
| Task join guarantee  | Enforced by `async with` exit         | Caller must remember to `await`           |
| Multi-error reporting| Native `ExceptionGroup`               | First exception wins; rest lost           |
| Cancellation         | Propagates cleanly through the group  | Easy to leave dangling tasks              |

## Edge Cases

- `asyncio.gather` is acceptable for narrow, trivial cases where **all** tasks share identical lifetime and error semantics is a single homogeneous failure — but `TaskGroup` is still preferred for consistency.
- Handle aggregated failures with `except*` (PEP 654) to match the `ExceptionGroup` shape.
- For fire-and-forget tasks, hold a strong reference (store the `Task` object); do not rely on `asyncio.create_task` alone — the event loop only holds a weak reference.

## Related

PYT-ASYNC-02, PYT-ASYNC-03, PYT-EXCP-04
