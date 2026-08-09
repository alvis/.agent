# Function: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md` to confirm the violation and follow its fix guidance.

> **During linting**: Only apply a rule's fix if it is a mechanical correction — formatting, naming, documentation, casing, import ordering, or field/function reordering. If the fix would add new logic, change control flow, introduce runtime validation, or alter program behavior, report the violation without fixing it.

> **Scanner-backed rules**: `FUNC-SIGN-03` and `FUNC-SIGN-06` have advisory mechanical scanner support (`plugins/coding/scripts/scanners/`). The scanner surfaces candidates only — always re-verify each hit against the rule guide before flagging.

## Quick Scan

- DO NOT mix multiple responsibilities in one function [`FUNC-ARCH-01`] (→ GEN-DESN-01)
- DO NOT build multi-line text with string concatenation [`FUNC-ARCH-02`]
- DO NOT add wrappers that provide no behavioral value [`FUNC-ARCH-03`] (→ GEN-DESN-03)
- DO NOT inject the parent class into a child (`new Child({ parent: this })`) or use `extends Parent` purely to share private helpers; use a parent factory method or a standalone module-level helper instead [`FUNC-ARCH-04`]
- DO NOT keep short-circuit guards before loops that average ≤3 iterations; use optional chaining at the call site [`FUNC-ARCH-05`]
- DO NOT omit explicit return types [`FUNC-SIGN-01`]
- DO NOT use overly long positional signatures [`FUNC-SIGN-02`]
- DO NOT use non-standard parameter names, such as `payload`, `cfg`, or `extra` when canonical names apply [`FUNC-SIGN-03`] (→ NAM-TYPE-02)
- DO NOT use unsafe optional destructuring [`FUNC-SIGN-04`] (→ TYP-PARM-01)
- DO NOT mark `Options` fields as required; rename to `*Params` if no defaults exist [`FUNC-SIGN-04`]
- DO NOT omit exported contract types [`FUNC-SIGN-05`] (→ TYP-PARM-02)
- DO NOT use conditional spread `...(cond ? { k: v } : {})` for optional keys when the consumer treats `key: undefined` as absent (Prisma, `JSON.stringify`, React props, destructuring defaults); pass the value directly [`FUNC-SIGN-06`]
- DO NOT use multi-positional constructor params or store the param object whole as a `#dependencies` / `#deps` / `#internals` bag; one object param (`XXXParams` / `XXXConfig`) destructured into named `#fields` [`FUNC-SIGN-07`]
- DO NOT mutate input parameters [`FUNC-STAT-01`]
- DO NOT use mutable transforms when immutable transforms suffice, such as `items.push(...)` instead of creating a new array [`FUNC-STAT-02`]
- DO NOT mix pure logic with side effects [`FUNC-STAT-03`]
- DO NOT hide side effects in utility-style flows [`FUNC-STAT-04`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `FUNC-ARCH-01` | Function has multiple responsibilities | `function saveAndNotify(){ saveUser(user); sendWelcomeEmail(user); }` |
| `FUNC-ARCH-02` | Multi-line text uses concatenation | `msg += "- Email is required\n"`; `let message = "Validation failed:\n";` |
| `FUNC-ARCH-03` | Wrapper adds no behavioral value | `return service.run(data)` |
| `FUNC-ARCH-04` | Parent class injected into child, or `extends Parent` used purely to share private helpers | `new Child({ parent: this })`; `class Child extends Parent {}` (for shared helpers only) |
| `FUNC-ARCH-05` | Unnecessary short-circuit guard before small loop | `if (!cb) return; for (const x of items) cb(x)`; `if (!handlers.length) return; for (const h of handlers) h(evt)` |
| `FUNC-SIGN-01` | Missing explicit return type | `function parse(x){ return x }`; `function getUserById(id: string) {` |
| `FUNC-SIGN-02` | Positional signature is overly long | `createUser(n,e,r,w,d)` |
| `FUNC-SIGN-03` | Parameter names are non-standard | `fn(payload, cfg, extra)` |
| `FUNC-SIGN-04` | Optional destructuring is unsafe | `const { a } = maybeOpts`; `function run({ id }: Options | undefined) {}`; `type Options = { model: string }` — Options field must be optional; `function run(opts: Options): R` — options param must be optional |
| `FUNC-SIGN-05` | Exported contract type is missing | `export function createUser(p:any)` |
| `FUNC-SIGN-06` | Conditional spread for optional keys when consumer is undefined-tolerant | `{ ...(opts.filter ? { filter: opts.filter } : {}) }`; `{ ...(x !== undefined ? { x } : {}) }`; `{ ...(x != undefined ? { x } : {}) }` inside a `{ ... }` object literal whose consumer is Prisma / `JSON.stringify` / React props / destructuring with defaults |
| `FUNC-SIGN-07` | Multi-positional constructor params, or param object stored whole as a `#dependencies` / `#deps` / `#internals` bag | `constructor(repo: Repo, log: Log, cache: Cache)`; `class C { #deps: Deps; constructor(deps: Deps) { this.#deps = deps; } }` |
| `FUNC-STAT-01` | Input parameter is mutated | `user.name = user.name.trim()`; `function processUser(user: User): User {` |
| `FUNC-STAT-02` | Mutable transform used without need | `items.push(nextItem)`; `for (const item of items) total += item.price` where `reduce`/immutable flow is sufficient |
| `FUNC-STAT-03` | Pure logic mixed with side effects | `logger.info(calc(x))` |
| `FUNC-STAT-04` | Side effects hidden in utility flow | `function sum(){ db.save() }` |
