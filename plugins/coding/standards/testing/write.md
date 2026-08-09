# Testing: Compliant Code Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Key Principles

- 100% line coverage with ABSOLUTE MINIMUM tests (one test per unique path)
- TDD: write failing test -> implement -> refactor
- Test descriptions: `it("should ...")`, symbol-scoped suites: `describe("fn:symbol")`, general suites: plain description
- All mocks typed with `satisfies Partial<typeof import("...")>` or `satisfies Partial<RealType>` — never `Record<string, unknown>` or inline structural types
- Happy-path defaults inline: `vi.fn(() => value)`, never `.mockResolvedValue()`
- No `beforeEach` for mock setup — only for non-Vitest mock history resets (`client.resetHistory()`) or registering `ctx.onTestFailed(...)` debug-dump hooks
- Log-observable behavior: capture logger as typed `vi.fn<LogFn>()` and assert `log.mock.calls` structurally
- Test behavior, not static content: never restate a value whose source of truth lives elsewhere — assert the property that holds over the set (cap, uniqueness, ordering, integrity), keeping only assertions that fail when the data is *wrong*, not when it legitimately changes
- `const` for shared fixtures; file-level instances by default
- Structural assertions (`toEqual`), not field-by-field
- No silent skips: missing env/config must hard-fail at file load (`throw`), never `runIf`/`skipIf`/conditional-return
- Async setup (server/DB/external resource): use runner `globalSetup` + `project.provide`/`inject` (bound to `const`), teardown returned from global setup — never `beforeAll`/`afterAll` or `let` (no `vi.provide`/`vi.inject`)

## Naming Prefixes

| Prefix | Usage |
|--------|-------|
| `fn:` | Functions |
| `sv:` | Services |
| `op:` | Operations |
| `cl:` | Classes |
| `mt:` | Class methods |
| `gt:` | Class getters |
| `st:` | Class setters |
| `re:` | Regex |
| `ty:` | Utility types or interfaces |
| `rc:` | React components |
| `hk:` | React hooks |

**Prefixes apply only to symbol-scoped `describe()` blocks** — i.e., when the suite tests a specific function, class, method, hook, etc. General-purpose `describe()` blocks that group by scenario, behavior category, or context must use plain natural-language titles without any prefix.

## Test Structure Template

Canonical test file layout:

1. Vitest imports (`import { describe, it, expect, vi } from 'vitest'`)
2. Type imports (`import type { ... }`)
3. `vi.mock(...)` calls
4. `vi.hoisted(...)` declarations (when needed for spy/error paths)
5. Constants and shared fixtures (`const`)
6. Helper functions (if any)
7. `describe(...)` suites

Section headers for complex files: `// --- TYPES --- //` -> `// --- MOCKS --- //` -> `// --- CONSTANTS --- //` -> `// --- HELPERS --- //` -> `// --- TEST SUITES --- //`

AAA spacing: blank lines between arrange/act/assert. No `// Arrange` / `// Act` / `// Assert` comments.

## Core Rules Summary

### Testing Discipline (TST-CORE)

- **TST-CORE-01**: Test code inherits full TypeScript constraints: no `any`, proper import separation, safe narrowing, typed contracts.
- **TST-CORE-02**: Write failing tests before implementation, then implement, then refactor.
- **TST-CORE-03**: Every `it(...)` starts with `should`. `describe(...)` titles scoped to a symbol use approved prefixes; general-purpose `describe(...)` titles use plain descriptions without prefixes.
- **TST-CORE-04**: A test is valid only if it adds a new behavior path, branch, or meaningful edge case.
- **TST-CORE-05**: Do not add tests that only vary arbitrary numbers/strings without changing behavior.
- **TST-CORE-06**: Do not test only that dependencies were called. Assert behavior and outcome.
- **TST-CORE-07**: Do not spy on internals when external behavior can be tested.
- **TST-CORE-08**: Avoid `await import(...)` in tests. Keep imports static and predictable.
- **TST-CORE-09**: For log-observable behavior, capture the logger as `vi.fn<LogFn>()` or `{ info: vi.fn<Logger['info']>() } satisfies Partial<Logger>` and assert the full call record with `expect(log.mock.calls).toEqual([...])` — the array pins how many lines were logged and each line's content (one call `[[...]]` or many). Do not use `toHaveBeenCalledTimes(...)` + scattered `toHaveBeenCalledWith(...)` pairs, count-only assertions, or `log.mock.calls[N]` indexing. Prefer the SUT's exported `Log` type; a local alias is acceptable only when no real type is exported.
- **TST-CORE-10**: Do not restate static content — a value whose source of truth lives elsewhere (constant exports, rosters, manifests, config maps, copy text, exact counts). Such a test only fires when source and test are edited in opposite directions. Test the consumer, or encode shape in source via `satisfies`/`as const`. EXCEPTION: a systematic property holding over the set regardless of the values (bound/cap, uniqueness, ordering, referential integrity, schema validity, round-trip preservation, among others) is required, not forbidden. Decide by what the assertion fails on: on a legitimate data change ⇒ change-detector, remove; only when the data is genuinely wrong ⇒ property, keep. The matcher never decides it.
- **TST-CORE-11**: Tests must run or hard-fail. Never gate with `describe.runIf`/`it.skipIf`/`if (!env.X) return`. Required env vars are validated at file load with `throw new Error(...)` so missing config breaks the suite loudly.

### Coverage (TST-COVR)

- **TST-COVR-01**: 100% line coverage required (excluding barrel/type-only files).
- **TST-COVR-02**: Critical failure, fallback, and validation branches require full coverage.
- **TST-COVR-03**: One-test-at-a-time workflow: add one test, run coverage, decide next.
- **TST-COVR-04**: Remove tests that add zero new coverage and no distinct behavior protection.

### Fixtures & Data (TST-DATA)

- **TST-DATA-01**: Use `const` for shared fixtures. Never mutate shared objects across tests.
- **TST-DATA-02**: Use one structural assertion (`toEqual`, `objectContaining`) instead of many per-field assertions.
- **TST-DATA-03**: No zero-argument factories. Use factories only when multiple valid variants are required.
- **TST-DATA-04**: Do not pass explicit `undefined` in override objects. Omit the field or argument.
- **TST-DATA-05**: Create instances at file/describe level by default. Per-test only when tests mutate state.
- **TST-DATA-07**: Assert errors as a whole — `expect(error).toEqual(new Error('msg'))`. Never split into `toBeInstanceOf` + a separate `.message`/`.cause` check (`toEqual` ignores `cause`).

### Mocks (TST-MOCK)

- **TST-MOCK-01**: Mock only IO/external/control dependencies. Keep pure internal logic real.
- **TST-MOCK-02**: Use `vi.hoisted` only when shared refs are needed for spying or error-path overrides.
- **TST-MOCK-03**: Define defaults inline: `vi.fn(() => value)` or `vi.fn(async () => value)`. Never chain `.mockResolvedValue()`.
- **TST-MOCK-04**: `beforeEach` must NOT contain any mock setup. Its only permitted uses are (a) non-Vitest mock history resets (`client.resetHistory()`, `interceptor.clearRecords()`) and (b) registering `ctx.onTestFailed(...)` hooks that dump recorded logs/HTTP records for failure diagnosis. Happy-path defaults go at file/describe level; error-path overrides go inside `it()`.
- **TST-MOCK-05**: All test doubles validated with `satisfies Partial<typeof import("...")>` or `satisfies Partial<RealType>`. Weak generic types (`Record<string, unknown>`, `Record<string, ReturnType<typeof vi.fn>>`, inline structural types) are violations — they bypass real type validation.
- **TST-MOCK-06**: No custom mock-only interfaces or oversized mock surfaces.
- **TST-MOCK-07**: Mock behavior depends on input arguments, not mutable external flags.
- **TST-MOCK-08**: Class mocks use `Object.assign(this, mockObject)` in constructor.
- **TST-MOCK-09**: No `as unknown as` escape casts. Use `satisfies Partial<T>` and the approved bridge (`as Partial<T> as T`).
- **TST-MOCK-10**: Vitest cleanup options enabled in config. No manual cleanup hooks (`afterEach(() => vi.clearAllMocks())`, `beforeAll(() => vi.useFakeTimers())`, `afterAll(() => vi.useRealTimers())`). For non-Vitest mocks, no full resets (`client.reset()`) — use history-only clears (`client.resetHistory()`).
- **TST-MOCK-11**: Use `vi.stubGlobal` and `vi.stubEnv` with config-based auto restoration.
- **TST-MOCK-12**: Set shared `vi.useFakeTimers()` and `vi.setSystemTime()` at file or describe level directly (no `beforeAll` wrapper). Per-test overrides for different times are acceptable.
- **TST-MOCK-13**: No `mock*` or `mocked` identifier prefixes. Use semantic names: `userRepository`, `emailGateway`, `clockStub`.
- **TST-MOCK-14**: Use `InstanceType<typeof import("...")["ClassName"]>` for class instance typing, not module-level `typeof import(...)`.
- **TST-MOCK-15**: Return existing mock instances directly from `vi.mock()` factories. Never re-wrap with `vi.fn((...args) => existing(...args))`.

### Structure (TST-STRU)

- **TST-STRU-01**: `*.spec.ts` for unit, `*.int.spec.ts` for integration, `*.e2e.spec.ts` for e2e. Unit tests isolated; integration tests must not use unit-style mocks.
- **TST-STRU-02**: Canonical order: imports, constants/fixtures/mocks, setup hooks, then `describe`. No `describe` before setup.
- **TST-STRU-03**: AAA with blank-line separation. Comments explain why, stay concise, lowercase style.
- **TST-STRU-05**: One-time async setup lives in the runner `globalSetup`; expose serializable handles via `project.provide` and read them with `inject` into a `const`. No `beforeAll`/`afterAll`, no `let`.

## Mock Patterns

### When to Mock

Mock only IO/external/control dependencies. Keep pure internal logic real.

### Mock Setup Decision

1. Will method be called in tests? **No** -> omit (use `satisfies Partial<T>`)
2. Need to spy on calls or test error paths? **No** -> inline in `vi.mock()` factory
3. **Yes** -> use `vi.hoisted()` with inline default return

### Typing

- All test doubles: `satisfies Partial<typeof import("...")>` or `satisfies Partial<RealType>` (never `Record<...>` or inline structural types)
- Class instances: `InstanceType<typeof import('#m')['Cls']>`
- Triple pattern when full type needed: `satisfies Partial<T> as Partial<T> as T`
- Classes with `#private` fields: `// @ts-expect-error class mocking with #private fields` before `satisfies Partial<T>`

### Identifier Names

No `mock*` or `mocked` prefixes. Use semantic names: `userRepository`, `emailGateway`, `clockStub`.

### Asserting Calls

Pick the form by *what you assert*, not by call count:

- **Called with given args** (count not pinned) -> `expect(fn).toHaveBeenCalledWith(...)` (or `toHaveBeenNthCalledWith(n, ...)`).
- **Complete call record** (exact count + exact args) -> `expect(fn.mock.calls).toEqual([...])`. When you'd otherwise pair `toHaveBeenCalledTimes(n)` with `toHaveBeenCalledWith(...)`, collapse both into this one structural assertion (works for one call `[[...]]` or many).
- **Never** index a recorded call -> `fn.mock.calls[N]` / `fn.mock.results[N]` is banned (flagged by the `mock-calls-index` scanner); assert the whole `mock.calls` array with `toEqual`. See `TST-DATA-02`.

## Coverage Workflow

0. Before measuring, remove dead code — unused constants, regexps, no-value
   wrappers (`GEN-DESN-04`, `FUNC-ARCH-03`). Coverage applies to living code only.
1. Write one test -> run coverage -> check delta
2. Zero coverage gain? Delete the test
3. Repeat until 100% line coverage

## Quick Reference

| Test Type   | File Pattern    | Purpose                       | Mocking                       |
|-------------|-----------------|-------------------------------|-------------------------------|
| Unit        | `*.spec.ts`     | Isolated component testing    | Required for IO/external deps |
| Integration | `*.int.spec.ts` | Component interaction testing | NOT allowed                   |
| E2E         | `*.e2e.spec.ts` | Full system testing           | NOT allowed                   |

**Test Isolation**: Unit tests (`.spec.ts`) must be fully isolated — mock databases, APIs, and services. Integration tests (`.int.spec.ts`) may use real internal dependencies and external services. **Mocking is NOT allowed in integration tests** — they must exercise real code paths.

## Anti-Patterns

- Repeating nearly identical tests to inflate coverage numbers.
- Restating a value whose source of truth lives elsewhere (roster counts, ID mirrors, config maps, copy text) — it breaks on every legitimate edit and proves nothing.
- Mocking internal pure functions instead of testing outcomes.
- Reassigning shared test data with `let` in suites.
- Building large fake interfaces that diverge from real contracts.
- Manual mock cleanup hooks instead of configuration-driven cleanup.
- Wrapping an existing mock instance with nested `vi.fn` in a `vi.mock` module factory.
- Silently skipping tests when env vars are missing (`runIf`/`skipIf`/early-return) — CI goes green without running anything.
- Async server/DB setup in `beforeAll`/`afterAll` with `let` bindings instead of `globalSetup` + `inject`.

## Quick Decision Tree

1. Is this behavior already covered by another test? If yes, do not add duplicate (`TST-CORE-04`).
2. Are you testing only call-through behavior? Assert business outcome instead (`TST-CORE-06`).
3. Need a mock? Only if dependency is IO/external/control-sensitive (`TST-MOCK-01`).
4. Need hoisted mocks? Use only for call spying or error-path overrides (`TST-MOCK-02`).
5. Reusing a hoisted/mock symbol in `vi.mock` factory? Export it directly, do not re-wrap with nested `vi.fn` (`TST-MOCK-15`).
6. Adding a test now? Run coverage before and after, keep only positive-delta tests (`TST-COVR-03`, `TST-COVR-04`).
7. Structuring a test file? Enforce naming, canonical layout, and AAA spacing (`TST-STRU-01`, `TST-STRU-02`, `TST-STRU-03`).
8. Needs an env var? Validate at file top with `throw`; never `runIf`/`skipIf` (`TST-CORE-11`).
9. Asserting static data? Ask what it fails on — a legitimate data change means it's a change-detector; only a genuinely wrong value means it's a property worth keeping (`TST-CORE-10`).
