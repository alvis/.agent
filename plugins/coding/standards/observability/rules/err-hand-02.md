# ERR-HAND-02: Throw Early, Handle at Boundaries

## Intent

Throw as soon as invalid state is detected, then handle errors explicitly at system boundaries (HTTP handlers, jobs, CLI entrypoints). Never swallow errors with empty `catch` blocks or silent returns; rethrow a domain error or return a typed failure contract.

## Fix

```typescript
try {
  return await paymentGateway.charge(payload);
} catch (error) {
  throw new PaymentProcessingError("failed to charge payment", { cause: error as Error });
}
```

### Typed failure contract instead of silent swallow

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError };

function parseConfig(raw: string): Result<AppConfig> {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, error: new ConfigParseError("invalid config format", { cause: error as Error }) };
  }
}
```

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `catch { return }`, refactor before adding new behavior.
- If the caller can recover, return a typed failure contract; otherwise throw a specific domain error.

## Related

ERR-HAND-01, ERR-HAND-03
