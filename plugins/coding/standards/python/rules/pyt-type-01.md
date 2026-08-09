# PYT-TYPE-01: Choose Protocol vs ABC vs dataclass vs Pydantic

**Tool Coverage:** standard-only

## Intent

Picking the wrong type shape locks a codebase into the wrong abstraction. Use `Protocol` for structural/duck-typed contracts, `ABC` for nominal inheritance with shared behavior, `@dataclass(frozen=True, slots=True)` for internal value objects, and `Pydantic` **only** at trust boundaries. Internal components MUST NOT use Pydantic — validation overhead belongs at the edge, not every call site.

## Fix

```python
# ✅ GOOD: Protocol for structural typing (duck-typed contract)
from typing import Protocol

class Cache(Protocol):
    def get(self, key: str) -> bytes | None: ...
    def set(self, key: str, value: bytes) -> None: ...

# ✅ GOOD: ABC for nominal inheritance with shared behavior
from abc import ABC, abstractmethod

class PaymentProcessor(ABC):
    def charge(self, amount: int) -> None:
        self._validate(amount)
        self._process(amount)  # shared

    @abstractmethod
    def _process(self, amount: int) -> None: ...

# ✅ GOOD: frozen dataclass for internal value objects
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Money:
    amount: int
    currency: str

# ✅ GOOD: Pydantic ONLY at trust boundaries (HTTP body)
from pydantic import BaseModel

class CreateUserRequest(BaseModel):  # HTTP boundary
    email: str
    age: int

# ❌ BAD: Pydantic for internal value object
class InternalMoney(BaseModel):  # validation tax on every construction
    amount: int
```

### Decision Tree

- **Crossing a trust boundary?** (CLI arg, file, HTTP body, external API) → **Pydantic**
- **Otherwise — duck-typed contract across unrelated impls?** → **Protocol**
- **Otherwise — shared behavior with nominal "is-a"?** → **ABC**
- **Otherwise — immutable data shape?** → **`@dataclass(frozen=True, slots=True)`**

## Edge Cases

- An internal library that also exposes a CLI: Pydantic lives only in the CLI adapter layer; the library core uses dataclasses.
- A Protocol can be `@runtime_checkable` for `isinstance()` checks, but prefer static verification.
- Tooling cannot enforce "Pydantic only at boundaries" — it is an architectural rule reviewed in code review.

## Related

PYT-TYPE-02, PYT-TYPE-05, PYT-CORE-02
