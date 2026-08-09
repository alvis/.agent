# PYT-EXCP-02: Never Catch `BaseException` or Use Bare `except:`

**Tool Coverage:** ruff:E722 (partial — flags bare `except:` but not `except BaseException`)

## Intent

`BaseException` sits above `Exception` and is the parent of `KeyboardInterrupt`, `SystemExit`, and `GeneratorExit`. Catching it (or using bare `except:` which is equivalent) means Ctrl+C and `sys.exit()` get swallowed, leaving the process unkillable. Always narrow to `Exception` or, preferably, a specific subclass.

## Fix

```python
# ✅ GOOD: specific exception
try:
    data = json.loads(raw)
except json.JSONDecodeError as exc:
    logger.warning("malformed payload", exc_info=exc)
    return None

# ✅ GOOD: Exception at a top-level boundary with re-raise discipline
def main() -> int:
    try:
        run()
    except Exception:   # NEVER BaseException
        logger.exception("unhandled")
        return 1
    return 0

# ❌ BAD: bare except — E722, swallows KeyboardInterrupt/SystemExit
try:
    run()
except:
    pass

# ❌ BAD: explicit BaseException — same problem, just verbose
try:
    run()
except BaseException:
    pass
```

### The Only Legitimate `BaseException` Catch

Frameworks that implement `asyncio` event loops or test runners may need to intercept `BaseException` to run cleanup, but they MUST re-raise:

```python
try:
    await task
except BaseException:
    await cleanup()
    raise                 # non-negotiable re-raise
```

## Edge Cases

- `ruff E722` flags bare `except:` but does not fire on `except BaseException:` — that pattern must be caught in code review.
- In `except*` (exception groups), catching `BaseExceptionGroup` has the same hazard — narrow to `ExceptionGroup` instead.
- Tests that assert "any failure" should use `pytest.raises(Exception)`, never `BaseException`.

## Related

PYT-EXCP-01, PYT-EXCP-03, PYT-EXCP-04
