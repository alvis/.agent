# RST-OWNS-02: `Cow<'a, T>` at Maybe-Borrow Boundaries

**Tool Coverage:** standard-only

## Intent

When an API boundary may produce or accept a value that is *usually* a borrow but *sometimes* an owned allocation (a normalisation that often returns the input unchanged, a transformation that conditionally copies, a parser that may need to substitute escape sequences), use `std::borrow::Cow<'a, T>` instead of always returning/accepting an owned `String` / `Vec<T>`. `Cow` lets the function allocate only in the case that genuinely needs an owned value, while ergonomic callers in the common borrow path pay nothing. Forcing every caller to receive `String` when 95% of inputs round-trip unchanged turns a hot path into an allocation storm; forcing every caller to receive `&str` when 5% genuinely need an owned result is unimplementable.

## Fix

```rust
// ✅ GOOD: returns Cow — borrows on the common path, allocates only when needed
use std::borrow::Cow;

pub fn normalise_whitespace(input: &str) -> Cow<'_, str> {
    if !input.chars().any(char::is_whitespace) {
        return Cow::Borrowed(input);
    }
    let mut out = String::with_capacity(input.len());
    let mut last_space = false;
    for ch in input.chars() {
        if ch.is_whitespace() {
            if !last_space {
                out.push(' ');
            }
            last_space = true;
        } else {
            out.push(ch);
            last_space = false;
        }
    }
    Cow::Owned(out)
}

// ✅ GOOD: accepts Cow — caller chooses borrow vs own without converting
pub fn store_name(name: Cow<'_, str>) -> Result<NameId, StoreError> {
    // We only allocate (via .into_owned()) when actually persisting.
    let owned: String = name.into_owned();
    persist(owned)
}

// callers
let s = "already-clean";
let cleaned = normalise_whitespace(s);   // Cow::Borrowed — zero allocation
assert_eq!(&*cleaned, "already-clean");

store_name(Cow::Borrowed("guest"));      // borrow path
store_name(Cow::Owned(format!("user-{n}")));  // owned path
```

```rust
// ❌ BAD: always allocates, even when input was already canonical
pub fn normalise_whitespace(input: &str) -> String {
    // returns an owned copy of `input` 95% of the time
    /* ... */
    input.to_string()
}

// ❌ BAD: forces caller to .to_string() even when they have a borrow
pub fn store_name(name: String) -> Result<NameId, StoreError> {
    persist(name)
}

// ❌ BAD: picks the borrow side and rejects callers that need to own
pub fn normalise_whitespace<'a>(input: &'a str) -> &'a str {
    // unimplementable when whitespace must collapse — the result
    // doesn't exist as a substring of `input`
    input
}
```

### When `Cow` Is the Right Tool

`Cow<'a, T>` is specifically the shape "this value MAY borrow from `'a`, OR it MAY own". Reach for it when:

- A normalisation/transformation conditionally allocates.
- A parser returns slices into the input except when it must un-escape.
- A configuration loader returns the literal value from the file or substitutes a default.

If the function *always* borrows, return `&T`. If it *always* owns, return `T`. `Cow` is for genuine maybe-cases — not "I'm too lazy to decide". Picking `Cow` when ownership is unconditional just adds an enum tag and a useless match at every call site.

## Edge Cases

- **`Cow<'static, str>` for compile-time literals + runtime values**: a function returning a label that is sometimes a `&'static str` and sometimes a `format!`-built `String` should return `Cow<'static, str>`.
- **`Cow<'a, [u8]>` for byte slices**: same shape, different element type — applies identically to binary protocols where escape/un-escape is sometimes needed.
- **`Cow<'a, Path>`**: less common; usually `&Path` (RST-OWNS-01) or `PathBuf` is the right answer. Reach for `Cow<'a, Path>` only when path normalisation (e.g. resolving `..`) conditionally produces a new path.
- **`Cow` in struct fields**: introduces a lifetime parameter on the struct. Acceptable for short-lived views (parser AST nodes), painful for long-lived state — in long-lived state, prefer owning the data and exposing `&` accessors.
- **Async functions returning `Cow`**: borrowed variants tie the future to the input's lifetime. Verify the future's lifetime is what callers expect — `'static` futures cannot return `Cow<'a, _>` for `'a` shorter than `'static`.

## Related

RST-OWNS-01, RST-OWNS-03, RST-OWNS-04, RST-PARM-02
