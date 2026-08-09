# RST-CORE-05: No `Box<dyn Any>` / Type-Erased Escape Hatches

**Tool Coverage:** standard-only

## Intent

Type-erased containers — `Box<dyn Any>`, `Box<dyn Error + Send + Sync + 'static>` used as an internal API type, `HashMap<String, Box<dyn Any>>` for "extension" bags, `serde_json::Value` threaded through business logic — disable Rust's type system at exactly the boundary that needs it most. Every downstream caller must downcast (and handle the downcast failure), the compiler stops catching shape changes, and the "extension point" becomes an unbounded contract no one can refactor safely. Model the variation explicitly: an `enum` for closed alternatives, a generic parameter for open ones, a sealed trait for capability-based dispatch. `dyn Any` is the Rust equivalent of Python's `Any` (PYT-CORE-02) — and is forbidden for the same reasons.

## Fix

```rust
// ✅ GOOD: closed alternatives become an enum the compiler can exhaustively check
#[derive(Debug)]
pub enum Payload {
    Text(String),
    Bytes(Vec<u8>),
    Json(serde_json::Value),
}

pub fn handle(payload: Payload) -> Result<(), HandlerError> {
    match payload {
        Payload::Text(s)  => write_text(&s),
        Payload::Bytes(b) => write_bytes(&b),
        Payload::Json(v)  => write_json(&v),
    }
}

// ✅ GOOD: open alternatives become a sealed trait with named capabilities
pub trait Render {
    fn render(&self, out: &mut dyn std::io::Write) -> std::io::Result<()>;
}

pub fn emit<R: Render>(item: &R, out: &mut dyn std::io::Write) -> std::io::Result<()> {
    item.render(out)
}
```

```rust
// ❌ BAD: `dyn Any` defers every shape question to runtime
use std::any::Any;

pub fn handle(payload: Box<dyn Any>) -> Result<(), HandlerError> {
    if let Some(s) = payload.downcast_ref::<String>() {
        write_text(s)
    } else if let Some(b) = payload.downcast_ref::<Vec<u8>>() {
        write_bytes(b)
    } else {
        Err(HandlerError::UnknownPayload) // compiler never warned us a variant was missing
    }
}

// ❌ BAD: `Box<dyn Error + Send + Sync + 'static>` as an internal API type
// erases the source error; per RST-ERRH-04 use typed `#[from]` chaining.
pub fn parse(input: &str) -> Result<Config, Box<dyn std::error::Error + Send + Sync + 'static>> {
    /* ... */
}

// ❌ BAD: `HashMap<String, Box<dyn Any>>` as an "extension bag"
pub struct Request {
    pub extensions: std::collections::HashMap<String, Box<dyn Any + Send + Sync>>,
}
```

### Why "It's Just an Escape Hatch" Is Wrong Here

Each downcast site is a runtime check the compiler cannot help with; once one caller relies on a particular concrete type being inside the `Any`, the producer can never refactor it without silently breaking that consumer. The point of Rust's type system is to make those couplings explicit and reviewable — `dyn Any` opts out of that contract at exactly the place reviewers most need it. The same logic applies to `serde_json::Value` used as a business-logic type: parse it into a typed `struct` at the boundary and let the rest of the code program against named fields.

## Edge Cases

- **`Box<dyn Error>` at the binary main boundary** is fine — that is what `anyhow::Error` (RST-ERRH-02) wraps. The prohibition is on type-erased errors *inside* library public APIs, not at the `main()` reporting boundary.
- **`std::any::TypeId` for trait-object dispatch** (e.g. building an extractor registry indexed by request type) MAY use `TypeId` keys *as long as* the public API exposes typed accessors (`req.extension::<TracingCtx>()`) — never raw `Box<dyn Any>` to callers.
- **Heterogeneous test fixtures** (only under `#[cfg(test)]`) MAY use `Box<dyn Any>` as a test helper; production paths still hold the line.
- **Plugin/dynamic-loading boundaries** (loading `cdylib`s at runtime) genuinely need erasure across the FFI boundary; wrap immediately into a typed enum on the Rust side so the rest of the codebase never sees `dyn Any`.
- **`serde_json::Value`** is acceptable as a transport type at exactly one boundary (HTTP ingress, message queue payload) and MUST be parsed into a typed struct (`serde::Deserialize`) before any business logic runs.

## Related

RST-CORE-01, RST-CORE-02, RST-ERRH-01, RST-ERRH-02, RST-ERRH-04, RST-TYPE-01, RST-TYPE-02
