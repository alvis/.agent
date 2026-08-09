# RST-NAME-01: snake_case for Functions, Variables, Modules, Files; PascalCase for Types

**Tool Coverage:** rustc:non_snake_case, rustc:non_camel_case_types, clippy:module_name_repetitions (partial — built-in lints catch identifier casing but not file naming).

## Intent

Rust has a single community casing convention: `snake_case` for value-level names (functions, methods, parameters, local and field bindings, modules, and the `.rs` files that back them) and `PascalCase` for type-level names (structs, enums, traits, type aliases, enum variants). The compiler's built-in `non_snake_case` / `non_camel_case_types` lints catch most identifier slips, but file naming is invisible to the linter — `UserService.rs` compiles cleanly even though it breaks the convention. Mixing cases sabotages tooling (path completion, search, `mod` resolution) and signals the code was machine-translated from another language.

## Fix

```rust
// ✅ GOOD: file is `src/user_service.rs`
pub mod billing;

pub struct UserService {
    repo: UserRepo,
}

pub enum PaymentStatus {
    Pending,
    Settled,
    Refunded,
}

impl UserService {
    pub fn create_user(&self, full_name: &str, email_address: &str) -> User {
        let normalized_email = email_address.trim().to_ascii_lowercase();
        User::new(full_name, &normalized_email)
    }
}
```

```rust
// ❌ BAD: file is `src/UserService.rs` (wrong — PascalCase filename)
pub mod Billing;                              // module must be snake_case

pub struct user_service {                     // type must be PascalCase
    repo: user_repo,
}

pub enum payment_status {                     // enum must be PascalCase
    pending,                                  // variant must be PascalCase
    SETTLED,
}

impl user_service {
    pub fn createUser(&self, fullName: &str, emailAddress: &str) -> User {  // camelCase
        let normalizedEmail = emailAddress.trim().to_ascii_lowercase();      // camelCase local
        User::new(fullName, &normalizedEmail)
    }
}
```

### File Naming Mirrors Module Naming

A `mod foo;` declaration resolves to `foo.rs` (or `foo/mod.rs`, which RST-MODL-03 forbids — see `foo.rs` + `foo/` directory layout). The filename is therefore part of the module path: `src/UserService.rs` would force `mod UserService;`, which immediately violates this rule at the module-name level. Keep file, directory, and `mod` name in lockstep: `user_service.rs` ↔ `mod user_service;`.

## Edge Cases

- Acronyms in identifiers stay lowercase inside `snake_case` (`parse_html`, `http_client`) and use only an initial capital inside `PascalCase` (`HtmlParser`, `HttpClient`, not `HTMLParser`). The compiler's `non_camel_case_types` lint enforces the latter.
- FFI bindings to C libraries may keep upstream casing — silence the lint with `#[allow(non_snake_case)] // reason: matches libc symbol layout` per RST-CORE-03.
- Single-letter generic parameters (`T`, `U`, `K`, `V`) and short loop variables (`i`, `n`) are fine; they are values and types respectively, and the case still matches the slot.
- Binary-crate file names (`src/bin/my_tool.rs`) follow the same `snake_case` rule; the resulting executable name inherits the filename.

## Related

RST-NAME-02, RST-NAME-03, RST-NAME-04, RST-MODL-03
