# Orchestration & delegation

Delegate on signal, not reflex. The Project Manager owns delivery across teams; route every coding change through `tech-lead` and the implementing teammate. A domain lead gathers teammate advice, decomposes the assigned goal, owns its domain's implementation decisions, assigns and monitors the pieces, and reconciles results. Delegation never transfers accountability: review and synthesize what comes back. When work crosses this boundary, stop and route it to the best current teammate — zero tolerance.

## Choosing the topology

Classify the task and pick the substrate once, up front, then name the success criteria before launch — a run with no stop condition is not ready:

- **Inline** — don't dispatch when dispatching would save no context, add no independence, and only cost latency or a lossy hand-off. Work you can finish in a handful of tool calls is inline; prefer one subagent over several.
- **Parallel tasks** — independent, dispatch-and-score work whose siblings needn't talk → parallel uses of the subagent-dispatch capability in one request, one stable reference from [naming.md](naming.md) each.
- **Agent Team** — ongoing, high-signal multi-role coordination where warm context avoids repeated setup → persistent teammates around a warm core. A need to relay reasoning or evidence is not sufficient; put durable detail in artifacts.
- **Ephemeral parallel execution** — high-volume structured iteration toward a measurable target: fan-out plus adversarial verification plus a bounded, resumable correction loop. A subagent composes the complete launch input and asks the main agent to run it.

## Delegating well

- **Route to the best runtime specialist.** Inspect each available agent's description immediately before every spawn. Classify the requested action and deliverable from its verbs and acceptance criteria first; only then match subject area, tools, independence, and context — shared nouns do not establish ownership (implementing a component and designing it have different owners). Do not add an unrequested prerequisite stage merely because a specialist's preferred workflow mentions one. Named routing rows and collaboration edges are proven defaults, not limits; never invent an unavailable agent, and honor the "Must use" and "Use proactively" triggers in each agent's description.
- **Give full context once.** Compose every first task handover from
  [directions/subagent-handover.md](directions/subagent-handover.md). Every
  later message is a delta.
- **Own only eligible skills.** Follow a skill yourself only when your resolved intelligence meets its requirement. Otherwise transfer the complete task under the eligibility contract in `hooks/ALLAGENT.md`. A qualified owner may delegate bounded steps without transferring skill ownership. Know where every standard and skill lives; never ask others to find them.
- **Parallel first.** Map the task set as a dependency graph, drawing an edge only where one task truly needs another's output; batch the edge-free tasks into one request through the subagent-dispatch capability, and serialize only along real edges.
- **One bounded task per subagent.** Give each worker exactly one task; before launching, estimate its context load — base, files, tool output, generated output — and keep the unit bounded. Never hand more work to a worker whose measured remaining context cannot safely hold it.
- **Only the main agent names teammates** (rules in "Runtime teammate naming" below); nested agents never assign configured names.
- **Reuse a warm peer by ID.** Route a small task that needs a large base context to the `agent_id` of a live teammate that already carries it — separate spawns do not share a cached base.
- **Delegate continuing work directly when the owner is known.** A subagent that knows the best teammate's `agent_id` messages it directly; knowing the teammate but not the ID, it asks the main agent to resolve it; only with no known owner does it ask the main agent to suggest one — the main agent prefers a living teammate with matching folder/feature history, else spawns a new named teammate and returns its `agent_id`.
- **Message only by `agent_id`.** Direct agent-to-agent communication always targets the runtime `agent_id`; a role, `subagent_type`, configured name, or label is never a message address.
- **Synthesize.** Collect what returns, identify patterns, and consolidate it into actionable results.

## Scope and deliverable

Explore the approach freely; ship narrowly. The requested scope is the deliverable — do not quietly narrow, widen, or transform it. Make routine judgment calls yourself; check in only when different readings would produce materially different work. If the request seems mistaken, say so; escalate if consequential, else continue. Stop short of actions clearly beyond it, finish the whole task, and name what you left out and why.

## Message discipline

- **4,096 characters is a hard ceiling.** Before every subagent dispatch or direct teammate message, inspect the body. If it would exceed 4,096 characters, externalize the detail before sending. A lead or reviewer that receives an overlong inline body returns `blocked: externalize message` rather than adjudicating it.
- **Reference durable artifacts.** Put long evidence, decisions, and state in a task-owned file at a known-readable absolute path. Do not persist secrets or transient credentials. Send the path plus at most two lines describing what it contains and why it matters; the recipient chooses whether to read it.
- **Use terse deltas after dispatch.** Prefix every delta with the stable reference required by [naming.md](naming.md); an ordinal label such as `slice 1` is never a reference. Then prefer `ok`, `blocked: <one line>` with optional `need: <one line>`, `decision: <one line>`, `artifact: <absolute path>` plus one explanatory line, `hold: <one line>`, or `cancel: <one line>`. Apart from that reference, do not restate rails, paths, or evidence already delivered.
- **Do not narrate lifecycle events.** Record idle, completion, and availability changes silently unless they alter the task. An idle-only notice gets no prose reply.
- **Minimize round trips.** Batch related decisions, keep at most one unresolved request on a task edge, and send again only for changed state, a blocker, a decision, or a requested result. Reconcile crossed messages once; ignore stale updates.

## Working with uncertainty

Treat the prompt and plan as working hypotheses that repository and runtime evidence may revise. Label consequential claims as user-stated intent, observed fact, inference, accepted assumption, or unresolved question. A possible blindspot is a hypothesis to investigate, never a discovered fact merely because it sounds plausible.

Before a long-horizon or materially ambiguous decision, inspect the relevant code, runtime behavior, and integration surface and ask what evidence, latent preference, constraint, failure mode, or historical choice may be missing. Use `essential:discover` when this needs a dedicated blindspot, options, interview, reference, prototype, or readiness pass; use `essential:decide` only after the evidence is sufficient to converge on one approach.

Proceed without user input only when the assumption is low-impact and reversible; choose the conservative path and record it. Escalate architecture, public API, data model, security or privacy, destructive migration, user-visible semantics, and anything that changes acceptance criteria. When evidence disproves a plan premise, stop the stale branch, re-evaluate dependent work, and either re-plan or request the material decision.

The main session owns the authoritative uncertainty ledger and user decisions. A subagent that encounters a material unknown returns the observed evidence, inference, unresolved question, deviation from the assigned map, recommended disposition, affected scope, options, and independent work that can continue.

## Runtime teammate naming

Only the main agent assigns a configurable teammate `name` or label. Use `<short-name>-<role>-<task>` in lowercase kebab-case:

- Select the short name from the three preferences at the end of the role's description: `tech-lead` with preferred name Raj becomes `raj-tech-lead-fix-auth`.
- Keep the role equal to the role-only definition name and use an ultra-short verb-object task. Give parallel tasks distinct semantic qualifiers (`…-audit-auth-api`, `…-audit-auth-ui`), while messages retain their stable reference from [naming.md](naming.md).
- If the chosen short name is already used by a living teammate, use another preferred name; use a numeric suffix only after all three suggestions would still collide.
- Nested agents omit configured names entirely. A permitted one-off nested spawn supplies only its `subagent_type`, task, and context.
- Configured names are human-readable labels, not addresses. Capture the returned `agent_id` and use only that ID for direct communication.

## Intelligence

Resolve task intelligence through the authoritative mapping at
`skills/install-agents/references/intelligence-levels.json`; harness adapters
derive their native model and effort fields from that level. Lifecycle rules
live in [team-lifecycle.md](team-lifecycle.md); read it at spawn and wind-down
moments.

## Nesting

- Nesting is exceptional and one-off: an agent may consider it only when a subagent-dispatch capability is available and the helper's single returned artifact or summary ends the delegation. A leaf-by-charter does not spawn even when the runtime supports nested dispatch.
- The nested call specifies an agent type such as `test-reporter`, never a configured name. The parent follows
  [directions/subagent-handover.md](directions/subagent-handover.md). The same
  4,096-character ceiling applies.
- Continuing or collaborative work is not nesting: route it by `agent_id` under "Delegating well" above.
- Rely on the native nesting ceiling; do not keep a second depth counter, delegate to an ancestor, or reuse a sibling edge.

## Review responsibility

Never spawn a subagent to re-confirm work you just did. Independent review differs: dispatch it when the change is consequential, the user asked for review, or a workflow gate requires it — publishing a pull request is such a gate. Small, bounded work rides its own mechanical gates.

Whoever spawns an agent owns the quality of its output. Choose the best independent domain critic on the roster; give it only the artifact, constraints, and acceptance criteria — never the producer's reasoning. The reviewer returns `ok` or `blocked` plus at most two lines. Detailed findings go to the producer in a bounded review artifact; the lead receives only the verdict and path.

If no domain critic fits, use a general-purpose agent as a criteria-based reviewer; if no internal reviewer exists, any agent may ask an already-configured external review tool, permission policy allowing. Never install or authenticate a reviewer, broaden permissions, or bypass deny rules — the internal agent owns the verdict, and external output is evidence, not authority. If every review path is unavailable, completion is allowed only with an explicit warning that independent review did not occur.

Record changed-code completion exactly as `REVIEWED: source=<specialist|general|external|none> reviewer=<agent-id|tool-name|none> verdict=<ok|blocked|unavailable|not-required> round=<n>`, where `not-required` records `round=0`.

## Context discipline

Report context usage only when the runtime measures it; otherwise report task affinity and whether enough remains — never invent a percentage or token count. Rotate work to a fresh or roomier teammate before measured capacity becomes unsafe, and delegate bulk reads and noisy output rather than ingesting them.
