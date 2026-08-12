# Action: create

Loaded by `SKILL.md` when the requested action is `create`. Add a new reusable
skill; the shared policy, thought-experiment/blindspot test, and verification
commands live in `SKILL.md`.

## Boundaries

- Create a skill only for reusable judgment or workflow guidance.
- Do not encode one-off project facts as a skill; use project documentation.
- Search existing skills first. Update an existing owner (the `update` action)
  when the capability overlaps instead of creating a competing trigger.

Use the strict shared structure in `references/authoring.md`. When a harness
difference affects the result, follow `references/harnesses.md`.

## Inputs

- **Required**: skill purpose, name, and concrete trigger examples.
- **Optional**: supporting references, scripts, assets, and output contract.

## Workflow

1. Inspect neighboring skills and call sites.
2. From concrete representative tasks, define the reusable knowledge target as
   specified in `references/authoring.md`: raw inputs, outcomes, decisions, and the
   routine subject knowledge a fresh agent must not have to rediscover.
3. Inspect applicable evidence in the priority order defined in
   `references/authoring.md`: real local consumers and callers, official
   documentation or source, then credible battle-tested public usage only when a gap
   remains. Separate mechanics from project conventions and current evidence from
   stale claims.
4. Define the new skill's owned outcome, positive triggers, near-miss prompts,
   exclusions, inputs, failure behavior, and verification.
5. Before writing the skill, run the shared thought-experiment and blindspot
   test (see `SKILL.md`) for the intended triggers and behavior.
6. Create the smallest self-contained `<name>/SKILL.md` and supporting resources that
   meet the reusable knowledge target. Keep always-used routing and instructions
   inline and conditional recipes, examples, and diagnostics in root-relative
   resources.
7. Add supporting scripts only for deterministic operations that prose should
   not reproduce. Test scripts before documenting them.
8. Run structural and policy validation (see `SKILL.md`), then re-run the
   thought experiment and blindspot test against positive and near-miss
   prompts. Revise until the intended trigger boundary is explicit and
   neighboring work remains excluded. Do not claim runtime trigger behavior was
   exercised unless an executable evaluation actually ran.
9. Run the `verify` action in full mode. It applies the shared cold-start gate to the
   representative tasks from step 2. When a task fails, fix the owning instruction and
   rerun validation plus only the affected task, within the shared retry bound in
   `references/functional-mode.md`.

## Completion

Apply the root completion contract. Also report the created path and any intentionally
deferred cases.
