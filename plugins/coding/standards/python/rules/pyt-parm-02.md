# PYT-PARM-02: Positional-Only for Self-Explanatory Utilities

**Tool Coverage:** standard-only

## Intent

Use the `/` separator to mark parameters as positional-only when the function is a small self-explanatory utility whose argument is obvious from the function name (`abs(x, /)`, `len(obj, /)`, `round(number, ndigits, /)`). This frees the internal parameter name to be refactored without breaking callers who (wrongly) used it as a keyword, and it signals "this is a primitive; don't bother naming the arg at the call site."

## Fix

```python
# ✅ GOOD: positional-only for obvious single-argument utilities
def slugify(text: str, /) -> str:
    """Turn text into a URL-safe slug."""
    ...

def clamp(value: float, low: float, high: float, /) -> float:
    """Clamp value between low and high."""
    ...

slugify("Hello World")       # no name needed; meaning is obvious
clamp(temperature, 0.0, 100.0)
```

```python
# ❌ BAD: no positional-only marker, callers may latch onto parameter names
def slugify(text: str) -> str: ...

# now some caller writes slugify(text=raw); renaming `text` to `value` breaks them
```

### When to Use `/`

- Single-argument utilities where the function name fully describes the argument (`normalize`, `encode`, `hash`).
- Classic numeric/string helpers that mirror builtins (`abs`, `len`, `round`).
- **Not** for multi-argument domain functions where named arguments aid readability — those follow PYT-PARM-01.

## Edge Cases

- Ruff does not enforce "should be positional-only" — this is a design choice, not a correctness one. Ty's `positional-only-parameter-as-kwarg` will flag callers who try to pass a positional-only parameter by name, which is the runtime error `/` prevents.
- Dunder methods (`__eq__`, `__hash__`) are effectively positional-only by protocol; marking them explicitly is optional but harmless.
- Do not mix `/` and `*` without need; when both are required (`def f(a, /, b, *, c)`), prefer splitting into two functions or a config object (PYT-PARM-04).

## Related

PYT-PARM-01, PYT-PARM-03, PYT-NAME-01
