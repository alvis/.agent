# RST-NAME-04: Trait Names Follow Capability-Adjective or Conversion Conventions

**Tool Coverage:** standard-only — no clippy lint enforces trait-naming conventions.

## Intent

Trait names communicate *what an implementor can do*. The Rust standard library uses two stable patterns: **capability traits** are adjectives or verbed adjectives describing an ability (`Read`, `Write`, `Iterator`, `Clone`, `Send`, `Sync`, `Hash`, `Debug`, `Display`); **conversion traits** describe a directional value transformation and live behind `From<T>`, `Into<T>`, `AsRef<T>`, `AsMut<T>`, `TryFrom<T>`, `TryInto<T>`. Inventing parallel hierarchies (`IntoFoo` when `From<Foo>` would do, or noun-shaped `UserStuff` traits) fractures the ecosystem's vocabulary. This rule pins the project to the std-lib conventions.

## Fix

```rust
// ✅ GOOD: capability traits as adjectives or std-style verbs
pub trait Readable {
    fn read_bytes(&mut self) -> std::io::Result<Vec<u8>>;
}

pub trait Cacheable {
    fn cache_key(&self) -> String;
}

pub trait Serializable {
    fn to_wire(&self) -> bytes::Bytes;
}

// ✅ GOOD: conversion traits use std-lib shapes
pub struct UserId(uuid::Uuid);

impl From<uuid::Uuid> for UserId {
    fn from(value: uuid::Uuid) -> Self { Self(value) }
}

impl AsRef<uuid::Uuid> for UserId {
    fn as_ref(&self) -> &uuid::Uuid { &self.0 }
}

// callers get `let id: UserId = raw.into();` and `id.as_ref()` for free
```

```rust
// ❌ BAD: noun-shaped traits and reinvented conversion hierarchies
pub trait UserStuff {                        // noun — describes a thing, not a capability
    fn do_user_stuff(&self);
}

pub trait DoesIO {                           // verb phrase — pick `Readable`/`Writable` instead
    fn does_io(&mut self) -> std::io::Result<()>;
}

pub trait IntoUserId {                       // reinvents `From<T> for UserId`
    fn into_user_id(self) -> UserId;
}

impl IntoUserId for uuid::Uuid {
    fn into_user_id(self) -> UserId { UserId(self) }
}

pub trait UserIdRef {                        // reinvents `AsRef<uuid::Uuid>`
    fn user_id_ref(&self) -> &uuid::Uuid;
}
```

### When to Reach for `From` vs. a Named Trait

If the operation is a pure conversion (`A` → `B`, lossless or fallible with `TryFrom`), implement `From<A> for B` (or `TryFrom`). Implementors get `Into<B> for A` automatically, and callers write idiomatic `let b: B = a.into();`. Reach for a named trait (`ToWire`, `IntoRequest`) only when the conversion needs additional context (`fn to_wire(&self, ctx: &Context) -> Bytes`) that `From::from` cannot carry. Names like `IntoFoo` without that justification are duplicate machinery.

### Capability Trait Naming

- Adjective form: `Readable`, `Writable`, `Hashable`, `Cloneable`, `Serializable`, `Cacheable`.
- Std-lib bare-verb form: `Read`, `Write`, `Iterator`, `Display`, `Debug`, `Hash`. Use these when matching std-lib semantics; do not coin new bare-verb traits in application code (the adjective form reads better at the use site).
- Avoid `I`-prefix (`IReadable`), `Abstract`-prefix (`AbstractReader`), or noun-shaped traits (`UserStuff`, `Helper`). All three are non-idiomatic in Rust.

## Edge Cases

- Marker traits (no methods) often end in `-able` or describe a property: `Send`, `Sync`, `Unpin`, `Copy`. New markers should follow the same shape.
- Operator-overload traits (`Add`, `Sub`, `Index`) follow std-lib naming exactly — implement them, do not rename them.
- A trait that conceptually says "convert to" but needs &self (not consuming self) is `AsRef<T>` / `AsMut<T>`, not a custom `ToFoo` trait, unless the conversion is genuinely expensive or fallible.
- Sealed traits used purely for type-system tagging (`mod sealed { pub trait Sealed {} }`) may use the noun form by convention — the `Sealed` name is itself a recognised pattern.

## Related

RST-NAME-01, RST-NAME-03, RST-TYPE-01, RST-TYPE-03
