# Workflow tool — input reference

What a Workflow launch request must contain. Read this before composing the tool input you send to the main agent (see `hooks/SUBAGENT.md`): the main agent launches your request **verbatim** — if it doesn't validate against this reference, the launch fails and the round-trip is wasted.

## Tool input parameters

Exactly one of `script`, `scriptPath`, or `name` selects the workflow:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `script` | string | Self-contained inline workflow script (see below). |
| `scriptPath` | string | Path to a previously persisted script file. Every run persists its script under the session directory and returns the path — edit that file and relaunch with `scriptPath` instead of resending the whole script. Takes precedence over `script` and `name`. |
| `name` | string | A predefined/saved workflow (built-in or from `.claude/workflows/`). |
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

## Script-body API

- `agent(prompt, opts?) → Promise<any>` — spawn a subagent. Without `opts.schema` it resolves to the agent's final text; with `schema` (a JSON Schema) it resolves to the validated object. Resolves `null` if the agent is skipped or dies — `.filter(Boolean)` results. Options: `label` (display), `phase` (progress group; use inside pipeline/parallel stages), `schema`, `model` (omit unless certain — inherits the session model), `effort` (`low`–`max`), `isolation: 'worktree'` (only when agents mutate files in parallel; expensive), `agentType` (named agent from the registry, e.g. `'general-purpose'`).
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
- Concurrency: at most `min(16, cores − 2)` agents run at once per workflow (excess queue); lifetime cap 1000 agents per run; one `pipeline()`/`parallel()` call accepts at most 4096 items.
- Prefer `pipeline()`; justify every barrier. If a workflow silently bounds coverage (top-N, sampling), `log()` what was dropped.

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
