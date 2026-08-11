# @scope/queue-worker

> ARCHITECTURE = how it works. For usage, see readme.md.

<br/>

📌 **Architectural shape:** `@scope/queue-worker` is a **hexagonal (ports & adapters) microservice**. A thin domain core owns job lifecycle rules and delegates every I/O concern — durable storage, broker dispatch, admin HTTP — to a port whose implementation is chosen at boot. The core compiles with zero runtime dependencies; all vendor SDKs (`pg`, `mysql2`, `ioredis`, `amqplib`) live behind adapter packages.

**Why this shape:** background workers accrete tribal knowledge fast — one team picks Redis + BullMQ, another picks Postgres-only polling, a third wants SQLite for local development. Treating storage and dispatch as independent ports means the domain rules (idempotency, retry, at-least-once delivery, safe drain) are written once and audited in one place, while the integration-testing surface shrinks to a single contract test per adapter. The public API described in [`readme.md`](../../readme.md) is the narrowest possible surface that still expresses these rules.

<br/>
<div align="center">

•&emsp;&emsp;🌐 [Context](#-system-context)&emsp;&emsp;•&emsp;&emsp;🗂️ [Modules](#-module-topology)&emsp;&emsp;•&emsp;&emsp;🔄 [Flow](#-data-flow)&emsp;&emsp;•&emsp;&emsp;🔁 [Cycle](#-state--lifecycle)&emsp;&emsp;•&emsp;&emsp;🗃️ [Model](#-data-model)&emsp;&emsp;•&emsp;&emsp;🛡️ [Rules](#-invariants--contracts)&emsp;&emsp;•

</div>
<br/>

---

## 💡 Core Concepts

The six abstractions below are the entire vocabulary of the worker. Everything in the source tree is collaboration between them; if a contributor understands these, the rest reads as glue.

| Concept | Role | Defined In |
| --- | --- | --- |
| `Job` | durable record of work to do; has `kind`, `payload`, `status`, `idempotencyKey` | `src/domain/job.ts` |
| `Attempt` | one execution of a job; carries `startedAt`, `endedAt`, `error`, `durationMs` | `src/domain/attempt.ts` |
| `Handler` | user-registered function that executes a specific `kind`; receives typed payload and `JobContext` | `src/domain/handler.ts` |
| `JobAdapter` | port for durable storage; implementations talk to Postgres, MySQL, SQLite, or memory | `src/adapters/job-adapter.ts` |
| `BrokerAdapter` | port for dispatch hints; Redis streams, RabbitMQ, or memory | `src/adapters/broker-adapter.ts` |
| `IdempotencyKey` | optional unique tag on a `Job`; second enqueue with the same key returns the first job | `src/domain/idempotency.ts` |

The **job lifecycle** is: `queued → running → {succeeded | failed | retrying}` with a terminal `dead_letter` for exhausted retries. The **adapter contract** promises at-least-once delivery — handlers must be idempotent, and the `idempotencyKey` is the seam that makes this cheap.

---

## 🌐 System Context

The worker sits between producer services (which enqueue jobs over HTTP or in-process) and downstream systems (which the handlers call). Storage and broker are the only stateful external dependencies; everything else is ephemeral.

```mermaid
block-beta
  columns 5
  Client["HTTP Client"]:1
  space:1
  API["Admin API"]:1
  space:1
  Worker["Worker Runtime"]:1

  space:5

  space:1
  DBAdapter["JobAdapter"]:1
  space:1
  BrokerAdapter["BrokerAdapter"]:1
  space:1

  space:5

  space:1
  DB[("Postgres / MySQL / SQLite")]:1
  space:1
  Broker[("Redis / RabbitMQ / memory")]:1
  space:1

  Client --> API
  API --> Worker
  Worker --> DBAdapter
  Worker --> BrokerAdapter
  DBAdapter --> DB
  BrokerAdapter --> Broker
```

---

## 🗂️ Module Topology

```plain
src
├── api         # fastify admin HTTP surface
│   ├── routes  # /jobs, /health, /admin/drain
│   └── server.ts
├── worker      # pull loop, lease, drain coordination
│   ├── worker.ts
│   ├── lease.ts
│   └── health.ts
├── adapters    # port interfaces and built-in implementations
│   ├── job-adapter.ts
│   ├── broker-adapter.ts
│   ├── postgres
│   ├── mysql
│   ├── sqlite
│   └── memory
├── domain      # pure lifecycle rules, no I/O
│   ├── job-service.ts
│   ├── handler-registry.ts
│   ├── retry-policy.ts
│   └── idempotency.ts
└── index.ts    # public barrel
```

| Module | Path | Responsibility | Key Exports |
| --- | --- | --- | --- |
| `api` | `src/api` | expose admin endpoints over HTTP | `createAdminServer` |
| `worker` | `src/worker` | run the pull loop, manage leases and drain | `Worker`, `createWorker` |
| `adapters` | `src/adapters` | define ports and ship built-in implementations | `JobAdapter`, `BrokerAdapter` |
| `domain` | `src/domain` | enforce lifecycle rules with zero I/O | `JobService`, `HandlerRegistry` |

---

## 🧩 Component Architecture

`JobService` is the only component that sees the whole lifecycle; it composes a `JobAdapter` for durability, a `HandlerRegistry` for dispatch, and a `RetryPolicy` for attempt scheduling. `Worker` wraps `JobService` with a pull loop and a `BrokerAdapter` for low-latency dispatch.

```mermaid
classDiagram
    class Worker {
        -service: JobService
        -broker: BrokerAdapter
        -concurrency: number
        +start() Promise~void~
        +drain(graceMs) Promise~void~
        +health() HealthReport
    }
    class JobService {
        -store: JobAdapter
        -handlers: HandlerRegistry
        -retry: RetryPolicy
        +enqueue(input) Promise~Job~
        +ack(id, result) Promise~void~
    }
    class HandlerRegistry {
        -handlers: Map
        +register(kind, fn) void
        +run(job) Promise~unknown~
    }
    class HealthChecker {
        -store: JobAdapter
        -broker: BrokerAdapter
        +check() HealthReport
    }
    class AdapterRegistry {
        +resolveStore(url) JobAdapter
        +resolveBroker(url) BrokerAdapter
    }

    Worker --> JobService : delegates
    Worker --> HealthChecker : owns
    JobService --> HandlerRegistry : dispatches
    Worker --> AdapterRegistry : bootstraps via
```

| Component | File | Role | Collaborators |
| --- | --- | --- | --- |
| `Worker` | `src/worker/worker.ts` | pull loop, concurrency, drain | `JobService`, `BrokerAdapter` |
| `JobService` | `src/domain/job-service.ts` | enforces lifecycle rules | `JobAdapter`, `HandlerRegistry`, `RetryPolicy` |
| `HandlerRegistry` | `src/domain/handler-registry.ts` | typed dispatch table | `Handler` |
| `HealthChecker` | `src/worker/health.ts` | aggregate adapter status | `JobAdapter`, `BrokerAdapter` |
| `AdapterRegistry` | `src/adapters/registry.ts` | URL → adapter resolution at boot | — |

---

## 🔄 Data Flow

The sequence below shows a successful enqueue-through-ack. Producer and worker may run in the same process or on different hosts; the flow is identical.

```mermaid
sequenceDiagram
    participant Producer
    participant JobService
    participant Store as JobAdapter
    participant Broker as BrokerAdapter
    participant Worker
    participant Handler

    Producer->>JobService: enqueue(input)
    JobService->>Store: insert(job)
    Store-->>JobService: job
    JobService->>Broker: notify(jobId)
    JobService-->>Producer: job

    Broker-->>Worker: jobId
    Worker->>Store: leaseNext(workerId)
    Store-->>Worker: job
    Worker->>Handler: run(payload, context)
    Handler-->>Worker: result
    Worker->>Store: ack(job.id, 'succeeded')
    Store-->>Worker: ok
```

---

## 🔁 State & Lifecycle

Every job is modelled as a small state machine. Transitions are gated by `JobService` so the set of legal moves is centralised; adapters never mutate state directly.

```mermaid
stateDiagram-v2
    [*] --> queued
    queued --> running: worker leased
    running --> succeeded: handler resolved
    running --> retrying: handler rejected & attempts < max
    running --> failed: handler rejected & attempts == max
    retrying --> queued: backoff elapsed
    failed --> dead_letter: DLQ handler registered
    succeeded --> [*]
    failed --> [*]
    dead_letter --> [*]
```

---

## 🗃️ Data Model

The schema is four tables; there are no cross-table joins in the hot path, so every supported database reaches comparable throughput.

```mermaid
erDiagram
    JOB ||--o{ ATTEMPT : has
    JOB }o--|| HANDLER : dispatched_to
    JOB ||--o| DEAD_LETTER : terminates_as

    JOB {
        uuid id PK
        string kind
        json payload
        string status
        string idempotencyKey
        datetime runAt
        datetime createdAt
        int attemptCount
    }
    ATTEMPT {
        uuid id PK
        uuid jobId FK
        int index
        datetime startedAt
        datetime endedAt
        string error
        int durationMs
    }
    HANDLER {
        string kind PK
        int maxAttempts
        string backoff
        string schemaHash
    }
    DEAD_LETTER {
        uuid id PK
        uuid jobId FK
        datetime terminatedAt
        string reason
    }
```

---

## 🧩 Adapter Interface

Every storage adapter implements the same `JobAdapter` contract. The interface is nine methods; built-in implementations inherit from nothing, composition only.

```mermaid
classDiagram
    class JobAdapter {
        <<interface>>
        +insert(job: NewJob) Promise~Job~
        +leaseNext(workerId, visibilityMs) Promise~Job~
        +ack(id, result) Promise~void~
        +fail(id, error) Promise~void~
        +findById(id) Promise~Job~
        +findByIdempotencyKey(key) Promise~Job~
        +recordAttempt(attempt) Promise~void~
        +listDeadLetters(limit) Promise~Job[]~
        +ping() Promise~HealthReport~
    }
    class PostgresJobAdapter {
        -pool: Pool
        +insert(job) Promise~Job~
        +leaseNext(workerId, ms) Promise~Job~
    }
    class MySQLJobAdapter {
        -pool: Pool
        +insert(job) Promise~Job~
        +leaseNext(workerId, ms) Promise~Job~
    }
    class SQLiteJobAdapter {
        -db: Database
        +insert(job) Promise~Job~
        +leaseNext(workerId, ms) Promise~Job~
    }

    PostgresJobAdapter ..|> JobAdapter
    MySQLJobAdapter ..|> JobAdapter
    SQLiteJobAdapter ..|> JobAdapter
```

---

## 🧠 Design Patterns

| # | Pattern | Intent | Implemented In |
| --- | --- | --- | --- |
| 1 | Ports & Adapters (Hexagonal) | isolate lifecycle rules from storage and broker concerns so the core tests stay I/O-free | `src/domain`, `src/adapters` |
| 2 | Strategy | swap retry shape (`exponential`, `linear`, `fixed`) without touching the worker | `src/domain/retry-policy.ts` |
| 3 | Circuit Breaker | stop hammering a broker that has been failing for `resetMs` so restart storms cannot form | `src/worker/broker-breaker.ts` |
| 4 | Registry | resolve `QUEUE_DB_URL` to the correct adapter and cache the instance for the process lifetime | `src/adapters/registry.ts` |
| 5 | Lease | cooperative visibility timeout gives crashed workers' jobs back to the pool without global locks | `src/worker/lease.ts` |

---

## 🔌 Extension Points

The worker is explicitly designed to be extended by dropping a new adapter or handler into place. All extension seams are typed and covered by shared contract tests.

| Extension | Steps | Files Touched | Tests |
| --- | --- | --- | --- |
| Add a new `JobAdapter` | 1. implement the nine-method `JobAdapter` interface 2. add the URL scheme to `AdapterRegistry.resolveStore` 3. run the shared contract test suite | `src/adapters/<name>`, `src/adapters/registry.ts` | `spec/contract/job-adapter.spec.ts` |
| Add a new `BrokerAdapter` | 1. implement `publish` and `subscribe` 2. add the URL scheme to `AdapterRegistry.resolveBroker` 3. run the shared contract test suite | `src/adapters/<name>`, `src/adapters/registry.ts` | `spec/contract/broker-adapter.spec.ts` |
| Add a new Handler | 1. call `defineJob` with a Zod schema 2. call `worker.register(def, fn)` 3. add a spec driving the handler | `<consumer>/jobs/<kind>.ts` | `<consumer>/jobs/<kind>.spec.ts` |

---

## 🛡️ Invariants & Contracts

| # | Rule | Why | Enforced By |
| --- | --- | --- | --- |
| 1 | every `Job` is persisted before any broker notification fires | a broker crash between `notify` and `insert` would lose the job | transactional boundary in `JobService.enqueue` + integration test |
| 2 | handlers run under at-least-once semantics; consumers must be idempotent | leases can expire under GC pauses and be re-delivered | documented in `JobContext`; `idempotencyKey` column + unique index |
| 3 | lifecycle transitions only happen inside `JobService` | scattered state updates produce ghost states that are impossible to reason about | `JobAdapter` has no generic `setStatus` / `update` method; status transitions happen only via the specific verbs `insert`, `ack`, `fail`, `recordAttempt` |
| 4 | drain never cancels in-flight handlers before `graceMs` elapses | cutting a running handler leaves the downstream in an unknown state | timer + `AbortSignal` wired in `Worker.drain` |
| 5 | adapter `ping()` is side-effect-free | `/health` is called frequently and must not perturb the system | contract test forbids writes during `ping()` |

### Concurrency & Back-pressure

`QUEUE_CONCURRENCY` gates both the pull rate and the count of inflight handlers — the worker will not lease a new job while `inflight >= QUEUE_CONCURRENCY`. The circuit breaker (Design Pattern #3) trips the `BrokerAdapter` on repeated failures so restart storms cannot form; pulls pause until the breaker resets. Drain composes cleanly with concurrency: `Worker.drain` stops new pulls immediately, and the concurrency cap continues to apply to in-flight handlers so the invariants above never violate during shutdown.

---

## 📊 Observability

Every production deployment exposes the same three signal surfaces; dashboards and alerts can therefore be built once and reused across adapters.

### Metrics

Prometheus-compatible names; all metrics carry `kind`, `adapter`, and `workerId` labels unless noted.

| Kind | Name | Purpose |
| --- | --- | --- |
| counter | `queue_jobs_enqueued_total` | jobs accepted by `JobService.enqueue` |
| counter | `queue_jobs_succeeded_total` | handler resolutions |
| counter | `queue_jobs_failed_total` | terminal failures after retries exhausted |
| counter | `queue_jobs_retried_total` | scheduled retry attempts |
| histogram | `queue_job_duration_seconds` | handler wall-clock time |
| histogram | `queue_job_latency_seconds` | enqueue-to-start latency |
| gauge | `queue_inflight` | handlers currently running on this worker |
| gauge | `queue_depth` | visible `queued` rows per `kind` |

### Log fields

Every log line emitted by the runtime is JSON with at least these keys: `jobId`, `kind`, `attempt`, `workerId`, `adapter`, `latencyMs`, `outcome`. The `outcome` field takes one of `succeeded | retrying | failed | dead_letter`.

### Trace spans

OpenTelemetry spans are emitted per phase; the parent span carries `jobId` so the whole lifecycle stitches together in a trace backend:

- `queue.enqueue` — producer-side insertion (child of the HTTP span that triggered it)
- `queue.lease` — worker pull + visibility lease
- `queue.handler` — user handler execution
- `queue.ack` — status transition + adapter write

---

## 🚢 Deployment Topology

The worker runtime is stateless; all state lives in the `JobAdapter`. Horizontal scale is achieved by running N identical replicas that all point at the same database; an optional broker fans dispatch hints out so replicas do not need to poll.

```mermaid
block-beta
  columns 5
  W1["Worker #1"]:1
  W2["Worker #2"]:1
  W3["Worker #3"]:1
  space:1
  WN["Worker #N"]:1

  space:5

  space:1
  space:1
  DB[("Shared DB")]:1
  space:1
  Broker[("Broker (optional)")]:1

  W1 --> DB
  W2 --> DB
  W3 --> DB
  WN --> DB
  W1 --> Broker
  W2 --> Broker
  W3 --> Broker
  WN --> Broker
```

**Scale properties:**
- any replica can lease any job; the visibility lease prevents double-execution
- adding replicas increases throughput until DB connection pool or broker becomes the bottleneck
- rolling deploys drain each replica via `SIGTERM` → `Worker.drain(graceMs)` before terminating

**Single-writer caveat:** the `@scope/adapter-sqlite` adapter serialises all writes through one file; running more than one replica against the same SQLite file will contend on the write lock. Use SQLite only for local development or single-replica deployments; use Postgres or MySQL for horizontal scale.

---

## 📦 Related Packages

- [`@scope/queue-client`](../queue-client): thin enqueue-only client for services that should not embed the worker runtime
- [`@scope/adapter-postgres`](../adapter-postgres): first-party `JobAdapter` implementation; reference for new adapters
- [`@scope/adapter-redis-broker`](../adapter-redis-broker): first-party `BrokerAdapter` implementation
- [`@scope/retry`](../retry): underlying retry engine reused by `RetryPolicy`

---
