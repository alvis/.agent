# RST-TYPE-05: No `String`-as-Enum; Use `strum::EnumString`

**Tool Coverage:** standard-only — clippy cannot infer "this `String` is a finite domain".

## Intent

When a closed set of values needs string parsing — HTTP query parameters, CLI flags, database string columns — the temptation is to keep the value as `String` and branch on `if s == "active" { ... } else if s == "paused" { ... }`. That defeats every benefit of the type system: typos survive, exhaustiveness disappears, and the parsing logic spreads across the codebase. Define an `enum` (RST-TYPE-02), derive `strum::EnumString` (or write `FromStr` by hand), and parse **once** at the boundary into the typed value. The rest of the code sees only `enum`. Mirrors PYT-TYPE-03 / PYT-TYPE-05 — string-as-enum is the single largest stringly-typed antipattern.

## Fix

```rust
// ✅ GOOD: enum + strum::EnumString — parse once at the edge, match exhaustively inside
use strum::{Display, EnumString};

#[derive(Debug, Clone, Copy, PartialEq, Eq, EnumString, Display)]
#[strum(serialize_all = "snake_case")]
pub enum SubscriptionStatus {
    Active,
    Paused,
    Cancelled,
}

// boundary: parse once
pub fn handle_webhook(raw_status: &str) -> Result<(), WebhookError> {
    let status: SubscriptionStatus = raw_status
        .parse()
        .map_err(|_| WebhookError::UnknownStatus { value: raw_status.to_owned() })?;
    apply(status)
}

// interior: exhaustive match, no strings
fn apply(status: SubscriptionStatus) -> Result<(), WebhookError> {
    match status {
        SubscriptionStatus::Active    => activate(),
        SubscriptionStatus::Paused    => pause(),
        SubscriptionStatus::Cancelled => cancel(),
    }
}
```

```rust
// ❌ BAD: stringly-typed throughout — typos and missing branches survive
pub fn handle_webhook(raw_status: &str) -> Result<(), WebhookError> {
    if raw_status == "active" {
        activate()
    } else if raw_status == "paused" {
        pause()
    } else if raw_status == "canceled" {        // typo: payload says "cancelled"
        cancel()
    } else {
        Err(WebhookError::UnknownStatus { value: raw_status.to_owned() })
    }
}
```

### When a Hand-Written `FromStr` Is Right

`strum` is the default. Reach for a hand-written `impl FromStr for SubscriptionStatus` when:

- The wire format is case-insensitive across only some variants, or carries aliases (`"active"`, `"ACTIVE"`, `"act"`).
- The variant carries data parsed out of the input string (`enum Cmd { Move(Direction) }`).
- The crate cannot add a `strum` dependency (rare — `strum` is `no_std` compatible).

The rule is the *outcome* — no `if s == "..."` chains — not the specific crate.

## Edge Cases

- Serde-side parsing uses `#[serde(rename_all = "snake_case")]` on the enum; pair it with `strum(serialize_all = "snake_case")` so both wire formats agree.
- For `clap` CLI args, derive `clap::ValueEnum` instead of (or alongside) `strum::EnumString` — `clap` reads the variant names directly.
- A genuinely open-ended string domain (user-defined tags, plugin names) is **not** a finite enum — keep it as `String` (or a newtype around `String` per RST-TYPE-01).
- Variants that only ever appear in tests can be gated behind `#[cfg(test)]` on the variant — but consider whether the test-only path indicates the domain is not truly closed.

## Related

RST-TYPE-01, RST-TYPE-02, RST-TYPE-03, RST-ERRH-05, RST-PARM-01
