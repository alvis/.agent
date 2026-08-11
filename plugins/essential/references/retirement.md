# Promotion, parking, and retirement

Read this when promoting durable knowledge, parking an idle stream, or
retiring a completed one.

## Promotion

Promotion is auditable after retirement deletes the work stream: every
promoted `docs/` file carries front matter naming its `source-work` (the work
ID), promotion date, and any superseded document, and work closure requires a
promotion receipt in the stream's final `changes/` child listing every
promoted path. Only stable knowledge is promoted — never transient task
state. Durable docs that can age may carry the freshness metadata in
[approvals.md](approvals.md).

## Parking idle streams

Live streams are not free: the journal grows, `state.md` accumulates rows,
and every session re-reads them. A stream idle long past its last journal
entry — abandoned rather than paused — may be **parked**: move its entire
`works/<work-id>/` directory to `.state/archive/<work-id>/`, the single sink
for every stream that leaves `works/`, which the
resolver never enumerates, and drop or annotate its `overview.md` row. Both
paths are under the default source tree's `.state/` — the only tree that
carries one — so parking is a move within one directory, never across trees. Park
only with user approval, journal the parking as the final line first, and
never park a stream holding an unresolved critical risk or an unpublished
accepted decision — resolve, promote, or hand over those first. Unparking
is a plain move back. A summary journal line may also compact history: it
may summarize and supersede the journal lines before it, keeping live
streams readable without losing the record (the superseded lines remain,
marked by the summary above them).

## Completion and the debt rule

These steps are ordered, because two of them are crash-unsafe reversed.

1. **The completion receipt is written first.** Phase `completed` requires it
   ([state-format.md](state-format.md)); everything below
   reads from it rather than from the overview row it is about to drop.
2. **Every outlives-me item has an owner, or the stream does not complete.**
   A follow-up left in a row that will be deleted in days, held by nobody, is
   a plan to forget it. Promote it to `docs/`, open a successor stream, or
   file it in the tracker — then name that carrier in the receipt.
3. **Merge evidence is a recorded locator — a pull request number or a merge
   SHA — and elapsed idle time never substitutes for one.** A stream marked
   `completed` whose directory holds no PR, no SHA, and no journal line has
   demonstrated nothing; retiring it because it has sat still for weeks
   converts *"nobody recorded why this finished"* into *"this finished"*, and
   files that upgrade in the one place nobody re-reads. Absence of evidence
   fails toward the finding: the stream stays in `works/`, and its `Next
   action` names the missing locator.
4. **A `completed` stream at `Blocked on: <named blocker>` does not archive.**
   The condition is merge evidence **and** no open question, because `archive/`
   is skipped by the resolver — archiving a stream that still carries an
   operator question drops that question out of the overview's `Awaiting you`
   section, burying precisely what that section exists to surface. Merge
   evidence retires the work; it does not answer the question. The stream holds
   its place at phase `completed` until the question is answered, or until its
   answer is owned by a carrier that outlives the stream (step 2).
   `Blocked on: unknown` names no question, so archiving drops nothing out of
   `Awaiting you` and nothing holds the stream: it is an ordinary stream
   overdue for retention under step 5.
5. **Three days after merge evidence, move `works/<work-id>/` to
   `archive/<work-id>/` first, then drop the overview row.** Three days is long
   enough for whoever was watching the merge to see it settle, and short enough
   that the table indexes live work. The order is not negotiable: while the
   stream sits in `works/` the overview row is its only index, so dropping the
   row first hides live work, and a crash between the two steps loses it
   entirely. The stream then appears in `Recently landed` until that section's
   cap retires the line, and in `archive/` permanently — nothing deletes an archived stream,
   which is what keeps its ID from being reused.

## Retirement

Retire completed local work only after acceptance, review closure, durable
promotion, Notion push and verification pull, final receipts, and every accepted
decision's disposition under the completion gate
([decision-causality.md](decision-causality.md)) are recorded — retirement
deletes the operational projection, so nothing consequential may exist only
there. The default retention is 30 days unless repository compliance policy
requires longer. Existing ambiguous artifacts are reported and preserved,
never deleted or migrated by guesswork.

A retired stream's own `archive/<work-id>/state.md` is the one home for its
identity and outcome, whatever the stream had worth promoting — code-only work
leaves no durable document to carry its name. Never delete state while that
archived record is still loose in the working tree: an uncommitted record does
not outlive the state it stands in for.
