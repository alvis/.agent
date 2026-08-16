# Adaptive interview — question batteries

This reference holds the Step 2 question battery. The interview is **adaptive, not fixed**: skip any domain the
arguments or a pre-filled brief already answer unambiguously, and ask only what the mandatory-field checklist
(`references/brief-template.md`) still needs. Mechanics:

- **Batteries of <=4 questions** per use of the graphical or structured user-input tool, grouped by domain. Never ask all nine domains at once.
- **Always offer a proposed default as an option.** The user should be able to accept a sensible default with one
  tap; free-text is the escape hatch, not the primary path.
- **Loop until the exit-criteria pass.** Each failed criterion generates the next battery, targeted at exactly the
  gap that failed. Do not re-ask anything already answered.
- **Answers land in the brief, nowhere else.** The interview's only output is frontmatter fields and body prose.

## Domains

### 1. Goal & artifact type

Establish: what is being optimized, and where the current version lives (or that there is none).

- "In one sentence, what should this run optimize?"
- "What kind of artifact is it?" — options: `code` / `text` / `config` / `model` / `other`
- "Where does the current version live?" — options: a detected candidate path / "no current version (cold start)"

Probe: if the goal names an outcome but not an artifact ("improve conversion"), ask what concrete thing the agents
will actually mutate.

### 2. Metric

Establish: `metric.name`, a third-party-computable `definition`, `direction`, `scale`.

- "What single number tells us a candidate is better?" — propose a metric inferred from the goal as the default
- "Higher is better, or lower?" — options: `maximize` / `minimize`
- "What scale does it live on?" — options: `0-100` / `0-1` / "ms, lower better" / other

Key probe: **"If I hand you two candidates, how do you decide which is better, mechanically?"** If the answer
involves judgment calls the brief doesn't capture, the definition is not yet computable — keep probing.

### 3. Eval backend

Establish: `eval.backend`, then the backend-specific block.

- "How should candidates be scored?" — options: "run a command (programmatic)" / "panel of LLM judges" /
  "I score them myself each round (human)"
- Programmatic: "What exact command prints the score? It must print exactly one number on stdout." — propose a
  detected test/eval script as the default; also ask for `setup_command` if the repo needs per-worktree setup
- Judges: "Describe the rubric with anchored scale points — what does a 3 look like vs a 7 vs a 9?" — propose a
  drafted rubric from the goal as the default; confirm `count` (default 3) and `consensus` (default median)
- Human: "What scale will you score on, and how many candidates per round can you stomach?" — defaults: stated
  anchors on a 1-10 scale, batch of 5

Probe: for judges, if the rubric only names qualities ("punchy", "clear") with no anchored points, ask for the
concrete description of at least three score levels.

### 4. Baseline

Establish: `baseline.artifact` (path or `'none'`), and whether a score is already known.

- "Is there an existing version to beat?" — options: detected path / "cold start"
- "Do you already know its score, or should Step 4 measure it?" — options: "measure it" (default) / free-text number

Probe: a claimed baseline score with no provenance — prefer measuring in Step 4 unless the user insists.

### 5. Target & stopping

Establish: `target.threshold`, `budget.max_rounds`, `plateau.rounds` + `plateau.epsilon`.

- "What score counts as done?" — propose a default relative to the baseline (e.g. "+20% over baseline")
- "Maximum rounds before we stop and regroup?" — options: `6` (default) / `3` / `10` / free-text
- "How many flat rounds equal a plateau, and what's the smallest improvement that still counts?" — defaults:
  3 rounds, epsilon proposed on the metric's scale

Probe: a target like "as good as possible" is not a number — convert it to a threshold or an explicit
budget-only run (threshold = best achievable, stop on budget/plateau).

### 6. Constraints

Establish: `constraints`, `immutable_paths`, content boundaries, runtime/cost limits.

- "Anything candidates must never do or touch?" — options: "none declared" (default) / free-text list
- "Any files or paths that are off-limits?" — propose detected eval scripts and CI config as defaults
- "Any brand/tone/legal boundaries for the content?" (text artifacts) / "Any runtime or cost ceilings per
  candidate?" (code artifacts)

Probe: for each stated constraint, ask how a refuter would check it — a constraint nobody can verify yes/no is
restated until it is checkable.

### 7. Search space

Establish: >=3 distinct `framing_directions` seeding round 1.

- "What are your hunches — which directions seem promising?" — free-text first; the user's intuition is signal
- "I'd add these complements: <proposed directions>. Keep, swap, or extend?" — propose directions orthogonal to
  the user's (taglines: e.g. emotional / functional / contrarian framings; ML: e.g. different
  signal-processing families; code perf: e.g. algorithmic / caching / data-layout)
- "Any direction you explicitly want excluded?"

Probe: if two directions would produce near-identical candidates ("shorter" and "more concise"), merge them and
ask for a genuinely distinct third.

### 8. Execution permissions (code mode only)

Establish: explicit `execution.code_execution` grant; worktree and dependency policy.

- "May agents write and run code in this repo?" — options: "yes, in isolated worktrees" (default) / "yes, in
  place (single candidate only)" / "no — abort code mode"
- "May they install dependencies?" — options: "yes, project package manager only" (default) / "no"
- "Which paths may they edit?" — propose source dirs as `mutable_paths`; eval command auto-joins `immutable_paths`

Probe: never default this domain. Silence is not a grant — `code_execution: true` requires an explicit answer.

### 9. Evolution & fanout

Establish: confirm defaults or switch strategy.

- "Evolution strategy?" — options: "genetic — top-k mutate/recombine + wildcards" (default) /
  "keep best, regenerate the rest"
- "Fanout?" — options: "adaptive 4-8, start 5" (default) / free-text bounds

Probe: only dig deeper if the user picks non-defaults; this domain is one battery at most.

## Unambiguity exit-criteria

All must pass before Step 3 renders the brief. Each failure names the next battery.

- **(a) Third-party scoreable.** A stranger could score an arbitrary candidate from the brief alone:
  the programmatic command **dry-runs to a single parseable number**, OR the judge rubric has >=3 anchored
  scale points, OR the human scale + anchors are stated. → fails: re-enter domain 2 or 3.
- **(b) Numeric target.** `target.threshold` is a number on `metric.scale` with stated direction. → domain 5.
- **(c) Checkable constraints.** Every constraint is one a refuter could rule violated yes/no. → domain 6.
- **(d) >=3 distinct framing directions.** → domain 7.
- **(e) Numeric budget.** `budget.max_rounds` and both plateau fields are numeric. → domain 5.
- **(f) Code mode grant.** Explicit `code_execution` answer plus declared `mutable_paths` / `immutable_paths`.
  → domain 8.

**Programmatic dry-run rule.** Before criterion (a) passes for `backend: programmatic`, the orchestrator runs the
eval command **read-only against the baseline artifact**. Output that is not a single parseable number — multiple
lines, prose, an error, an empty string — fails criterion (a) and re-enters the interview with the captured output
shown to the user, so the command is fixed before any fanout spend.
