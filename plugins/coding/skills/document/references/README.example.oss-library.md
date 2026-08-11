# @scope/retry

> Tiny, type-safe exponential backoff retry for Node.js and the browser — zero dependencies, fully tree-shakeable.

[![npm version](https://img.shields.io/npm/v/@scope/retry.svg?style=flat-square)](https://www.npmjs.com/package/@scope/retry)
[![CI](https://img.shields.io/github/actions/workflow/status/example/retry/ci.yml?branch=main&style=flat-square)](https://github.com/example/retry/actions)
[![Coverage](https://img.shields.io/codecov/c/github/example/retry?style=flat-square)](https://codecov.io/gh/example/retry)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](./LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@scope/retry?style=flat-square)](https://bundlephobia.com/package/@scope/retry)

---

## ⚡ Quick Start

```bash
npm install @scope/retry
```

```ts
import { retry } from '@scope/retry';

const user = await retry(() => fetch('/api/user').then((r) => r.json()), {
  attempts: 5,
  backoff: 'exponential',
});
```

That's it. Five attempts, exponential backoff (100ms → 200ms → 400ms → 800ms), jittered, cancellable, fully typed.

---

## ✨ Why @scope/retry?

### The Problem

Every non-trivial app ends up retrying something — a flaky API, a rate-limited webhook, a cold Lambda. Most teams either:

- **Reinvent the wheel** with ad-hoc `for` loops and `setTimeout`, missing jitter, cancellation, and typed errors.
- **Reach for a giant library** (`got`, `axios-retry`, `cockatiel`) that drags in transport-specific assumptions, circular deps, or 30 KB of policy DSL they'll never use.

Neither is right. Retry is a _primitive_, not a framework — but the primitive has to be correct. Getting backoff wrong (no jitter, unbounded growth, thundering herds) is a production incident waiting to happen.

### The Solution

`@scope/retry` is a **~1 KB, zero-dependency, transport-agnostic** retry primitive:

- Works with any `Promise`-returning function — `fetch`, `pg`, `redis`, SDK calls, your own code.
- Exponential, linear, constant, or custom backoff with full-jitter by default.
- `AbortSignal` native — cancel in-flight attempts and pending delays together.
- Typed retry predicates so `retryIf` knows the error shape.
- Works in Node 18+, Deno, Bun, Cloudflare Workers, and every evergreen browser.

---

## 🚀 Key Features

- **Zero dependencies** — no transitive supply-chain surface.
- **~1 KB minzipped** — tree-shakes to the single helper you use.
- **First-class `AbortSignal`** — compose with `fetch`, `setTimeout`, user gestures.
- **Full-jitter backoff** by default (AWS Architecture Blog — avoids thundering herd).
- **Typed retry predicates** — `retryIf: (err: FetchError) => err.status === 503`.
- **Deterministic mode** for tests — inject a fake clock and RNG.
- **Instrumented** — `onRetry(attempt, error, delayMs)` hook for logs and metrics.
- **ESM + CJS + `.d.ts`** — works everywhere, no build config required.

---

## 📖 Usage

### Basic — retry any async function

```ts
import { retry } from '@scope/retry';

const data = await retry(() => fetch('/api/flaky').then((r) => r.json()));
```

Defaults: 3 attempts, exponential backoff starting at 100 ms, full jitter.

### Factory — pre-configure a retryer for a whole client

```ts
import { createRetryer } from '@scope/retry';

const retryGithub = createRetryer({
  attempts: 6,
  backoff: 'exponential',
  minDelay: 250,
  maxDelay: 10_000,
  retryIf: (err) => err instanceof Response && err.status >= 500,
});

const repo = await retryGithub(() => fetch('https://api.github.com/repos/example/retry'));
const user = await retryGithub(() => fetch('https://api.github.com/users/octocat'));
```

### Advanced — cancellation, observability, and custom backoff

```ts
import { retry } from '@scope/retry';

const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000); // hard deadline

const result = await retry(
  async ({ signal, attempt }) => {
    const res = await fetch('/api/jobs/123', { signal });
    if (res.status === 429) throw Object.assign(new Error('rate limited'), { retryAfter: 2_000 });
    return res.json();
  },
  {
    attempts: 10,
    signal: controller.signal,
    backoff: (attempt, error) =>
      typeof error?.retryAfter === 'number' ? error.retryAfter : 2 ** attempt * 100,
    onRetry: (attempt, error, delayMs) => {
      logger.warn({ attempt, delayMs, err: error }, 'retrying job fetch');
    },
  },
);
```

---

## 📚 API Reference

<details>
<summary><code>retry(fn, options?)</code></summary>

Execute `fn` with retry-on-failure semantics. Returns whatever `fn` resolves to.

```ts
function retry<T>(
  fn: (ctx: { attempt: number; signal: AbortSignal }) => Promise<T>,
  options?: RetryOptions,
): Promise<T>;
```

**Options**

| Option     | Type                                                | Default         | Notes                                           |
| ---------- | --------------------------------------------------- | --------------- | ----------------------------------------------- |
| `attempts` | `number`                                            | `3`             | Total tries including the first.                |
| `backoff`  | `'exponential' \| 'linear' \| 'constant' \| Fn`     | `'exponential'` | Or `(attempt, error) => delayMs`.               |
| `minDelay` | `number`                                            | `100`           | ms — floor after jitter.                        |
| `maxDelay` | `number`                                            | `30_000`        | ms — cap per attempt.                           |
| `jitter`   | `'full' \| 'equal' \| 'none'`                       | `'full'`        | Full jitter recommended.                        |
| `retryIf`  | `(err: unknown) => boolean`                         | retry all       | Return `false` to abort immediately.            |
| `signal`   | `AbortSignal`                                       | —               | Cancels pending delays and in-flight `fn`.      |
| `onRetry`  | `(attempt, error, delayMs) => void`                 | —               | Fired before each retry (not before first try). |

</details>

<details>
<summary><code>createRetryer(defaults)</code></summary>

Returns a reusable `retry` pre-bound to shared defaults. Per-call options override.

```ts
const retryer = createRetryer({ attempts: 5, minDelay: 500 });
await retryer(fetchUser); // uses attempts: 5
await retryer(fetchUser, { attempts: 2 }); // override to 2
```

</details>

<details>
<summary><code>RetryError</code></summary>

Thrown when all attempts fail. Wraps the final error and exposes the full history.

```ts
class RetryError extends Error {
  readonly attempts: number;
  readonly cause: unknown; // last error thrown by fn
  readonly history: { attempt: number; error: unknown; delayMs: number }[];
}
```

Use `instanceof RetryError` to distinguish exhaustion from an aborted or non-retryable error.

</details>

---

## 🧰 Support Matrix

| Runtime             | Supported | Notes                                 |
| ------------------- | --------- | ------------------------------------- |
| Node.js ≥ 18        | ✓         | Native `AbortController`, ESM + CJS.  |
| Deno ≥ 1.30         | ✓         | Import via `npm:@scope/retry`.         |
| Bun ≥ 1.0           | ✓         | First-class.                          |
| Cloudflare Workers  | ✓         | No timers-beyond-request caveats.     |
| Chrome / Firefox / Safari (last 2) | ✓ | ESM build, ~1 KB minzipped. |
| React Native ≥ 0.72 | ✓         | `AbortController` polyfill not needed. |
| IE 11               | ✗         | No `AbortController`, no support.     |
| TypeScript ≥ 4.7    | ✓         | Ships `.d.ts`. Strict-mode clean.     |

---

## ⚔️ Alternatives

| Feature                   | `@scope/retry` | `p-retry` | `axios-retry` | `cockatiel` |
| ------------------------- | :-----------: | :-------: | :-----------: | :---------: |
| Zero dependencies         |       ✓       |     ~     |       ✗       |      ✗      |
| Works with any Promise    |       ✓       |     ✓     |       ✗       |      ✓      |
| `AbortSignal` native      |       ✓       |     ~     |       ✗       |      ✓      |
| Full-jitter by default    |       ✓       |     ✗     |       ✗       |      ~      |
| Typed `retryIf` predicate |       ✓       |     ~     |       ✗       |      ✓      |
| Bundle size (minzip)      |   **~1 KB**   |   ~2 KB   |     ~4 KB     |    ~9 KB    |
| Circuit breaker / bulkhead |      ✗        |     ✗     |       ✗       |      ✓      |
| Axios-coupled             |       ✗       |     ✗     |       ✓       |      ✗      |

**TL;DR** — pick `cockatiel` if you need circuit breakers and bulkheads; pick `axios-retry` if you're already committed to axios; otherwise `@scope/retry` is the smallest correct primitive.

---

## 🏗️ Advanced

### Deterministic retries in tests

```ts
import { retry, __setClock, __setRandom } from '@scope/retry/testing';

__setClock({ now: () => 0, sleep: async () => {} }); // no real delays
__setRandom(() => 0.5); // predictable jitter

await expect(retry(flakyFn, { attempts: 3 })).rejects.toThrow(RetryError);
```

### Respecting `Retry-After`

```ts
retry(fn, {
  backoff: (_, err) => {
    const header = err instanceof Response ? err.headers.get('retry-after') : null;
    return header ? Number(header) * 1000 : 2 ** _ * 100;
  },
});
```

### Extension point — custom jitter

Pass `backoff` as a function and you own the delay. Jitter is just `delay * Math.random()` — swap in a seeded PRNG for reproducible load tests.

### Gotchas

- **`fn` must be idempotent.** Retrying non-idempotent HTTP verbs (POST without idempotency keys) can duplicate side effects.
- **Don't retry 4xx**. The default `retryIf` retries everything; narrow it for REST APIs: `retryIf: (e) => e.status >= 500 || e.code === 'ECONNRESET'`.
- **`maxDelay` caps per-attempt, not total**. For a hard deadline use `signal` with a `setTimeout(abort, N)`.

---

## ❓ FAQ

**Does it retry on _any_ thrown error by default?**
Yes. Override with `retryIf` to narrow. We chose retry-all as the default because `fn` can decide what to throw.

**Why full jitter and not equal jitter?**
[AWS Architecture Blog — Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) showed full jitter minimizes contention under load. Equal is also available via `jitter: 'equal'`.

**Can I use this with `axios`, `ky`, `got`, `undici`?**
Yes — it's transport-agnostic. Wrap the call: `retry(() => axios.get(url))`. For `ky`, prefer `ky`'s built-in retry unless you need features it lacks (e.g. typed `retryIf`).

**What happens if my `fn` never settles?**
`retry` won't time it out — that's your job. Pass `signal: AbortSignal.timeout(5000)` or wire your own controller.

**Is this safe in React `useEffect`?**
Yes — pass the effect's `AbortSignal` and abort on cleanup. The pending delay is cancelled too.

**Does it support circuit breaking?**
No. That's a bigger concern — use [`cockatiel`](https://github.com/connor4312/cockatiel) and wrap this inside its policy, or keep state in your own module.

---

## 🛠️ Troubleshooting

**`Error: AbortError: The operation was aborted`**
Your `signal` fired before `fn` resolved. This is the intended behavior — catch `AbortError` separately from `RetryError`.

**Retries never happen — `attempts` seems ignored.**
Check `retryIf`. If it returns `false` for your error shape, retry aborts immediately. Log the error inside `retryIf` to verify.

**Delays feel too short or too long.**
Full jitter means the actual delay is uniformly distributed in `[minDelay, base * 2 ** attempt]`. Bump `minDelay` for a floor, or switch to `jitter: 'equal'` for tighter distribution.

**TypeScript complains about `ctx.signal` being `AbortSignal | undefined`.**
Upgrade to `@scope/retry` ≥ 2.0 — we made it non-optional. On older versions, non-null-assert after narrowing.

---

## 🤝 Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, test commands, and the commit-message convention. We label `good first issue` for newcomers.

## 🛡️ Security

Report vulnerabilities privately via the process in [SECURITY.md](./SECURITY.md). Please do not open public issues for security reports.

## 📜 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes. We follow [Semantic Versioning](https://semver.org/) and [Keep a Changelog](https://keepachangelog.com/).

## 📄 License

[MIT](./LICENSE) © Example Contributors
