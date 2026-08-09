# RST-IMPT-01: No Glob Imports Outside `tests` and `prelude`

**Tool Coverage:** clippy:wildcard_imports

## Intent

Glob imports (`use foo::*`) hide which symbols enter the current scope, making the file's dependency surface invisible to readers and refactoring tools. They also leak symbols silently: a new `pub fn` added upstream becomes available downstream without anyone noticing, and a renamed symbol disappears without a compile error at the import site. Glob imports are tolerated in exactly two places: inside `#[cfg(test)] mod tests { use super::*; }` (where pulling the entire module under test is the point) and inside an explicit `prelude` module (whose contract is "re-export everything intended for downstream glob-import"). Everywhere else, list imports explicitly.

## Fix

```rust
// ✅ GOOD: explicit imports — every symbol is named at the boundary
use crate::models::{Invoice, Receipt, UserId};
use crate::services::billing::charge;

pub fn run(user_id: UserId, invoice: Invoice) -> Result<Receipt, BillingError> {
    charge(user_id, invoice)
}

// ✅ GOOD: glob allowed inside tests
#[cfg(test)]
mod tests {
    use super::*; // pulls the module under test into scope

    #[test]
    fn charges_invoice() {
        // ...
    }
}

// ✅ GOOD: glob allowed when importing from an explicit `prelude` module
use crate::prelude::*;
```

```rust
// ❌ BAD: glob outside tests or prelude
use crate::models::*;
use crate::services::billing::*;

pub fn run(user_id: UserId, invoice: Invoice) -> Result<Receipt, BillingError> {
    charge(user_id, invoice) // where did `charge` come from? readers cannot tell
}
```

### What Counts as a `prelude` Module

A module named exactly `prelude` (`crate::prelude`, `crate::api::prelude`, etc.) whose body is overwhelmingly `pub use` re-exports. The module's purpose IS to be glob-imported; the contract is explicit. A module that happens to re-export a few items but is not named `prelude` does not qualify — glob-importing it is still a violation.

## Edge Cases

- Enum variant globs (`use MyEnum::*;`) inside a `match` arm or a short function body are sometimes proposed for readability; reject them — list variants explicitly or `use` the enum and reference variants as `MyEnum::Variant`.
- Macro re-exports (`pub use macro_name`) do not require a glob; `use crate::my_macro;` works in edition 2018+.
- Integration tests (`tests/*.rs`) follow the same rule — `tests` *modules* allow glob, top-level test files do not.

## Related

RST-IMPT-02, RST-IMPT-03, RST-MODL-04
