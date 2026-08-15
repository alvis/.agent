# Team lifecycle, model, and effort

Read this when forming a team, spawning or retiring a teammate, or choosing
a worker's model and effort.

## Team lifecycle

- **Form a team when delegation carries signal** — large or high-output work;
  stay inline for trivial, conversational, or small tasks.
- **Keep teammates hot.** Route related work to an idle teammate whose loaded
  context still fits.
- **Terminate the unneeded.** Retire a teammate once it is clearly done —
  task finished with no follow-up, a review passed — or telemetry shows
  keeping it no longer helps.
- **Spawn fresh for independent work** when a task is unrelated to a
  teammate's loaded context, or a follow-up (such as a re-review while a fix
  is in flight) would block it.
- **Keep nested spawning one-off.** A nested agent may spawn only when the
  task is certainly disposable after one returned artifact or summary. It
  specifies `subagent_type` (for example, `test-reporter`), omits a
  configured name, and never creates a standing nested teammate. For
  continuing work, it messages the best-known teammate directly by
  `agent_id`; only when it cannot identify the owner does it ask the main
  agent to suggest one.
- **Bound exceptional fan-out.** Declare a task-wide child-spawn budget
  before the first one-off nested spawn; default to three. `SendMessage`
  hand-offs to known `agent_id`s don't spend it, but the same task must not
  cross the same sibling edge twice.
- **Hand off by reference.** The first message follows
  [directions/subagent-handover.md](directions/subagent-handover.md). Later
  messages carry only deltas. If
  `SendMessage` is unavailable, return the compact hand-off to the caller.
- **Keep agent definitions role-specific.** An agent's `Collaboration`
  section lists only outbound collaborators as concise bullets; it never
  repeats this protocol, narrates who spawns it, or restates its tools.

## Model and effort

Pick the model by whether the work reasons at all, then match the task's
cognitive demand with effort:

| Model | Use for |
|-------|---------|
| **haiku** | Simple, routine, deterministic work with a known procedure — tests, lint, command output, mechanical file sweeps. |
| **opus** | Everything else, from moderate edits to advanced coding, deep reasoning, research, and review. |

Effort is the dial that carries cognitive demand (`low|medium|high|xhigh|max`;
omit for haiku, which has none). Set it by the task's difficulty: `low` for a
known procedure, `medium` for a few genuine decision points, `high` for
sustained judgment or orchestration, `xhigh`–`max` for deep adversarial
scrutiny and pivotal one-shot gates. To make a worker think harder, raise its
effort — the model is not the lever.
