# RST-OWNS-01: Borrow Over Clone at Parameter Boundaries

**Tool Coverage:** clippy:ptr_arg

## Intent

Function parameters that only *read* their argument MUST be taken as the borrowed slice/string/path type (`&str`, `&[T]`, `&Path`), not as a borrow of the owned form (`&String`, `&Vec<T>`, `&PathBuf`). The owned-borrow form forces every caller to either allocate a `String`/`Vec`/`PathBuf` first or hold one already; the slice form accepts both. The cost is one keystroke at the callee (`s: &str` vs `s: &String`) and saves an allocation — or, more importantly, an API constraint — at every call site. The same logic applies to `&[T]` over `&Vec<T>` and `&Path` over `&PathBuf`.

## Fix

```rust
// ✅ GOOD: slice borrows accept both owned and borrowed callers
pub fn parse_header(line: &str) -> Option<(&str, &str)> {
    line.split_once(':')
}

pub fn checksum(payload: &[u8]) -> u32 {
    payload.iter().copied().map(u32::from).sum()
}

pub fn load(path: &std::path::Path) -> std::io::Result<Vec<u8>> {
    std::fs::read(path)
}

// callers — both forms work without conversion
let owned = String::from("Host: example");
parse_header(&owned);                    // &String coerces to &str
parse_header("Host: example");           // string literal works too

let v: Vec<u8> = vec![1, 2, 3];
checksum(&v);                            // &Vec<u8> coerces to &[u8]
checksum(&[1, 2, 3]);                    // array slice works too
```

```rust
// ❌ BAD: forces the caller to own a String / Vec / PathBuf first
pub fn parse_header(line: &String) -> Option<(&str, &str)> {
    line.split_once(':')
}

pub fn checksum(payload: &Vec<u8>) -> u32 {
    payload.iter().copied().map(u32::from).sum()
}

pub fn load(path: &std::path::PathBuf) -> std::io::Result<Vec<u8>> {
    std::fs::read(path)
}

// callers — must allocate or restructure
parse_header(&"Host: example".to_string());   // unnecessary allocation
checksum(&vec![1, 2, 3]);                     // unnecessary Vec
```

### Deref Coercion Does the Work

Rust's deref coercion turns `&String` into `&str` and `&Vec<T>` into `&[T]` automatically at the call site — so taking the slice form costs callers nothing while *also* admitting callers that don't have an owned value. Taking the owned-borrow form rules out string literals, array slices, `&'static [u8]`, and any future caller that hasn't allocated yet.

## Edge Cases

- **You actually need ownership** (storing the value, moving it into a task, mutating in place): take the *owned* type (`String`, `Vec<T>`, `PathBuf`) or `impl Into<String>` per RST-PARM-02 — not a borrow.
- **You need a method only on `String`** (e.g. `.capacity()`, `.shrink_to_fit()`): that is a code smell. Either return a typed result and let the caller own the `String`, or take `&mut String` if you really must mutate the caller's buffer.
- **Path parameters**: prefer `impl AsRef<Path>` per RST-PARM-02 when the function is public and ergonomic acceptance matters — `&Path` is the minimum bar for non-generic signatures.
- **Generic byte sources**: `impl AsRef<[u8]>` is acceptable when you want the function to accept both `&[u8]` and `&Vec<u8>` without coercion (rare — deref coercion already handles it).
- **`Cow<'_, T>` parameters**: when the function may borrow OR own depending on input, take `Cow<'_, str>` per RST-OWNS-02 rather than picking one side and forcing the other to convert.

## Related

RST-OWNS-02, RST-OWNS-03, RST-OWNS-04, RST-PARM-02
