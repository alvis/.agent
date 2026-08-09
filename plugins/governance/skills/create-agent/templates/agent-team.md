<!-- INSTRUCTION: This is the companion template for forming an Agent Team — persistent teammates that
     coordinate conversationally around a warm core, as distinct from a Dynamic Workflow. The main-session
     Project Manager alone forms and names the team and spawns persistent teammates. Domain leads orchestrate
     their teammates but ask the Project Manager to add them. A spawned subagent or existing teammate
     messages a best-known peer directly by `agent_id`, asking the Project Manager to suggest an owner only when
     it cannot identify one. `tech-lead` is the default coding lead, not the only domain lead. -->

# Agent Team — Template

## When to reach for this

An Agent Team earns its overhead when several roles need persistent, high-signal coordination and warm context —
a design review, incident bridge, or multi-role build where `service-implementation-engineer`,
`testing-evangelist`, and `code-quality-critic` will exchange decisions over time. Reasoning and evidence belong
in durable artifacts, not repeated messages. Independent dispatch-and-score slices belong to parallel `Agent`
calls; high-volume scored iteration belongs to a Dynamic Workflow.

## Identity at runtime

Keep the three identifiers separate:

- **Definition name / agent type** — the role-only registry name, such as `principal-engineer`. Use it to select
  the role and as `subagent_type`; never personalize definition paths or frontmatter names.
- **Configured teammate name** — a human-readable label assigned only by the main agent. Choose one of the three
  preferred short names in the role description and format `<short-name>-<role>-<task>`; choose another
  suggestion when a living teammate already uses that short name.
- **`agent_id`** — the runtime address returned after spawn. Every direct message targets this ID. Never use the
  definition name, `subagent_type`, configured name, or label as a `SendMessage` address.

## Warm core

The default warm core is `tech-lead`, `code-quality-critic`, `testing-evangelist`,
`service-implementation-engineer`, `generalist-engineer`, and `harness-eval-engineer`. Their own
`Coordination Posture` sections carry the trust and working style; this team template does not invent personas.

## Reusing a warm teammate

A teammate loads its base context once and stays warm across tasks. Separate spawns do not share cached context.

- Reuse a living teammate by its `agent_id` when it has the right role, relevant folder/feature history, and
  enough measured room.
- Retire a saturated teammate rather than topping it up; reuse is for warm-and-roomy peers.
- If a subagent knows the best teammate and its `agent_id`, it messages that teammate directly. If the teammate
  is known but the ID is not, the main agent resolves the ID. Only when the subagent cannot identify the owner
  does it send the main agent the role, task, constraints, and relevant history so the main agent can select the
  best living match or spawn a new named teammate and return its ID.
- Nested spawning is reserved for certainly one-off work whose single result ends the delegation. Such a call
  specifies `subagent_type`, omits a configured name, and does not create a standing teammate.

## Roles in a formed team

- **Project Manager** — the main-session orchestrator responsible for the user contract and whole-project
  delivery. The Project Manager selects leads, forms and names the team, spawns teammates, brokers user and
  session-only tools, resolves cross-team dependencies, and decides when the overall delivery is complete.
- **Domain leads** — selected from the live roster by role fit; `tech-lead` is the coding default. A lead gathers
  relevant teammate advice, decomposes its domain goal, owns the resulting implementation decisions, assigns and
  monitors work across the team, reconciles results, and escalates cross-team or staffing needs to the Project Manager.
- **Teammates** — advisers, planners, implementers, investigators, and reviewers who contribute evidence or own
  bounded pieces and return results, blockers, and hand-offs to their assigning lead.
- **Capabilities** — teammates inherit the appointed lead's `permissionMode`; their standalone values and own
  `skills` or `mcpServers` frontmatter do not survive team formation. The Project Manager grants required
  capabilities when forming the team.

## Coordination topology

State one topology when forming the team:

- **Hierarchy** — authority and control updates flow through the domain lead to the Project Manager. Producers
  and reviewers exchange task data directly by known `agent_id`; the lead receives compact verdicts rather than
  relaying evidence. This is the default for managed delivery.
- **Star** — every teammate messages the Project Manager's `agent_id`; use for a small team with no domain lead.
- **Chain** — one known `agent_id` hands directly to another known `agent_id`; use only for stable hand-offs.
- **Mesh** — known peers message one another directly for a bounded exchange. Use sparingly.

The topology describes decision ownership, but the actual `SendMessage` target is always an `agent_id`. Do not
turn the hierarchy into a payload relay.

## Hand-offs

A hand-off sends one bounded mission capsule — objective, acceptance criteria, constraints, why it matters, and
absolute paths to standards and durable artifacts. It never pastes the artifacts into the message. After the
first hand-off, that edge carries deltas only. Every `Agent`, `Task`, and `SendMessage` body stays at or below
4,096 characters. Document planned edges by role for readability, then bind each role to its returned `agent_id`
before the first message:

```text
service-implementation-engineer -> code-quality-critic: implementation complete, before commit
code-quality-critic -> service-implementation-engineer: gate failure, with findings
code-quality-critic -> tech-lead: gate pass, or two rounds exhausted
testing-evangelist -> service-implementation-engineer: coverage gap found during implementation
```

At runtime, the sender uses the recipient's captured ID, for example
`SendMessage(agent_id="agent-7f2", ...)`; it never addresses `code-quality-critic` as a type.

Every planned edge should already exist as a `Collaboration` statement in the source role's `base.md`. The team
activates proven edges; it does not invent ownership.

## Forming the team (Project Manager only)

1. Inspect the live roster and select each domain lead by role fit; use `tech-lead` as the coding default.
2. Confirm the task needs persistent multi-role exchange rather than independent slices.
3. Select the advisers and delivery teammates each domain lead is likely to need.
4. Assign each teammate a collision-free `<short-name>-<role>-<task>` name, spawn it, and record its `agent_id`.
5. Give every lead its domain goal, teammate IDs, and durable context paths in one bounded dispatch. The lead
   gathers advice, decomposes the work, decides the domain approach, assigns and monitors its pieces, and reports
   `ok` or `blocked` plus at most two lines; supporting evidence remains path-addressed.
6. Broker requests for another continuing collaborator by reusing a matching ID or spawning a named teammate.
7. Close only when every role converges, every lead reports its domain delivered, and the Project Manager judges
   the user contract complete.

## Worked example — managed hierarchy

```text
Project Manager agent_id: agent-main

Teammates:
  - role: tech-lead
    configured name: raj-tech-lead-build-auth
    agent_id: agent-41a
  - role: specification-expert
    configured name: sam-specification-expert-plan-auth
    agent_id: agent-42b
  - role: service-implementation-engineer
    configured name: james-service-implementation-engineer-build-auth
    agent_id: agent-52b
  - role: testing-evangelist
    configured name: ava-testing-evangelist-cover-auth
    agent_id: agent-63c
  - role: code-quality-critic
    configured name: marcus-code-quality-critic-review-auth
    agent_id: agent-74d

Topology: hierarchy: agent-main -> agent-41a -> agent-42b/agent-52b/agent-63c/agent-74d
Convergence: agent-41a reports the planned pieces reconciled after agent-74d reports gate pass and agent-63c
reports no open coverage gap; agent-main then closes delivery.
```
