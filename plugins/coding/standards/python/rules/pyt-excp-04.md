# PYT-EXCP-04: `ExceptionGroup` / `except*` for Fan-Out

**Tool Coverage:** ruff:B029 (partial — flags `except* ():` misuse but does not require using `except*` in fan-out code)

## Intent

When multiple operations run concurrently (`asyncio.TaskGroup`, parallel fetches, multi-target validation), more than one can fail. A classic `try/except` reports the first failure and hides the rest. `ExceptionGroup` collects every failure, and `except*` handles each class independently so callers see the full picture.

## Fix

```python
# ✅ GOOD: TaskGroup propagates an ExceptionGroup; except* handles each class
import asyncio

async def fetch_all(urls: list[str]) -> list[Response]:
    results: list[Response] = []
    try:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(fetch(u)) for u in urls]
    except* TimeoutError as eg:
        logger.warning("timeouts: %d", len(eg.exceptions))
    except* ValueError as eg:
        logger.warning("bad payloads: %d", len(eg.exceptions))
    return [t.result() for t in tasks if not t.exception()]

# ✅ GOOD: raising an ExceptionGroup yourself for multi-target validation
errors: list[Exception] = []
for rule in rules:
    try: rule.check(value)
    except ValidationError as exc: errors.append(exc)
if errors:
    raise ExceptionGroup("validation failed", errors)

# ❌ BAD: catching only the first failure, losing the rest
try:
    async with asyncio.TaskGroup() as tg: ...
except TimeoutError:           # only one subgroup visible
    ...

# ❌ BAD: empty tuple (B029) — catches nothing
except* ():
    ...
```

### When `except*` Is Not Warranted

Single-operation code paths do not need `except*` — it only pays for itself when failures genuinely fan out. Prefer plain `except` for sequential code.

## Edge Cases

- `except*` auto-rewraps unhandled sub-exceptions back into an `ExceptionGroup` — do not assume the handler consumed everything.
- `B029` flags `except* ():`; `B030` flags non-exception classes in `except*`. Both are auto-detectable.
- Python 3.11+ only — the standard targets 3.13+ so this is always available.
- Do not catch `BaseExceptionGroup` (see PYT-EXCP-02); catch `ExceptionGroup`.

## Related

PYT-EXCP-02, PYT-EXCP-03, PYT-ASYNC-01
