# Action: verify

Loaded by `SKILL.md` when the requested action is `verify`. Validate a new or
changed skill; the shared policy, thought-experiment/blindspot test, and
verification commands live in `SKILL.md`.

## Boundaries

- The Agent Skills specification owns the portable directory, required
  frontmatter, and supporting-file contract.
- Claude Code's validator owns Claude manifest and frontmatter schema
  correctness only.
- `quick_validate.ts` owns repository policies only; it must not duplicate the
  evolving Claude schema. Its default run delegates schema validation to
  Claude; `--policy-only` is the bounded path when that validator is not
  available.
- Codex validation uses the documented Agent Skills contract and applicable
  documented Codex behavior. Do not invent a `codex plugin validate` command
  or infer Codex support from a Claude-only field.
- Functional and trigger checks are required when behavior or discovery changed,
  not for a wording-only edit with unchanged meaning.
- The cold-start release gate in `references/functional-mode.md` applies to every
  `create`, operational `update`, and standalone verification claiming behavioral
  self-sufficiency. Optional harness runtime evaluation is a separate check.
- Structural mode checks structure and policy only. It may return structural `PASS`,
  but cannot claim behavioral or self-sufficiency validation.

## Inputs

- **Required**: a `SKILL.md`, skill directory, plugin, marketplace, or plugins
  path.
- **Required for functional or full mode**: representative tasks, raw inputs, expected
  outcomes, and acceptance checks. Derive missing tasks from the skill's promises and
  real consumers; if that is impossible, behavioral verification is incomplete.
- **Optional comparison evidence**: prior skill version, baseline ref, or diff. Use it
  to classify an update; its absence does not exempt functional or full verification
  from exercising the current skill.
- **Optional** mode: `structural`, `functional`, or `full` (default `full`).
- **Optional** representative prompts supplied inline and `runtime: true|false`
  (default `false`).
- **Optional** `fix: true|false` (default `false`) — apply fixes for reported
  causes and rerun the failed checks.

## Workflow

1. Resolve the target and enumerate affected skills and plugin roots. When comparison
   evidence exists, classify the change with `update` step 3; a semantic difference
   such as a changed command or configuration value is operational. Without comparison
   evidence, verify the requested properties of the current skill without inventing
   update history.
2. Validate the portable core and load `references/harnesses.md`. Run only
   the applicable checks for the target harnesses. Report unavailable commands
   as not run or blocked rather than substituting a private validator.
3. Resolve `scripts/quick_validate.ts` from the loaded `write-skill` root and
   invoke `--portable` separately for each enumerated skill file or directory.
   Review body length, description budget, root-contained references, and
   placeholders. Use `--policy-only` only when Claude validation is
   unavailable, and report that omission.
4. For create, operational update, and functional or full verification, resolve the
   representative tasks and apply the cold-start gate in
   `references/functional-mode.md`. Structural-only verification skips execution and
   labels self-sufficiency `not_evaluated`.
5. For functional or full mode, derive a transient representative-case matrix
   from the owned outcome and any caller-supplied prompts. Keep it in context or
   a temporary Markdown scratch file in the OS temp folder (for example
   `${TMPDIR:-/tmp}/check.md`). Follow `references/functional-mode.md`
   for the case shape, paper-only reasoning, and optional isolated harness execution.
6. Include positive trigger prompts, nearby negative prompts, and behavior or
   failure cases relevant to the change. Separate reasoned outcomes from
   observed runtime evidence; a pass must not claim execution that did not run.
7. Aggregate evidence by skill and delete any temporary scratch file. When fixes
   are requested, change only reported causes and rerun the failed checks.

## Verification

After every fix iteration, re-run the verification commands in `SKILL.md`.
Trigger and functional results must include the prompt, expectation, reasoned or
observed outcome, and pass/fail rationale. A fix changes the current bytes and makes
prior cold-start evidence stale; repeat step 4 before returning a verdict. When
cold-start is applicable, do not return a passing verdict unless its release gate
passes.

## Completion

Apply the root completion contract. Return separate structural and behavioral verdicts
so a structural pass cannot be mistaken for self-sufficiency evidence.
