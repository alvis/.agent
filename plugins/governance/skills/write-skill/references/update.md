# Action: update

Loaded by `SKILL.md` when the requested action is `update`. Revise one or more
existing skills; the shared policy, thought-experiment/blindspot test, and
verification commands live in `SKILL.md`.

## Boundaries

- Update existing skill behavior and documentation; use the `create` action
  when no suitable owner exists.
- Preserve established public behavior unless the requested change explicitly
  removes or reassigns it.
- Do not modernize unrelated skills merely because they are nearby.

The current skill and its real callers are authoritative; the template is a
concise aid, not a migration target whose headings must be copied.

## Inputs

- **Required**: a path, plugin-qualified skill name, glob, or explicit `--all`.
- **Optional**: requested behavior, trigger, wording, or policy changes.
- Never interpret an empty selector as permission to update every skill.

## Workflow

1. Resolve the selector and list exact targets. Reject ambiguity before edits.
2. Read each target completely, including directly referenced files and real
   cross-skill invocations.
3. Compare the prior and current exact bytes and decide whether operational meaning
   changes. Any change to trigger semantics,
   discovery or invocation behavior, ownership or exclusions, capability boundaries,
   mechanics, decisions, inputs, setup, commands, configuration, source boundaries,
   failure handling, outputs, or verification is operational. Treat uncertainty as
   operational; changed command or configuration values are operational even when the
   surrounding shape is unchanged. Classify an update as wording-only only when all
   those semantics remain unchanged.
4. When step 3 classifies the update operational, derive concrete representative tasks
   for the owned capability and changed behavior, then define the reusable knowledge
   target as specified in
   `references/authoring.md`. Identify which routine mechanics, decisions, recipes,
   diagnostics, or verification a fresh agent currently lacks before writing.
5. When step 4 applies, inspect evidence in the priority order defined in
   `references/authoring.md`: real local consumers and callers, official
   documentation or source, then credible battle-tested public usage only when needed.
   Preserve valid project conventions without presenting them as universal mechanics.
6. When discovery, invocation, or harness support changes, load
   `references/harnesses.md`. Express harness-only behavior as an equivalent
   portable instruction or report incompatibility. Define current ownership
   and the requested end state.
   Run the shared thought-experiment and blindspot test (see `SKILL.md`) over
   positive and near-miss cases for changed triggers or behavior.
7. Capture a failing baseline for testable behavior when a deterministic check
   exists, then rewrite the existing document coherently. Remove superseded
   instructions and stale references.
8. When step 3 classifies the update operational, meet the reusable knowledge target
   while keeping core routing and the always-used workflow concise. Move conditional
   recipes, examples, and troubleshooting depth to references. For a wording-only
   update, preserve the existing operational contract exactly. Do not add personas,
   diagrams, fixed phases, or delegation ceremony unless they materially clarify this
   particular skill.
9. Run the `verify` action against the final diff: structural mode for wording-only
   changes and full mode for operational changes. Full mode applies the shared
   cold-start gate. When verification changes a target, rerun structural validation,
   the affected paper cases, and only the cold-start tasks invalidated by that change.
   Use the shared retry bound in `references/functional-mode.md`; report remaining
   failures instead of starting a nested convergence loop.

Independent targets may be delegated in bounded batches of at most 8 skills. Each
assignment names exact paths and reports per-target results. Operational changes need
their own cold-start evidence; a pass for one skill does not cover another. Review the
combined diff afterward.

## Completion

Apply the root completion contract and list every updated target. Never claim a bulk
update without listing its targets.
