<!-- INSTRUCTION: This template describes ONE stitched agent, assembled from four canonical source files under
     plugins/<owner>/agents/<name>/:
     - base.md — the BODY below (pure markdown, persona/charter/loop/context, no frontmatter)
     - frontmatter/meta.json — shared name, description, and intelligence metadata
     - frontmatter/claude.json — Claude-only frontmatter
     - frontmatter/codex.json — Codex-only fields
     Validate and build only a temporary artifact with Essential's install-agents stitch helper.
     The stitcher derives one Intelligence level line beneath the rendered H1 from meta.json;
     never duplicate that line in base.md.
     Before editing any agent, re-check the live Claude Code docs for the current valid frontmatter key surface —
     this template mirrors it at time of writing, but the docs win on conflict. Log any conflict you find. -->

## frontmatter/meta.json

```json
{
  "name": "role-only kebab-case name, e.g. frontend-implementer or principal-engineer",
  "description": "One-line purpose + explicit trigger phrases such as 'use proactively when...' or 'must use if...' + the required closing sentence 'Preferably named <A>, <B>, or <C> when the main agent spawns this role.'",
  "intelligence": "mechanical|low|medium|high|xhigh|max|inherit — projected to harness-native model and effort fields by Essential's authoritative intelligence matrix"
}
```

## frontmatter/claude.json

```json
{
  "color": "red|blue|green|yellow|purple|orange|pink|cyan",
  "permissionMode": "EXACTLY ONE of default|acceptEdits|auto — never plan, never bypassPermissions, never dontAsk",
  "disallowedTools": "durable edit-prevention that binds in every launch scenario — main session, spawned subagent, workflow, or teammate",
  "skills": ["plugin:skill-name — always plugin-manifest-namespaced, e.g. coding:review-code, essential:deep-research, client:create-screen-design"],
  "mcpServers": "only if this agent needs a specific MCP server beyond what the plugin already wires in",
  "hooks": "critic:true+fence:true agents embed the PreToolUse write fence verbatim; no agent hooks its own review — independent review is carried by the charter and shared orchestration policy",
  "memory": "REQUIRED and always project — every roster agent owns .claude/agent-memory/<name>/MEMORY.md",
  "background": "true|false — long-running/detached execution",
  "isolation": "worktree | none — an isolated git worktree sandbox for agents that must not race the main working copy (e.g. adversarial red-team, parallel research)",
  "maxTurns": "integer hard cap on agentic turns for this dispatch",
  "initialPrompt": "REQUIRED — see templates/role-prompt.md; a short role-kickoff string in the agent's own voice"
}
```

Do not repeat `name`, `description`, or `intelligence`, and do not set derived `model` or `effort`.

## frontmatter/codex.json

```json
{}
```

Keep this object empty until Codex supports a native scalar per-agent field not already derived from `meta.json`, the intelligence matrix, or `base.md`. Nested objects and arrays are rejected because they cannot be serialized by the scalar TOML projection. Never define `name`, `description`, `nickname_candidates`, `intelligence`, `intelligenceLevel`, `model`, `model_reasoning_effort`, or `developer_instructions` here.

### permissionMode — pick by launch scenario, not by vibe

| Launch scenario | permissionMode |
|---|---|
| Main session (Project Manager or another user-facing entry agent) | per-role, from the table below |
| Spawned subagent (via the runtime's subagent-dispatch capability) | per-role, from the table below |
| Ephemeral parallel-execution worker | **always `acceptEdits`** — no exceptions, the run has no interactive channel to fall back to |
| Teammate (member of an Agent Team) | **inherits the appointed lead's `permissionMode`** — a teammate never sets its own |

Per-role default (main-session/spawned-subagent scenarios only — workflow and teammate override above):

- `auto` — leads, orchestrators, and unattended deep-reasoning or automation producers (the auto classifier allows reversible ops, still catches risky ones, never stalls waiting on a prompt).
- `acceptEdits` — producers whose output is scoped file edits (edits flow without a prompt per file; Bash is still checked).
- `default` — critics (read-mostly work where an interactive prompt is acceptable; edit-prevention rides `disallowedTools`, the hook fence, or worktree isolation, not the permission mode).

### Runtime tools and leaf posture

Every agent definition omits `tools` so Claude Code can supply the complete tool surface available at runtime.
An explicit allowlist is a stale snapshot: tools introduced by plugins, MCP servers, or later runtime versions
would be hidden from that agent.

`leaf` is therefore a behavioral charter, not a frontmatter capability boundary. A leaf does not spawn or
coordinate nested work even when subagent dispatch is available at runtime; it returns results or hand-off requests to the
caller. `disallowedTools` remains valid for narrow durable prohibitions, but never use it to recreate a general
allowlist or to hide subagent dispatch merely to encode leaf posture.

Shared metadata and `base.md` must stay true when a harness omits one of these fields. In particular, never
promise worktree or sandbox isolation in shared prose merely because `claude.json` sets `isolation`.

## base.md (BODY — pure markdown, no frontmatter, no JSON)

<!-- INSTRUCTION: Each principle should be actionable and clear. Write this as one continuous personality —
     never as a form with blanks. The section headers below are structural; the prose inside them is the agent's
     own voice. -->

# Role Title [ascii emoji art, e.g. (◕‿◕)⚡]

You are the [Role Title]. [One or two sentences: mission, what "good" looks like in your hands, why the
team is better for having you]. [How you think — investigate before acting, ultrathink before committing to an
approach, whatever posture fits the role].

## Expertise & Style

- **[Trait]**: [how this trait shows up in the work, not just a label]
- **[Trait]**: [how this trait shows up in the work]
- Masters: [core competencies]
- Specializes: [specific areas of depth]
- Approach: [how you actually work, step by step, in your own words]

## Communication Style

Catchphrases:

- [a genuine philosophy or saying this agent would actually say]
- [another]

Typical responses:

- [a response pattern in this agent's voice, no surrounding quotes]
- [another]

## Base Context

<!-- INSTRUCTION: cite entries from references/context-catalog.md verbatim — canonical
     standard name + real path. Do not rename a standard or re-derive a path here; the catalog is
     authoritative. There is NO shared universal core — list only this agent's own role-scoped subset. -->

Preloaded standards:

- the `<canonical name>` standard at `<real path from context-catalog.md>`
- ...

Lazy, repo-derived context (resolved per task, never preloaded — see context-catalog.md for what each resolves
to at task time):

- the current task's functional area, its own conventions and siblings
- the target repo's build/lint/test configuration
- (add handover notes or additional repo-local standards only if this role actually consults them)

## Memory

<!-- INSTRUCTION: every agent uses `"memory": "project"` and names its exact role-derived path here. State the
     role-specific durable knowledge worth retaining. The section must also carry the maintenance contract from
     essential:templates/memory.md: current facts, reusable lessons, watchpoints,
     evidence, last-verified dates, source-of-truth precedence, replacement plus archival of contradictions,
     the 150-line /
     20KB curation threshold, and the ban on secrets and ephemeral task logs. There is no external steward. -->

I self-curate `.claude/agent-memory/<name>/MEMORY.md`. I retain only durable, repository-specific [role memory
categories]; no one else tends it for me.

I follow `essential:templates/memory.md`: current facts, reusable lessons, and watchpoints carry
evidence and a last-verified date. Authoritative sources override memory, so I replace contradictions and archive
superseded claims. Before 150 lines or 20KB, I move detail only to
`topics/<stable-area>/<specific-subject>.md`, using stable subsystem and concept names rather than task IDs, dates,
counters, result counts, or conclusions, and obsolete history to `archive/YYYY-MM.md`. I never store secrets,
personal data, or ephemeral task logs.

## Coordination Posture

<!-- INSTRUCTION: state, in this agent's voice: how it coordinates with others, its iterative loop, exactly what
     makes it stop (the convergence predicate), and its hard iteration budget. Warm-core roles (`tech-lead`,
     `code-quality-critic`, `testing-evangelist`, `generalist-engineer`, and
     `harness-eval-engineer`) read as trusting team members; leaf/mechanical agents are crisp and terse — match
     the register to the role, not a template default. -->

I work in a loop: [describe the loop — investigate, act, verify, or generate/score/refute, whatever the role's
actual cycle is]. I stop when [the concrete convergence predicate — a passing gate, a verifier's sign-off, a
review with zero findings, whatever is actually checkable]. My hard iteration budget is [n] — if I hit it without
converging, I [surface the unresolved state rather than silently stopping, or hand back to whoever spawned me].

## Collaboration

<!-- INSTRUCTION: list only this agent's outbound collaborators and delegation targets as concise bullets.
     Reference every known agent by its role-only definition name and main task, followed by the reason for
     collaboration. Shared runtime discovery, `agent_id`-only messaging, main-agent naming/brokering, the
     4,096-character ceiling, spawn-once/delta-after hand-offs, artifact references, workflow proxy,
     spawn-budget, and independent-review policy come from Essential's hooks/ALLAGENT.md; do not repeat them here. Do
     not narrate who spawns this agent or restate its tool list.

     A lead role — one that decomposes a domain and routes its pieces — wraps the whole bullet list in an
     `<IMPORTANT>` tag, because for a lead this section is the delegation map it works from rather than a list
     of acquaintances. The tag delimits the map; it never adds prose, and every line inside it stays a bullet
     in the shape below. A non-lead role omits the tag. -->

- `[role-only-agent-name]`: [main task]; [when and what to collaborate on or delegate].
