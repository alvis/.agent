# NAM-FUNC-03: Factory Naming Discipline

## Intent

Use `createX` for one-off instance/value creation. Use `xFactory` only when returning a reusable/stateful factory that captures configuration. Do not mix both patterns for the same concept.

## Fix

```typescript
// createX for one-off instance/value creation
const createSession = () => ({ id: crypto.randomUUID(), startedAt: new Date() });
const createDefaultConfig = (): AppConfig => ({ debug: false, port: 3000 });
```

### xFactory for Reusable Creators

```typescript
// xFactory for reusable/stateful factory that captures configuration
const reportFactory = buildReportFactory({ locale: "en-US", timezone: "UTC" });
const report = reportFactory.create("monthly");

const loggerFactory = configureLoggerFactory({ level: "info" });
const appLogger = loggerFactory.create("app");
```

### Factory Pattern Selection

| Pattern | Use When | Example |
|---------|----------|---------|
| `createX` | Creating a single instance or value without persistent state | `createEventEmitter()`, `createLogger()` |
| `xFactory` | Returning a reusable or stateful factory function | `userFactory()`, `routerFactory()` |

- Use `createX` for one-off creators or stateless helpers (even if the function returns another function).
- Use `xFactory` when returning a higher-order factory that captures configuration or maintains state for reuse.
- Avoid naming factory helpers `create*` if they immediately return a configured reusable function; prefer the `xFactory` suffix instead.

<IMPORTANT>
**Persistence reminder**: `create*` and `xFactory` apply to in-memory helpers. When interacting with persisted entities, use `Set<Entity>` instead of `create*` to express upsert behavior. See `NAM-FUNC-04`.
</IMPORTANT>

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const createFactory = build()`, refactor before adding new behavior.
- Do not mix `createX` and `xFactory` for the same concept; pick one pattern per concept.
- For persisted entities, use `Set<Entity>` instead of `create*` (see `NAM-FUNC-04`).

## Related

NAM-FUNC-01, NAM-FUNC-02, NAM-FUNC-04
