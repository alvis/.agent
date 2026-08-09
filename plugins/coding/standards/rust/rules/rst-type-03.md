# RST-TYPE-03: `impl Trait` Returns at API Boundaries

**Tool Coverage:** standard-only — clippy does not enforce return-type abstraction.

## Intent

A function that returns `std::slice::Iter<'_, Row>` leaks its internal storage (`Vec<Row>` somewhere) into its signature: callers depend on the concrete iterator type, and any refactor that switches to `BTreeMap` values, `chunks`, or a filtered iterator becomes a breaking change. Returning `impl Iterator<Item = &Row>` (or `impl Future<Output = T>`, `impl Stream<Item = T>`) keeps the boundary abstract, lets the implementation change freely, and avoids forcing the caller to allocate a `Vec` just to forget the concrete type. `impl Trait` in return position has been stable since Rust 1.26; in trait return position since Rust 1.75, and is fully usable across the 2024 edition.

## Fix

```rust
// ✅ GOOD: borrow the storage and return an opaque iterator
pub struct OrderBook {
    orders: Vec<Order>,
}

impl OrderBook {
    pub fn pending(&self) -> impl Iterator<Item = &Order> + '_ {
        self.orders.iter().filter(|o| o.is_pending())
    }
}

// ✅ GOOD: async fn already returns impl Future; impl Future works for non-async-fn shapes
pub fn fetch_all(urls: Vec<String>) -> impl std::future::Future<Output = Result<Vec<Bytes>, FetchError>> + Send {
    async move {
        /* ... */
        # unimplemented!()
    }
}
```

```rust
// ❌ BAD: concrete iterator type leaks; switching storage breaks every caller
pub fn pending(&self) -> std::slice::Iter<'_, Order> {
    self.orders.iter()          // can never become .iter().filter(...)
}

// ❌ BAD: forces a Vec allocation just to erase the iterator type
pub fn pending(&self) -> Vec<Order> {
    self.orders.iter().filter(|o| o.is_pending()).cloned().collect()
}

// ❌ BAD: leaks the IntoIter type — caller depends on the consuming shape
pub fn drain_pending(self) -> std::vec::IntoIter<Order> {
    self.orders.into_iter()
}
```

### When to Box Instead

`impl Trait` in return position fixes a single concrete underlying type per call site. When the return type genuinely varies at runtime (two branches return different iterator structures), the function must return `Box<dyn Iterator<Item = T> + '_>` instead. Treat that as the exception, not the rule — usually the branches can be unified with `.chain(...)`, `Either<L, R>` from the `itertools` crate, or by restructuring the function.

### `impl Trait` in Trait Return Position

Since Rust 1.75 (stable across 2024 edition) traits MAY declare methods that return `impl Trait`:

```rust
pub trait Repo {
    fn pending(&self) -> impl Iterator<Item = &Order>;
}
```

This is preferred over `Box<dyn Iterator<...>>` returns in trait methods when no dynamic dispatch is needed. Add explicit `Send`/`Sync` bounds (`impl Iterator<Item = &Order> + Send`) when the trait will be used across `tokio::spawn` boundaries.

## Edge Cases

- `impl Trait` in return position captures all in-scope lifetimes by default in edition 2024 — verify lifetime inference with `cargo expand` if a borrow chain compiles in 2021 but not 2024.
- Returning `impl Iterator<Item = T> + 'static` is sometimes necessary to escape a borrow; document with a `// reason:` if `'static` is non-obvious.
- Storing an `impl Trait` value in a struct field is not supported — name the bound (a concrete type, a generic parameter, or `Box<dyn ...>`).
- For public APIs that need to spell the return type in user code (rare), document the type alias explicitly — but prefer to gate that behind a sealed trait.

## Related

RST-TYPE-04, RST-TYPE-01, RST-PARM-02, RST-ASYNC-02, RST-OWNS-02
