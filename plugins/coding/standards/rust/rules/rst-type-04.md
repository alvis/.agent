# RST-TYPE-04: Generic Bounds Move to `where` at 2+ Bounds

**Tool Coverage:** clippy:multiple_bound_locations (partial — flags duplication across `<>` and `where`, not the formatting threshold itself).

## Intent

A single bound in angle brackets (`fn run<T: Read>(io: T)`) reads cleanly and stays on one line. Two or more bounds inline (`fn run<T: Read + Write + Send + Sync>(io: T)`) push the signature past comfortable reading width, hide bound additions in noise, and make rustfmt produce one indent-soup line. Once a function has **two or more bounds** — on the same type parameter, on different parameters, or any combination — every bound MUST move to a `where` clause. The result is one bound per line, scannable, and trivially diffable when a `+ Clone` is added or removed.

## Fix

```rust
// ✅ GOOD: one bound stays inline
pub fn print<T: std::fmt::Display>(value: T) {
    println!("{value}");
}

// ✅ GOOD: 2+ bounds move to `where`; one bound per line
pub fn run<T, U>(io: T, sink: U) -> Result<(), IoError>
where
    T: std::io::Read + Send + Sync,
    U: std::io::Write + Send,
{
    /* ... */
    # unimplemented!()
}

// ✅ GOOD: associated-type and lifetime bounds also move to `where`
pub fn collect<I>(iter: I) -> Vec<I::Item>
where
    I: IntoIterator,
    I::Item: Clone + Send,
{
    iter.into_iter().collect()
}
```

```rust
// ❌ BAD: 2+ bounds inline — hard to scan, rustfmt produces an unreadable line
pub fn run<T: std::io::Read + Send + Sync, U: std::io::Write + Send>(
    io: T,
    sink: U,
) -> Result<(), IoError> {
    /* ... */
    # unimplemented!()
}

// ❌ BAD: split between inline and where — clippy::multiple_bound_locations
pub fn run<T: std::io::Read>(io: T) -> Result<(), IoError>
where
    T: Send + Sync,
{
    /* ... */
    # unimplemented!()
}
```

### The Inflection Point

| Bounds on the function | Form |
|---|---|
| 1 bound on 1 type | inline: `fn f<T: Trait>(...)` |
| 2+ bounds total (any combination across type params) | `where` clause, one bound per line |
| `impl Trait` argument with 1 bound | inline: `fn f(arg: impl Trait)` |
| `impl Trait` argument with 2+ bounds | name the parameter and move to `where` |

The threshold counts bounds, not type parameters — a single type parameter with two bounds (`T: Read + Write`) already triggers the `where`-clause rule.

## Edge Cases

- Trait declarations follow the same rule: `trait Foo<T> where T: Bar + Baz { ... }`.
- Lifetime bounds (`'a: 'b`) live in `where` once a trait bound is also present; pure lifetime bounds on a single parameter may stay inline.
- For `impl` blocks, all bounds belong in the `impl<...> where ...` block — never split across the `impl Trait for Type` head and a separate `where`.
- `rustfmt` enforces the formatting *once* the `where` clause is present; it does not move bounds for you. Reviewers MUST flag inline 2+ bounds even if rustfmt is green.
- When a generic parameter is used in only one place inside the body, consider replacing it with `impl Trait` in argument position — often eliminates the bound count entirely.

## Related

RST-TYPE-03, RST-PARM-02, RST-PARM-03, RST-NAME-04
