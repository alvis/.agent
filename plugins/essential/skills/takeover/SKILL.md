---
name: takeover
description: Resume paused work from the default source tree's centralized .state/works/. Offer incomplete streams, settle each reviewing stream against its applicable landing evidence, resolve pending decisions, delegate planning to the relevant lead, and drive the selected stream toward its charter. Promote durable results before non-coding completion; route coding publication through the relevant change-publication capability.
requirements:
  intelligence: high
argument-hint: "[--revalidate]"
---

# Takeover

Resume paused work streams. Resumption always reads the centralized work state
under the default source tree's `state_root/.state/works/`, then reads that
tree's global `.state/overview.md` for each stream's recorded source-checkout
`Location`. Resumption resolves pending decisions and
hands each selected stream to the relevant implementation skill, one hand-off
per runnable next action. Resumption
does not stop at that first hand-off: it surfaces the unblocked streams as the
recommended next work, delegates each stream's planning to the relevant lead
role, and drives each selected stream toward its charter's success criteria. At
completion it promotes every stable durable fact, recording evidenced
`not required` when none exists, and for a coding stream delegates pull-request
creation and monitoring to an executor agent running the relevant
change-publication capability. State stays in `.state/`, persisted
continuously by the state contract.

## Boundaries

- Use for continuing paused work streams.
- Only one work stream is worked at a time. Finish the current stream — to
  phase `reviewing` or `completed` — or record its phase plus a separate
  `Blocked on:` value before starting another.
- Do not assume `.state/` is versioned. It is not per-tree either: every
  worktree and workspace resolves to the same centralized state under the
  default source tree, so there is nothing to synchronize between trees.
- Do not implement code here. Apart from resolved decisions, implementation
  belongs to the relevant implementation skill chosen by each stream's declared
  continuation intent.
- Do not plan a stream's work inline. Delegate planning to the relevant lead
  role and let it propose the team or workflow that fulfils it.
- The main session never creates, updates, or monitors pull requests itself.
  It delegates all pull-request work to an executor agent running the relevant
  change-publication capability, which owns opening the PR(s) and monitoring
  their reviews, comments, and CI; takeover only records the resulting PRs and
  never reimplements publication or monitoring mechanics. A non-coding stream
  produces no pull request.
- At completion, promote each stable durable fact to its authoritative
  destination and record the promoted paths; when no such fact exists, record
  evidenced `not required`. A coding pull request need not contain a promoted
  document. `.state/` stays ignored work memory in the default source tree,
  persisted continuously by the state contract.
## Inputs

- Optional `--revalidate`: forces re-verification of each selected stream's
  recorded source anchor against the current checkout even when it already
  appears to match.
- Resumption requires only the on-disk work state under
  `state_root/.state/works/`, which every checkout resolves to; it
  resumes with no overview at all. It additionally reads the global
  `state_root/.state/overview.md` for each stream's `Location` **when that
  file exists**, but a missing overview never blocks a resume. A specification
  is read from the work directory that carries it; a live
  source (such as a Notion-backed spec) is refreshed through the relevant
  specification-sync skill.

## State gate

Before creating or materially rewriting a target-project artifact, read the
absolute `state.md` path injected by Essential. If unavailable, stop
artifact writes and report the missing contract. Reading `overview.md` and
offering streams are the explicit takeover exception to global bootstrap
ordering: they may run first because they do not touch a target project's
artifacts.

The selected stream's `state_root/.state/works/<work-id>/` state already exists
under the default source tree, so resume it there. No bootstrap, anchor
application, or disposable tree is involved: there is nothing to reconstruct.
When its recorded `Location` names a different source checkout, switch the
working directory to that checkout only for source work; continue every state
lookup and write through the same centralized `state_root`. A stream's identity
is the one recorded in that centralized state; never mint a replacement.

Bootstrap remains required only when a resume must **create** work memory that
does not exist — the normal ignore gate, then the resolver with that exact work
ID and `--bootstrap`. A directory that is already present needs neither,
because it already carries its own work state.

## Workflow

L1. Enumerate **every** incomplete work stream. Resolve `state_root` and read
    each `state_root/.state/works/<work-id>/state.md` directly; the
    continuable ones (phase `planned` or `working`) are the resume candidates;
    `Blocked on:` is a separate field that determines whether a next action is
    runnable, not a phase. This on-disk state is the authority, and it is the same
    set whichever worktree or workspace this session started in — no overview is
    required to resume.

L2. Additionally read the global `state_root/.state/overview.md` for each
    stream's `Location` — the checkout its code is worked in, with kind,
    label/path, and revision. It is only an index: treat `works/` as
    authoritative and reconcile any overview row against it. If `works/` lists
    no continuable and no `reviewing` stream, stop and report that nothing is
    resumable; if the user named a specific stream, say which work directory
    would have to be present (`state_root/.state/works/<work-id>/`).

L2b. **Settle every `reviewing` stream before offering the next task.** A
    `reviewing` stream has finished executing and recorded its applicable
    submission. For coding work, check the recorded PR(s) with
    `gh pr view <n> --json state,mergedAt`; with no PR recorded, fall back to
    whether its changes are present on the default branch. For non-coding work,
    check for explicit acceptance naming the accepter, artifact, and revision,
    plus a promotion receipt listing every promoted durable path or evidenced
    `not required`. On applicable landing evidence, clear the submission-wait
    blocker, retain only an independently unresolved blocker with a concrete
    owner or durable carrier, set its phase to `completed`, and reconcile
    its `overview.md` row, then use the graphical or structured user-input tool to ask whether to remove that
    stream's source tree from disk — routing any removal to
    [coding:cleanup](../../../coding/skills/cleanup/SKILL.md), which owns
    worktree inventory and per-target approval. Never run `git worktree remove`
    here, and never treat a merged branch alone as authorization to delete.
    A stream with no applicable landing evidence yet stays `reviewing` and is reported as
    such. Only then continue to L3.

L3. Offer the continuable streams through the graphical or structured user-input tool, grouped by the
    checkout each is worked in and defaulting to this one's streams; `reviewing`
    streams that L2b could not settle, plus `completed` streams,
    are not resumable, so exclude them and name them so the user sees why.
    Within each group, surface the **unblocked** streams first — those with a
    runnable next action and no decision still blocking it — as the recommended
    next work, and annotate a stream carrying `Blocked on:` with the decision it is waiting on
    so the user sees why it is not yet runnable.
    Because only one stream is worked at a time, take a single selection. If the
    chosen stream's `Location` is a **different** checkout, switch the working
    directory to that Git worktree or jj workspace root before continuing — the
    code is resumed from inside the checkout that owns it, even though the state
    is shared. Verify the selected stream's
    `state_root/.state/works/<work-id>/state.md` exists and its on-disk
    phase is continuable, dropping any stale option.

L4. For each selected stream, read its on-disk
    `state_root/.state/works/<work-id>/`
    state directly: `state/working.md` first when present, then `state.md`
    (including its `## Continuation` section: current task, next owner, next
    action, and continuation intent), its linked detail files, decisions, and the
    materialized specification. From the `state.md` task table (and any
    `state/*.md` children), determine which tasks are runnable, which are blocked,
    the current owner, and the next action; there is no separate validation step.
    Treat repository and runtime evidence as authoritative over stale local
    memory. No anchor application, disposable tree, or bootstrap is needed — the
    work state is already present under the default source tree; the recorded
    `Location` affects only which source checkout is used for implementation.

L5. Verify each selected stream's **source anchor** against the current checkout
    before handing work off. Read the anchor from that stream's `## Continuation`
    section and compare it with the checked-out revision. When they match,
    continue. When they diverge, do not check out a second revision inside a
    tree already holding other streams:
    report the exact revision the stream assumes and let the user bring this
    checkout to it or re-run takeover in a worktree at that anchor. When a stream
    records an approved patch or bundle under its `artifacts/`, name it as the
    means to reach that revision, and apply it only with explicit user approval.
    `--revalidate` forces this comparison even when the anchor already appears
    to match. An anchor mismatch stops that
    stream only — other selected streams continue.

L6. Reconcile a centralized work directory this session did not write before
    taking coordinator ownership. A `lease.json` left by another owner is never inherited:
    treat it as stale and claim the stream through the explicit `takeover` lease
    verb below, journaling the returned payload. Reconcile the stream's row into
    the default tree's `overview.md` with its current `Location`, and leave its
    recorded identity untouched. If the
    directory's structure is damaged or its `state.md` unparseable, stop that
    stream and recommend `essential:doctor` rather than repairing it inline.

L7. Resolve decisions that block a selected stream's next action with
    the graphical or structured user-input tool; store detail in that stream's `decisions/<slug>.md`,
    reconcile `decisions.md`, and update the affected state tasks. Then continue
    into the shared hand-off at step 11 — step 10's decision reconciliation is
    already done.

## Shared continuation

Before the first coordinator write to any selected stream, hold its on-disk
lease with the idempotent `state-lease ensure` verb (Essential's
`lease.md`): it acquires a free lease and renews one this session already
holds; `contended` means a live foreign coordinator owns the stream — stop
and report it, never write; `takeover_required` means the lease expired
under another owner — claim it only with the explicit `takeover` verb and
journal the returned payload as a `lease` event. Takeover does not run the
structural doctor; if resuming surfaces evidence of structural damage (a
resolver failure, an unparseable `state.md`), stop that stream and recommend
`essential:doctor` instead of repairing inline.

10. Resolve decisions that block a selected stream's next action using
    the graphical or structured user-input tool. Store detail in that stream's `decisions/<slug>.md`,
    reconcile `decisions.md`, and update the affected state tasks. Leave deferred
    questions explicit with owner/deadline. (Step L7 already did this; do not
    repeat it.)

11. Plan, then resume the stream's current runnable next action. Do not plan the
    work inline: first delegate the stream's planning to the relevant lead role,
    composing the first task handover from
    [subagent-handover.md](../../references/directions/subagent-handover.md).
    Its task-specific Context names the next action, staged specification, work
    ID/root, resolved decisions, contradictions, and original user context. The
    lead returns a proposed **team** (coordinated parallel
    work) **or** a **structured multi-phase workflow**, with the task detail for
    each piece. Then execute that plan through the stream's declared continuation
    intent, handing off to the relevant implementation skill and
    passing the lead's plan alongside the same task context. Hand off once per runnable
    next action — the drive-to-completion loop in step 13 re-enters this step for
    each subsequent runnable action, and a completed action is never re-handed.
    Because publication is delegated downstream at completion (step 12), instruct
    the hand-off to **defer its own publication**: it saves work locally but does
    not open or update pull requests itself. Each stream keeps its own
    coordinator lease, so per-stream handoffs run sequentially or as per-stream
    continuation handovers to the PM. Choose each skill by mapping that stream's
    capability-level continuation-intent descriptor to the relevant
    implementation skill. The descriptor comes from the `## Continuation` section
    of the on-disk `state.md`. When it is absent (state written before this field
    existed), derive the intent from
    on-disk evidence — specification-led implementation when a materialized
    specification governs the next action, generic coding implementation
    otherwise — rather than hard-rejecting. Reject only a source-contradictory
    descriptor, and never silently fall back to a fixed skill name.

12. When a selected stream finishes executing — every required executable leaf
    `done` — meet the completion obligations before moving on. State is already
    durable, the state contract persists it continuously, so this
    step only promotes, publishes, and parks the stream for review:
    - **Durable promotion (work-type aware).** Inventory stable facts that must
      outlive `.state/` and promote each to its authoritative destination,
      including versioned `docs/` when documentation is the durable form.
      Record the paths in the closure promotion receipt. When the stream
      produced no stable durable fact, record evidenced `not required`; never
      promote transient task state merely to manufacture a document.
    - **Pull requests (coding streams only).** When the completed stream's
      continuation intent is code implementation, delegate the saved code
      change to an
      executor agent running the relevant change-publication capability: it opens
      a **single pull request** for a small change or an ordered **stack** for
      dependent changes, and it owns monitoring the resulting PRs' reviews,
      comments, and CI. Confirm the capability is available before routing; if it
      is unavailable, report the equivalent action and the exact saved change to
      publish. Record the resulting PRs. A non-coding stream produces no pull
      request and is named as skipped. A coding PR does not require a promoted
      document; any independently required durable promotion remains evidenced
      by its receipt.
    - **Park at `reviewing`.** Set the stream's phase to `reviewing`, record
      the applicable submission in `state.md`, and reconcile its `overview.md`
      row. Finishing the work is not the same as the work having landed: only
      coding merge/default-branch evidence or non-coding explicit acceptance
      plus a promotion receipt listing durable paths or evidenced `not required`
      makes a stream `completed`, and L2b is where a later run collects
      it. Non-coding work also enters `reviewing`; having nothing to merge does
      not bypass explicit acceptance or the promotion receipt.

13. Drive each selected stream toward completion. After a stream's hand-off
    returns, re-read its on-disk `state.md`: if its required executable leaves
    are done, run step 12 for it; if runnable work remains, continue it. Once the
    stream reaches `reviewing`, re-surface the next **unblocked** stream — the
    one with a runnable next action and no blocking decision — as the recommended
    next work and continue from step 10 for it. Repeat until every selected
    stream reaches `reviewing`/`completed` or hits a genuine blocker the
    user must resolve. The loop stays user-gated — selection and consequential
    decisions remain the user's — and bounded: stop and report when no selected
    stream makes progress or an escalation is unresolved, rather than looping
    without advance. Do not start another stream here; offer it as a fresh run
    instead.

14. Return every created or materially rewritten path in `generated_files`,
   including durable promotion paths when any were required. Do not run file sizing; the PM checks only
   eligible work Markdown inside the target `.state/`.

## Verification

- Exactly one stream was resumed; `completed` streams were
  excluded and named, and only the user-selected stream was resumed.
- Every `reviewing` stream was settled before the next task was offered: its
  applicable landing evidence was checked, a landed stream became `completed` with
  its `overview.md` row reconciled, and any source-tree removal was offered to
  the user and routed to `coding:cleanup` rather than run here.
- Resumption enumerated the centralized `state_root/.state/works/`, used
  `overview.md` only for each stream's `Location`, switched the working directory
  to the checkout owning the chosen stream, and continued from on-disk state
  without bootstrap, anchor application, or a disposable tree.
- Each stream's continuation used its authoritative on-disk work state.
- Each selected stream's recorded source anchor was compared with the current
  checkout, and every divergent-anchor stream returned a re-run or
  bring-the-checkout instruction rather than a second checkout here.
- Every work directory this session did not write had its foreign lease claimed
  through the explicit `takeover` verb and its `overview.md` row reconciled to
  its current `Location`, with its recorded identity untouched.
- Each resumed `state.md` is complete and links the PM-owned, current-focus-only
  `state/working.md`; each selected implementation skill received the coordinator
  lease plus exact work, specification, decision, and source paths.
- Every resolved decision is durable in the affected stream's decision artifacts.
- Each implementation hand-off advanced one runnable next action by the stream's
  declared continuation intent — no fixed skill name, no silent fallback, no
  completed action re-handed — and deferred its own publication.
- Unblocked streams led selection, and each selected stream reached its charter's
  success criteria or a named blocker.
- Planning was delegated to the relevant lead role, returning a team or a
  workflow; no plan was authored inline.
- No pull-request work ran in the main session: creation and monitoring were
  delegated to an executor agent, and non-coding streams opened none.
- Every stable durable fact was promoted to its authoritative destination, or
  the receipt evidenced `not required`; `.state/` stayed operational work memory.
- No stream was written under a live foreign lease; every expired lease was
  claimed through the explicit `takeover` verb and journaled.

## Completion

Prefix the unchanged implementation-skill reports with the workspace root, the
selected source checkout, the selected streams and each one's centralized work directory, any
divergent-anchor streams deferred to a re-run, the implementation skill chosen
per stream from its declared continuation intent, the lead role's chosen topology
(team or workflow) per stream, contradictions, decisions, materialized spec
paths, durable promotion paths or evidenced `not required`, the pull requests the executor opened per
completed coding stream (URLs and single-PR-or-stack shape, with non-coding
streams named as skipped), any claimed foreign leases, and `generated_files`.
On rejection, name the invalid overview entry, stream, or source,
and recommend `essential:doctor` when the on-disk state itself is damaged.
