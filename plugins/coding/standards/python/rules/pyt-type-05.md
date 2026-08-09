# PYT-TYPE-05: `TypedDict` Only for External JSON Shapes

**Tool Coverage:** standard-only

## Intent

`TypedDict` describes the *shape* of a dict but has no runtime identity and no methods. That is exactly right for JSON coming from APIs or config files (the value is already a dict) and exactly wrong for internal models, where a `dataclass` offers immutability, methods, equality, and `isinstance` checks.

## Fix

```python
# ✅ GOOD: TypedDict for an external JSON response shape
from typing import TypedDict

class GitHubUserPayload(TypedDict):
    id: int
    login: str
    email: str | None

def parse_user(raw: dict) -> GitHubUserPayload:
    return GitHubUserPayload(id=raw["id"], login=raw["login"], email=raw.get("email"))

# ✅ GOOD: internal model is a dataclass, not a TypedDict
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class User:
    id: int
    login: str
    email: str | None

    def is_anonymous(self) -> bool:
        return self.email is None

# ❌ BAD: TypedDict used for internal model
class User(TypedDict):  # no methods, no isinstance, no immutability
    id: int
    login: str
```

### Boundary Flow

External JSON → `TypedDict` (transport) → mapped to `dataclass` (domain) inside the boundary function. The rest of the code sees only the dataclass.

## Edge Cases

- `TypedDict` is structurally typed — extra keys at runtime do not raise.
- Prefer class syntax over the legacy functional form (`ruff UP013`).
- Totality: mark optional keys with `NotRequired[...]` rather than splitting into two `TypedDict` classes.
- Tooling cannot tell "is this shape external?" — the decision is policy-enforced in review.

## Related

PYT-TYPE-01, PYT-TYPE-02, PYT-CORE-01
