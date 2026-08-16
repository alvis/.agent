---
name: complete-code
description: Complete explicit production implementation stubs in an existing scope. Use for canonical implementation TODOs, temporary production stubs, and draft-code sentinels; route bugs, test work, unstubbed functionality, new features, and ambiguous markers to their owning workflows.
requirements:
  intelligence: medium
context: fork
argument-hint: "<scope>"
---

# Complete Code

Before any `jj` decision or command, follow
`coding:references/jj.md`.

Finish only explicit production implementation stubs. The surrounding contract,
types, tests, and specification must already make the intended behavior clear.
`coding:complete-test` owns test authoring; `coding:write-code` owns new
functionality.

## Boundaries

Use for these accepted markers only:

- `TODO(implementation):` markers.
- A legacy implementation TODO only when its text unambiguously requests a
  production implementation.
- `TEMP:` stub implementations whose replacement behavior is explicit.
- The exact sentinel form `throw new Error('IMPLEMENTATION: ...')` emitted by
  `coding:draft-code`.

Do not claim neighboring work:

| Finding | Action |
|---|---|
| `FIXME` | Route to `coding:fix`. |
| Test-file TODO, `it.todo`, or `describe.todo` | Route to `coding:complete-test`. |
| Missing functionality without an explicit stub | Route to `coding:write-code`. |
| Newly requested feature | Route to `coding:write-code`. |
| Ambiguous marker | Leave untouched and report it as blocked. |
| `HACK` or `WORKAROUND` | Preserve unless the user explicitly routes it to `coding:fix` or `coding:refactor`. |

This skill may read and run existing tests to discover and verify the established
contract. It does not author broad test suites, pursue coverage, create replacement
placeholders, or guess behavior that the repository does not specify. Also report
as blocked, instead of implementing: markers that require an external dependency
that is not installed, and security-sensitive operations (authentication,
authorization, cryptography, secrets) whose requirements are not clearly
specified.

## Inputs

- **Required**: `<scope>` — the file, directory, or package to scan.
- **Optional**: none. If `$ARGUMENTS` contains `--test-only`, stop immediately
  with exactly:
  > `--test-only` was removed; use `coding:complete-test <scope>`.
- **Prerequisites**: implementations must satisfy the constitution standards for
  `universal/write`, `function/write`, `typescript/write`,
  `documentation/write`, `observability/write`, and `testing/write` (when
  touching tests to verify a contract).

## State gate

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential. If unavailable, stop artifact
writes and report the missing contract. Resolve the active work root first.
When delegated, start from the mission capsule's exact work root and relevant
specification/design paths. Read `state/working.md` only when the capsule lacks
current navigation; read `state.md` only for resume, cross-slice dependency, or
alignment work. Never write PM-owned work pointers or overview files.
The caller/PM uses the resolver, asks only on `work_id_required`, and gives a
delegated run the explicit resolved work ID/root.

## Workflow

1. Validate the scope and reject the removed flag before scanning. If the scope
   contains no accepted marker, report that and stop.
2. Find accepted markers, then classify every nearby TODO-like marker using the
   routing table above. Plan completion order by dependency: group related
   markers and complete prerequisites before the code that depends on them.
3. Read the specification, types, call sites, siblings, and existing tests needed
   to establish each accepted stub's behavior.
4. If behavior remains ambiguous, leave the marker untouched and record the
   blocker. Do not infer a new feature contract.
5. Replace each accepted stub with the smallest production implementation that
   satisfies the established contract. Remove the marker; never replace it with a
   new placeholder. Run the focused existing tests after each replacement so a
   regression is caught at the marker that introduced it.
6. Run the verification below; when a check fails, fix the cause and re-run that
   check. Repeat until every check passes or a concrete blocker remains, then
   report the blocker instead of looping.

## Verification

- Focused existing tests for the changed scope pass.
- The repository type check passes for the changed scope.
- Mechanical lint checks for the changed scope pass.
- No accepted marker remains in scope other than the reported blocked ones.

## Completion

Report completed markers with file locations, routed findings, blocked ambiguous
markers, changed files, and exact verification commands and results. Return
every created or materially rewritten path as `generated_files` to the PM. Do
not run file sizing; after all artifact writers finish, the PM checks only
eligible work Markdown inside the target `.state/`.
