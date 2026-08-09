# PYT-MODL-02: `__init__.py` Is for Re-Exports Only

**Tool Coverage:** standard-only

## Intent

`__init__.py` files MUST contain only imports, re-exports, and an `__all__` declaration. No logic, no top-level side effects — no DB connections, no network calls, no file reads, no `print`, no logging configuration, no `sys.path` mutation. Import-time work bloats startup, couples every consumer to the side effect, and sabotages testability (you cannot import a submodule in isolation).

## Fix

```python
# ✅ GOOD: src/myproject/__init__.py — re-exports only
"""Public API for myproject."""

from myproject.api import create_client
from myproject.errors import MyProjectError, NotFoundError
from myproject.models import User

__all__ = [
    "MyProjectError",
    "NotFoundError",
    "User",
    "create_client",
]

# ❌ BAD: side effects run every time someone imports any submodule
"""Public API for myproject."""

import logging

from myproject.api import create_client  # noqa: F401

logging.basicConfig(level=logging.INFO)             # side effect #1
_connection = create_client().connect()             # side effect #2 — network call at import!
print(f"myproject initialised at {_connection.id}") # side effect #3
```

### What Counts as a Side Effect

| Allowed in `__init__.py`                 | Forbidden in `__init__.py`                          |
|------------------------------------------|-----------------------------------------------------|
| `from .submodule import Symbol`          | `client = SomeClient(...)` (any instantiation that opens a resource) |
| `__all__ = [...]`                        | `logging.basicConfig(...)`, `logger.info(...)`      |
| Module docstring                         | `load_dotenv()`, `os.environ["X"] = "y"`            |
| Type aliases / `TypeVar` / PEP 695 alias | `sys.path.append(...)`, `warnings.filterwarnings(...)` |
| `TYPE_CHECKING`-guarded imports          | File I/O, DB connections, HTTP calls, subprocess spawn |

## Edge Cases

- Version strings are allowed: `__version__ = "1.2.3"` — but prefer `importlib.metadata.version("myproject")` for installed packages so the wheel is the single source of truth.
- Registering Pydantic / dataclass subclasses via import is acceptable when the registration is a pure side effect of *defining* the class, not a runtime action — i.e. the import of the submodule itself is what registers, and `__init__.py` just re-exports.
- Lazy imports (`__getattr__` at module level, PEP 562) are allowed to defer expensive submodules — still no side effects at import time.

## Related

PYT-MODL-01, PYT-MODL-03, PYT-IMPT-05
