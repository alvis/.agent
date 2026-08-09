# RST-MODL-02: Workspace Uses `resolver = "3"`

**Tool Coverage:** `standard-only` — cargo emits a warning if a 2024-edition workspace omits `resolver`, but it does not fail the build; reviewers MUST confirm the `[workspace]` table declares the resolver explicitly.

## Intent

Cargo's dependency resolver selects which feature unions and platform-specific dependencies are activated when multiple crates in the workspace share a transitive dependency. Resolver v1 (the legacy default for the 2015 edition) unifies features across `[dependencies]`, `[dev-dependencies]`, and `[build-dependencies]`, which leaks test-only features into production builds. Resolver v2 introduced per-target feature isolation, and **resolver v3** — the default for Rust 2024-edition workspaces on Rust 1.84+ — adds MSRV-aware version selection so transitive crates do not pull in versions that exceed the workspace's pinned toolchain.

Because the workspace `Cargo.toml` is what cargo reads first, the resolver MUST be declared at the workspace level (per-crate `package.resolver` is ignored when the crate is part of a workspace). Targeting Rust 1.95+ on the 2024 edition (per `meta.md`), declare `resolver = "3"` explicitly. Even though it is the edition-2024 default, explicit declaration makes the choice visible to reviewers and locks behaviour against future edition changes.

## Fix

```toml
# ✅ GOOD: workspace Cargo.toml declares the resolver explicitly
[workspace]
resolver = "3"
members = [
    "crates/billing",
    "crates/billing-cli",
    "crates/billing-types",
]

[workspace.package]
edition = "2024"
rust-version = "1.95"

[workspace.dependencies]
thiserror = "1"
tokio = { version = "1", features = ["full"] }
```

```toml
# ❌ BAD: missing `resolver` — cargo emits a warning, but build still succeeds
[workspace]
members = ["crates/billing", "crates/billing-cli"]
# Defaults change with the edition. The team can't tell from this file whether
# they're getting resolver v1, v2, or v3 behaviour.

# ❌ BAD: pinned to v2 on a 2024-edition workspace — loses MSRV-aware selection
[workspace]
resolver = "2"
members = ["crates/billing"]
# Resolver v2 will pick a transitive version that requires Rust 1.97, breaking
# the 1.95 MSRV. v3 would reject the upgrade and keep the older compatible version.
```

### Why v3 Specifically

| Capability                                        | v1 | v2 | v3 |
|---------------------------------------------------|----|----|----|
| Unified features across all dep kinds             | ✓  |    |    |
| Per-target / per-dep-kind feature isolation       |    | ✓  | ✓  |
| MSRV-aware version selection (respects `rust-version`) |    |    | ✓  |
| Default for 2024 edition                          |    |    | ✓  |

Resolver v3 reads `package.rust-version` (or `workspace.package.rust-version`) and refuses to pick a transitive crate version that requires a newer toolchain. Combined with the `rust-toolchain.toml` pin (RST-TOOL-01), this is what keeps `cargo update` from silently breaking the MSRV.

## Edge Cases

- **Single-crate repositories** without a `[workspace]` table set the resolver in `[package]` instead: `[package] resolver = "3"`. The principle is identical; the table is different.
- **Mixed-edition workspaces** (a 2024-edition workspace containing 2021-edition crates) work fine — the resolver is workspace-wide, the edition is per-crate.
- **Downgrading to v2** is a deliberate decision (e.g. a transitive dep is incompatible with v3 MSRV constraints); document the reason inline as a TOML comment, and prefer fixing the upstream pin via `[patch.crates-io]` instead of relaxing the resolver.
- **`virtual` workspaces** (no top-level `[package]`) MUST still declare `[workspace] resolver = "3"` — there is no `[package]` to fall back on.

## Related

RST-MODL-01, RST-MODL-03, RST-MODL-04, RST-TOOL-01, RST-CORE-04
