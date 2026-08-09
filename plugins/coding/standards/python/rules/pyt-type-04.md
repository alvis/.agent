# PYT-TYPE-04: `NewType` for Primitive-Obsession-Prone IDs

**Tool Coverage:** standard-only

## Intent

`user_id: str` and `order_id: str` are interchangeable to the type checker — nothing stops `charge(order_id, user_id)` from silently swapping them. `NewType` gives each ID its own nominal type at zero runtime cost, turning a latent bug into a type error.

## Fix

```python
# ✅ GOOD: distinct nominal types, impossible to cross-pass
from typing import NewType

UserId = NewType("UserId", str)
OrderId = NewType("OrderId", str)

def charge(order_id: OrderId, user_id: UserId) -> None: ...

uid = UserId("u_123")
oid = OrderId("o_456")
charge(oid, uid)   # ok
charge(uid, oid)   # type error: argument order wrong

# ❌ BAD: plain str — swap compiles, breaks at runtime
def charge(order_id: str, user_id: str) -> None: ...
charge(user_id_value, order_id_value)  # silently wrong
```

### When to Introduce a NewType

Introduce one when **any** of these is true:
- the value is an identifier (`*_id`, token, handle)
- two or more sibling values share the same primitive type
- the value carries domain meaning beyond "a string" (e.g. `EmailAddress`, `SemVer`)

## Edge Cases

- `NewType` has no runtime class — `isinstance(x, UserId)` raises `TypeError`. Use `str` for runtime checks.
- Do not subclass a `NewType` (`class Admin(UserId): ...` is invalid); create a second `NewType` or a real class.
- The first argument MUST be a string literal matching the variable name (`ty` flags `invalid-newtype` otherwise).
- Tooling does not know *when* to introduce a `NewType`; the decision is policy-enforced in review.

## Related

PYT-TYPE-01, PYT-TYPE-03, PYT-CORE-02
