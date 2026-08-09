# RST-CORE-04: Deny `clippy::all` + `clippy::pedantic` in `[lints]`

**Tool Coverage:** standard-only (the `[lints]` table itself is the enforcement mechanism; this rule audits that the table exists and matches the curated policy)

## Intent

Workspaces MUST configure the `[workspace.lints]` table in `Cargo.toml` to deny `clippy::all` *and* `clippy::pedantic` at the workspace level, then re-allow a small, curated subset of pedantic lints — each with a `// reason:` justification per RST-CORE-03 — and additionally deny a list of correctness/observability lints "without exception". This pulls the workspace's baseline well past Rust's default `warn`-level clippy posture: pedantic findings become build failures by default, and the few that would create noise without catching real bugs are allowed deliberately and visibly. A floating clippy level lets each crate drift; an explicit `[lints]` table makes the contract uniform and reviewable.

## Fix

```toml
# ✅ GOOD: Cargo.toml at the workspace root
[workspace]
resolver = "3"
members  = ["crates/*"]

[workspace.lints.rust]
unsafe_op_in_unsafe_fn = "deny"
missing_docs           = "warn"

[workspace.lints.clippy]
# Baseline: deny everything in `all` and `pedantic`.
all      = { level = "deny", priority = -1 }
pedantic = { level = "deny", priority = -1 }

# Curated allow-list (see table below for rationale). Each entry MUST
# carry a `reason = "..."` per RST-CORE-03.
module_name_repetitions  = { level = "allow", priority = 0, reason = "RST-IMPT-03 — one public symbol per module; `foo::FooClient` is idiomatic" }
missing_errors_doc       = { level = "allow", priority = 0, reason = "RST-ERRH-01 — typed error documents failure modes at the type" }
missing_panics_doc       = { level = "allow", priority = 0, reason = "RST-CORE-01 — panics forbidden in libs; rare allowed panic documented at call site" }
must_use_candidate       = { level = "allow", priority = 0, reason = "`#[must_use]` reserved for builders and Result-like values" }
return_self_not_must_use = { level = "allow", priority = 0, reason = "RST-PARM-04 — `&mut Self` fluent chains do not need `#[must_use]`" }
implicit_hasher          = { level = "allow", priority = 0, reason = "ergonomic `HashMap<K, V>` in API surfaces; explicit hasher in security-sensitive code" }
similar_names            = { level = "allow", priority = 0, reason = "RST-TYPE-01 newtypes solve the actual collision risk" }
struct_excessive_bools   = { level = "allow", priority = 0, reason = "RST-PARM-01 behavioural bools become enum; pure config DTOs may carry flags" }
too_many_arguments       = { level = "allow", priority = 0, reason = "RST-PARM-03 supersedes — bundle into request struct" }
doc_markdown             = { level = "allow", priority = 0, reason = "noise on proper nouns (`PostgreSQL`, `OpenAPI`); reviewers catch real prose bugs" }

# Denied without exception — these catch real bugs and align with PYT/TYP strictness.
unwrap_used         = "deny"  # RST-CORE-01
expect_used         = "deny"  # RST-CORE-01
panic               = "deny"  # RST-CORE-01
dbg_macro           = "deny"  # observability via `tracing` only
print_stdout        = "deny"  # observability via `tracing` only
print_stderr        = "deny"  # observability via `tracing` only
todo                = "deny"  # no half-finished implementations
unimplemented       = "deny"  # no half-finished implementations
indexing_slicing    = "deny"  # panics-as-control-flow forbidden
float_cmp           = "deny"  # correctness
lossy_float_literal = "deny"  # correctness
large_enum_variant  = "deny"  # perf correctness
large_stack_arrays  = "deny"  # perf correctness
shadow_unrelated    = "deny"  # naming hygiene
```

```toml
# ❌ BAD: no [lints] table — pedantic defaults to warn, easily ignored,
# and the deny-without-exception list is unenforced.
[workspace]
resolver = "3"
members  = ["crates/*"]
```

### Curated `clippy::pedantic` Allow-List

`RST-CORE-04` (and the matching `RST-TOOL-04`) sanction exactly these ten pedantic lints as allowed at workspace level. Adding to this list requires team review.

| Lint                                 | Allow reason (matches our principle)                                                                                              |
|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `clippy::module_name_repetitions`    | Mirrors PYT-MODL-03 / TYP-MODL-01 — one public symbol per module makes `foo::FooClient` idiomatic.                                |
| `clippy::missing_errors_doc`         | Errors are typed; per RST-ERRH-01 the type itself documents failure modes. `///` docs are mandatory at the *type*, not every `Result` return site. |
| `clippy::missing_panics_doc`         | Per RST-CORE-01 we already forbid `panic!` in libs; the rare allowed panic is documented at the call site.                        |
| `clippy::must_use_candidate`         | `#[must_use]` is opinionated; we mandate it only for builders and `Result`-like value objects.                                    |
| `clippy::return_self_not_must_use`   | Same — fluent chains (`&mut Self`) per RST-PARM-04 don't need `#[must_use]`.                                                      |
| `clippy::implicit_hasher`            | Permits ergonomic `HashMap<K, V>` in API surfaces; security-sensitive code uses explicit hasher.                                  |
| `clippy::similar_names`              | Domain vocabulary (`user_id` vs `order_id`) often collides legitimately; RST-TYPE-01 newtypes solve the actual risk.              |
| `clippy::struct_excessive_bools`     | Per RST-PARM-01 booleans become enum variants when behavioural — but pure config DTOs may carry flags.                            |
| `clippy::too_many_arguments`         | Superseded by RST-PARM-03 (>5 → request struct); clippy's threshold differs and would double-fire.                                |
| `clippy::doc_markdown`               | Generates noise on legitimate proper nouns (`PostgreSQL`, `OpenAPI`); reviewers catch real prose bugs.                            |

### Denied Without Exception

These lints catch real bugs and align with PYT/TYP strictness. A `#[allow]` with a `// reason:` CANNOT unlock them — restructure the code instead.

- `clippy::unwrap_used`, `clippy::expect_used` — enforce RST-CORE-01.
- `clippy::panic` — enforce RST-CORE-01.
- `clippy::dbg_macro`, `clippy::print_stdout`, `clippy::print_stderr` — observability via tracing only (mirrors TYP-CORE / Python `print` discipline).
- `clippy::todo`, `clippy::unimplemented` — mirror our "no half-finished implementations" rule.
- `clippy::indexing_slicing` — mirrors Python's narrow-exception discipline; panics-as-control-flow forbidden.
- `clippy::float_cmp`, `clippy::lossy_float_literal` — correctness.
- `clippy::large_enum_variant`, `clippy::large_stack_arrays` — perf correctness.
- `clippy::shadow_unrelated` — naming hygiene mirroring PYT-NAME / TYP-NAME clarity.

### `[lints]` Table Syntax Notes

- Use the *table-style* entry (`{ level = "...", priority = N, reason = "..." }`) for any lint that needs a `reason`. The short string form (`unwrap_used = "deny"`) is valid only for entries without a reason.
- `priority = -1` on the group-level `all` / `pedantic` entries lets individual lint allows override them; without the lower priority, cargo errors with a conflicting-lint-spec message.
- Member crates inherit via `[lints] workspace = true` in their own `Cargo.toml`. Per-crate `[lints]` blocks that re-deny are forbidden — divergence must go through the workspace table.

## Edge Cases

- **Single-crate repos** (no `[workspace]`) use `[lints.clippy]` instead of `[workspace.lints.clippy]`; the policy is identical.
- **Examples and integration tests** (`examples/`, `tests/`) inherit the workspace lints; they MAY locally `#[allow]` `unwrap_used` *only* if the test is exercising panic behaviour — and even then with `// reason:` per RST-CORE-03.
- **Proc-macro crates** generating code that triggers `indexing_slicing` must emit the necessary `#[allow]` with `reason = "..."` inside the generated tokens — the call site is not where the lint fires.
- **CI enforcement**: `cargo clippy --workspace --all-targets -- -D warnings` is the canonical invocation; the `[lints]` table makes the `-D warnings` redundant but explicit-is-better.

## Related

RST-CORE-01, RST-CORE-02, RST-CORE-03, RST-CORE-05, RST-TOOL-01, RST-TOOL-04
