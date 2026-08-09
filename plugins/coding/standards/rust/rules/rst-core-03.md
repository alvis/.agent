# RST-CORE-03: `#[allow(...)]` Requires a `// reason:` Postfix

**Tool Coverage:** clippy:allow_attributes_without_reason (partial - the lint enforces `reason = "..."` inside the attribute; this rule additionally accepts the documented `// reason: <text>` line-comment form for grep-friendly auditing)

## Intent

Every `#[allow(lint)]` (and `#[expect(lint)]`) suppression MUST carry a human-readable justification, either as the structured `reason = "..."` argument *or* as an adjacent `// reason: <text>` comment on the same or immediately-preceding line. A bare `#[allow]` strands future maintainers guessing why the hatch was opened, whether the upstream cause still applies, and whether the suppression can now be removed. This rule is the Rust counterpart to PYT-CORE-03's `# type: ignore[code]  # reason: <text>` discipline: one grep enumerates every accepted escape hatch in the workspace at review time.

## Fix

```rust
// ✅ GOOD #1: structured `reason = "..."` inside the attribute
#[allow(
    clippy::too_many_arguments,
    reason = "FFI signature mirrors libfoo's C API verbatim; bundling would break ABI",
)]
pub unsafe extern "C" fn libfoo_open(
    path: *const u8,
    path_len: usize,
    flags: u32,
    mode: u32,
    handle_out: *mut *mut libfoo_handle,
    err_out: *mut *mut libfoo_error,
) -> i32 { /* ... */ }

// ✅ GOOD #2: `// reason:` postfix on the same line (grep-friendly)
#[allow(clippy::module_name_repetitions)] // reason: re-export `FooClient` from `foo` module per RST-IMPT-03

// ✅ GOOD #3: `// reason:` on the preceding line
// reason: third-party derive emits a `dead_code` false positive on the generated `__private` field
#[allow(dead_code)]
struct Generated {
    __private: (),
}
```

```rust
// ❌ BAD: bare allow — no rationale, no audit trail
#[allow(clippy::too_many_arguments)]
pub fn deploy(/* 8 args */) { /* ... */ }

// ❌ BAD: reason present but missing the `reason:` marker — defeats the grep workflow
#[allow(dead_code)] // unused for now
struct Generated { /* ... */ }
```

### Review-Time Grep Workflow

Because every suppression ends with `reason = "..."` or `// reason: …`, reviewers run one command to surface them all:

```bash
# every allow that lacks a reason (format violation)
rg '#\[(allow|expect)\(' --type rust | rg -v 'reason\b'

# full audit inventory of accepted escape hatches
rg 'reason[:=]' --type rust
```

The first query finds any `#[allow]` missing its justification; the second lists every accepted suppression so they can be revisited when the upstream cause is fixed (lint refined, upstream crate annotated, design issue resolved).

## Edge Cases

- **Crate-level allows** (`#![allow(lint)]` at the top of `lib.rs` / `main.rs`) are forbidden — they hide every future occurrence in the whole crate. Scope the allow to the smallest item (function, block, struct) that needs it.
- **Generated code** (build scripts, `#[derive]` macro output): if the violation is in generated code you cannot annotate, suppress at the `mod generated;` declaration site with `// reason: bindgen output; lint disabled wholesale per ADR-NNN`.
- **`#[allow]` inside a macro expansion**: the macro itself must emit the `reason = "..."` argument or the comment; the call site is not where the lint fires.
- **Lints in the deny-without-exception list** (per RST-CORE-04: `unwrap_used`, `panic`, `dbg_macro`, `todo`, `unimplemented`, etc.) MUST NOT be `#[allow]`'d at all. A `// reason:` cannot unlock a deny-without-exception lint; restructure the code instead.

## Related

RST-CORE-01, RST-CORE-02, RST-CORE-04, RST-TOOL-04
