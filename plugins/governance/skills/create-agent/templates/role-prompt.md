<!-- INSTRUCTION: This is the companion template for an agent's `initialPrompt` frontmatter field — the short
     string every agent's claude.json carries (see templates/agent.md). `initialPrompt` fires ONLY on a no-task
     launch: when the agent is started as the session agent with no input, no task given. It governs just the
     agent's FIRST response — it does not run when the agent is spawned with a task. It is NOT a separate file on
     disk; it is the literal string value of `initialPrompt` in frontmatter/claude.json. This template exists so
     every agent's no-task response follows the same shape without reading as boilerplate. -->

# Role Prompt (initialPrompt) — Template

`initialPrompt` answers one question: *launched with no task, what does this agent do on its first turn?* The
answer is never "start working" — with no task there is nothing to work on. It is either **propose** (glance at
what's in front of it and offer the concrete work it would pick up) or **greet + state need** (say what artifact
or brief it needs before it can begin), and then wait.

## What it must NOT contain

- **No identity line.** Do not open with `You are the <role>.` — the role-only def-file body already
  establishes who it is. Open directly with the instruction.
- **No "no task" announcement.** Do not narrate `You've been launched with no task…` — that is the implicit
  context, not something to say back. Jump straight to the first move.
- **No preloaded context.** Do not tell it to load its base standards on start. A greeting shouldn't burn context on
  work that may not come; the agent loads its base standards only when real work is named. `base.md` still
  documents them.

## The three beats, in order

A short directive — 2–4 sentences, in the agent's own voice, as a flowing string:

1. **First move** — pick by role:
   - *propose* (role-fit — the next work is legible from repo/its area): take a light glance, then greet and
     propose the concrete work it'd pick up first, with a couple of examples.
   - *greet + state need* (it needs a human brief or an upstream artifact): greet, name plainly what it needs to
     begin, and what it'll do with it once handed over.
   A one-clause reason *why* it needs that, in voice, may lead.
2. **Wait** — an explicit "then wait for the user"; do not execute, edit, or spawn on this turn.
3. **Defer + guardrail** — it loads its base standards and starts its loop only once real work is named; fold the
   role's one specific guardrail (the thing this exact role gets wrong most) into this clause.

Keep it 2–4 sentences. It is a first-turn directive, not a spec restatement.

## Literal templates

Propose (role's next work is legible from repo state):

```
<Light glance at X>, then greet the user and propose <the concrete work you'd pick up> — <1-2 examples>. Then
wait; load your base standards and start only once <real work is named>, and never <role guardrail>.
```

Greet + state need (role needs a brief or upstream artifact):

```
<One-clause why you need it>. Greet the user and say plainly what you need: <the artifact/brief>. Offer that
you'll <what you do with it>. Then wait; load your base standards and start only once <it is named>, <role
guardrail>.
```

## Worked examples

Producer that proposes (Tech Lead — repo or plan state is enough to orient and decompose):

```
Lead by orienting, not executing. Take a quick read of the plan, backlog, or repo state, then greet the user and
propose how you'd decompose the engineering goal, which teammate advice should inform the approach, and who
should own each milestone. Ask them to confirm or redirect, then wait; load your base standards only once a real
goal is named, own the resulting technical decisions, and route team formation, teammate spawning, user
questions, and Workflow launches through the Project Manager.
```

Critic that greets (Code Quality Critic — the gate needs a change to run on):

```
The quality gate only runs on a change, and none is named yet. Greet the user and say plainly what you need:
point you at a diff, branch, or changed files to review. Offer that you'll rank findings by severity and escalate
to Security Champion or Adversarial Red-Team when depth warrants — but never edit the code, only report. Then wait; load your review standards
and start only once a real change is named.
```

Leaf/mechanical that greets (Test Runner — terse register, runs what it's pointed at):

```
You're the on-demand sweep — you run what you're pointed at. Greet the user, short and plain, and say what you
need: the package or scope to sweep. Offer that you'll find the test/lint/type scripts, run the full sweep once,
and report the numbers clean. Then wait — you don't author tests or run speculatively; start only when there's a
scope.
```

## Notes

- **Propose vs greet is a role property.** A role proposes only when its next work is visible without a human
  brief — a lead reading the plan, an initializer reading an empty directory, an optimizer reading the roster.
  Everything that needs an upstream artifact (a diff to review, an approved design to build, a hypothesis to
  test) greets and states the need instead. When in doubt, greet.
- The guardrail beat is where role identity survives compression — a generic "be careful" guardrail is a sign the
  prompt was written from the template, not the agent's own base.md. Derive it from what this specific role gets
  wrong most often.
- If the agent is `leaf:true`, the first move is greet-and-report, never "coordinate" or "delegate" — a leaf's
  `initialPrompt` must not imply spawning capability it does not have.
- If the agent is workflow-spawned or a teammate, do not restate `permissionMode` in the `initialPrompt` — that
  is a frontmatter concern (see templates/agent.md's permissionMode-by-launch-scenario table), not a voice
  concern.
