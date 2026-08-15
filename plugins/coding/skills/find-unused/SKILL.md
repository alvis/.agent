---
name: find-unused
description: Perform read-only dead-code discovery for commented-out code, unused symbols, and unused test helpers. Use when identifying removal candidates; report evidence without deleting, refactoring, linting, or otherwise modifying the inspected source.
model: opus
argument-hint: "[path/to/scan] [--exclude=pattern]"
---

# Find Unused Code

Before any `jj` decision or command, follow
`coding:references/jj.md`.

Own read-only dead-code discovery: commented-out code blocks, unused exports
and symbols, unused test helpers, and production code referenced only by
tests. Removal belongs to the caller — `coding:lint` runs this skill as its
pre-flight and handles user-confirmed deletion.

## Boundaries

- Use for: identifying removal candidates with file:line evidence across a
  path, directory, or glob; LSP-backed unused-symbol analysis; commented-out
  code detection; finding orphaned fixtures, mocks, and test helpers.
- Do not use for: deleting or modifying code (report only; `coding:lint` owns
  confirmed removal), running tests, refactoring (`coding:refactor`), or
  scanning binary and non-code files.

## Inputs

- **Required**: none — defaults to the current directory.
- **Optional**: a path, directory, or glob to scan; `--exclude=pattern` to
  drop matching files from analysis.

## Workflow

1. Validate the target path exists; reject missing paths and binary or
   non-code targets with a clear message and a suggested correction. Discover
   source files via Glob, apply `--exclude` patterns, and group by file type.
2. Launch three analysis agents in parallel via Task — Commented Code, Unused
   Symbols (hierarchical LSP: file-level reachability, then symbol-level,
   then test helpers), and Test-Only Production Code — following the
   decomposition in
   [references/parallel-analysis.md](references/parallel-analysis.md). Each
   agent maps detection tasks to LSP operations and classifies references per
   [references/lsp-operations.md](references/lsp-operations.md): only
   actual-usage references (calls, instantiations, reads, type annotations)
   count — exports, re-exports, imports, and type-only imports do not.
3. Merge agent findings: deduplicate across agents, drop false positives
   (documentation comments, license headers, dynamic imports), and prioritize
   — high: unused exports (potential dead code); medium: commented-out code
   blocks; low: unused test helpers.
4. Run the verification below; when a check fails, fix the cause and re-run
   that check. Repeat until every check passes or a concrete blocker remains,
   then report the blocker instead of looping.

<IMPORTANT>
This skill never edits, deletes, or creates project files. Every finding is
evidence for the user or a calling skill to act on.
</IMPORTANT>

## Verification

- The scanned path was valid, and every discovered file was analyzed or
  explicitly excluded.
- All three analysis agents returned reports, and merged findings carry no
  duplicates.
- Each unused-symbol finding cites only non-usage references under the
  classification rules in
  [references/lsp-operations.md](references/lsp-operations.md).
- No project file was modified by this run.

## Completion

Report the path scanned, files analyzed, and per-category counts, then list
findings grouped by priority — high: unused exports; medium: commented-out
blocks; low: unused test helpers — each with file:line, the symbol or
snippet, and its evidence (for example "no usage references"). Recommend next
steps (manual review, removal via the `coding:lint` pre-flight). A partial
result must state which agent or phase failed and what was still scanned.
