# PYT-ASYNC-02: No Blocking I/O Inside Async Code

**Tool Coverage:** ruff:ASYNC210,ASYNC212,ASYNC220,ASYNC221,ASYNC222,ASYNC230,ASYNC240,ASYNC250,ASYNC251 (partial — only catches a curated list of stdlib/`requests`/`httpx` blocking calls; custom blocking wrappers, CPU-bound loops, and third-party sync SDKs slip through)

## Intent

Blocking calls inside a coroutine freeze the event loop for every task sharing it. Route synchronous I/O (`open`, `time.sleep`, `requests`, `subprocess.run`, DB drivers without async support) and CPU-bound work through `asyncio.to_thread(...)` or a dedicated executor. Prefer native async libraries (`httpx.AsyncClient`, `aiofiles`, async DB drivers) when they exist.

## Fix

```python
# ✅ GOOD: native async client
import asyncio
import httpx

async def fetch_user(user_id: str) -> dict[str, object]:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"/users/{user_id}")
    return response.json()

# ✅ GOOD: offload unavoidable sync work
async def read_config(path: str) -> str:
    return await asyncio.to_thread(_read_file, path)

def _read_file(path: str) -> str:
    with open(path, encoding="utf-8") as handle:
        return handle.read()

# ❌ BAD: blocking HTTP stalls the loop (ruff ASYNC210)
async def fetch_user(user_id: str) -> dict[str, object]:
    return requests.get(f"/users/{user_id}").json()

# ❌ BAD: blocking sleep freezes every coroutine on the loop
async def rate_limited() -> None:
    time.sleep(1)

# ❌ BAD: synchronous file I/O in async scope
async def read_config(path: str) -> str:
    with open(path, encoding="utf-8") as handle:
        return handle.read()
```

### What Counts as Blocking

- Network: `requests`, `urllib`, `http.client`, sync DB drivers (`psycopg2`, `sqlite3`, `redis-py` sync API).
- Filesystem: `open`, `os.read/write`, `pathlib.Path.read_text`.
- Process: `subprocess.run`, `os.system`.
- Timing: `time.sleep` — use `asyncio.sleep`.
- CPU-bound: tight numeric loops, regex on large inputs, compression, crypto. Send to `asyncio.to_thread` or a `ProcessPoolExecutor`.

## Edge Cases

- Ruff's ASYNC2xx only flags known blocking APIs. Reviewers MUST still scrutinise custom utility functions that wrap sync I/O without exposing it at the call site.
- Startup code that runs before the event loop starts (e.g. loading a config file in `main()`) may use sync I/O safely.
- Small, bounded computations (microseconds) are fine inline — the event loop does not pre-empt them anyway. Measure before offloading.

## Related

PYT-ASYNC-01, PYT-ASYNC-03, PYT-ASYNC-04
