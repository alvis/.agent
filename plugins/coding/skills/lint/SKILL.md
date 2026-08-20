---
name: lint
description: Enforce coding standards mechanically across a selected scope with batched linters and independent reviewers. Use when source files need lint-error correction, standards enforcement, or consistent formatting, including calls extended by another plugin's portable lint profile; behavior-changing repairs belong to fix.
requirements:
  intelligence: medium
argument-hint: "[specifier] [--scope=SCOPE] [--skip-unused] [--profile=ABSOLUTE_PATH]"
---

# Linting

Before any `jj` decision or command, follow
`coding:references/jj.md`.

Set `CODING_LINT_SKILL_DIR` to the absolute directory containing this loaded
`SKILL.md` before invoking its scripts.

Apply generic coding standards mechanically. This skill owns file discovery, scope handling, batching, the generic scanner, verification, aggregation, and the final report. It does not select or dispatch framework skills; a framework plugin extends it by passing a portable profile.

## Boundaries

- Use for: mechanical standards enforcement, lint-error correction, and consistent formatting on eligible source files, with an optional pre-flight unused-code prune.
- Do not use for: modifying configuration files, installing or updating lint tooling, authoring lint rules, or processing binary, gitignored, generated, or vendor files. Behavior-changing repairs belong to `coding:fix`; structural cleanup belongs to `coding:refactor`.

## Inputs

- **Required**: none — defaults to the repository root with `--scope=uncommitted`.
- **Optional**:
  - `specifier`: file, directory, or glob.
  - `--scope`: `uncommitted` (default), `all`, or a focused section hint.
  - `--skip-unused`: bypass the pre-flight unused-code scan entirely.
  - `--profile=<absolute-path>`: internal extension contract for another plugin. Reject relative or unreadable paths.

The caller forwards its original arguments unchanged and may append one profile. Direct calls without a profile apply generic checks to every eligible source file, regardless of framework.

## Profile contract

Read the profile before discovery. A profile may narrow eligible files, add standards, add scanners, define exclusions, and supply a report label. It cannot replace generic standards, the generic scanner, verification, status semantics, or report shape.

Profile headings are declarative:

- `Eligibility`: included extensions and conditional file kinds.
- `Standards`: additional standard directories or names.
- `Scanners`: additional commands, run after the generic scanner.
- `Exclusions`: paths or file kinds removed from the candidate set.
- `Report label`: label shown in the unchanged report shape.

Fail before editing if the profile is invalid, references a missing standard/scanner, or attempts to redefine orchestration or reporting.

## Workflow

You are the lead orchestrator: coordinate, delegate, and aggregate only — never scan, lint, review, or read standard files yourself. Load [references/team-lint-cycle.md](references/team-lint-cycle.md) for the lead rules, agent pool lifecycle, per-batch task contents, the lint–review cycle, and `/goal` convergence semantics.

0. Unless `--skip-unused` is set, run the pre-flight unused-code scan: invoke `coding:find-unused` with the specifier (or repo root). Zero findings → proceed silently. Otherwise present each finding through a graphical or structured user-input tool (file:line + symbol, Remove/Keep, ≤4 questions per call, paginated), then dispatch one low-intelligence cleanup agent with the confirmed-unused list to delete precisely and report. Record scan/removed/kept counts for the final report; they never count toward `violations_found_total`. `--scope` does not apply here — dead-code detection is project-wide by nature.
1. Parse `specifier`, `--scope`, and the optional profile independently of argument order.
2. Resolve candidate files:
   - `uncommitted`: union unstaged, staged, and untracked files, then apply the specifier.
   - `all` or a custom scope: resolve the specifier directly.
   - Always exclude ignored files, dependencies, generated output, and paths outside the repository.
3. Apply profile eligibility and exclusions when supplied. Stop cleanly if no files remain.
4. Discover generic coding standards from active plugin context: collect the standard file paths listed under the "Plugin Constitution > Standards" sections of the system prompt (fall back to filesystem pattern search for `**/standards/**` when absent), select the set named by the linting Delegation Rule by matching names to filename stems (partial-stem matching tolerates renamed or split standards), and add testing standards when any target is a `*.spec.*` or `*.test.*` file. Add profile standards without replacing or duplicating generic standards. Pass standard paths to teammates as strings — the lead never reads their contents.
5. Batch related files, with at most two files per batch.
6. For each batch, delegate mechanical linting to a suitable available subagent that cannot delegate further (low-intelligence linters, max 4 concurrent — see the team reference for the full task contents and lifecycle):
   - Run `bun run ${CODING_LINT_SKILL_DIR}/../../scripts/lint_profile_runner.ts [--profile=<absolute-path>] <files>` exactly once. The runner resolves Coding resources from its installed location.
   - The runner executes the generic scanner exactly once, then each profile scanner exactly once in declared order. Profile resources resolve relative to the absolute profile path.
   - Treat scanner output as advisory; confirm candidates against the matching rule before editing.
   - Apply generic and profile standards only within the requested scope.
   - Run project lint, type, and focused test commands after edits.
   - Return `violations_found`, `status`, files changed, checks run, and remaining issues.
7. Independently review batches that changed files with two medium-intelligence reviewers per batch, repeating the fix–review round until both approve (see the team reference). Already-compliant batches need no review.
8. Aggregate batch counts and use the worst status: `failure > partial > success > compliant`.
9. Run the verification below; when a check fails, fix the cause and re-run that check. Repeat until every check passes or a concrete blocker remains, then report the blocker instead of looping.

## Verification

- Every target was eligible and inside the repository.
- The generic scanner ran once per batch; every profile scanner ran once per batch.
- Every edit is justified by a loaded rule or project tool failure.
- Relevant project checks pass, or their exact failure is reported.
- All delegated work is complete and temporary teams are shut down.

## Completion

Begin with these keys (a `/goal` evaluator reads convergence directly from them):

<report>

```yaml
violations_found_total: 0
status: compliant # compliant | success | partial | failure
```

</report>

Then report the command, the unused-code pre-flight (ran/skipped, findings/removed/kept), profile report label when present, scope, files scanned and modified, standards and scanners applied, verification commands, review coverage, agent lifecycle counts, and remaining issues. Use `compliant` only for a clean pass with no edits and `success` when violations were fixed. A caller using a profile receives this same report shape.
