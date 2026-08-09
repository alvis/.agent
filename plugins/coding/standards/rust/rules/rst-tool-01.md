# RST-TOOL-01: rust-toolchain.toml Pins Channel and Components

**Tool Coverage:** standard-only — no tool warns when `rust-toolchain.toml` is absent; `rustup` will silently fall back to the user's default toolchain.

## Intent

Every repository MUST check in a `rust-toolchain.toml` at the repo root that pins both the Rust channel (a specific stable version, e.g. `1.95`) and the required components (`rustfmt`, `clippy`). Without the pin, contributors and CI build against whatever `rustup default` happens to point at — a moving target that breaks reproducibility, masks regressions, and makes "works on my machine" the norm. The TOML file is a one-time setup that gives `rustup` everything it needs to provision the exact toolchain on `cargo` invocation.

## Fix

```toml
# ✅ GOOD: rust-toolchain.toml at the repo root
[toolchain]
channel = "1.95"
components = ["rustfmt", "clippy"]
profile = "minimal"
```

```toml
# ❌ BAD: no rust-toolchain.toml exists, OR the file omits components
[toolchain]
channel = "stable"                           # floating — drifts with each rustup update
# components missing — CI must `rustup component add` ad-hoc
```

```bash
# ✅ GOOD: contributor onboarding is one command
git clone <repo> && cd <repo>
cargo build          # rustup auto-installs 1.95 + rustfmt + clippy on first use
```

```bash
# ❌ BAD: README tells you to set up the toolchain by hand
rustup install 1.95
rustup default 1.95
rustup component add rustfmt clippy
# easy to skip; CI and dev environments drift apart
```

### Why `profile = "minimal"`

The `minimal` profile installs only the compiler and `cargo`; `components = [...]` then adds back exactly what we need. The default profile bundles `rust-docs`, `rust-std` for additional targets, and other artefacts that bloat CI cache footprints. Pin minimal + opt-in components.

### Why a Specific Version Rather Than `stable`

Pinning `channel = "stable"` floats with `rustup update`. A repo built on `stable` Tuesday may fail to build the same way Wednesday once a new patch lands. Pin the exact `1.95` (or `1.95.x` if a hot-fix is required); bumping the toolchain becomes an explicit, reviewable change.

## Edge Cases

- Cross-compilation targets: add `targets = ["wasm32-unknown-unknown", "aarch64-unknown-linux-musl"]` to the `[toolchain]` table — these are part of the reproducible build contract.
- Nightly-only crates: if a sub-crate genuinely needs nightly, isolate it under its own workspace with its own `rust-toolchain.toml` rather than promoting the whole project to nightly.
- CI caching: cache `~/.rustup/toolchains` keyed on the `rust-toolchain.toml` file hash so a toolchain bump invalidates the cache automatically.
- IDE integration: `rust-analyzer` reads `rust-toolchain.toml` and uses the pinned toolchain — contributors get matching diagnostics without extra config.

## Related

RST-TOOL-02, RST-TOOL-03, RST-TOOL-04, RST-MODL-02
