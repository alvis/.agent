# @scope/retry

<br/>
📌 A typed retry/backoff library for TypeScript that turns flaky operations into predictable, observable pipelines. It cures retry fatigue: the half-correct `try/catch + setTimeout` loops teams copy-paste — each with its own bug around jitter, non-retryable errors, and cancellation.

The `@scope/retry` package centers the retry decision around a **pluggable classifier** and a **small 4-phase pipeline** (`Attempt → Classify → Delay → Decide`), so the same engine handles HTTP calls, database reconnects, and message broker redelivery with one mental model. Compared to `p-retry` it exposes the classifier as a first-class citizen; compared to `async-retry` it is zero-dep, strictly typed, and cancel-aware via `AbortSignal`.

<br/>
<div align="center">

•&emsp;&emsp;💡 [Core Concept](#-core-concept)&emsp;&emsp;•&emsp;&emsp;📐 [Architecture](#-architecture)&emsp;&emsp;•&emsp;&emsp;📖 [Usage](#-usage)&emsp;&emsp;•&emsp;&emsp;📚 [API Reference](#-api-reference)&emsp;&emsp;•&emsp;&emsp;📦 [Related](#-related-packages)&emsp;&emsp;•

</div>
<br/>

---

## 💡 Core Concept

Retry is deceptively easy to get wrong — teams reinvent the same half-correct `try/catch + setTimeout`, each with its own jitter, classification, and cancellation bug. `@scope/retry` cures that retry fatigue with a single fixed pipeline: every attempt walks through **Attempt → Classify → Delay → Decide**, always in the same order, always with full context.

Because the four phases are isolated behind small interfaces, swapping one — a deterministic `DelayStrategy` in tests, a header-aware `Classifier` in production — never perturbs the rest. See [the architecture guide](./docs/architecture/retry-engine.md#-core-concepts) for per-phase rationale and invariants.

---

## 📐 Architecture

A 4-phase pipeline (`Attempt → Classify → Delay → Decide`) runs inside `RetryEngine`, with every phase behind a replaceable interface (`src/engine`, `src/policy`, `src/classify`, `src/delay`).

See [`docs/architecture/retry-engine.md`](./docs/architecture/retry-engine.md) for component diagrams, data flow, state machine, and invariants.

---

## 📖 Usage

### Example: Basic retry with exponential backoff

Wrap any async operation. Defaults cover the 90% case: 5 attempts, exponential backoff from 100 ms capped at 30 s, decorrelated jitter, retry on network errors and HTTP 5xx.

```ts
import { retry } from '@scope/retry';

const user = await retry(async () => {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error(`status ${response.status}`);
  return (await response.json()) as User;
});
```

### Example: Custom classifier for domain errors

The classifier is the most common extension point. Return `'retryable'` for anything transient, `'fatal'` for programmer errors, and `'abort'` when a caller explicitly cancelled.

```ts
import { createRetryPolicy, retry } from '@scope/retry';
import { RateLimitError, ValidationError } from './errors';

const policy = createRetryPolicy()
  .maxAttempts(8)
  .classify((error) => {
    if (error instanceof RateLimitError) return 'retryable';
    if (error instanceof ValidationError) return 'fatal';
    return 'retryable';
  })
  .build();

const result = await retry(() => chargeCard(payment), policy);
```

### Example: Retry with an external circuit breaker

Compose with `@scope/circuit-breaker` to short-circuit once a downstream is known bad; the breaker's `OpenError` is classified as `fatal` so retry exits cleanly.

```ts
import { createCircuitBreaker, OpenError } from '@scope/circuit-breaker';
import { createRetryPolicy, retry } from '@scope/retry';

const breaker = createCircuitBreaker({ threshold: 5, resetMs: 30_000 });

const policy = createRetryPolicy()
  .maxAttempts(6)
  .maxElapsedMs(10_000)
  .classify((error) => (error instanceof OpenError ? 'fatal' : 'retryable'))
  .build();

await retry(() => breaker.execute(() => callDownstream()), policy);
```

---

## 📚 API Reference

### Core Functions

<details>
<summary><code>retry&lt;T&gt;(operation: () =&gt; Promise&lt;T&gt;, policy?: Policy, signal?: AbortSignal): Promise&lt;T&gt;</code></summary>

**Description:**
Runs `operation` under the retry engine. Resolves with the first successful value or rejects with a `RetryError` once the policy is exhausted.

**Parameters:**

- `operation` (`() => Promise<T>`): The async function to attempt; must be idempotent or the caller accepts duplicated side effects
- `policy` (`Policy`, optional): Built via `createRetryPolicy()`; defaults to the package defaults if omitted
- `signal` (`AbortSignal`, optional): When aborted, the engine stops scheduling new attempts and rejects with the abort reason

**Returns:**

- `Promise<T>`: The resolved value of the first successful attempt

**Throws:**

- `RetryError`: All attempts exhausted; inspect `attempts` and `lastError`
- `AbortError`: The signal fired before the next attempt could run

**Example:**

```ts
import { retry } from '@scope/retry';

const data = await retry(() => fetchJson('/api/health'));
```

</details>

<details>
<summary><code>createRetryPolicy(): PolicyBuilder</code></summary>

**Description:**
Returns a fluent builder for a `Policy`. Each chained method narrows the retry behavior; `.build()` freezes the policy.

**Parameters:** none

**Returns:**

- `PolicyBuilder`: Exposes `maxAttempts(n)`, `maxElapsedMs(ms)`, `classify(fn)`, `delay(strategy)`, `build()`

**Builder methods (chainable; each returns `PolicyBuilder`):**

| Method | Purpose |
| --- | --- |
| `.maxAttempts(n: number)` | cap on total attempts before `RetryError` with reason `'max-attempts'` |
| `.maxElapsedMs(ms: number)` | wall-clock cap before `RetryError` with reason `'max-elapsed'` |
| `.classify(fn: Classifier)` | override verdict mapping; replaces the default classifier entirely |
| `.delay(strategy: DelayStrategy)` | override wait computation; built-ins include `exponential`, `decorrelatedJitter` |
| `.circuitBreaker(opts)` | optional integration with `@scope/circuit-breaker`; classifies `OpenError` as fatal |
| `.build()` | freeze and return an immutable `Policy` |

**Example:**

```ts
import { createRetryPolicy } from '@scope/retry';

const policy = createRetryPolicy()
  .maxAttempts(4)
  .maxElapsedMs(5_000)
  .build();
```

</details>

<details>
<summary><code>class RetryError extends Error</code></summary>

**Description:**
Aggregate error thrown when a retry policy is exhausted. Preserves every attempt for diagnostics.

**Fields:**

- `attempts` (`AttemptRecord[]`): One record per attempt with `index`, `error`, `durationMs`
- `lastError` (`unknown`): Shortcut to `attempts[attempts.length - 1].error`
- `reason` (`'max-attempts' | 'max-elapsed' | 'fatal'`): Why the loop stopped

**Example:**

```ts
import { RetryError, retry } from '@scope/retry';

try {
  await retry(() => flakyCall());
} catch (error) {
  if (error instanceof RetryError) {
    console.error(`gave up after ${error.attempts.length}`, error.lastError);
  }
}
```

</details>

---

## 📦 Related Packages

- [`@scope/circuit-breaker`](../circuit-breaker): pairs with retry to stop hammering a known-bad downstream; its `OpenError` is naturally fatal to classify
- [`@scope/rate-limiter`](../rate-limiter): sits in front of retry to bound request volume; its `RateLimitError` is the canonical retryable error in the default classifier

---
