# PYT-NAME-04: Leading Underscore for Private API, Double Underscore Only for Name-Mangling

**Tool Coverage:** standard-only

## Intent

A single leading underscore (`_helper`) marks an identifier as *internal* — not part of the public contract, not re-exported by `from pkg import *`. A double leading underscore (`__attr`) is a language feature, not "more private": it triggers name-mangling (`Base.__x` becomes `Base._Base__x` inside the class body) and exists to avoid attribute collisions across a class hierarchy. Ruff cannot enforce this design distinction, so reviewers must: reach for `_name` by default and only use `__name` when subclass collision is a real risk (mixin frameworks, deeply inherited base classes).

## Fix

GOOD:
```python
# single leading underscore — internal API
def _normalize_email(value: str) -> str:
    return value.strip().lower()

class UserService:
    def __init__(self, repo: "UserRepo") -> None:
        self._repo = repo               # internal collaborator
        self._cache: dict[str, User] = {}

    def find(self, user_id: str) -> User | None:
        return self._cache.get(user_id) or self._repo.get(user_id)


# double leading underscore — only when collision is a real concern
class TracingMixin:
    """Mixin layered onto many concrete classes; mangle to avoid clashes."""

    def __init__(self) -> None:
        self.__trace_id: str | None = None  # becomes _TracingMixin__trace_id

    def _set_trace(self, trace_id: str) -> None:
        self.__trace_id = trace_id


# dunders — reserved for the language, never invent your own
class Point:
    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

    def __repr__(self) -> str:
        return f"Point({self.x}, {self.y})"
```

BAD:
```python
class UserService:
    def __init__(self, repo: "UserRepo") -> None:
        self.__repo = repo              # name-mangled for no reason
        self.__cache: dict[str, User] = {}

    def find(self, user_id: str) -> User | None:
        # subclasses cannot override _cache without surprise:
        # self.__cache in a subclass resolves to _Subclass__cache
        return self.__cache.get(user_id) or self.__repo.get(user_id)


# inventing dunders — reserved for the language
class Widget:
    def __my_init__(self) -> None:      # not a protocol; looks like one
        ...
```

## Edge Cases

- `from pkg import *` skips names starting with `_` unless they are listed in `__all__`. If a helper *needs* to be re-exported, name it without a leading underscore or add it to `__all__` explicitly (PYT-IMPT-05).
- Single trailing underscore (`class_`, `type_`) is the idiomatic way to sidestep a keyword or builtin collision. It is unrelated to privacy.
- Do not use `__name` to "force" subclasses to leave an attribute alone — subclasses can still reach `instance._Base__name`. Name-mangling is collision avoidance, not access control.
- Reserved dunders (`__init__`, `__enter__`, `__getattr__`, …) are part of the data model. Never define a *new* `__custom__` name; Python may one day add one and break you.

## Related

PYT-NAME-01, PYT-NAME-02, PYT-IMPT-05, PYT-MODL-03
