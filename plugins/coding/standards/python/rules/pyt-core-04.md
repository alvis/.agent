# PYT-CORE-04: Use `Self` for Fluent Returns, `__enter__`, and `from_*` Classmethods

**Tool Coverage:** standard-only

## Intent

PEP 673's `typing.Self` spells "the current class, even under subclassing" in one token. Use it for fluent builder methods that return `self`, for `__enter__` in context managers, and for alternative constructors (`from_json`, `from_row`, `from_env`). The legacy `TypeVar("T", bound="Cls")` pattern is verbose and has to be threaded through every signature; `Self` is both shorter and correctly covariant on subclasses out of the box. Neither ruff nor ty flags the legacy pattern — both forms are type-correct — so this is enforced in review as an ergonomic/maintainability rule.

## Fix

```python
# ✅ GOOD: Self on fluent builder, __enter__, and from_* classmethods
from typing import Self
from dataclasses import dataclass, replace

@dataclass(frozen=True, slots=True)
class QueryBuilder:
    table: str
    limit: int | None = None

    def with_limit(self, limit: int) -> Self:
        return replace(self, limit=limit)

    @classmethod
    def from_table(cls, table: str) -> Self:
        return cls(table=table)

class Transaction:
    def __enter__(self) -> Self:
        self._begin()
        return self

    def __exit__(self, *exc: object) -> None:
        self._commit()

    def _begin(self) -> None: ...
    def _commit(self) -> None: ...
```

```python
# ❌ BAD: TypeVar dance — verbose, does not subclass cleanly
from typing import TypeVar

T = TypeVar("T", bound="QueryBuilder")

class QueryBuilder:
    def with_limit(self: T, limit: int) -> T:  # noise on every method
        ...

    @classmethod
    def from_table(cls: type[T], table: str) -> T:  # awkward
        ...
```

### Why `Self` Beats Manual TypeVars

A subclass `AuditedQueryBuilder(QueryBuilder)` calling `.with_limit(10)` must get back an `AuditedQueryBuilder`, not a `QueryBuilder`. `Self` encodes that automatically in every method; the `TypeVar` form requires you to remember to bind `self: T` or `cls: type[T]` on each signature and silently degrades to the base class if you forget.

## Edge Cases

- Functions that return a *different* instance of the same class (not `self`) still use `Self` — the contract is "same class as the receiver", not "same object".
- For `__exit__`, return `None` (or `bool` if you suppress exceptions); `Self` is only for `__enter__`.
- In a Protocol, `Self` refers to the concrete implementer, which is usually what you want; document it if the contract expects a specific subclass relationship.
- Escape hatches needing `# type: ignore` must follow PYT-CORE-03's mandated format.

## Related

PYT-CORE-01, PYT-TYPE-02, PYT-TYPE-06
