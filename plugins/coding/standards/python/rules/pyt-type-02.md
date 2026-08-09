# PYT-TYPE-02: Frozen Dataclasses with Slots for Value Objects

**Tool Coverage:** ruff:RUF008 (partial — enforces no mutable defaults but not `frozen=True`/`slots=True`)

## Intent

Value objects are defined by their fields, not their identity. Declare them with `@dataclass(frozen=True, slots=True)`. `frozen=True` prevents mutation so `__hash__` stays stable (usable as dict keys / set members). `slots=True` drops `__dict__`, cutting per-instance memory and preventing accidental attribute additions.

## Fix

```python
# ✅ GOOD: frozen + slots for value object
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Coordinate:
    latitude: float
    longitude: float

point = Coordinate(51.5, -0.1)
positions: set[Coordinate] = {point}  # hashable

# ❌ BAD: mutable — unhashable, accidental mutation, __dict__ overhead
@dataclass
class Coordinate:
    latitude: float
    longitude: float

p = Coordinate(51.5, -0.1)
p.latitude = 0.0           # silent mutation
p.altitude = 10            # typo creates new attr (no slots)
{p}                        # TypeError: unhashable type
```

### When slots Hurts

```python
# slots=True breaks multiple inheritance with non-slotted classes
# and mixins that expect __dict__ — document the exception
@dataclass(frozen=True)  # omit slots intentionally
class AuditedEntity(LegacyMixin):
    id: str
```

## Edge Cases

- Dataclasses with mutable field *types* (e.g. `list[str]`) are frozen at the field level only — the list itself is still mutable. Use `tuple[str, ...]` for full immutability.
- `slots=True` is Python 3.10+. Target is 3.13+, so always include it.
- Inheriting from a non-slots class nullifies the memory benefit; either slot the whole chain or accept the cost.
- Tooling flags only `RUF008` (mutable default values); the `frozen`/`slots` decision is policy-enforced in review.

## Related

PYT-TYPE-01, PYT-TYPE-05, PYT-PARM-03
