# @scope/queue-worker

> README = how to run it. For design rationale, see [`docs/architecture/durable-job-worker.md`](./docs/architecture/durable-job-worker.md).

<br/>

📌 A horizontally-scalable background job runner for TypeScript services that turns ad-hoc cron scripts and in-process `setInterval` loops into a uniform, observable work queue. It solves the "background job drift" problem: every team writes their own half-correct worker with different retry semantics, different idempotency stories, and different ways to drain safely during deploys.

The `@scope/queue-worker` package centres job execution around a **pluggable adapter pair** — one `JobAdapter` for durable storage (Postgres / MySQL / SQLite) and one `BrokerAdapter` for dispatch (Redis / RabbitMQ / in-memory) — driven by a small hexagonal core. Compared to BullMQ it is broker-agnostic and ships a Postgres-only mode for teams who do not want a Redis dependency; compared to Agenda it exposes the adapter contract as a first-class extension seam so new stores can land in under 200 lines.

<br/>
<div align="center">

•&emsp;&emsp;💡 [Concept](#-core-concept)&emsp;&emsp;•&emsp;&emsp;🚀 [Start](#-quick-start)&emsp;&emsp;•&emsp;&emsp;🔑 [Env](#-environment-variables)&emsp;&emsp;•&emsp;&emsp;📖 [Usage](#-usage)&emsp;&emsp;•&emsp;&emsp;📚 [API](#-api-reference)&emsp;&emsp;•&emsp;&emsp;📐 [Arch](#-architecture)&emsp;&emsp;•

</div>
<br/>

---

## 💡 Core Concept

The worker is a **hexagonal runtime** (`ports & adapters`): the domain core owns job lifecycle rules, and every I/O concern is a pluggable port. Every job flows through the same five phases in the same order, so observability, retries, and draining are uniform across adapters:

1. **Enqueue** (via `JobService.enqueue`) so that a job is persisted with an `idempotencyKey` before a broker ever sees it — the queue survives a broker outage
2. **Dispatch** (via `Worker.pullNext`) so that the broker hands back one job at a time with a visibility lease; in-memory mode short-circuits directly through the `JobAdapter`
3. **Execute** (via `HandlerRegistry.run`) so that the registered handler for the job `kind` runs with a typed payload and a structured `JobContext`
4. **Acknowledge** (via `JobService.ack`) so that success marks the job `succeeded` and failure records an `Attempt` before the retry policy decides the next state
5. **Drain** (via `Worker.drain`) so that `SIGTERM` stops new pulls and waits for in-flight handlers to finish within a bounded grace period

Because storage and dispatch are decoupled, you can run a Postgres-backed queue with no broker at all (polling mode), or pair Postgres with RabbitMQ for low-latency dispatch, or run an in-memory adapter for tests — the handler code does not change. The deeper rationale and diagrams live in [`docs/architecture/durable-job-worker.md`](./docs/architecture/durable-job-worker.md).

---

## 🔑 Environment Variables

The worker reads its configuration from the process environment so that the same binary runs in every stage without rebuilds. All values are validated at boot; an invalid value aborts startup with a descriptive error.

- `QUEUE_DB_URL`: connection string for the chosen `JobAdapter` (e.g. `postgres://user:pass@host/db`); required
- `QUEUE_BROKER_URL`: connection string for the `BrokerAdapter`; set to `memory://` to disable broker dispatch and fall back to DB polling
- `QUEUE_CONCURRENCY`: maximum number of handlers to run in parallel per worker process; defaults to `8`
- `QUEUE_POLL_INTERVAL_MS`: DB polling interval when running without a broker or when recovering stuck jobs; defaults to `2000`
- `QUEUE_VISIBILITY_MS`: lease duration for an in-flight job before it becomes visible again; defaults to `60000`
- `QUEUE_SHUTDOWN_GRACE_MS`: maximum wait during drain before in-flight handlers are cancelled; defaults to `30000`
- `QUEUE_LOG_LEVEL`: log verbosity (`trace|debug|info|warn|error`); defaults to `info`
- `QUEUE_METRICS_PORT`: Prometheus scrape port; set to `0` to disable; defaults to `9090`
- `QUEUE_WORKER_ID`: unique worker identifier surfaced in logs and metrics; defaults to `hostname`

---

## 🚀 Quick Start

Install the package and run the bundled migrations against the target database, then start the worker with a minimal configuration.

```bash
npm install @scope/queue-worker @scope/adapter-postgres
npx queue-worker migrate --url "$QUEUE_DB_URL"
npx queue-worker start
```

For a code-first startup — which is the recommended path in most services — register handlers and start the worker from your own entrypoint:

```ts
import { createWorker } from '@scope/queue-worker';
import { postgresAdapter } from '@scope/adapter-postgres';

const worker = createWorker({
  store: postgresAdapter({ url: process.env.QUEUE_DB_URL! }),
  broker: 'memory',
  concurrency: 8,
});

worker.register('send-email', async (payload: { to: string }) => {
  await fetch('https://mail.example.com', { method: 'POST', body: JSON.stringify(payload) });
});

await worker.start();
```

---

## 📖 Usage

### Example: Enqueue a job from an HTTP handler

Producers talk to the queue through `JobClient`, which validates the payload against the registered handler's schema and writes the job durably before returning.

```ts
import { createJobClient } from '@scope/queue-worker';
import { postgresAdapter } from '@scope/adapter-postgres';

const jobs = createJobClient({
  store: postgresAdapter({ url: process.env.QUEUE_DB_URL! }),
});

await jobs.enqueue({
  kind: 'send-email',
  payload: { to: 'alice@example.com', subject: 'Welcome' },
  idempotencyKey: `welcome:${userId}`,
  runAt: new Date(Date.now() + 60_000),
});
```

### Example: Register a typed handler with backoff

Handlers are registered once at startup; the type of `payload` is inferred from the Zod schema passed to `defineJob`, so producers and consumers cannot drift.

```ts
import { createWorker, defineJob } from '@scope/queue-worker';
import { postgresAdapter } from '@scope/adapter-postgres';
import { z } from 'zod';

const sendEmail = defineJob({
  kind: 'send-email',
  schema: z.object({ to: z.string().email(), subject: z.string() }),
  retry: { maxAttempts: 5, backoff: 'exponential' },
});

const worker = createWorker({
  store: postgresAdapter({ url: process.env.QUEUE_DB_URL! }),
  broker: 'memory',
});

worker.register(sendEmail, async ({ payload, attempt }) => {
  await fetch('https://mail.example.com', {
    method: 'POST',
    body: JSON.stringify({ ...payload, attempt }),
  });
});

await worker.start();
```

### Example: Health check endpoint for Kubernetes

The worker exposes a lightweight HTTP probe suitable for liveness and readiness checks; a failing adapter fails the probe so the pod is restarted or removed from the service pool.

```ts
import { createWorker } from '@scope/queue-worker';
import { postgresAdapter } from '@scope/adapter-postgres';
import { createServer } from 'node:http';

const worker = createWorker({
  store: postgresAdapter({ url: process.env.QUEUE_DB_URL! }),
  broker: process.env.QUEUE_BROKER_URL!,
});

await worker.start();

createServer(async (_req, res) => {
  const health = await worker.health();
  res.statusCode = health.status === 'ok' ? 200 : 503;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(health));
}).listen(8080);
```

---

## 📚 API Reference

### HTTP Endpoints

The admin HTTP surface is disabled by default and must be opted in via `worker.admin({ port })`. The table below lists every endpoint the worker exposes when enabled.

| Method | Path | Purpose | Request Body | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/jobs` | enqueue a new job (alternative to `JobClient.enqueue`) | `{ kind, payload, idempotencyKey?, runAt? }` | `201 { id, status }` |
| `GET` | `/jobs/:id` | fetch the current state of a job including its attempt history | — | `200 { id, status, attempts[] }` |
| `GET` | `/health` | liveness + readiness probe; checks adapter connectivity | — | `200 { status: 'ok' }` or `503 { status, failing[] }` |
| `POST` | `/admin/drain` | stop pulling new jobs and drain in-flight handlers with the configured grace window | `{ graceMs?: number }` | `202 { draining: true }` |

### Core Functions

<details>
<summary><code>createWorker(config: WorkerConfig): Worker</code></summary>

**Description:**
Constructs a `Worker` bound to the chosen adapters. Does not open connections until `.start()` is called, so tests can assert configuration eagerly without side effects.

**Parameters:**

- `config` (`WorkerConfig`): the store adapter, broker adapter (or `'memory'`), concurrency, and shutdown grace window

**Returns:**

- `Worker`: exposes `register`, `start`, `drain`, `health`, and `admin`

**Example:**

```ts
import { createWorker } from '@scope/queue-worker';
import { postgresAdapter } from '@scope/adapter-postgres';

const worker = createWorker({
  store: postgresAdapter({ url: process.env.QUEUE_DB_URL! }),
  broker: 'memory',
});
```

</details>

<details>
<summary><code>defineJob&lt;S extends ZodSchema&gt;(spec: JobSpec&lt;S&gt;): JobDefinition&lt;S&gt;</code></summary>

**Description:**
Declares a job `kind` with its payload schema and retry policy. The returned definition is shared between producer and consumer so payload types cannot drift.

**Parameters:**

- `spec.kind` (`string`): globally unique job name; becomes the discriminator in the `jobs` table
- `spec.schema` (`ZodSchema`): validates the payload at both enqueue and execute time
- `spec.retry` (`RetryPolicy`, optional): maximum attempts and backoff shape; defaults to 5 attempts, exponential

**Returns:**

- `JobDefinition<S>`: value passed to both `JobClient.enqueue` and `Worker.register`

</details>

---

## 🧰 Support Matrix

The worker is only as capable as the adapter pair you plug in. The matrix below is the authoritative feature map for every first-party adapter shipped in this repo. Adapters published separately should include their own row in their README and link back here.

| Adapter | Batch processing | Streaming | Transactional | Delay support | Priority queue |
| --- | --- | --- | --- | --- | --- |
| `@scope/adapter-postgres` | ✅ | ⚠️ via `LISTEN/NOTIFY` | ✅ | ✅ | ✅ |
| `@scope/adapter-mysql` | ✅ | ❌ | ✅ | ✅ | ⚠️ single-tier only |
| `@scope/adapter-sqlite` | ⚠️ single-writer | ❌ | ✅ | ✅ | ❌ |
| `@scope/adapter-redis-broker` | ✅ | ✅ | ❌ | ✅ | ✅ |
| `@scope/adapter-rabbitmq-broker` | ✅ | ✅ | ⚠️ publisher confirms | 🔜 | ✅ |
| `@scope/adapter-memory-broker` | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ supported &nbsp; ⚠️ partial &nbsp; ❌ unsupported &nbsp; 🔜 planned

---

## 📐 Architecture

A hexagonal runtime: a domain core (`src/domain`) drives every job, with storage and dispatch swapped behind `JobAdapter` / `BrokerAdapter` ports (`src/adapters`); `src/worker` owns the pull loop and draining.

See [`docs/architecture/durable-job-worker.md`](./docs/architecture/durable-job-worker.md) for adapter contracts, deployment topology, and state machine.

---

## 📦 Related Packages

- [`@scope/queue-client`](../queue-client): browser-and-server-safe client for enqueuing jobs without pulling in the worker runtime — use this from edge functions and HTTP handlers
- [`@scope/adapter-postgres`](../adapter-postgres): first-party `JobAdapter` implementation backed by `pg`; the recommended default for most teams
- [`@scope/adapter-redis-broker`](../adapter-redis-broker): first-party `BrokerAdapter` backed by Redis streams; pairs with any `JobAdapter`
- [`@scope/retry`](../retry): underlying retry engine reused for attempt scheduling and classifier logic

---

## ❓ FAQ

**Q: How does the admin HTTP surface authenticate callers?**
A: The admin surface is disabled by default; `worker.admin({ port })` accepts a `verify(req)` hook that returns the caller identity or rejects the request. In our reference deployment, the hook validates a short-lived service-to-service JWT minted by the platform's auth gateway — the worker itself never sees long-lived credentials. `/health` is the only endpoint exempt from the hook so liveness probes do not need a token; `/jobs`, `/jobs/:id`, and `/admin/drain` all require a valid principal.

**Q: Are there rate limits on `JobClient.enqueue` or the `POST /jobs` endpoint?**
A: The worker does not impose a fixed RPS limit; throughput is gated by the `JobAdapter` write path (for `@scope/adapter-postgres`, that is a single `INSERT ... RETURNING`). In practice we recommend callers keep enqueue concurrency below `QUEUE_CONCURRENCY` on the writer side, and lean on the broker's backpressure — `@scope/adapter-redis-broker` will reject enqueues once its stream depth exceeds the configured high-water mark, surfacing as a typed `QueueBackpressureError`.

**Q: When is the `idempotencyKey` required and how is it enforced?**
A: It is optional but strongly recommended for anything triggered from an HTTP handler or webhook. When present, the store enforces a unique constraint over `(kind, idempotencyKey)`; a duplicate enqueue returns the existing job rather than creating a second row, so retried producers cannot double-dispatch. The key is also surfaced in structured logs and in the `attempts[]` response so operators can trace a user action through every retry.

**Q: How do correlation IDs flow through the five-phase lifecycle?**
A: Every `JobContext` exposes a `traceId` and `spanId` derived from the enqueue-time headers (W3C `traceparent` if present, otherwise a fresh ULID). The same IDs are stamped on every log line emitted during execute, on the `Attempt` row written at ack, and on Prometheus exemplars attached to the `queue_job_duration_seconds` histogram — so a single request ID can be followed from the producer through every retry without bespoke glue.

**Q: What is the versioning policy for job kinds and payload schemas?**
A: Job kinds are part of the public API — renaming one is a breaking change. To evolve a payload, bump the `kind` (e.g. `send-email` → `send-email.v2`) and register both handlers during the transition; `defineJob` uses the Zod schema passed in, so old in-flight jobs keep validating against the old schema while new enqueues use the new one. We follow semver at the package level: adapter changes that alter on-disk layout are major bumps and ship with a `npx queue-worker migrate` step.

---

## 🛠️ Troubleshooting

- **Worker aborts at boot with an env-validation error** — every `QUEUE_*` variable is validated at startup; an invalid value (unparseable URL, non-numeric `QUEUE_CONCURRENCY`, missing `QUEUE_DB_URL`) exits non-zero with a descriptive message pointing at the offending key. Re-check the variable against the [Environment Variables](#-environment-variables) list, and remember that `QUEUE_BROKER_URL=memory://` is required — not "empty" — to disable broker dispatch.
- **`EADDRINUSE` on the metrics port or admin port** — `QUEUE_METRICS_PORT` defaults to `9090` and the admin server takes whatever you passed to `worker.admin({ port })`. In local dev a prior worker process or a stray Prometheus scraper often holds the port. Either set `QUEUE_METRICS_PORT=0` to disable metrics scrape entirely, pick a free port, or kill the holder with `lsof -i :9090`.
- **`/health` returns 503 with `failing: ['broker']` or `failing: ['store']`** — the probe reports the adapter that failed its connectivity check. For the Postgres store this usually means the `pg` pool cannot reach the DB (check `QUEUE_DB_URL`, security group, SSL mode); for the Redis broker it usually means TLS or AUTH mismatch. The worker keeps pulling queued jobs via DB polling while the broker is unhealthy, so `/health` flipping to 503 does not imply a full outage — it is a readiness signal for the load balancer.
- **Postgres connection pool exhaustion (`timeout exceeded when trying to connect`)** — the default `pg` pool is 10 connections per worker; a high `QUEUE_CONCURRENCY` plus a long-running handler can starve enqueue calls. Either lower `QUEUE_CONCURRENCY`, raise the pool size via the adapter's `pool: { max }` option, or move read-only queries off the worker's pool. Our standard alarm fires when `pg_pool_waiting` stays above zero for more than 60 seconds — that is the early warning before requests start timing out.

---
