# RST-PARM-01: No Boolean Positional Arguments

**Tool Coverage:** clippy:fn_params_excessive_bools (partial — flags signatures with multiple `bool` parameters but does not reject a single boolean positional flag; the call-site readability concern is reviewer-enforced).

## Intent

Boolean positional arguments are unreadable at call sites — `deploy("billing", true, false, true)` tells the reader nothing about which flag is which. They also swap silently under refactor: re-ordering two `bool` parameters compiles cleanly and ships the wrong behaviour. At public function boundaries, model behavioural toggles as named `enum` variants (one variant per meaningful state) so the call site reads as prose; for clusters of optional flags, route through a builder per `RST-PARM-03`.

## Fix

```rust
// ✅ GOOD: enum variants name the behaviour at the call site
pub enum DeployMode {
    DryRun,
    Live,
}

pub enum Verbosity {
    Quiet,
    Verbose,
}

pub fn deploy(service: &str, mode: DeployMode, verbosity: Verbosity) -> Result<(), DeployError> {
    // ...
    Ok(())
}

// caller — every argument names itself
deploy("billing", DeployMode::DryRun, Verbosity::Verbose)?;
```

```rust
// ❌ BAD: positional booleans, unreadable at call site, swap-silent under refactor
pub fn deploy(service: &str, dry_run: bool, verbose: bool) -> Result<(), DeployError> {
    // ...
    Ok(())
}

deploy("billing", true, false)?; // which flag is which?
```

### When a Builder Beats an Enum

If the function carries three or more independent boolean toggles, do not stack three enum parameters — collapse them into a `*Request` struct with a builder per `RST-PARM-03`. Enums shine when each toggle has two to four discrete meaningful states; builders shine when toggles are independent and many are optional.

## Edge Cases

- Private helpers (`fn _foo(..., flag: bool)`) inside a single module may keep a positional `bool` if there is exactly one call site — the rule targets `pub` / `pub(crate)` boundaries.
- Two-state toggles where one state is "the only sensible default" (e.g., `Recursive::Yes` vs `Recursive::No`) still earn an enum; the named call site is the point.
- Pure data DTOs (struct fields, not function parameters) may carry `bool` fields; the curated allow-list explicitly permits `clippy::struct_excessive_bools` because field access is named by definition.

## Related

RST-PARM-03, RST-PARM-04, RST-TYPE-02
