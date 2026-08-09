# Rust Standards

_Compact Rust rules for ownership hygiene, typed errors, async discipline, module layout, parameter ergonomics, and toolchain pins._

## Target

Rust **stable 1.95+** on the **Rust 2024 edition**. Rules assume and exploit modern features: `let-else`, async `fn` in traits, generic associated types (GATs), the edition-2024 prelude, and `[lints]` table in `Cargo.toml`. Toolchain is pinned via `rust-toolchain.toml`.

## Tooling

All Rust code MUST pass the following tools on every commit:

- **`rustfmt`** - formatter (zero-config). Layout, import ordering, and whitespace.
- **`clippy`** - lints. Denies `clippy::all` + `clippy::pedantic` at workspace level; curated allow-list per `RST-CORE-04`.
- **`cargo-nextest`** - test runner. `cargo test` is forbidden as the canonical command.
- **`bacon`** - background check/clippy/test loop. Replaces `cargo watch`; configured via `bacon.toml`.
- **`rustup`** - toolchain manager. Channel and components pinned via `rust-toolchain.toml`.

Every rule in this standard declares a `Tool Coverage:` line stating which checks are enforced by `clippy`, which by `rustfmt`, and which require human review. Reviewers MUST NOT re-litigate mechanical checks the tools already enforce - focus review effort on semantic rules the tools cannot verify.

## Dependent Standards

You MUST also read the following standards together with this file:

- General Coding Principles (standard:universal) - baseline correctness and consistency constraints
- Naming Standards (standard:naming) - overlaid and specialized by `RST-NAME-*` for Rust conventions (`snake_case`, `PascalCase`, `SCREAMING_SNAKE_CASE`)
- Documentation Standards (standard:documentation) - public items require compliant `///` rustdoc
- Function Design Standards (standard:function) - function contracts and parameter design must stay aligned
- Testing Standards (standard:testing) - test layout; `cargo nextest`-specific bits live there

## What's Stricter Here

This standard enforces requirements beyond typical Rust practices:

| Standard Practice                          | Our Stricter Requirement                                                |
|--------------------------------------------|-------------------------------------------------------------------------|
| `.unwrap()` / `.expect()` tolerated in libs | **Forbidden in `src/lib.rs` paths; `?` operator + typed errors only**   |
| `cargo test`                               | **`cargo nextest run` - `cargo test` rejected in CI scripts and docs**  |
| `cargo watch -x check`                     | **`bacon` - `cargo watch` rejected; `bacon.toml` checked in**           |
| Default clippy level                       | **`clippy::pedantic` denied by default (curated allows w/ `// reason:`)** |
| `anyhow` everywhere                        | **`anyhow` only at binary boundary; `thiserror` in libraries**          |
| `mod.rs` accepted                          | **Forbidden - `foo.rs` + `foo/` directory layout only**                 |
| `#[allow(lint)]` bare                      | **Requires `// reason: <text>` postfix (mirrors Python `# type: ignore`)** |
| `unsafe` blocks ad-hoc                     | **`// SAFETY:` block listing invariants required at every `unsafe` site** |
| Floating Rust toolchain                    | **`rust-toolchain.toml` pins channel + components (rustfmt, clippy)**   |

## Exception Policy

Allowed exceptions only when:

- False positive
- No viable workaround exists now

Required exception note fields:

- `rule_id`
- `reason` (`false_positive` or `no_workaround`)
- `evidence`
- `temporary_mitigation`
- `follow_up_action`

If exception note is missing, submission is rejected.

Testing rules are out of scope here and live in `standard:testing`; nextest-specific bits and `#[test]` ergonomics live there.

## Rule Groups

- `RST-CORE-*`: Core safety hygiene - no `unwrap`/`expect` in libs, `unsafe` requires `// SAFETY:`, `#[allow]` requires `// reason:`, deny `clippy::pedantic`, no `Box<dyn Any>` escape hatches (5 rules).
- `RST-OWNS-*`: Ownership and borrowing - borrow over clone, `Cow` at boundaries, no `Rc<RefCell<T>>` for shared mutability, meaningful lifetime names (4 rules).
- `RST-ERRH-*`: Error handling - `thiserror` in libraries, `anyhow` at binary boundary only, `?` over `.unwrap()`, source chaining via `#[from]`, identifying context in messages (5 rules).
- `RST-TYPE-*`: Type-shape selection - newtypes for sibling IDs, `enum` for finite state, `impl Trait` returns at boundaries, `where` clauses for multi-bound generics, no `String`-as-enum (5 rules).
- `RST-ASYNC-*`: Async discipline - no blocking I/O in `async fn`, structured fan-out via `JoinSet`/`try_join!`, cancellation safety documented, no `block_on` in async context (4 rules).
- `RST-MODL-*`: Crate and module structure - thin `main.rs` + logic in `lib.rs`, workspace `resolver = "2"`/`"3"`, `mod.rs` banned, `lib.rs` is declarations only (4 rules).
- `RST-PARM-*`: Parameter ergonomics - no boolean positionals, `impl AsRef<Path>` for paths, >5 params bundled into request struct, fluent `&mut self -> &mut Self` (4 rules).
- `RST-IMPT-*`: `use` and re-export discipline - no glob imports outside `tests`/`prelude`, `use` ordering std → external → crate-local, re-export public surface from `lib.rs` only (3 rules).
- `RST-NAME-*`: Naming conventions - `snake_case`/`PascalCase`/`SCREAMING_SNAKE_CASE`, error types end in `Error`, capability-trait naming (4 rules).
- `RST-TOOL-*`: Tooling pins - `rust-toolchain.toml` pin, `cargo nextest run` mandatory, `bacon.toml` configured, `[lints]` table denies `clippy::pedantic` with curated allows (4 rules).
