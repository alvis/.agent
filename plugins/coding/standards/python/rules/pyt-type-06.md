# PYT-TYPE-06: PEP 695 `type` Aliases

**Tool Coverage:** standard-only

## Intent

Python 3.12+ introduces the `type` statement for type aliases. It has proper runtime identity as a `TypeAliasType`, supports generic parameters natively, and signals intent to both readers and type checkers. Legacy `X: TypeAlias = ...` and bare `X = ...` assignments are ambiguous (is this an alias or a regular value?) and lack generic syntax.

## Fix

```python
# ✅ GOOD: PEP 695 type statement
type UserId = str
type JsonValue = str | int | float | bool | None | list["JsonValue"] | dict[str, "JsonValue"]
type Result[T, E] = tuple[T, None] | tuple[None, E]   # generic alias

def parse[T](raw: str, decoder: Callable[[str], T]) -> Result[T, ValueError]: ...

# ❌ BAD: legacy TypeAlias annotation (pre-3.12)
from typing import TypeAlias
UserId: TypeAlias = str

# ❌ BAD: bare assignment — ambiguous with a regular value
JsonValue = str | int | float | bool | None

# ❌ BAD: legacy generic alias needs TypeVar boilerplate
T = TypeVar("T")
E = TypeVar("E")
Result = tuple[T, None] | tuple[None, E]
```

## Edge Cases

- `type X = ...` requires Python 3.12+. The standard targets 3.13+, so always use it.
- PEP 695 aliases are lazy — forward references inside them resolve at use time, so recursive aliases (`JsonValue`) work without string quotes in the alias body itself, though quotes are still needed for self-references inside collections.
- For type variables, PEP 695 also supports inline generic syntax (`def f[T](x: T) -> T`) — prefer it over `TypeVar` declarations.
- `ruff` surfaces related stub-file hygiene (e.g. `PYI042` CamelCase alias names) but does not auto-migrate legacy aliases.

## Related

PYT-TYPE-01, PYT-TYPE-03, PYT-CORE-04
