# Ephemeral parallel execution — input reference

What an ephemeral parallel-execution launch request must contain. Read this
before composing the input you send to the main agent (see
`hooks/SUBAGENT.md`): the main agent launches it verbatim, so invalid input
wastes the round trip.

## Tool input parameters

Exactly one of `script`, `scriptPath`, or `name` selects the run:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `script` | string | Self-contained inline execution script (see below). |
| `scriptPath` | string | Path to a previously persisted script file. Every run persists its script under the session directory and returns the path — edit that file and relaunch with `scriptPath` instead of resending the whole script. Takes precedence over `script` and `name`. |
| `name` | string | A predefined or saved execution known to the active harness adapter. |
| `args` | any | Input exposed to the script as the global `args`, verbatim. Pass arrays/objects as **real JSON values, never a JSON-encoded string** — a stringified list arrives as one string and `args.map`/`args.filter` throw. |
| `resumeFromRunId` | string | Run ID (`wf_…`) of a prior run to resume. The longest unchanged prefix of `agent()` calls returns cached results instantly; only edited or new calls run live. Same-session only; stop the prior run first. |

## Script requirements

Plain **JavaScript, not TypeScript** — type annotations, interfaces, and generics fail to parse. The body runs in an async context; use `await` directly.

Every script must begin with a `meta` export that is a **pure literal** (no variables, calls, spreads, or template interpolation):

```js
export const meta = {
  name: 'kebab-case-name',            // required
  description: 'one-line summary',    // required
  phases: [                           // optional; titles must match phase() calls exactly
    { title: 'Scan', detail: 'what this phase does' },
  ],
}
```

## Script-body adapter API

- `agent(task, opts?) → Promise<any>` — spawn a subagent. Without `opts.schema` it resolves to the agent's final text; with `schema` (a JSON Schema) it resolves to the validated object. Resolves `null` if the agent is skipped or dies — `.filter(Boolean)` results. Options: `label` (display), `phase` (progress group; use inside pipeline/parallel stages), `schema`, `intelligence` (a concrete mapping level; the adapter applies only that level's native model and effort projection), `isolation: 'worktree'` (only when agents mutate files in parallel; expensive), and `agentType` (named agent from the registry, e.g. `'general-purpose'`). Callers never pass native model or effort fields.
- `pipeline(items, ...stages) → Promise<any[]>` — each item flows through all stages independently, **no barrier between stages**; the default for multi-stage work. Stage callbacks receive `(prevResult, originalItem, index)`. A throwing stage drops that item to `null`.
- `parallel(thunks) → Promise<any[]>` — run `() => Promise` thunks concurrently and **wait for all** (a barrier). A throwing thunk resolves to `null`; the call never rejects. Use only when a stage genuinely needs all prior results at once (dedup/merge, early-exit on zero, cross-item comparison).
- `phase(title)` — start a progress group for subsequent `agent()` calls.
- `log(message)` — narrator line shown to the user.
- `args` — the tool-input `args`, verbatim.
- `budget` — `{total, spent(), remaining()}` token budget shared across the whole turn; `total` is `null` when no target was set. Guard budget loops with `budget.total && budget.remaining() > N` — with no target, `remaining()` is `Infinity`.
- `workflow(nameOrRef, args?)` — run a saved workflow or `{scriptPath}` inline as a sub-step. One level of nesting only.

## Hard constraints

- `Date.now()`, `Math.random()`, and argless `new Date()` **throw** (they would break resume). Pass timestamps in via `args`; stamp results after the run returns.
- No filesystem or Node.js APIs — standard JS built-ins only.
- Concurrency: at most `min(16, cores − 2)` agents run at once per execution (excess queue); lifetime cap 1000 agents per run; one `pipeline()`/`parallel()` call accepts at most 4096 items.
- Prefer `pipeline()`; justify every barrier. If an execution silently bounds coverage (top-N, sampling), `log()` what was dropped.

## Minimal example

Every `agent()` task below is a first handover and therefore follows
[directions/subagent-handover.md](directions/subagent-handover.md). The caller
passes absolute file paths in `args.files`; the verification finding carries
the absolute evidence path in `x.path`. `args.work_id` is the resolved stable
reference required by `references/naming.md`.

```js
export const meta = {
  name: 'review-changes',
  description: 'Review changed files, verify each finding',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}
const results = await pipeline(
  args.files,
  f => agent(`${args.work_id}

Goal: Identify actionable defects in the changed file with evidence sufficient for independent verification.

Requirements:
- Return findings that satisfy the FINDINGS schema.

Boundary:
- Review only; do not modify files.

Directions:
- Prioritize semantic correctness and regressions.

Context:
Inputs:
- Changed file — ${f}`, { phase: 'Review', schema: FINDINGS }),
  r => parallel(r.findings.map(x => () =>
    agent(`${args.work_id}

Goal: Determine whether the reported defect is real, reproducible, and material.

Requirements:
- Return a verdict that satisfies the VERDICT schema.

Boundary:
- Verify only; do not modify files or broaden the finding.

Directions:
- Try to falsify the finding before accepting it.

Context:
Inputs:
- Reported defect evidence — ${x.path}
Finding: ${x.title}`, { phase: 'Verify', schema: VERDICT })
      .then(v => ({ ...x, verdict: v })))),
)
return { confirmed: results.flat().filter(Boolean).filter(x => x.verdict?.isReal) }
```
