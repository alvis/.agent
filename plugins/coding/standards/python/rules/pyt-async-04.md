# PYT-ASYNC-04: Use `async with` for Async Resource Lifetimes

**Tool Coverage:** standard-only

## Intent

Any object that owns an async resource (network connection, DB session, lock, transaction, subscription) MUST expose `__aenter__` / `__aexit__` and be consumed with `async with`. Manual `await obj.open()` / `await obj.close()` pairs leak on exceptions, hide ordering mistakes, and are impossible for reviewers or static tools to validate.

## Fix

```python
# ✅ GOOD: resource lifetime bound to the block
async def publish(message: bytes) -> None:
    async with connect_broker() as broker:
        async with broker.transaction() as tx:
            await tx.publish(message)

# ✅ GOOD: implement the protocol for custom resources
from types import TracebackType
from typing import Self

class RedisSubscription:
    def __init__(self, client: RedisClient, channel: str) -> None:
        self._client = client
        self._channel = channel

    async def __aenter__(self) -> Self:
        await self._client.subscribe(self._channel)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self._client.unsubscribe(self._channel)

# ❌ BAD: manual open/close leaks on exception
async def publish(message: bytes) -> None:
    broker = await connect_broker()
    tx = await broker.begin()
    await tx.publish(message)          # if this raises, commit/close never run
    await tx.commit()
    await broker.close()

# ❌ BAD: try/finally pattern reinvents async with, poorly
async def publish(message: bytes) -> None:
    broker = await connect_broker()
    try:
        await broker.publish(message)
    finally:
        await broker.close()  # still correct, but every call site must remember
```

### Why `async with` Is Non-Negotiable

- Exceptions during setup, body, or teardown are routed through `__aexit__` with full context.
- Static readers see the resource scope at a glance; there is no "did we close it?" branch to audit.
- `contextlib.AsyncExitStack` composes multiple async resources without nesting.
- Cancellation (PYT-ASYNC-03) runs `__aexit__` as part of cleanup — manual teardown code is typically skipped on cancel.

## Edge Cases

- For third-party libraries that only expose open/close, wrap them in `@contextlib.asynccontextmanager` once and consume via `async with` everywhere else.
- Locks and semaphores (`asyncio.Lock`, `asyncio.Semaphore`) already support `async with` — never call `.acquire()` / `.release()` manually.
- If a resource must span multiple coroutines, use `AsyncExitStack` and pass the stack, not raw open/close calls.

## Related

PYT-ASYNC-02, PYT-ASYNC-03, PYT-EXCP-03
