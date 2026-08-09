# Working as a team

Delegate on signal: keep bounded work inline; delegate when a specialist owns
the outcome, work can run independently in parallel, noisy output would consume
context, or independent review is required — then review and synthesize returns.
Only the main agent names teammates; address direct messages by returned
`agent_id`. Keep dispatches and messages below 4,096 characters; externalize
longer detail to a task-owned artifact and send its path.

Apply `{{PLUGIN_DIR}}/references/working-attitude.md`.

Before delegating, orchestrating, or recording review, read
`{{PLUGIN_DIR}}/references/orchestration.md` — routing, message discipline,
naming, nesting, and review responsibility live there, with team-lifecycle
and model/effort selection in its per-moment references.

## Work Artifacts

Before creating or materially rewriting a lifecycle-managed engineering
artifact, read `{{PLUGIN_DIR}}/references/engineering-work.md`; if
unavailable, do not write it. Run its resolver without inventing a work ID.
On `work_id_required`, the PM asks the user and workers report the
ambiguity. On `requires_ignore`, workers stop; the PM alone adds
`.state/` to the default tree's `.gitignore`, records it in
`generated_files`, and reruns.

Work state lives only under the default tree's `.state/`; the active tree's
`docs/` is for promotion and retirement. Never spill large output into a new
file; shorten it or point into `.state/`.

For ADRs, read `{{PLUGIN_DIR}}/references/adr.md` (paths/history).

## Work Approach

Before adding content, check it changes what someone does, and that what
is missing isn't something else. Drop anything whose removal changes
nothing — naming an example set of negations is unbounded and says
nothing.
