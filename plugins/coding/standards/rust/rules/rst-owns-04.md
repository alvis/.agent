# RST-OWNS-04: Meaningful Lifetime Names at Public Boundaries

**Tool Coverage:** standard-only

## Intent

Lifetime parameters on public APIs MUST carry meaningful names (`'src`, `'tx`, `'req`, `'cfg`) — never the default `'a`/`'b`/`'c`. A lifetime in a public signature is a contract: "this output borrows from *that* input for *this* duration". `'a` says nothing; `'src` (the source string), `'tx` (the transaction), `'req` (the request) say which input owns the borrow and how long the relationship must hold. Readers see the contract without consulting the docs, refactors that change the borrow source produce a focused diff, and signatures with two or more lifetimes (`'src` and `'tx`) become legible instead of an `'a`/`'b` sea. Private/internal APIs MAY use `'a` when the lifetime is local and obvious.

## Fix

```rust
// ✅ GOOD: lifetime names spell the contract
pub struct AstNode<'src> {
    text: &'src str,
}

pub fn parse<'src>(source: &'src str) -> AstNode<'src> {
    AstNode { text: source }
}

// ✅ GOOD: two lifetimes — each names its source
pub struct Query<'tx, 'sql> {
    tx:  &'tx mut Transaction,
    sql: &'sql str,
}

pub fn prepare<'tx, 'sql>(
    tx:  &'tx mut Transaction,
    sql: &'sql str,
) -> Query<'tx, 'sql> {
    Query { tx, sql }
}

// ✅ GOOD: request/response borrow named for the request lifetime
pub fn extract_token<'req>(req: &'req HttpRequest) -> Option<&'req str> {
    req.headers().get("authorization").map(|h| h.as_str())
}
```

```rust
// ❌ BAD: 'a / 'b — reader must trace borrow paths by hand
pub struct AstNode<'a> {
    text: &'a str,
}

pub fn parse<'a>(source: &'a str) -> AstNode<'a> {
    AstNode { text: source }
}

// ❌ BAD: two anonymous lifetimes — which one is the tx? which is the sql?
pub struct Query<'a, 'b> {
    tx:  &'a mut Transaction,
    sql: &'b str,
}

pub fn prepare<'a, 'b>(
    tx:  &'a mut Transaction,
    sql: &'b str,
) -> Query<'a, 'b> {
    Query { tx, sql }
}
```

### Suggested Names

| Lifetime intent                              | Name to use         |
|----------------------------------------------|---------------------|
| Source text / input being parsed             | `'src`              |
| Open database/storage transaction            | `'tx`               |
| Incoming HTTP/RPC request                    | `'req`              |
| Outgoing response                            | `'resp`             |
| Configuration loaded for the operation       | `'cfg`              |
| Buffer being filled / written into           | `'buf`              |
| Caller-supplied context / scope              | `'ctx`              |
| Parent / surrounding scope                   | `'scope`            |

These are conventions, not a closed list — pick the noun the borrow refers to. Reserve `'a`/`'b` for genuinely local, single-lifetime private helpers.

## Edge Cases

- **Lifetime elision** still applies — when the borrow checker can infer the lifetime (single input borrow, single output borrow tied to it), elide it entirely instead of naming `'a`: `fn first_word(s: &str) -> &str` is preferable to `fn first_word<'src>(s: &'src str) -> &'src str`. Name lifetimes when elision *cannot* express the relationship (two-input, two-output, or struct-borrow).
- **Trait definitions** with associated types or higher-ranked trait bounds (`for<'a> Fn(&'a str) -> &'a str`): name them by the borrow they bind (`for<'item> Fn(&'item T) -> &'item U`).
- **`'static`** is special — never rename it; `'static` is the explicit "lives for the whole program" marker.
- **Private helpers inside a module** MAY use `'a` when the lifetime is obvious from context. Once the helper is `pub` or `pub(crate)`, rename to a meaningful identifier.
- **GATs (generic associated types)** under edition 2024: name the lifetime in the trait definition (`type Slice<'src>: Iterator<Item = &'src u8>`) so implementers see the contract.

## Related

RST-OWNS-01, RST-OWNS-02, RST-OWNS-03, RST-NAME-01, RST-PARM-02
