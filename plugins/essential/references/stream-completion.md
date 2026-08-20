# Finishing a work stream

Read this when a stream's execution finishes, and when a `reviewing` stream is
settled on resume. Everyday planning does not need it — the always-read
contract states only the rule, and the detail lives here.

## One stream at a time

Work **one** stream to completion before starting another. Parallel streams
split attention and leave an overview full of things nobody is finishing. The
rule is measurable in the stream's own fields
([state-format.md](state-format.md)): at most one stream
sits at phase `working` or `reviewing`. No check enforces this; the fields make
it countable.

A `reviewing` stream still holds that slot. Submission does not free capacity
— **landing** does, because a verdict can send the work back, and a second
front opened while the first can still return is exactly the split the rule
exists to prevent. Capacity is freed by a stream reaching `completed`, or by
parking or handing it over. Being blocked frees nothing: a stream waiting on
someone else records `- Blocked on: <who or what>` and stays in the pipeline
at the phase it reached.

## Execution finished is not terminal

Finished execution lands in phase `reviewing`, never straight in a terminal
state. The submission evidence depends on what the stream delivers:

1. For coding work, propose the pull request(s) through
   [coding:pr create](../../coding/skills/pr/SKILL.md) and record their
   references. For non-coding work, record the reviewed deliverables and the
   person whose explicit acceptance is required.
2. Set phase `reviewing` and add `- Blocked on: <reviewer, CI, or accepter>` so
   whoever resumes can check the submission without rediscovering it.
3. Reconcile the stream's `overview.md` row.

`reviewing` requires every required executable leaf to be `done` **and** the
applicable submission recorded. Such a stream is not resumable — there is no
next task to hand anyone — and it is not a mere index marker either: it holds
the one-stream-at-a-time slot until its verdict arrives.

## `completed` requires landing evidence

`completed` is terminal and reachable **only** from `reviewing`, **only** on
the landing evidence appropriate to the stream:

- **Coding work:** the recorded pull request(s) observed merged
  (`gh pr view <n> --json state,mergedAt`), or the stream's changes observed
  present on the default branch when no PR exists.
- **Non-coding work:** explicit acceptance records the accepter, accepted
  artifact, and revision, and the promotion receipt lists every durable result
  promoted out of transient `.state/` into its authoritative destination or
  evidences `not required` when none exists.

On this transition, remove the `Blocked on:` value when it named the now-met
submission wait. Retain a blocker only when it is independently unresolved and
still has a concrete owner or durable carrier; completion does not erase that
separate question, and retirement remains gated on its resolution.

An author's assertion that the work is finished is never landing evidence.
For non-coding work the author may also be the accepter only when the charter
explicitly grants that authority. Passing tests are not landing evidence
while review, sync, publication, durable promotion, or history anchoring
remains required.

[essential:takeover](../skills/takeover/SKILL.md) settles every `reviewing`
stream against this rule before it offers the next task, and asks — never
assumes — whether a settled stream's source tree should be removed, routing
any removal to [coding:cleanup](../../coding/skills/cleanup/SKILL.md).
