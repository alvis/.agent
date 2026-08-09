# RST-PARM-02: Borrow-Generic Path and String Parameters

**Tool Coverage:** clippy:ptr_arg (flags `&String`, `&Vec<T>`, `&PathBuf` parameters; the `impl AsRef<Path>` / `impl Into<String>` distinction is reviewer-enforced).

## Intent

Path and string parameters MUST accept the broadest borrow shape that fits the function's actual ownership needs. Use `impl AsRef<Path>` for path inputs the function only reads, and `impl AsRef<str>` (or `&str`) for string inputs the function only reads. Only escalate to `impl Into<PathBuf>` / `impl Into<String>` when the function will **store** the value and therefore needs ownership. The bad shapes — `&Path`, `&PathBuf`, `&String` — either force the caller to allocate or to dereference, while delivering no extra capability to the callee.

## Fix

```rust
// ✅ GOOD: borrow-generic for read-only inputs
use std::path::{Path, PathBuf};

pub fn load_config(path: impl AsRef<Path>) -> Result<Config, ConfigError> {
    let path = path.as_ref();
    let bytes = std::fs::read(path)?;
    Config::parse(&bytes)
}

pub fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}

// ✅ GOOD: ownership-taken — Into<PathBuf> / Into<String> because we store it
pub struct CacheHandle {
    root: PathBuf,
    namespace: String,
}

impl CacheHandle {
    pub fn open(root: impl Into<PathBuf>, namespace: impl Into<String>) -> Self {
        Self { root: root.into(), namespace: namespace.into() }
    }
}
```

```rust
// ❌ BAD: rigid borrowed-owned shape — caller must produce a PathBuf / String
use std::path::{Path, PathBuf};

pub fn load_config(path: &PathBuf) -> Result<Config, ConfigError> {
    // forces every caller to own a PathBuf even though we only read it
    let bytes = std::fs::read(path)?;
    Config::parse(&bytes)
}

pub fn greet(name: &String) -> String {
    // &String adds no capability over &str and rejects string literals
    format!("Hello, {name}!")
}
```

### Choosing the Right Shape

| Function intent | Parameter shape |
|-----------------|-----------------|
| Read a path, do not store | `impl AsRef<Path>` |
| Store a path on a struct or move into a thread | `impl Into<PathBuf>` |
| Read a string, do not store | `&str` (or `impl AsRef<str>` if you also want `String`/`Cow` to flow in directly) |
| Store a string on a struct or send across a channel | `impl Into<String>` |
| Need both read and possible ownership (rare) | `Cow<'_, str>` / `Cow<'_, Path>` (see `RST-OWNS-02`) |

## Edge Cases

- Trait methods cannot always use `impl Trait` in argument position; in those cases, fall back to `&Path` / `&str` and document the constraint.
- Generic explosion: a function with five `impl AsRef<Path>` parameters is unreadable — extract a request struct per `RST-PARM-03` and store concrete `PathBuf` fields inside it.
- `OsStr` / `OsString` follow the same dichotomy: `impl AsRef<OsStr>` for read, `impl Into<OsString>` for ownership.

## Related

RST-OWNS-01, RST-OWNS-02, RST-PARM-03
