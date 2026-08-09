# PYT-PARM-03: No Mutable Default Arguments

**Tool Coverage:** ruff:B006, B008

## Intent

Never use mutable objects (`[]`, `{}`, `set()`, `dataclass()`, any function call) as default values. Python evaluates defaults **once** at function definition time, so the same list/dict is shared across every call — the classic "why is my list growing between tests?" bug. Use `None` as a sentinel and construct the real default in the function body.

## Fix

```python
# ✅ GOOD: None sentinel, construct fresh inside
def append_event(payload: dict, history: list[dict] | None = None) -> list[dict]:
    history = history if history is not None else []
    history.append(payload)
    return history
```

```python
# ❌ BAD: the same list is shared across every call that omits `history`
def append_event(payload: dict, history: list[dict] = []) -> list[dict]:
    history.append(payload)
    return history

append_event({"id": 1})  # returns [{"id": 1}]
append_event({"id": 2})  # returns [{"id": 1}, {"id": 2}]  — surprise!
```

### Also Forbidden: Function Calls as Defaults

```python
# ❌ BAD: datetime.now() is evaluated once at import, not per call (B008)
def log(event: str, when: datetime = datetime.now()) -> None:
    ...

# ✅ GOOD: compute in the body
def log(event: str, when: datetime | None = None) -> None:
    when = when if when is not None else datetime.now()
    ...
```

### Immutable Defaults Are Fine

Tuples, frozensets, strings, numbers, `None`, and `frozen=True` dataclasses are safe because they cannot be mutated after creation:

```python
def render(tags: tuple[str, ...] = ()) -> str: ...   # safe
def price(currency: str = "USD") -> Money: ...       # safe
```

## Edge Cases

- `dataclasses.field(default_factory=list)` is the dataclass equivalent — the factory runs per instance, not once.
- Callable defaults whose return value is immutable (e.g., a sentinel singleton) may appear safe but still violate B008; prefer the `None` pattern for consistency.

## Related

PYT-PARM-01, PYT-PARM-04, PYT-CORE-05
