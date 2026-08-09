# NAM-CORE-04: Units and Temporal Precision

## Intent

Time-related and measurement variables MUST include unit suffixes where relevant (`timeoutMs`, `intervalSeconds`, `sizeBytes`). Bare numeric names like `timeout` or `delay` hide the unit and invite conversion bugs.

## Fix

```typescript
// time variables include unit suffixes
const connectionTimeoutMs = 5000;
const sessionDurationMinutes = 30;
const retryDelaySeconds = 2;
```

### Timestamp Variables

Timestamp variables use `*At` suffix to imply a point-in-time:

```typescript
const createdAt = new Date();
const updatedAt = record.lastModified;
const expiresAt = new Date(Date.now() + ttlMs);
```

### Measurement Variables

```typescript
const maxFileSizeBytes = 10 * 1024 * 1024;
const uploadSpeedKbps = 512;
const bufferLengthMs = 200;
```

### Disallowed Bare Names

| Disallowed | Use Instead |
|------------|-------------|
| `time` | `createdAt`, `updatedAt`, `timestamp`, `startTime` |
| `duration` | `durationMs`, `durationSeconds`, `elapsedTimeMs` |
| `timeout` | `timeoutMs`, `requestTimeoutSeconds`, `connectionTimeoutMs` |
| `delay` | `delayMs`, `retryDelaySeconds` |

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `const timeout = 5000`, refactor before adding new behavior.
- Variables like `createdAt`, `updatedAt`, `expiresAt` are acceptable since the `At` suffix implies a point-in-time.

## Related

NAM-CORE-01, NAM-CORE-02, NAM-CORE-03
