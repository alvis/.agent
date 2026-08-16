---
name: decide
description: 'Decides between researched approaches before implementation. Use when asked to choose an approach, challenge a recommendation, make an architecture decision, compare options, define rollback and falsification signals, or obtain approval; routes blindspot passes, brainstorms, interviews, references, and prototypes to essential:discover.'
requirements:
  intelligence: high
argument-hint: "[problem-or-question]"
---

# Decide

Converge on one approach before acting. The output is an approved decision,
not an implementation artifact; `essential:discover` owns divergent exploration
when the evidence or option surface is not ready to converge.

## Boundaries

- Use for: choosing among multiple viable approaches, resolving tradeoffs before
  an irreversible change, and grounding a plan in observed constraints.
- Do not use for: blindspot discovery, broad brainstorming, preference
  elicitation, reference extraction, or prototypes (`essential:discover`), or a
  problem with one clear established path (use its implementing skill).

## Inputs

- **Required**: the problem or question (`$ARGUMENTS`); when empty, resolve it
  from conversation context.
- **Optional**: a discovery ledger, specification, decision log, or other evidence
  artifact; an implementing skill for the approved handoff.

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential. If unavailable, stop artifact
writes and report the missing contract. No artifact is written before approval.

<IMPORTANT>
- Never execute, create, or modify files before approval.
- Never delegate: this is one bounded convergence pass, not an audit.
- Do not force a recommendation from sparse evidence. Route to
  `essential:discover` when a material option, constraint, or acceptance
  criterion is still unknown.
</IMPORTANT>

## Workflow

1. **Check readiness.** Read the supplied evidence and up to three directly
   relevant files. Separate user-stated intent, observed facts, inferences,
   accepted assumptions, and unresolved questions. If a material unknown could
   change the option set or acceptance criteria, invoke `essential:discover`
   with that gap and stop this pass until its result returns.
2. **Frame the decision.** State what is being decided, why a naive answer is
   unsafe, the constraints that bind it, and what a bad outcome looks like.
3. **Compare approaches.** Produce two or three materially distinct options,
   always including the smallest viable change. For each, state evidence,
   cost/complexity, reversibility, accepted tradeoffs, and what it breaks or
   ignores. Recommend one option.
4. **Challenge the recommendation.** Give the two or three strongest
   objections. State whether each changes the recommendation and name the
   falsification signal that would make another option win.
5. **Validate completeness.** Require identified dependencies, at least one
   edge case or failure mode, a rollback path or explicit reason none is
   needed, and no hidden material decision. Explicitly deferred matters name an
   owner and decision deadline; blockers prevent approval.
6. **Present and stop.** Ask the user to approve, revise, or reject:

   <report>

   ```text
   RECOMMENDATION: [one-sentence summary]

   Approach: [chosen option]
   Evidence: [observed facts supporting it]
   Tradeoffs accepted: [what is given up]
   Edge cases handled: [named]
   Falsification signal: [evidence that changes the choice]
   Rollback: [path or reason it is unnecessary]
   Deferred decisions: [owner + deadline, or none]

   WAITING FOR APPROVAL — not implementing until confirmed.
   ```

   </report>

   On rejection, incorporate the new constraint and return to step 3. On
   approval, continue to step 7.
7. **Record and hand off.** For project work, write the approved decision to a
   lowercase `decisions/<decision-slug>.md` child with status `accepted`, the
   contract's required metadata, and the causal fields from Essential's
   `decision-causality.md` (`supersedes`/`affects`/`invalidates`/`preserves`,
   each named by id and exact revision; omit empty fields). Never edit a
   previously accepted decision into the new one — supersede it. Return the
   path to the PM for reconciliation into `decisions.md`, together with the
   acceptance's obligation: the blast-radius sweep over `affects`/
   `invalidates`, which the PM runs and journals under the coordinator
   lease; do not edit the overview as a worker. Discover the one
   or two most relevant available skills by frontmatter, select the owner of the
   approved outcome, and invoke it with the decision, observed constraints,
   accepted assumptions, falsification signal, rollback, and relevant paths.
8. Run the verification below; fix a failed check and repeat until it passes or
   a concrete blocker remains.

## Verification

- No artifact changed before approval and no subagent was dispatched.
- Every recommendation is grounded in observed evidence and names its
  falsification signal, accepted tradeoffs, dependencies, edge case, and
  rollback posture.
- No material unknown is hidden as an assumption; discovery was invoked when
  the evidence was not ready to converge.
- The approved handoff includes the full decision contract.

## Completion

Report the recommendation, user decision, deferred decisions, and—after an
approved handoff—the invoked skill and context passed. When no option survives,
name the eliminating constraint rather than forcing a recommendation. Return
explicit final paths generated or materially rewritten as `generated_files`;
the PM size-checks only eligible work Markdown inside the target
`.state/`.
