# @scope/edge-cdn-stack

<br/>

📌 A Pulumi stack that provisions an AWS-backed edge CDN — CloudFront distribution, S3 origin bucket, WAF policy, and Lambda@Edge request routing — with one opinionated command per environment. It solves the "snowflake CDN" problem: web properties each roll their own mix of Terraform modules, hand-edited cache behaviours, and `aws` CLI scripts, making drift between dev/staging/prod invisible until a cache miss storm hits production.

The `@scope/edge-cdn-stack` package treats the whole delivery path as a **single declarative resource graph**: one Pulumi stack per environment, one config schema validated at `pulumi preview`, and one set of policies shared across every environment. Compared to raw Terraform it ships a strongly-typed config surface (TypeScript + Zod) and an `IaC-common` utility layer; compared to hand-rolled CDK stacks it keeps the plan/apply semantics that platform teams already run in their pipelines.

<br/>
<div align="center">

•&emsp;&emsp;🔑 [Env](#-environment-variables)&emsp;&emsp;•&emsp;&emsp;📖 [Usage](#-usage)&emsp;&emsp;•&emsp;&emsp;📚 [Outputs](#-stack-outputs)&emsp;&emsp;•&emsp;&emsp;📐 [Arch](#-architecture)&emsp;&emsp;•&emsp;&emsp;⚙️ [Ops](#operations)&emsp;&emsp;•&emsp;&emsp;📦 [Related](#-related-packages)&emsp;&emsp;•

</div>
<br/>

---

## Prerequisites

The stack targets AWS and is consumed through the Pulumi CLI. Before running any command, make sure the following are on `PATH` with compatible versions:

- **Pulumi CLI** — v3.120 or later (`pulumi version` to verify)
- **Node.js** — v22 LTS (the stack is TypeScript; earlier versions miss `node:test` assertions used in smoke tests)
- **AWS credentials** — a profile with permission to manage CloudFront, S3, WAF, Lambda@Edge, and IAM; typically exported via `AWS_PROFILE` or SSO
- **State backend** — `pulumi login` uses Pulumi Cloud by default. For self-hosted state, run `pulumi login s3://<bucket>` once per workstation.

After the one-time login every command is idempotent.

---

## 🔑 Environment Variables

### Shell environment variables

Read by the Pulumi CLI and AWS SDK at process start.

- `PULUMI_STACK`: fully-qualified stack name (e.g. `example/edge-cdn/prod`); selects the environment preset
- `AWS_REGION`: primary region for regional resources such as the origin bucket; defaults to `us-east-1` because Lambda@Edge is bound there
- `AWS_PROFILE`: named profile resolved by the AWS SDK; omit when using instance metadata or SSO
- `PULUMI_ACCESS_TOKEN`: optional; set in CI to authenticate non-interactively against Pulumi Cloud

### Pulumi config keys

Set via `pulumi config set <key> <value>` and stored in `Pulumi.<stack>.yaml`; resolved at `pulumi preview` time.

- `cdnDomain`: public domain attached to the distribution (e.g. `cdn.example.com`); an ACM cert must already exist in `us-east-1`
- `originBucket`: optional S3 bucket override; defaults to `${stackName}-origin`
- `cache.defaultTtl` / `cache.maxTtl`: default and maximum TTL for the response cache policy
- `waf.ruleset`: list of managed rule groups attached to the WebACL

### Secrets

Use `pulumi config set --secret <key> <value>` for anything sensitive (WAF IP lists, API tokens, upstream credentials). Secrets are encrypted at rest in the state backend (Pulumi Cloud or S3) and decrypted only during `pulumi up`. Never `pulumi config set` a secret without `--secret`.

---

## 📖 Usage

### Initialise and deploy

The three commands below are the full happy path. Run them from the package root; `pulumi stack init` is safe to skip if the stack already exists remotely.

```bash
pulumi stack init example/edge-cdn/dev
pulumi config set cdnDomain cdn.dev.example.com
pulumi config set originBucket example-edge-dev
pulumi up
```

```plain
$ pulumi up
Previewing update (dev):
     Type                              Name                 Plan
  +  pulumi:pulumi:Stack               edge-cdn-stack-dev   create
  +  ├─ aws:s3:Bucket                  origin               create
  +  ├─ aws:cloudfront:Distribution    edge                 create
     ...
Resources: + 8 to create

Do you want to perform this update? [yes/no/details] yes
```

Use `pulumi up --yes` in CI to skip the prompt.

A subsequent `pulumi up` is the only command needed for every change after the initial bootstrap; `pulumi destroy` tears the stack down in reverse-dependency order and is safe to re-run after a partial failure.

### Environment variants

Each environment is a named Pulumi stack with its own config. The table below lists the first-party presets shipped in `environments/`; copy one and edit to create a new tier.

| Stack | Cache TTL (default / max) | WAF ruleset | Lambda@Edge | Notes |
| --- | --- | --- | --- | --- |
| `dev` | 10s / 60s | `aws-managed-core` only | dev build | short TTLs make origin changes visible within a minute |
| `staging` | 60s / 300s | `aws-managed-core` + `bot-control` | staging build | adds bot control for load-test parity |
| `prod` | 300s / 86400s | `aws-managed-core` + `bot-control` + `ip-reputation` | prod build | conservative TTLs and full WAF stack |

### Promote a change

```bash
pulumi stack select example/edge-cdn/staging
pulumi preview --diff
pulumi up --yes
npm run smoke -- --base https://cdn.staging.example.com
```

`npm run smoke` hits the health endpoint and a small list of canary paths; it is wired into the pipeline as the gate before promotion to `prod`.

### Add a cache behaviour from code

Cache behaviours are composed as TypeScript — every override goes through the same `CachePolicy` builder so the diff produced by `pulumi preview` is meaningful. Below adds a short-TTL behaviour for `/api/*` without touching the default path.

```ts
import * as aws from '@pulumi/aws';
import { CachePolicy } from './src/resources/cache-policy';
import { EdgeDistribution } from './src/resources/edge-distribution';

const apiCache = new CachePolicy('api-cache', {
  defaultTtl: 0,
  maxTtl: 60,
  minTtl: 0,
  forwardedHeaders: ['Authorization', 'Accept-Language'],
});

export const distribution = new EdgeDistribution('edge', {
  domain: 'cdn.dev.example.com',
  bucket: 'example-edge-dev-origin',
  additionalBehaviours: [
    {
      pathPattern: '/api/*',
      cachePolicyArn: apiCache.policyArn,
      allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'POST'],
    },
  ],
});
```

### Invalidate after a deploy

Invalidations are not wired into `pulumi up` on purpose — CloudFront charges per path and invalidations should be deliberate. The snippet below is the recommended post-deploy step.

```bash
DIST_ID=$(pulumi stack output cdnDistributionId)
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths '/index.html' '/app.*.js'
```

---

## 📚 Stack Outputs

The stack exports the values below; consumer stacks read them via `pulumi.StackReference`, and CI exposes them as job outputs for downstream jobs.

| Output | Type | Description |
| --- | --- | --- |
| `cdnUrl` | `string` | fully-qualified HTTPS URL of the CloudFront distribution (e.g. `https://cdn.dev.example.com`) |
| `cdnDistributionId` | `string` | CloudFront distribution ID; used by invalidation scripts |
| `cacheARN` | `string` | ARN of the response cache policy attached to the default behaviour |
| `originBucketName` | `string` | name of the S3 origin bucket for artefact uploads |
| `originBucketArn` | `string` | ARN of the origin bucket; grant this to the CI role that uploads artefacts |
| `wafWebAclArn` | `string` | ARN of the Web ACL attached to the distribution |

Consume them from another stack:

```ts
import * as pulumi from '@pulumi/pulumi';

const edge = new pulumi.StackReference('example/edge-cdn/prod');
export const uploadBucket = edge.getOutput('originBucketName');
```

---

## 📐 Architecture

One Pulumi stack per environment composes `ComponentResource` building blocks (`src/resources`) into a single declarative graph; WAF / cache rules (`src/policies`) and Lambda@Edge handlers (`src/lambdas`) sit in reusable modules.

See [`docs/architecture/edge-cdn-stack.md`](./docs/architecture/edge-cdn-stack.md) for network topology, rollout pipeline, and `pulumi up` sequence.

---

## Operations

The stack is designed to be operated through Pulumi's standard commands; no custom CLI wraps them. The commands below are the full operational surface, in the order you are likely to need them.

| Command | Purpose |
| --- | --- |
| `pulumi preview --diff` | diff the desired graph against cloud state; safe to run from any workstation |
| `pulumi up` | apply the diff; respects Pulumi's `protect` flag on `prod` resources |
| `pulumi refresh` | reconcile local state with cloud state after out-of-band changes |
| `pulumi stack export` | dump the current state for audit or disaster-recovery tooling |
| `pulumi destroy` | tear the stack down; safe to re-run after partial failure |

### Logs and alarms

Every `ComponentResource` registers with the shared `log-group-<env>` CloudWatch log group. Lambda@Edge functions log into region-local log groups — one per edge region — which the alarm stack aggregates centrally.

### Rollback

Revert the offending commit, run `pulumi up` to re-converge, then invalidate CloudFront cache via the snippet in [Invalidate after a deploy](#invalidate-after-a-deploy). Use `pulumi stack history` to audit state changes and `pulumi stack export --version N` to recover a prior state if `up` cannot reconcile.

### Recovery

The origin bucket is versioned; artefact corruption is recovered by restoring the prior version and invalidating the CloudFront cache. Distribution drift is recovered by `pulumi refresh` followed by `pulumi up` — never by manual Console edits.

---

## Project Layout

The repository layout follows the Pulumi TypeScript convention: `Pulumi.yaml` at the root, one `Pulumi.<stack>.yaml` per environment, and TypeScript sources under `src`.

```plain
.
├── Pulumi.yaml
├── Pulumi.dev.yaml
├── Pulumi.staging.yaml
├── Pulumi.prod.yaml
├── src
│   ├── resources
│   ├── policies
│   ├── environments
│   ├── lambdas
│   └── index.ts
└── package.json
```

---

## 📦 Related Packages

- [`@scope/iac-common`](../iac-common): shared Pulumi helpers — tag composition, `ComponentResource` base class, config-schema validation; imported by every stack in this monorepo
- [`@scope/edge-policies`](../edge-policies): reusable WAF rule groups and cache policy fragments; versioned independently so stack bumps do not drag policy churn
- [`@scope/lambda-router`](../lambda-router): Lambda@Edge routing library consumed by the functions under `src/lambdas`

---

## 🛠️ Troubleshooting

- **`pulumi up` aborts with `the stack is currently locked`** — Pulumi holds a state lock in the backend (Pulumi Cloud, or the DynamoDB table when using the S3 backend) for the duration of an update. A crashed CI runner or a killed local `pulumi up` can leave the lock orphaned. Check `pulumi stack history` to confirm no update is actually in flight, then release it with `pulumi cancel` against the stack; for the S3/DynamoDB backend, delete the matching item from the lock table only after confirming no writer is active. Never run `pulumi up --force` on `prod` to bypass the lock — it bypasses the `protect` flag too.
- **Partial `pulumi up` left the stack half-applied** — the update log shows which resources were created before the failure; Pulumi records them in state so the next `pulumi up` resumes from that point, it does not retry from scratch. First run `pulumi refresh` to reconcile state with what actually landed in AWS, then `pulumi preview --diff` to inspect the remaining delta; if a resource was created in AWS but not recorded in state (typical when a Lambda@Edge replication times out), import it with `pulumi import` rather than deleting it by hand. Only fall back to `pulumi destroy` when the diff shows the stack is beyond salvage.
- **Region drift: resources exist in an unexpected region** — Lambda@Edge functions and their replicas land in `us-east-1` regardless of `AWS_REGION`; CloudFront is a global service; the origin bucket honours `AWS_REGION`. A stack deployed with the wrong `AWS_REGION` (e.g. a CI runner defaulting to `eu-west-1`) produces an origin bucket in the wrong region while the distribution still points at `us-east-1` — `pulumi refresh` will show the drift as `~` changes on `aws:s3:Bucket`. Recover by exporting the affected resources to a fresh stack in the correct region, or by using `pulumi state delete` + `pulumi import` to re-home individual resources; do not edit the Console.
- **Adopting pre-existing CloudFront/S3/WAF resources into the stack** — when migrating off a hand-rolled distribution, use `pulumi import` per resource (`pulumi import aws:cloudfront/distribution:Distribution edge E1ABCDEF`) so state picks up the live configuration without a destroy/recreate. Run `pulumi preview --diff` afterwards: any diff represents intentional config drift that `pulumi up` will reconcile on the next apply. For a whole-stack adoption, prefer an import plan file (`pulumi import -f plan.json`) so every resource lands atomically; this is the only supported path for `prod` because it keeps the `protect` flags intact.

---
