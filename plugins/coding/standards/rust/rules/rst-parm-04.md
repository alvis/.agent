# RST-PARM-04: Fluent Chains Use `&mut self -> &mut Self`

**Tool Coverage:** standard-only (clippy's `return_self_not_must_use` is explicitly allowed in `RST-CORE-04` because fluent chains here do not need `#[must_use]`).

## Intent

Non-consuming fluent configuration MUST take `&mut self` and return `&mut Self`. Consuming `self` is reserved for terminal operations — canonically `Builder::build(self) -> Result<T, BuildError>`, where the builder is intentionally retired. Consuming-`self` chains (`fn with_limit(self, ...) -> Self`) force callers to either rebind on every line or chain in one expression; they also block reusing a partially-configured value across branches. The `&mut self -> &mut Self` shape composes the same way at the call site, but lets the value live across statements and be borrowed again.

## Fix

```rust
// ✅ GOOD: fluent, non-consuming, reusable
pub struct QueryConfig {
    limit: u32,
    offset: u32,
    include_archived: bool,
}

impl QueryConfig {
    pub fn new() -> Self {
        Self { limit: 50, offset: 0, include_archived: false }
    }

    pub fn with_limit(&mut self, n: u32) -> &mut Self {
        self.limit = n;
        self
    }

    pub fn with_offset(&mut self, n: u32) -> &mut Self {
        self.offset = n;
        self
    }

    pub fn include_archived(&mut self, on: bool) -> &mut Self {
        self.include_archived = on;
        self
    }
}

let mut config = QueryConfig::new();
config.with_limit(100).with_offset(20);

if user.is_admin() {
    config.include_archived(true);
}
// `config` is still usable — nothing was consumed
```

```rust
// ❌ BAD: consuming self forces rebinding and blocks reuse
pub struct QueryConfig { limit: u32, offset: u32, include_archived: bool }

impl QueryConfig {
    pub fn with_limit(self, n: u32) -> Self {
        Self { limit: n, ..self }
    }

    pub fn with_offset(self, n: u32) -> Self {
        Self { offset: n, ..self }
    }
}

// every step must rebind; conditional config becomes awkward
let config = QueryConfig::new().with_limit(100).with_offset(20);
let config = if user.is_admin() { config.include_archived(true) } else { config };
```

### When Consuming `self` Is Correct

A terminal builder method that finalises the configuration is the canonical case. The builder is meant to be exhausted; consuming `self` makes that obvious and lets the compiler reject reuse:

```rust
// ✅ GOOD: terminal `build` consumes the builder by design
impl DeployRequestBuilder {
    pub fn build(self) -> Result<DeployRequest, BuildError> {
        // ...
        # unimplemented!()
    }
}
```

Other consuming-`self` patterns (e.g., `Into::into`, `IntoIterator::into_iter`) are not "fluent chains" and follow their own trait contracts.

## Edge Cases

- Trait methods returning `&mut Self` must be implemented on concrete types — trait objects (`dyn Trait`) cannot return `&mut Self` due to object safety. If trait-object compatibility matters, return `&mut dyn Trait` instead.
- For owned, value-style builders that genuinely cannot mutate in place (e.g., compile-time type-state builders that change phantom types per step), consuming `self` is unavoidable and acceptable — document the type-state pattern at the type level.
- Returning `&Self` (immutable) from a setter is wrong — it allows chaining but prevents the next setter from mutating; always `&mut Self`.

## Related

RST-PARM-01, RST-PARM-03, RST-OWNS-01
