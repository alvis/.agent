# RST-TYPE-02: `enum` for Finite State, Never Bare `&str`

**Tool Coverage:** standard-only — no clippy lint flags "should have been an enum".

## Intent

A parameter typed `&str` (or `String`) accepts every string ever created. If the domain in fact has a closed set of values — order status `draft | sent | paid | void`, region `eu | us | apac`, severity `info | warn | error` — model it with an `enum`. The compiler then enforces exhaustive `match`, flags typos at compile time, and gives the IDE the variant list. Stringly-typed state is the single largest source of "we forgot to handle `paid`" bugs, because `if status == "paid"` does not light up when a new variant is introduced. Mirrors PYT-TYPE-03 ("`Literal` over bare `str`").

## Fix

```rust
// ✅ GOOD: enum encodes the closed set; match is exhaustive
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InvoiceStatus {
    Draft,
    Sent,
    Paid,
    Void,
}

pub fn describe(status: InvoiceStatus) -> &'static str {
    match status {
        InvoiceStatus::Draft => "not sent",
        InvoiceStatus::Sent  => "awaiting payment",
        InvoiceStatus::Paid  => "settled",
        InvoiceStatus::Void  => "cancelled",
        // adding a new variant forces this match to be updated
    }
}
```

```rust
// ❌ BAD: bare &str — every string is legal, typos survive, no exhaustiveness
pub fn describe(status: &str) -> &'static str {
    if status == "drft" {            // typo: should be "draft" — never matches
        "not sent"
    } else if status == "sent" {
        "awaiting payment"
    } else if status == "paid" {
        "settled"
    } else {
        "unknown"                    // silent catch-all hides bugs
    }
}
```

### Why `match` Beats `if status == "…"`

The compiler refuses to compile a `match` over `InvoiceStatus` that omits a variant (without an explicit `_ =>` arm). When the domain gains a `Refunded` state, every site that switches on the status lights up as a type error. The `if/else` chain on `&str` continues to compile, silently falls into the catch-all, and ships a bug.

## Edge Cases

- When the enum must cross a serialization boundary (HTTP body, database column) add `#[derive(serde::Serialize, serde::Deserialize)]` plus `#[serde(rename_all = "snake_case")]`. Parsing-from-`&str` belongs to RST-TYPE-05 (`strum::EnumString`).
- For state machines with associated data per variant (e.g. `Paid { paid_at: DateTime }`), the enum becomes a struct-variant enum — still preferred over carrying a sibling `paid_at: Option<DateTime>` next to a `status: &str`.
- A finite set of *open-ended* extension points (plugin names, customer tags) is **not** finite state — that legitimately lives as `String` or a newtype around `String`.
- `match status { _ => ... }` catch-all defeats exhaustiveness — reach for it only when forwarding to a default and add a `// reason:` per RST-CORE-03.

## Related

RST-TYPE-01, RST-TYPE-05, RST-PARM-01, RST-ERRH-05
