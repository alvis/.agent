# RST-TYPE-01: Newtypes for Sibling IDs

**Tool Coverage:** standard-only — clippy cannot tell two `Uuid` fields apart.

## Intent

A function with `(user_id: Uuid, order_id: Uuid)` accepts the arguments in either order — the compiler has no way to tell them apart, and a single swapped call site is enough to charge the wrong customer. Wrap each domain identifier in a one-field `pub struct` (`UserId(pub Uuid)`, `OrderId(pub Uuid)`) so the type system rejects the swap at compile time. The runtime cost is zero (newtypes are layout-identical to the wrapped primitive), and the readability gain at every call site is permanent. Mirrors PYT-TYPE-* "domain types over primitives" — `Uuid`, `String`, `i64` are the Rust equivalents of "stringly typed".

## Fix

```rust
// ✅ GOOD: distinct newtypes per domain ID; compiler blocks accidental swap
use std::fmt;
use std::str::FromStr;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct UserId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct OrderId(pub Uuid);

impl fmt::Display for UserId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "user:{}", self.0)
    }
}

impl FromStr for UserId {
    type Err = uuid::Error;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(Self(Uuid::parse_str(s)?))
    }
}

// signature is now self-documenting; swapping the args is a type error
pub fn charge(order_id: OrderId, user_id: UserId) -> Result<Receipt, BillingError> {
    /* ... */
    # unimplemented!()
}
```

```rust
// ❌ BAD: bare Uuid for both — compiler accepts swapped arguments silently
use uuid::Uuid;

pub fn charge(order_id: Uuid, user_id: Uuid) -> Result<Receipt, BillingError> {
    /* ... */
    # unimplemented!()
}

// ❌ BAD: type alias provides zero distinctness
pub type UserId = Uuid;
pub type OrderId = Uuid;     // OrderId == UserId == Uuid to the compiler
```

### Why Type Aliases Don't Count

`pub type UserId = Uuid;` is a documentation hint — at the type level `UserId` and `Uuid` are the same type, and so is every other alias of `Uuid`. The newtype pattern (`struct UserId(pub Uuid)`) makes them distinct nominal types. Always reach for the newtype; reach for `type` only when the goal is genuinely an abbreviation (e.g. `type Result<T> = std::result::Result<T, BillingError>`).

## Edge Cases

- Boilerplate for `Display`, `FromStr`, `serde::{Serialize, Deserialize}` can be auto-derived via crates like `derive_more`, `nutype`, or `serde(transparent)` on the field. Pick one approach per crate for consistency.
- Newtypes wrapping `String` should expose `as_str(&self) -> &str` instead of leaking `&self.0`; that keeps the wrapper invariant intact.
- Sensitive identifiers (API keys, session tokens) MUST gate `Debug` / `Display` to redact the inner value — derive `Debug` manually or use the `secrecy` crate.
- For collections keyed by an ID, prefer `HashMap<UserId, T>` over `HashMap<Uuid, T>` — the key type travels with the value type and prevents accidental cross-domain lookups.

## Related

RST-TYPE-02, RST-TYPE-05, RST-NAME-01, RST-NAME-03, RST-PARM-01
