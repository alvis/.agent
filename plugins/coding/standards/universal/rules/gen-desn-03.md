# GEN-DESN-03: Wrappers Must Add Value

## Intent

A module, class, or service wrapper must add concrete value: validation, policy enforcement, transformation, caching, telemetry, retries, or error normalization. Pass-through modules/services that merely re-export or delegate without adding behavior are prohibited. For function-level no-value wrappers, see `FUNC-ARCH-03`.

## Fix

```typescript
// ✅ GOOD: UserService wraps repository with caching and error normalization
class UserService {
  constructor(
    private readonly repository: UserRepository,
    private readonly cache: CacheClient,
  ) {}

  async findUser(id: string): Promise<User> {
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return cached;

    const user = await this.repository.find(id);
    if (!user) throw new UserNotFoundError(`User ${id} not found`);

    await this.cache.set(`user:${id}`, user, { ttlSeconds: 3600 });
    return user;
  }
}
```

## Anti-Pattern: Pass-Through Service

```typescript
// ❌ BAD: service wrapper adds no value
class UserService {
  constructor(private readonly repository: UserRepository) {}

  async getById(userId: string): Promise<User | null> {
    return this.repository.findById(userId); // just delegates!
  }
}
```

## Factory Exception

Factory functions are allowed only when they accept configuration parameters:

```typescript
// ✅ GOOD: factory with parameters -- adds configuration value
function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}

// ❌ BAD: zero-argument factory -- no value added
function createDefaultLogger(): Logger {
  return new Logger(); // just use new Logger() directly!
}
```

## Wrapper Value Test

| Added Value          | Example                                |
|----------------------|----------------------------------------|
| Caching              | Cache lookup before repository call    |
| Validation           | Schema parse before forwarding         |
| Error normalization  | Catch and rethrow domain error         |
| Telemetry            | Duration/metric logging around call    |
| Policy enforcement   | Permission check before action         |
| Retries              | Retry with backoff around call         |
| Transformation       | Map external DTO to internal model     |

## Edge Cases

- A thin orchestration layer that coordinates multiple services (even without transformation) is acceptable since coordination itself is the added value.
- Factory modules are allowed only when they accept configuration parameters. Zero-argument factories that merely call `new` add no value.

## Related

FUNC-ARCH-03, GEN-DESN-01, GEN-DESN-02, GEN-DESN-04, GEN-CONS-01
