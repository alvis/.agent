---
name: modernize
description: 'Apply version-supported syntax and API upgrades based on the project runtime and toolchain. Use when replacing legacy constructs with supported modern equivalents; do not claim general refactoring, dependency upgrades, or behavioral feature work.'
requirements:
  intelligence: medium
context: fork
argument-hint: "<area> [--dry-run] [--target-version=X.Y]"
---

# Modernize

Before any `jj` decision or command, follow
`coding:references/jj.md`.

Upgrade code to the latest syntax, APIs, and patterns the project already
supports, with features discovered at runtime from the reference catalog and
gated by the detected TypeScript/Node.js versions. `coding:refactor` owns
general structural cleanup; dependency upgrades are out of scope.

<IMPORTANT>
Coherence Mandate: every edit must produce one continuous, deliberate work —
rewrite over restructure, restructure over integrate, never append. A
modernization is not a paint-over of an old idiom; the modern construct must
take the legacy one's place fully, with no `// legacy:` fallbacks, no
compatibility shims left behind once nothing calls them, and no parallel "new
path" that the rest of the module can still bypass.
</IMPORTANT>

## Boundaries

- Use for: replacing legacy constructs with modern equivalents the project's
  detected versions already support — safe, mechanical, pattern-for-pattern
  transforms.
- Do not use for: upgrading package.json dependencies or the TypeScript
  version, modifying configuration files (tsconfig.json, eslintrc, etc.),
  introducing dependencies, refactoring architecture or business logic
  (`coding:refactor`), or processing binary, gitignored, or vendor files.
  Reject configuration-file targets, areas with no valid source files,
  targets outside the project, and versions with no applicable features.

## Inputs

- **Required**: `area` — file path, directory, or glob selecting the files to
  modernize.
- **Optional**: `--dry-run` reports what would change without editing;
  `--target-version=X.Y` overrides the detected TypeScript version (useful
  for previewing upgrades before bumping the project version).

## Workflow

1. **Detect the ceiling.** From `package.json` take the TypeScript version
   (`devDependencies.typescript` or `dependencies.typescript`, range prefixes
   `^`/`~` stripped) and the minimum Node.js engine (`engines.node`, prefixes
   stripped); from `tsconfig.json` read the effective `target`, `module`, and
   `lib`, following `extends` to resolve the full config. `--target-version`
   overrides the detected TypeScript version. These values gate which
   features apply.
2. **Load the catalog.** Read `references/typescript.md` (relative to this
   skill's directory) — a compact one-line-per-feature format of `use xxx`
   entries, each pointing to an example file — and keep only entries whose
   required TypeScript version is ≤ the ceiling from step 1.
3. **Load examples.** For each applicable feature, read
   `examples/typescript/<name>.md` (filenames are version-prefixed, e.g.
   `ts50-tc39-decorators.md`) and collect its grep-compatible detection
   patterns, before/after transforms, and the edge cases where the transform
   must NOT be applied.
4. **Scan.** Grep the target area with each detection pattern; collect
   matches with file path, line number, and content; exclude matches covered
   by documented edge cases; group results by feature. If nothing matches,
   report that the area already uses modern patterns and stop.
5. **Apply.** On `--dry-run`, apply nothing: report each match's file, line,
   current pattern, proposed replacement, and motivating feature, and skip
   verification. Otherwise apply each transform through the filesystem edit capability, one file at a time
   to avoid overlapping edits, then run `npx tsc --noEmit` and the project
   test script (`npm test` or the script from `package.json`). When
   verification fails, identify the offending transform, revert it, record it
   as skipped with reason "verification failed", and re-run the checks.
   Repeat until every check passes or a concrete blocker remains, then report
   the blocker instead of looping.

## Verification

- `npx tsc --noEmit` and the project tests pass after edits (not applicable
  on `--dry-run`).
- Every applied transform corresponds to a catalog feature within the
  detected version ceiling, and no documented edge case was transformed.
- No configuration file, dependency manifest, or gitignored/vendor file was
  modified.

## Completion

Report the detected configuration (TypeScript version, target, module,
Node.js version, applicable feature count out of the catalog total), changes
applied per feature with file:line and description, changes skipped with
their reasons, items needing manual review, and the type-check and test
results. On `--dry-run`, present the same summary with proposed changes and
omit verification results.
