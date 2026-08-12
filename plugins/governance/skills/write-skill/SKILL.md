---
name: write-skill
description: "Use when authoring, revising, or validating an Agent Skill for Claude Code, Codex, or both through its create, update, and verify actions: define a reusable capability, align existing skills with repository policy, or check structure, triggers, portability, and behavior before use."
---

# Write Skill

Author, revise, and validate Agent Skills. One skill, three actions:
`create` a new skill, `update` one or more existing skills, or `verify` a
skill's structural, policy, and trigger compliance. Infer the action from the
user's stated intent, then route to its reference below and follow that
workflow.

## Actions

- **`create`** — Add a new reusable skill that teaches a missing behavior with
  clear ownership and triggers. See
  [references/create.md](references/create.md).
- **`update`** — Revise existing skill behavior, wording, or triggers, or align
  skills with current policy, without creating a competing skill. See
  [references/update.md](references/update.md).
- **`verify`** — Validate structural, repository-policy, and (when behavior or
  discovery changed) trigger and behavior compliance, optionally exercising
  isolated harness prompts. See [references/verify.md](references/verify.md).

If the action is missing or ambiguous, ask which action is intended rather than
guessing. `create` requires that no suitable owner exists; when one does,
switch to `update`. `create` and `update` call the `verify` action for
functional and trigger evaluation.

## Shared policy

Follow [references/authoring.md](references/authoring.md) for all three actions.
Load [references/harnesses.md](references/harnesses.md) only when a Claude Code
or Codex difference affects execution, required tools, or validation.

## Shared thought experiment and blindspot test

Whenever an action changes a trigger or behavior, conduct a paper-only thought
experiment and blindspot test over positive and near-miss prompts before and
after the change. Record the prompt, expected owner and behavior, evidence kind,
outcome, and rationale in context. If written notes help, keep them in an OS
temporary directory and delete them before staging. Do not claim runtime
behavior was exercised unless an executable evaluation actually ran.

## Verification

Resolve `scripts/quick_validate.py` from this skill's root—the directory
containing this loaded `SKILL.md`—rather than from the process working
directory. For each affected skill, set `TARGET` to its exact `SKILL.md` or
skill directory and run one invocation:

```bash
uv run --python 3.13 "<loaded-write-skill-root>/scripts/quick_validate.py" --portable "$TARGET"
```

Portable mode rejects required Markdown links outside the skill root and checks
root-relative links in `references/`. The script resolves a containing Claude
plugin through the target's ancestors and validates it when present. Complete
the checks in [references/authoring.md](references/authoring.md) and any
applicable harness checks in
[references/harnesses.md](references/harnesses.md) after every fix iteration.
When a check fails, change only the reported cause and re-run that check; loop
fix and re-verify at most 3 times, then report partial completion with the
remaining issues.

## Completion

<IMPORTANT>
A `create`, operational `update`, or verification claiming behavioral
self-sufficiency cannot return `PASS` from paper reasoning or validators. Apply the
[cold-start release gate](references/functional-mode.md#run-the-cold-start-release-gate)
to every representative task. A standalone structural verification may report
structural `PASS`, but must state that self-sufficiency was not evaluated.
</IMPORTANT>

Report the action taken, affected skill paths, ownership boundaries or changes,
reusable knowledge target, thought-experiment and blindspot coverage, structural
validation, behavioral gate status and session IDs when applicable, optional harness
runtime status, and unresolved ambiguity. The behavioral report schema and evidence
currency rules live only in `references/functional-mode.md`.
Confirm any temporary Markdown thought-experiment notes were deleted before
commit. Never claim a bulk update without listing its targets.
