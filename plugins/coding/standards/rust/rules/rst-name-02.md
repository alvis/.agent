# RST-NAME-02: SCREAMING_SNAKE_CASE Reserved for const and static Items

**Tool Coverage:** rustc:non_upper_case_globals (partial — flags lowercase on `const`/`static` but does not flag `SCREAMING_SNAKE` misuse on locals or enum variants).

## Intent

Reserve `SCREAMING_SNAKE_CASE` for two and only two slots: `const` and `static` items. The compiler's `non_upper_case_globals` lint will tell you if you spell a `const` lowercase, but it will not stop you from shouting at a local binding or an enum variant. Mis-applying the casing is a false signal that the value is a compile-time constant when it is in fact a mutable local, a `let`-bound expression, or a runtime-resolved enum variant.

## Fix

```rust
// ✅ GOOD: SCREAMING_SNAKE_CASE only on const / static
pub const MAX_RETRIES: u32 = 3;
pub const DEFAULT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);

static GLOBAL_COUNTER: std::sync::atomic::AtomicU64 =
    std::sync::atomic::AtomicU64::new(0);

// enum variants — PascalCase, not SCREAMING_SNAKE
pub enum Status {
    Active,
    Suspended,
    Closed,
}

pub fn run(limit: u32) {
    let attempts_remaining = limit;          // local — snake_case
    for attempt_index in 0..attempts_remaining {
        try_once(attempt_index);
    }
}
```

```rust
// ❌ BAD: SCREAMING_SNAKE_CASE in the wrong slots
pub enum Status {
    ACTIVE,                                  // variant must be PascalCase
    SUSPENDED,
    CLOSED,
}

pub fn run(limit: u32) {
    let MAX_ATTEMPTS = limit;                // local binding — must be snake_case
    for ATTEMPT_INDEX in 0..MAX_ATTEMPTS {   // loop variable — must be snake_case
        try_once(ATTEMPT_INDEX);
    }
}

pub fn DO_WORK() {}                          // function — must be snake_case (RST-NAME-01)
```

### Why Not Variants

In some languages (Java, Python `Enum`) variants are conventionally `SCREAMING_SNAKE`. Rust enum variants are `PascalCase` by community convention and by `non_camel_case_types` enforcement. The reader's case-based hint is preserved: `Status::Active` is clearly a value of a type; `MAX_RETRIES` is clearly a compile-time constant. Mixing them destroys the signal.

## Edge Cases

- `const fn` definitions are still functions — their *names* are `snake_case`. Only the values bound by `const NAME: T = ...;` get `SCREAMING_SNAKE`.
- Associated constants on traits and impls follow the same rule: `impl Foo { pub const MAX: u32 = 10; }` is correct; `pub const max: u32 = 10;` is not.
- `static mut` items still use `SCREAMING_SNAKE`, but `static mut` itself is a code smell — prefer `OnceLock`, `LazyLock`, or `AtomicT`. Reach for `static mut` only behind `unsafe` with a documented `// SAFETY:` block per RST-CORE-02.
- FFI imports may need `#[allow(non_upper_case_globals)] // reason: matches upstream symbol` for lowercase C constants — gate with the `// reason:` postfix from RST-CORE-03.

## Related

RST-NAME-01, RST-NAME-03, RST-CORE-03, RST-TYPE-02
