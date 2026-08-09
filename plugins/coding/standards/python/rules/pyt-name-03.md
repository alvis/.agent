# PYT-NAME-03: UPPER_SNAKE_CASE for Module Constants and Enum Members

**Tool Coverage:** standard-only

## Intent

Reserve `UPPER_SNAKE_CASE` for two and only two situations: true module-level constants and enum members. Ruff does not flag lowercase module constants or `UPPER_SNAKE` class attributes, so this is a convention rule humans enforce in review. Using `UPPER_SNAKE` elsewhere (class attributes, non-constant module values, function-local caches) is a false signal that the value is a compile-time constant when it is not.

## Fix

GOOD:
```python
from enum import Enum

# module-level constants — UPPER_SNAKE
MAX_RETRIES: int = 3
DEFAULT_TIMEOUT_SECONDS: float = 30.0
API_BASE_URL: str = "https://api.example.com"

# enum members — UPPER_SNAKE (PEP 8)
class Status(Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CLOSED = "closed"

# class attributes — snake_case for data, PascalCase for nested types
class HttpClient:
    default_timeout: float = 10.0         # instance default — snake_case
    _cached_session: object | None = None  # internal — snake_case

    class Config:                          # nested type — PascalCase
        ...

# non-constant module values — snake_case (these change at runtime)
_request_counter = 0
_connection_pool: list[object] = []
```

BAD:
```python
from enum import Enum

maxRetries = 3            # non-constant casing for a constant
max_retries = 3           # snake_case module constant — ambiguous with a variable

class Status(Enum):
    active = "active"     # enum members must be UPPER_SNAKE
    Suspended = "suspended"

class HttpClient:
    DEFAULT_TIMEOUT = 10.0  # not a module constant; shout-case misleads readers
    CACHED_SESSION = None   # mutable state, definitely not a constant

REQUEST_COUNTER = 0        # mutated at runtime — not a constant
REQUEST_COUNTER += 1
```

## Edge Cases

- A "constant" means the binding is not reassigned and the value is immutable (`int`, `str`, `tuple`, `frozenset`, `types.MappingProxyType`). A module-level `list` or `dict` that callers mutate is *not* a constant, even if its name never gets reassigned.
- Enum *values* can be any type; the member *names* are what PEP 8 governs. `Status.ACTIVE` is correct; `Status.active` is not.
- `typing.Final` is orthogonal: you can annotate `MAX_RETRIES: Final = 3`, but `Final` does not itself dictate casing — the convention does.
- Class-level `UPPER_SNAKE` is acceptable only for genuine class-scope constants that callers treat as namespaced module constants (rare); default to `snake_case` for instance defaults and internal state.

## Related

PYT-NAME-01, PYT-NAME-02, PYT-TYPE-03, PYT-IMPT-05
