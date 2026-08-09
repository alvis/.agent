---
name: refactor
description: Improve green code through behavior-preserving structural changes to organization, naming, readability, or documentation. Use when existing tests pass and the requested outcome is maintainability rather than a bug fix, new feature, or version-driven API upgrade.
model: opus
context: fork
argument-hint: "<area> [--focus=naming|structure|docs|all]"
---

# Refactor Code

Improve green code's structure, readability, naming, and documentation
without changing behavior, keeping every test passing throughout.
`coding:fix` owns failing code; `coding:write-code` owns new functionality;
`coding:modernize` owns version-driven API upgrades.

<IMPORTANT>
Coherence Mandate: every edit must produce one continuous, deliberate work —
rewrite over restructure, restructure over integrate, never append. A reader
must not be able to tell which parts are new. That standard is why
refactoring exists: it absorbs earlier compromises into the current shape of
the code rather than layering niceties on top — and the Two-Stage Rule in
step 2 is its concrete application to file size.
</IMPORTANT>

## Boundaries

- Use for: behavior-preserving improvements to structure, complexity,
  naming, readability, JSDoc, and inline documentation on code whose tests
  pass.
- Do not use for: new features or business logic (`coding:write-code`),
  fixing bugs or failing tests (`coding:fix`), creating new test cases, or
  modifying project configuration. Reject when tests fail in the target area
  (fix first) or the area path resolves to no files.

## Inputs

- **Required**: `area` — path to the code to refactor.
- **Optional**: `--focus=naming|structure|docs|all` (default `all`);
  `--from-composite` when invoked from a composite workflow.
- **Prerequisites**: all tests in the target area pass.

## Standards

Apply `universal/write` (general authoring conventions), `typescript/write`
(patterns and type safety), `function/write` (function design and
complexity), `documentation/write` (JSDoc and inline comments), and
`naming/write` (variable, function, and file naming).

## Workflow

1. **Analyze.** Parse the area and `--focus`. Run the existing tests; if any
   fail, reject and direct to `coding:fix`. Read the target files and list
   opportunities: structural improvements (extract functions, reduce
   complexity), readability enhancements, naming violations, missing or
   incomplete JSDoc, inline-comment gaps on complex logic, and
   inconsistencies with established codebase patterns.
2. **Restructure** (focus `structure` or `all`). Apply design patterns per
   the standards, reduce function complexity, extract reusable helpers, and
   run tests continuously so no functionality breaks. When a file exceeds the
   project's `max-lines` threshold, apply the Two-Stage Rule before any
   ad-hoc split: Stage 1 — extract logic into another file as a genuinely
   reusable helper, preferred when more than one caller shares it; Stage 2 —
   if still over the threshold, split into the `<base>.ts` + `<base>/*.ts`
   folder pattern, keeping `<base>.ts` as a thin re-export/orchestrator and
   moving helpers into `<base>/*.ts` with short names (the folder provides
   the context). Never split into arbitrary sibling files (e.g.
   `foo.schema.ts`, `foo.parse.ts`) unless that naming is already an
   established project convention. The full rule and examples live in the
   coding plugin's `standards/file-structure/` under "Long-File Decomposition."
3. **Improve readability** (focus `naming` or `all`). Apply naming standards
   to variables, functions, and files; simplify complex expressions; improve
   flow and logical grouping; remove dead code and unnecessary comments.
4. **Document** (focus `docs` or `all`). Add JSDoc for all public functions,
   classes, and interfaces — parameters, returns, behavior, and `@example`
   blocks where appropriate — and inline comments that explain why, not what;
   mark known limitations with TODO/FIXME.
5. **Validate.** Run the full test suite with coverage, the linter, and the
   type checker. When a check fails, fix the cause and re-run that check;
   repeat until every check passes or a concrete blocker remains, then report
   the blocker instead of looping.

## Verification

- All tests pass with coverage maintained at its prior level; behavior is
  unchanged.
- Lint and type checks pass.
- Public APIs in the area carry complete JSDoc, and no file exceeds
  `max-lines` without a recorded blocker.

## Completion

Report the area and focus, files refactored, improvements applied with
file:line entries, JSDoc blocks added, naming fixes, and quality-gate
results (tests, coverage, types, lint). Suggest commit via `coding:commit`
when relevant. A partial result names the failing check and the blocker.
