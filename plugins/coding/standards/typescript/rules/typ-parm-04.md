# TYP-PARM-04: Capability-Shaped Dependency Types

## Intent

Fields inside a class's companion contract (`XXXParams`, `XXXDependencies`, `XXXConfig`) should name *capabilities* the class actually needs — verb-shaped action functions like `readContextSource(id: string): Promise<Source>` or `tokenizeSearchQuery(query: string): readonly string[]` — not generic infrastructure containers like `database`, `logger`, `httpClient`. Each entry names *what needs to be done*, not *who provides it*. This keeps the class testable, grants it only the powers it needs, and prevents the dependency contract from drifting into a junk drawer.

## Fix

```typescript
// ✅ GOOD: capability-shaped dependency contract
interface ContextEngineDependencies {
  readonly readContextSource: (sourceId: string) => Promise<ContextSource>;
  readonly writeContextReceipt: (receipt: ContextReceipt) => Promise<void>;
  readonly getCurrentDate: () => Date;
}

type ContextEngineParams = Readonly<{
  readContextSource(sourceId: string): Promise<ContextSource>;
  writeContextReceipt(receipt: ContextReceipt): Promise<void>;
  getCurrentDate(): Date;
}>;
```

### Why Capabilities Scale

```typescript
// ✅ GOOD: test double narrows to a single function
const engine = new ContextEngine({
  readContextSource: async (id) => fixtureSource(id),
  writeContextReceipt: async () => undefined,
  getCurrentDate: () => new Date('2026-01-01'),
});
```

- **Substitution is local** — a test double replaces a single capability function, not an entire infrastructure handle.
- **Mocks stay narrow** — there is no full `Database` / `Logger` surface to stub; only the methods the class actually invokes.
- **Resists junk-drawer growth** — adding a new field forces the author to name a specific capability, not toss another service into a bag.
- **Powers are auditable** — reading the contract tells you exactly what the class can do at runtime.

### Anti-Pattern

```typescript
// ❌ BAD: infrastructure containers hide what the class actually needs
type ContextEngineDependencies = Readonly<{
  database: Database;
  clock: Clock;
  logger: Logger;
}>;

class ContextEngine {
  readonly #database: Database;
  readonly #clock: Clock;
  readonly #logger: Logger;
  // ...the class now holds the whole keyring; every reviewer must read the body
  // to discover which methods on Database / Clock / Logger are actually used.
}
```

This shape hides the real surface area, gives the class the entire keyring of every injected service, and lets the contract silently grow as new responsibilities sneak in.

## Edge Cases

- **External SDK *is* the contract** — when the dependency is a third-party SDK whose API is the capability surface (e.g. `stripe: Stripe`), decomposing it into per-method capabilities would just rewrap the entire SDK. Keep the SDK reference and document the rationale inline.
- **Thin fan-out wrappers** — a class whose sole job is to delegate the entire surface of another object (e.g. a typed proxy) can take that object as a single field; capability decomposition would duplicate the wrapped contract one-for-one.
- **Framework-imposed dependency names** — when a DI framework injects by class identity (e.g. NestJS providers, Angular services), the framework owns the field shape. Document the constraint inline and keep the capability-shaped style for everything the framework does not dictate.

## Related

TYP-PARM-02, TYP-PARM-03, TYP-TYPE-03, FUNC-SIGN-05, FUNC-SIGN-07, FUNC-ARCH-04, NAM-TYPE-03, NAM-FUNC-01
