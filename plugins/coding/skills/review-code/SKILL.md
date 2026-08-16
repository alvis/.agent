---
name: review-code
description: Review alignment, semantic correctness, security, test intent, documentation, quality, and style after code changes. Use for explicit post-implementation or pre-merge review; write canonical work-local review artifacts without editing the reviewed code.
requirements:
  intelligence: high
argument-hint: "[specifier] [--area=alignment|correctness|security|quality|testing|docs|style|all] [--work-id=<id>] [--plan=<path>] [--explain]"
---

# Review Code

Before any `jj` decision or command, follow
`coding:references/jj.md`.

Orchestrate a read-only code review and write seven canonical, lowercase review
areas beneath the active work root. Remediation belongs to
`coding:fix`; mechanical enforcement belongs to `coding:lint`.

## Boundaries

- Review post-implementation changes, PRs, or explicit scopes across alignment,
  correctness, security, quality, testing, docs, and style.
- Do not edit reviewed code, build/deploy infrastructure, review dependencies,
  or write generic root `reviews/` output.
- Reject binary-only scopes. Reject `--out` with a migration message directing
  callers to `--work-id`; review paths are contract-owned.

## Inputs

- Optional specifier: file, directory, glob, package, PR, or git range.
- Optional `--area` canonical area list (default `all`), `--work-id`,
  `--plan=<path>` only as an assertion of the active root `state.md`, and
  `--explain` for a work-local change-comprehension child.
- Require a repository checkout and an active or explicit work ID.

## State gate

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential. If unavailable, stop artifact
writes and report the missing contract. Resolve the work root before review.
Run Essential's resolver with `--work-id` only for an explicit override; accept
its deterministic match and ask only on `work_id_required`. A coordinator run
may use `state/working.md` and `state.md` to locate the plan/spec/design/review paths.
A nested run starts from its mission capsule and reads broad work memory only
for resume or cross-slice alignment. Never write work pointers or overviews.
Read the work item's `state.md` (and any `state/*.md` children) directly
before dispatch. From the task table, determine `plan_source: state.md` and
the applicable full task IDs (`task_id`); proceed on that reading — there is
no separate validation step. An explicit `--plan` or delegated plan identity
must match the report; never override or guess the canonical pointer from
directory contents.

## Output contract

<report>

- Summary: `.state/works/<work-id>/review.md`.
- Areas under `.state/works/<work-id>/reviews/`:

  | Prefix | File | Ownership |
  |---|---|---|
  | `ALIGN` | `alignment.md` | approved state/spec/design adherence and drift |
  | `CORR` | `correctness.md` | semantic behavior and failure paths |
  | `SEC` | `security.md` | trust boundaries and vulnerabilities |
  | `QUAL` | `quality.md` | structure, consistency, complexity, maintainability |
  | `TEST` | `testing.md` | behavior evidence, coverage, fixtures, reliability |
  | `DOCS` | `docs.md` | code and durable documentation accuracy |
  | `STYL` | `style.md` | repository naming and mechanical-tool results |

- Each area follows [references/review.template.md](references/review.template.md)
  and uses `open|fixed|acknowledged|deferred|skipped` finding status. IDs remain stable
  across reruns. `fixed` is closed only by verified evidence. `acknowledged`
  and `skipped` are closed non-fixed risk dispositions only with rationale,
  accountable owner, and explicit recheck condition; P0/P1 also require
  explicit risk-acceptance authority and durable evidence. `open`, `deferred`,
  and malformed risk dispositions remain outstanding and block review closure.
- The coordinator-lease holder rewrites `review.md` from every existing area
  file after writers finish. It contains overall status, all five
  disposition counts, derived `closed` and `outstanding` counts, priority
  counts for outstanding findings, one-line area headlines, paths, systemic
  patterns, and PM handback—not duplicated findings.
- With `--explain`, write a lowercase child under `changes/` using
  [references/explainer.md](references/explainer.md); return it for PM
  reconciliation of `changes.md`.

</report>

## Workflow

1. Resolve the specifier and per-area file lists through
   [references/specifier-resolution.md](references/specifier-resolution.md).
   Use root `state.md` as the only plan definition. An explicit `--plan` must
   resolve to that file. Follow only its explicit implementation-detail link,
   which may add ID-keyed procedure but cannot redefine IDs, edges,
   requiredness, targets, or acceptance mappings. Never auto-adopt another
   planning/design file.
2. Run the mandatory mechanical candidate scan described in
   [references/dispatch.md](references/dispatch.md). Candidates are advisory.
3. Dispatch one read-only reviewer per selected area in one parallel batch,
   following [references/dispatch.md](references/dispatch.md) and
   [references/mandates.md](references/mandates.md). Pass the canonical plan
   source (`state.md`) and applicable full task IDs. Each writes only its
   assigned lowercase area file and returns path, counts, context level, and
   `generated_files`.
4. Re-read `state.md` before aggregation and reject plan-definition
   drift. Validate every expected selected file, then aggregate every existing
   canonical area so a partial rerun cannot hide unselected findings; reject
   malformed disposition metadata. For every reused (unselected) area file,
   compare its `reviewed_task_defs` binding against the current definitions of
   the same `reviewed_task_ids` in `state.md`; when a task kept its ID but its
   immutable definition (summary, targets, requiredness, acceptance) changed,
   treat that area as stale — do not aggregate it as clean, and require its
   re-review before closure. Derive outstanding findings as `open`,
   `deferred`, or malformed `acknowledged`/`skipped`; derive closed findings as
   verified `fixed` plus valid `acknowledged`/`skipped`. Any outstanding P0 is
   `fail`; outstanding P1 is `requires_changes`; only outstanding P2/P3 is
   `pass_with_suggestions`; zero outstanding findings is `pass`. Every
   outstanding finding blocks review closure regardless of displayed verdict.
   If this invocation was explicitly granted the coordinator lease, rewrite
   `review.md` entirely; otherwise return the complete roll-up delta to its
   holder without writing the summary.
5. With `--explain`, generate the evidence-backed change child after review.
6. Render the final summary through
   [references/output-formats.md](references/output-formats.md). On malformed
   output, redispatch only the owning area until valid or blocked.
7. Return all changed area and optional explainer paths in `generated_files`;
   include `review.md` only when this invocation held the lease and wrote it.
Do not run file sizing; after every artifact writer returns, the PM checks only
eligible work Markdown inside the target `.state/` and coordinates a
complete split round if required.

## Verification

- Every selected area file exists, is lowercase, matches the template, and
  contains only its owned findings.
- The written `review.md`, or returned roll-up delta, matches every existing
  area file's disposition/priority counts and paths.
- Alignment used the identical pinned state/plan/spec contract expected by any
  follow-up fix; no root fallback was selected. The result binds the exact
  `plan_source: state.md` and reviewed task IDs.
- Reviewed code was not modified.

## Completion

Report area verdicts, aggregate priorities/dispositions, overall status,
`review.md` as `written` or `reconciliation_returned`, optional explainer
child, `plan_source: state.md`, reviewed task IDs, and
`generated_files`. Detailed findings remain in
area files.
