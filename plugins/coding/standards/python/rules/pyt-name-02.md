# PYT-NAME-02: PascalCase for Classes, Type Aliases, TypeVars, Protocols

**Tool Coverage:** ruff:N801,N818

## Intent

Use `PascalCase` (CapWords) for every *type-level* name: classes, `Protocol`s, abstract base classes, PEP 695 `type` aliases, and `TypeVar`s. A consistent casing boundary between values (`snake_case`) and types (`PascalCase`) lets readers tell at a glance whether an identifier refers to a value or a type, which is essential once annotations appear in nearly every signature.

## Fix

GOOD:
```python
from collections.abc import Iterable
from typing import Protocol, TypeVar

# classes — PascalCase
class InvoiceService:
    ...

# PEP 695 type aliases — PascalCase
type UserId = str
type JsonValue = str | int | float | bool | None | list["JsonValue"] | dict[str, "JsonValue"]

# TypeVars — single uppercase letter or PascalCase, matching `name=`
T = TypeVar("T")
RequestT = TypeVar("RequestT", bound="Request")

# Protocols — PascalCase, no `I` prefix
class SupportsClose(Protocol):
    def close(self) -> None: ...

# Exceptions — PascalCase ending in `Error`
class PaymentDeclinedError(Exception):
    ...
```

BAD:
```python
from typing import Protocol, TypeVar

class invoice_service:  # N801 — not CapWords
    ...

type user_id = str       # type alias must be PascalCase
type json_value = str | int | None

t = TypeVar("t")         # TypeVar should be T or PascalCase
request_t = TypeVar("request_t", bound="Request")

class ISupportsClose(Protocol):  # avoid Hungarian `I` prefix
    def close(self) -> None: ...

class PaymentDeclined(Exception):  # N818 — exception must end in `Error`
    ...
```

## Edge Cases

- `TypeVar("T")` must pass its own name as the string argument — `TypeVar("X")` assigned to `T` misleads every tool that reads the `name=` field (debuggers, `typing.get_args`, error messages).
- PEP 695 syntax (`type Alias = ...`) creates a real `TypeAliasType` object; casing applies to the identifier, not to what it resolves to.
- Do not prefix Protocols or ABCs with `I` or `Abstract` — `Readable`, `Closeable`, `Repository` read better than `IReadable` or `AbstractRepository`. The structural/nominal nature is visible from the base class.
- Exception hierarchies follow PYT-EXCP-01; this rule only governs the *name* (`XyzError`), not the inheritance shape.

## Related

PYT-NAME-01, PYT-NAME-03, PYT-TYPE-06, PYT-EXCP-01
