# Transient Paper, Cold-Start, Functional, and Trigger Checks

Loaded by the `verify` action for transient functional and trigger checks, and by
`create`, operational `update`, and `verify` for the mandatory cold-start check below.
Cold-start proves product self-sufficiency; the optional harness exercise tests
activation and runtime behavior. They are separate checks.

## Contents

- [Paper representative-case matrix](#build-the-paper-representative-case-matrix)
- [Paper-only blindspot check](#run-the-paper-only-blindspot-check)
- [Cold-start release gate](#run-the-cold-start-release-gate)
- [Optional harness exercise](#optionally-exercise-an-available-harness)
- [Report and clean up](#report-and-clean-up)

<IMPORTANT>
- Keep cases in context. If written notes help, use a Markdown table in an OS
  temporary directory and delete it before staging or committing.
- Label paper-only conclusions as `reasoned`. Reserve `observed` for commands
  that executed in an isolated runtime and outputs from a fresh-agent cold-start
  session. Every cold-start status must cite the evidence or blocking cause defined
  below.
</IMPORTANT>

## Build the paper representative-case matrix

Use caller-supplied prompts first, then derive only the missing coverage from
the skill's owned outcome, description, boundaries, workflow, and neighboring
skills. Keep the matrix small and change-focused:

- one direct positive request for the owned outcome;
- one paraphrased positive request when discovery wording changed;
- one nearby negative request owned by a neighboring skill;
- one behavior, missing-input, failure, or verification-shortcut case relevant
  to the changed workflow.

For each case record the prompt, expected owner, expected behavior, evidence to
inspect, and whether the result is reasoned or observed. `mode=functional` may
omit discovery-only cases; `mode=full` includes both trigger and behavior
coverage. These rows are thought-experiment evidence; never title or report this
matrix as cold-start evidence.

## Run the paper-only blindspot check

Compare every prompt with the target description, explicit boundaries, and the
closest competing skill descriptions. Then trace the expected behavior through
the target workflow and verification contract. A reasoned pass requires:

- positive prompts clearly belong to the target;
- near misses clearly belong elsewhere and are not stolen by broad wording;
- required inputs and failure behavior are explicit;
- shortcuts cannot bypass required verification;
- the expected outcome is supported by instructions or deterministic scripts,
  not by an unstated assumption.

Fix a discovered blindspot in the owning instruction, rerun the affected cases,
and bound the loop to two iterations. Paper reasoning does not establish actual
skill invocation or runtime output in any harness.

## Run the cold-start release gate

<IMPORTANT>
Cold-start is required for every create, operational update, and verification claiming
behavioral self-sufficiency. Paper reasoning, structural validators, and optional
harness activation checks cannot replace it.
</IMPORTANT>

Use the representative tasks from
[authoring.md](references/authoring.md#reusable-knowledge-target). For each task,
launch a fresh agent or isolated session with only the complete skill directory and
the raw prompt or disposable fixtures an ordinary caller would provide. Do not supply
authoring notes, expected answers, evaluation criteria, or the diagnosis that motivated
the change.

Record one compact evidence row per task:

- the promise being tested, task, expected outcome, and session identifier;
- the supplied skill revision or SHA-256 directory digest, plus the exact skill paths
  the task depended on and SHA-256 digests for those files, the prompt, and fixtures;
- the session's final response, produced artifacts, and a concise action/tool account
  when the interface exposes one;
- an attribution check for every task-critical decision that depends on the skill's
  promised reusable knowledge, mapping it to supplied skill text, a supplied raw input,
  a source the skill explicitly directs the agent to inspect, or the acceptance oracle;
  and
- a separate observed outcome check using the strongest available oracle:

  - an exact acceptance command, exit status, and relevant output;
  - an identified oracle and its comparison result; or
  - explicit inspection criteria and the observed result for each criterion.

A digest proves identity, not correctness. Prefer deterministic or independent oracles
when they exist; author-written inspection criteria are a fallback and must map to the
skill's stated promises. Assign status as follows:

- `passed` — the task meets its oracle, every task-critical skill-owned decision is
  attributable as above, and the session did not research or reconstruct omitted
  mechanics, setup, commands, or decision rules. Research required by the task or an
  explicit skill instruction is allowed.
- `failed` — the session ran but missed the oracle, made an unattributed task-critical
  skill-owned decision, researched or reconstructed omitted skill-owned mechanics,
  inferred omitted setup, or exposed another self-sufficiency gap. Cite the symptom
  and owning instruction to change.
- `blocked` — the caller prohibited the fresh-session check, the mechanism failed, or
  an external prerequisite that the skill correctly declares was observably
  unavailable. Cite the attempted mechanism or prerequisite check and report
  self-sufficiency as unverified.

Build a directory digest from a path-sorted manifest of every supplied file's relative
path and SHA-256 digest over its exact bytes, then SHA-256 that manifest. Evidence may
be reused when the task, expected outcome, oracle, prompt and fixture digests, evaluator
contract, and every recorded dependency-path digest match. A changed directory digest
triggers dependency comparison: invalidate a row when one of its recorded paths changed
or when the agent cannot prove the change is irrelevant to that task. Keep evidence
outside the target skill and repository; the caller may retain the compact manifest and
referenced outputs for later verification under its own storage policy.

Use read-only tasks or disposable fixtures unless the caller authorized side effects.
Unless the caller prohibited the attempt, run the fresh-session mechanism or the
skill's declared check for an external prerequisite before reporting `blocked`; report
the observed constraint or failure with self-sufficiency as unverified. An unattempted
or undeclared prerequisite claim is not blocking evidence. A paper-only pass cannot
replace the check or be reported as `passed`. Revise the owning instruction or
resource, rerun structural validation and affected paper cases, then rerun only the
invalidated task. Allow at most two attempts per task; report the remaining gap instead
of nesting another verification loop.

## Optionally exercise an available harness

Run executable cases only when `runtime: true` and the target harness provides
a documented isolated evaluation mechanism. Use one fresh session per prompt
and a natural-language request that expresses the representative intent without
naming or explicitly selecting the skill. Compare observed activation and
output with the case expectation. If no such evaluator is available, report
runtime as `blocked` with the missing prerequisite; do not translate another
harness's command by analogy or weaken the expected result.

This optional exercise does not produce or replace cold-start evidence. A harness
runtime result may be `not requested` while required cold-start tasks still pass, and a
cold-start task cannot pass merely because the harness exercise passed.

## Report and clean up

Return one row per paper case with prompt, expected owner/behavior, evidence kind,
outcome, and rationale. For cold-start, return the compact evidence rows, per-task
status, and aggregate status; aggregate passes only when every task passes. Report
optional harness runtime separately. Delete temporary scratch notes, but preserve any
caller-owned reusable evidence bundle according to its storage policy.
