---
name: audit-service
description: Audit a backend service against its work-local authoritative specification and canonical review areas, with optional approved remediation. Use for implementation, operation completeness, documentation, semantic, security, testing, and quality audits.
model: opus
argument-hint: "<service-name> [--work-id=<id>] [--spec=<path-or-ref>] [--scope=implementation|docs|all] [--operation=...] [--area=...] [--auto-fix]"
---

# Audit Service

Audit a service against its active work specification and implementation/docs,
then route findings to the canonical review taxonomy. Approved fixes remain
with Backend/Coding owners.

## Boundaries

- Implementation scope checks manifests, handlers, declarations, tests, and
  runtime contract; docs scope checks service/operation documentation. `all`
  composes both.
- Route contract omissions/drift to `alignment.md`; semantic defects to
  `correctness.md`; remaining findings to security, quality, testing, docs, or
  style. One finding has one owner.
- Keep detail in assigned `reviews/*.md` files and return counts/deltas so the
  PM can reconcile the sibling `review.md`.
- Do not mutate code, docs, MDC, or Notion merely because a discrepancy exists.

## Inputs

- **Required**: service/package.
- **Optional**: work id, an explicit local/remote specification source,
  `--scope=implementation|docs|all` (default `all`), operation/area filters, and
  auto-fix for eligible explicitly accepted remediation.

## Workflow

1. Before creating or materially rewriting a project artifact, read the
   absolute `state.md` path injected by Essential. If unavailable,
   stop artifact writes and report the missing contract. For a direct run, run
   Essential's workspace resolver with `--work-id` only for an explicit user
   override and accept its deterministic environment, Git-branch/jj-workspace,
   or sole-existing-work match. Ask only when it returns `work_id_required`,
   using its returned candidates. A delegated run receives the explicit work
   id/root. Read only the exact work, spec, and review pointers required by this
   audit.
2. Resolve the authoritative specification from an explicit user-supplied path,
   ref, or inline contract first, then the active work-state pointer. Use local
   or inline sources directly. Only when the selected source is a Notion ref and
   the requested direction requires local materialization invoke
   `specification:sync-spec`; use its exact receipt paths and frontmatter refs.
   Ask rather than infer an unidentified or ambiguous source.
3. Apply filters before checks. Inspect implementation evidence and delegate
   generic semantic/security review to `coding:review-code`, mechanical checks
   to lint, and unused-code discovery as needed.
4. For docs scope, map declared operations to versioned documentation and
   authoritative work-spec refs. Detect missing, duplicate, orphaned, stale, or
   ambiguous pages and compare overview, signatures, inputs/outputs, errors,
   examples, ownership, status, and links.
5. Run independent blind checks in bounded parallel batches of at most ten
   resources each — the delegation standard's bound, which keeps each report
   reviewable and a failed batch cheap to retry. Independent batches dispatch
   in parallel. Adversarially validate and deduplicate candidates, route
   survivors to one assigned canonical `reviews/<area>.md` file, and preserve
   stable IDs across reruns.
6. Each area writer returns its path and current verdict/count/disposition
   deltas; it never writes `review.md`. The PM/coordinator alone reconciles that
   roll-up after all reviewers finish. Track `open`, `fixed`, `acknowledged`,
   `deferred`, or `skipped` decisions with rationale, owner, and recheck
   condition.
7. Route approved implementation fixes to `backend:build-service` or
   `coding:fix`. Route durable documentation fixes to their owning documentation
   skill. A change to a selected Notion-backed specification uses
   `specification:mdc`, then verified `specification:sync-spec` completion;
   other sources use their declared owner. Re-run affected checks and record
   before/after evidence.
8. For remediation tracking, create a lowercase work-local change child and
   return PM reconciliation for `changes.md`/`state.md`; workers do not edit
   those PM-owned files.
9. Return explicit final paths generated or materially rewritten as
`generated_files`. Do not run file sizing; the PM checks only eligible work
Markdown inside the target `.state/`.

## Verification

- Canonical review details and returned reconciliation counts agree; every
  finding has evidence, severity, disposition, and next action.
- Correctness and security evidence exist even when alignment fails.
- Fixed pages/code have content-level re-verification; exit code alone is not
  success. Contract changes have verified sync/derivation receipts.
- PM reconciliation and `generated_files` are complete.

## Completion

Return status, service/work/spec receipt, scope/filters, per-area verdicts and
dispositions, documentation page-map counts, remediation/sync verification,
PM reconciliation, and `generated_files`.
