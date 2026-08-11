---
name: audit-data
description: Audit a data orchestrator against its work-local authoritative specification and the canonical review taxonomy, then remediate explicitly approved gaps. Use for schema, operation, controller, testing, and data-layer quality review; keep service audits in audit-service.
model: opus
argument-hint: "<domain-name> [--work-id=<id>] [--spec=<path-or-ref>] [--operation=...] [--entity=...] [--auto-fix]"
---

# Audit Data

Audit `@theriety/data-{domain}` against the active work specification and write
evidence to canonical work-local review areas. Approved remediation routes to
`backend:build-data`.

## Boundaries

- Audit is read-only until remediation is explicitly approved.
- Specification mismatch/completeness belongs in `reviews/alignment.md`;
  independently wrong behavior in `correctness.md`; other findings route to
  `security.md`, `quality.md`, `testing.md`, `docs.md`, or `style.md`.
- Do not create a standalone aggregate audit/departures report. `review.md` is the
  concise roll-up; plan departures live in work state and change children.
- Do not mutate Notion directly. Materialization/completion route through
  Specification skills.

## Inputs

- **Required**: domain name.
- **Optional**: work id, an explicit local/remote specification source,
  operation/entity filters; `--auto-fix` accepts remediation but does not waive
  decisions that change contract, data, security, or behavior.
- **Prerequisites**: existing data package and an authoritative specification
  available from the request, active work state, a local path, or a remote ref.

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
   `specification:sync-spec`; use its exact receipt paths and frontmatter refs,
   never filename shape. Ask rather than infer an ambiguous source.
3. Read Prisma schema, operations, controller, tests, and filters. Dispatch the
   blind schema/operation/controller streams in
   [references/audit-streams.md](references/audit-streams.md), plus Coding
   semantic/security review, lint, and unused-code discovery as applicable.
4. Adversarially check and deduplicate candidates, then route each survivor to
   exactly one assigned canonical `reviews/<area>.md` file. Preserve stable
   finding IDs on rerun. Each area writer returns its path and current
   counts/deltas; it never writes `review.md`. The PM/coordinator alone
   reconciles that roll-up after all reviewers finish.
5. Track `open`, `fixed`, `acknowledged`, `deferred`, or `skipped` disposition
   per finding with rationale, owner, and recheck condition. Auto-fix marks
   eligible findings for fixing; it never silently acknowledges contract risk.
6. For accepted remediation, write a lowercase work-local
   `changes/<slug>.md` child, return PM reconciliation for `changes.md` and
   `state.md`, and invoke `backend:build-data --extend` with exact spec/finding
   pointers. Re-run affected detection and update dispositions.
7. When resolution changes the authoritative specification, use that source's
   owning authoring and synchronization mechanism. For a selected Notion-backed
   source, route authored MDC through `specification:mdc` and verified completion
   through `specification:sync-spec`; otherwise do not push review decisions to
   Notion.
8. Return explicit final paths generated or materially rewritten as
`generated_files`. Do not run file sizing; after all writers finish, the PM
checks only eligible work Markdown inside the target `.state/`.

## Verification

- All findings have evidence, stable identity, one canonical area, severity,
  disposition, and next action; returned reconciliation counts match details.
- Every fixed finding passes rerun; non-fixed findings retain owner/rationale/
  recheck state.
- Contract changes complete the verified Notion/derivation round trip.
- No worker edited PM-owned overview/state/working files; PM reconciliation and
  `generated_files` are complete.

## Completion

Report domain, work/spec receipt, scope, per-area verdicts/counts/dispositions,
remediation and contract-sync outcomes, PM reconciliation, and
`generated_files`.
