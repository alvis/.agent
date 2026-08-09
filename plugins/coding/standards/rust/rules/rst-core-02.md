# RST-CORE-02: `unsafe` Requires a `// SAFETY:` Block

**Tool Coverage:** clippy:undocumented_unsafe_blocks,missing_safety_doc

## Intent

Every `unsafe { ... }` block (and every `unsafe fn` declaration) MUST be preceded by a `// SAFETY:` comment enumerating the invariants the surrounding code upholds for the operation to be sound. `unsafe` is not "trust me" — it is a contract between author and reviewer that lists *what would have to be true* for soundness, so the next maintainer can re-verify those facts when the surrounding code changes. A bare `unsafe { ... }` block makes the contract invisible and the soundness argument unauditable.

## Fix

```rust
// ✅ GOOD: SAFETY block enumerates every invariant the caller upholds
pub fn first_char(s: &str) -> Option<char> {
    let bytes = s.as_bytes();
    if bytes.is_empty() {
        return None;
    }
    // SAFETY:
    //   - `bytes` is non-empty (checked above), so index 0 is in-bounds.
    //   - `s: &str` guarantees `bytes` is valid UTF-8, so the leading
    //     byte begins a valid UTF-8 code point.
    //   - `from_utf8_unchecked` requires valid UTF-8 input; both
    //     preconditions are satisfied here.
    let leading = unsafe { std::str::from_utf8_unchecked(&bytes[..1]) };
    leading.chars().next()
}

/// # Safety
///
/// `ptr` MUST be non-null, properly aligned for `T`, and point to a
/// fully initialised `T` that is not aliased by any other reference
/// for the lifetime `'a`.
pub unsafe fn deref_raw<'a, T>(ptr: *const T) -> &'a T {
    // SAFETY: caller upholds the contract documented above.
    unsafe { &*ptr }
}
```

```rust
// ❌ BAD: unsafe block with no SAFETY comment — soundness argument missing
pub fn first_char(s: &str) -> char {
    let bytes = s.as_bytes();
    let leading = unsafe { std::str::from_utf8_unchecked(&bytes[..1]) };
    leading.chars().next().unwrap()
}

// ❌ BAD: unsafe fn with no `# Safety` doc section — callers cannot
// know what invariants they must uphold
pub unsafe fn deref_raw<T>(ptr: *const T) -> &'static T {
    unsafe { &*ptr }
}
```

### What a Good `// SAFETY:` Block Contains

Each bullet names one precondition required by the unsafe operation and shows where in the surrounding code that precondition is established. A reviewer should be able to read the block, find each cited check, and trace the soundness argument without re-deriving it. "Trust me — it works" is not a SAFETY comment.

## Edge Cases

- **FFI declarations** (`extern "C"` blocks): each imported function is `unsafe` to call; document the foreign contract on a wrapping safe Rust function and put the `// SAFETY:` block at the call site.
- **`unsafe impl Send`/`Sync`**: requires a `// SAFETY:` comment explaining why the type is in fact thread-safe (typically: which fields are atomic, which are behind a `Mutex`, why the rest are owned exclusively).
- **`unsafe fn` in traits** (e.g. `Allocator`): the trait already documents the contract; the impl's body still needs `// SAFETY:` on each unsafe operation inside.
- **Macros generating `unsafe` code**: the macro must expand into code that includes `// SAFETY:` comments; otherwise the macro itself is the violation.

## Related

RST-CORE-01, RST-CORE-03, RST-CORE-04, RST-CORE-05
