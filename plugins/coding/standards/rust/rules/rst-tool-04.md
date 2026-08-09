# RST-TOOL-04: Cargo.toml [lints] Denies clippy::all + clippy::pedantic with Curated Allows

**Tool Coverage:** standard-only — clippy itself cannot tell you that your `Cargo.toml` is missing a `[lints]` table.

## Intent

Every workspace MUST declare a `[workspace.lints.clippy]` table (or `[lints.clippy]` in a single-crate repo) that denies both `clippy::all` and `clippy::pedantic`, then allows the curated subset documented in RST-CORE-04. CLI flags (`cargo clippy -- -D clippy::pedantic`) drift between developers and CI; only a `Cargo.toml` entry guarantees that `cargo clippy` invoked anywhere — local, `bacon`, CI, rust-analyzer — produces the same verdict. The curated allow-list is non-negotiable: each allowed lint carries a `# reason:` comment so future maintainers know why the relaxation exists.

## Fix

```toml
# ✅ GOOD: Cargo.toml at workspace root
[workspace]
resolver = "2"
members = ["crates/*"]

[workspace.lints.clippy]
all = { level = "deny", priority = -1 }
pedantic = { level = "deny", priority = -1 }

# Curated allows — see RST-CORE-04 for the full rationale per lint
module_name_repetitions   = { level = "allow" }   # reason: one-public-symbol-per-module makes foo::FooClient idiomatic
missing_errors_doc        = { level = "allow" }   # reason: typed errors per RST-ERRH-01 document failure modes at the type
missing_panics_doc        = { level = "allow" }   # reason: panic! already forbidden in libs by RST-CORE-01
must_use_candidate        = { level = "allow" }   # reason: #[must_use] applied selectively to builders and Result-like values
return_self_not_must_use  = { level = "allow" }   # reason: &mut Self fluent chains per RST-PARM-04
implicit_hasher           = { level = "allow" }   # reason: ergonomic HashMap<K, V> in API surfaces
similar_names             = { level = "allow" }   # reason: domain vocabulary (user_id vs order_id); RST-TYPE-01 newtypes solve real risk
struct_excessive_bools    = { level = "allow" }   # reason: config DTOs may carry flags; RST-PARM-01 governs behavioural booleans
too_many_arguments        = { level = "allow" }   # reason: superseded by RST-PARM-03 (>5 params → request struct)
doc_markdown              = { level = "allow" }   # reason: noisy on proper nouns (PostgreSQL, OpenAPI)

# member crates inherit via workspace.lints
```

```toml
# ✅ GOOD: each member crate Cargo.toml
[package]
name = "billing"
version = "0.1.0"
edition = "2024"

[lints]
workspace = true
```

```toml
# ❌ BAD: no [lints] table, or pedantic merely warned
[workspace]
resolver = "2"
members = ["crates/*"]
# no [workspace.lints] block — pedantic only runs if CI happens to pass -D clippy::pedantic

[workspace.lints.clippy]
pedantic = "warn"        # warnings are ignored under load; must be deny
# no curated allows — every legitimate pedantic suggestion becomes noise
```

### `priority = -1` Explained

Clippy resolves overlapping lint groups by priority. `clippy::all` and `clippy::pedantic` are groups that contain individual lints; the curated allows are individual lints. Without `priority = -1` on the groups, the group-level `deny` and the individual `allow` apply at the same priority, and clippy emits an "unknown lint level" warning or refuses to compile. Setting the groups to `priority = -1` means individual lints win — exactly the override behaviour we want.

### Cross-Reference to RST-CORE-04

RST-CORE-04 holds the canonical curated allow-list and the rationale for each entry, plus the deny-without-exception list (`unwrap_used`, `expect_used`, `panic`, `dbg_macro`, `print_stdout`, `print_stderr`, `todo`, `unimplemented`, `indexing_slicing`, `float_cmp`, `lossy_float_literal`, `large_enum_variant`, `large_stack_arrays`, `shadow_unrelated`). This file (RST-TOOL-04) covers the *mechanical contract* — that the table exists and is wired into every member crate. Adding or removing an allow goes through RST-CORE-04 first.

## Edge Cases

- Single-crate repos: use `[lints.clippy]` directly in the crate `Cargo.toml`; the syntax is identical, the `workspace =` indirection drops.
- Per-crate exceptions: a single member may add its own `[lints.clippy]` with extra allows, each with `# reason:` — this overrides workspace inheritance for that crate only.
- Inline `#[allow(...)]` attributes on specific items still require the `// reason:` postfix per RST-CORE-03; this rule governs the global default, not the per-site escape hatch.
- `rust-analyzer` reads `[lints]` — IDE diagnostics match CI without extra config, eliminating "passes locally, fails in CI" surprises.

## Related

RST-CORE-03, RST-CORE-04, RST-TOOL-01, RST-MODL-02
