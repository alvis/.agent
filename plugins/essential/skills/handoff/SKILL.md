---
name: handoff
description: 'Create or execute a context-complete cross-domain plan as an orchestrator. Use when another agent must continue without prior context, or when a multi-domain plan needs coordinated execution while this skill retains decision ownership. For coding-session persistence, use essential:handover.'
---

# Handoff

Create or execute a context-complete cross-domain plan. This skill owns
portable planning and coordinated execution; `essential:handover` instead
persists the current coding session in continuation files.

## Boundaries

- Use for: writing a plan another agent can execute without any of this
  session's context, and orchestrating a multi-domain plan's execution while
  retaining decision ownership.
- Do not use for: persisting a coding session for later continuation
  (`essential:handover`), or doing the planned work inline — execution is
  delegated, bar a step you would finish in a handful of tool calls.

## Inputs

- **Required**: the work to plan, or an existing plan to execute.
- **Optional**: the `Workflow` tool for multi-phase execution; `coding:*`
  skills when available — confirm availability before routing to one,
  otherwise name the equivalent action or files without invoking it.
- **Required evidence for a persisted plan**: current repository root, active
  branch, base and HEAD commit SHAs, worktree status, relevant tool versions,
  exact command lines already run with outcomes, the `capability_id` of each
  actor whose run produced recorded evidence (Essential's `truth.md`), and
  absolute paths to every source artifact the next executor must use.

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential. If unavailable, stop artifact
writes and report the missing contract. Resolve the active work directory from
that contract.

## Workflow

1. **Resolve material uncertainty.** Separate user-stated intent, observed
   evidence, inferences, accepted assumptions, and unresolved questions. Ask
   only questions whose answers change scope, architecture, acceptance
   criteria, sequencing, or another material decision; give a recommended
   answer and reason. Remaining uncertainty must be low-impact and reversible,
   explicitly deferred with an owner and decision deadline, or marked blocking.
2. **Write the plan as a zero-context handoff.** Follow
   [Making plans](../../references/directions/plan.md), then specialize its
   required sections as follows:
   - **Goal** — make the verifiable outcome and bar self-contained so the user
     can copy the block verbatim to initiate the work.
   - **Requirements** — preserve every acceptance criterion and operating
     constraint the next agent must satisfy.
   - **Boundary** — name authorized systems, mutations, validation limits, and
     explicit non-goals.
   - **Direction** — include an ordered step-by-step implementation plan with
     exact files, reasons, per-phase acceptance, and rollback/stop conditions.
     When `Workflow` is appropriate, embed a complete plain-JavaScript script or
     an exact durable script path with its SHA-256 checksum and invocation
     arguments. It must run as-is: no placeholders or hidden context,
     deterministic inputs, explicit agent types, and validation against
     `plugins/essential/references/workflow-tool.md`. Otherwise include an
     equivalent sequential command plan.
   - **Context** — retain the direction's current-state, related-decision, and
     recent-work navigation, then add these handoff-specific subsections:
     - **Baseline** — exact repository root, active branch, base SHA, HEAD SHA,
       dirty-status summary, environment constraints, and every test, coverage,
       lint, build, or inspection command already run, with timestamps or run
       order, exit status, and concise result.
     - **Immutable Inputs** — exact absolute and repo-relative paths, filenames,
       artifact IDs, URLs, issue/PR IDs, data snapshots, and commit SHAs that
       define the work. Include file checksums when a referenced file lives
       outside the repository or may change independently.
     - **Decision and Assumption Detail** — user-stated intent, observed
       evidence, accepted assumptions, unresolved questions, owners, deadlines,
       and the precise evidence that should trigger a pivot.
     - **Execution Environment and Tooling** — copy-pasteable setup,
       installation, generation, test, coverage, lint, format, preview, and
       verification commands, each with its working directory, required
       environment, and pass/fail signal.
   Write so an execution agent never has to rediscover basics.
   Avoid pronouns like "this", "that", "above", or "the current task" unless
   the noun is named in the same sentence. Prefer absolute paths plus
   repo-relative paths for handoff-critical files. When the plan must persist,
   write it to a lowercase `proposals/<plan-slug>.md` child with status `open`;
   the PM reconciles the lazy `proposals.md` overview. Update the child to
   `accepted` only after user approval.
3. **Execute as orchestrator** (when execution is requested). Run a
   multi-phase plan as a `Workflow` — one phase per stage, fanning out to
   subagents where a phase allows — instead of doing the work inline. Act as
   the orchestrator and decision maker only: route each phase to the right
   agent with complete context, synthesize the results, and make the calls.
   Delegate all execution — reading, writing, running, testing — to
   subagents, so this session keeps its context for the decisions; the one
   exception is a step you would finish in a handful of tool calls, where
   dispatching costs more than it isolates. To pause a coding session rather
   than hand a plan off, use `essential:handover`. Compose each phase's first
   task handover from
   [subagent-handover.md](../../references/directions/subagent-handover.md),
   placing the approved plan and phase inputs in its extensible Context.
4. Run the verification below; when a check fails, fix the cause and re-run
   that check. Repeat until every check passes or a concrete blocker remains,
   then report the blocker instead of looping.

## Verification

- The plan passes the shared plan-direction verification, and its Goal block
  stands alone when pasted into a fresh session.
- Context includes a **Baseline** subsection with exact paths, branch,
  base/HEAD SHAs, dirty status, commands, outcomes, and relevant output.
- A reader without this session's context could execute the plan — no step
  depends on unstated knowledge or rediscovery of paths, SHAs, filenames,
  commands, tools, or source artifacts.
- Direction embeds a complete dynamic Workflow script, or names the durable
  script path, checksum, and args; if Workflow is not used, it embeds the
  concrete sequential execution commands.
- Every residual unknown is accepted and reversible, explicitly deferred with
  an owner and deadline, or blocking; the plan names evidence that requires a
  pivot.
- When executed: every phase was delegated with complete context — bar any step
  finished inline under the handful-of-tool-calls exception — and each phase's
  results were checked against the plan's success criteria before the next
  phase started.

## Completion

Report the plan's location and its Goal block, the decisions made while
planning, and — when executed — each phase's outcome and any open questions
or deviations from the plan. A blocked execution names the phase, what was
attempted, and what decision or input is needed to continue. Return explicit
final paths generated or materially rewritten as `generated_files`; the PM
size-checks only eligible work Markdown inside the target `.state/`.
