# RST-MODL-03: No `mod.rs` — Use `foo.rs` + `foo/` Layout

**Tool Coverage:** clippy:mod_module_files | clippy:self_named_module_files — both lints target the same convention; deny `mod_module_files` and enable the inverse `self_named_module_files` allow is wrong. Standard enforces `mod_module_files` (forbid `mod.rs`) workspace-wide.

## Intent

Since the Rust 2018 edition both module-file conventions are syntactically valid: a module `foo` may live in either `src/foo/mod.rs` (legacy) or `src/foo.rs` paired with a `src/foo/` directory for submodules (modern). The legacy `mod.rs` style scatters dozens of files all named `mod.rs` across the source tree — editors show them as `mod.rs (foo)`, `mod.rs (bar)`, `mod.rs (baz)`, tab-switching becomes guesswork, and `grep`/`rg` results lose context. The modern `foo.rs` + `foo/` layout keeps every file uniquely named after the module it implements, so tooling and humans can identify a file from its name alone. The standard enforces the modern layout on every module; legacy `mod.rs` is banned.

## Fix

```
# ✅ GOOD: each module's own file is named after the module
src/
├── lib.rs
├── billing.rs            # `pub mod billing;` — declarations + crate-level items
├── billing/
│   ├── invoice.rs
│   ├── payment.rs
│   └── refund.rs
├── parser.rs             # `pub mod parser;` — module root
└── parser/
    ├── lexer.rs
    └── grammar.rs
```

```rust
// ✅ GOOD: src/parser.rs — module root, declarations + items shared across submodules
pub mod grammar;
pub mod lexer;

pub use crate::parser::grammar::Grammar;
pub use crate::parser::lexer::{Lexer, Token};

/// Errors surfaced by the parser layer.
#[derive(Debug, thiserror::Error)]
pub enum ParseError { /* ... */ }
```

```
# ❌ BAD: legacy mod.rs layout — every directory has an identically named file
src/
├── lib.rs
├── billing/
│   ├── mod.rs            # ← which billing? indistinguishable in editor tabs
│   ├── invoice.rs
│   ├── payment.rs
│   └── refund.rs
└── parser/
    ├── mod.rs            # ← also called mod.rs — tab fight
    ├── lexer.rs
    └── grammar.rs
```

```rust
// ❌ BAD: src/parser/mod.rs — declarations buried under a generic filename
pub mod grammar;
pub mod lexer;
// Reviewers grepping for `parser` find this file under `parser/mod.rs`,
// not `parser.rs`. Jump-to-definition and file-tree navigation are slower
// in every IDE that surfaces only the filename, not the directory.
```

### Why the Modern Layout Wins

- **Unique filenames** — `git log src/parser.rs` returns just the parser-root history; with `mod.rs` you must say `git log src/parser/mod.rs` and editor tabs cannot distinguish `mod.rs` from any other `mod.rs`.
- **Tooling consistency** — `cargo doc`, `rustdoc`, `rust-analyzer`, and most IDEs surface the file basename. `foo.rs` self-documents the module name.
- **Cited as the preferred convention** by the Rust 2018 edition guide and reinforced by `clippy::mod_module_files`. The 2024 edition does not change the rule; legacy `mod.rs` remains valid syntax but is discouraged at every level of the toolchain.
- **Refactoring is mechanical** — `git mv src/foo/mod.rs src/foo.rs` is the entire migration for each module; no `use` paths change.

## Edge Cases

- **External code generation** (e.g. `tonic-build`, `prost-build`, `bindgen` output dirs) may emit `mod.rs` into `OUT_DIR`. That is acceptable because the output is not checked into source control; the rule applies to hand-authored files under `src/`, not to `build.rs`-generated artefacts.
- **Mixed layouts in the same crate are forbidden** — pick the `foo.rs` + `foo/` style and apply it uniformly. A half-migrated tree is harder to read than either pure convention.
- **Top-level crate root** (`src/lib.rs`, `src/main.rs`) is itself the modern equivalent of `mod.rs` for the crate root and is the one sanctioned exception. RST-MODL-04 governs what may live in `lib.rs`.
- **Workspace `Cargo.toml` `[lints.clippy]` entry**: `mod_module_files = "deny"`. Do **not** also allow `self_named_module_files`, which would flip the rule and ban the modern layout.

## Related

RST-MODL-01, RST-MODL-02, RST-MODL-04, RST-IMPT-02, RST-NAME-01
