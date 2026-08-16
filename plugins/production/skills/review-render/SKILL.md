---
name: review-render
description: Capture stakeholder feedback and approvals on a specific render or cut, bound to its exact revision and timecode ranges, and determine which approvals survive a new revision or a changed decision. Use when a cut is reviewed, feedback like "approved" or "make the text larger" arrives, or someone asks whether an existing approval still applies; this skill records review truth, never edits media.
metadata:
  intelligence: medium
argument-hint: "<render-id> [--work-id=<id>]"
---

# Review Render

Turn conversational feedback into review records that name exactly what was
reviewed. "Approved" is meaningless without *approved what*: every disposition
binds to one render id at one immutable revision, and an approval of v7 never
carries to v8 merely because v8 was derived from it.

## Boundaries

- Use for recording feedback, approvals, and rejections against renders/cuts,
  and for judging whether prior approvals survive a new revision.
- Do not edit media, do not update the asset manifest beyond validity marks
  routed through `production:track-assets`, and do not manage work-stream
  state (Essential owns the lifecycle).
- Never upgrade partial or scoped feedback into a full approval.

## State gate

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential; if unavailable, stop
artifact writes and report the missing contract. Also read Essential's
`approvals.md` (the approval binding tuple) and `reviews.md`, both in the
essential plugin's `references/` directory. Review records land in the
plugin-namespaced review area `reviews/production-render.md` — sanctioned
alongside the seven canonical review areas, under the same finding and
disposition lifecycle and the `review.md` roll-up; durable release records
promote at completion.

## Workflow

1. Resolve the subject: the render id and its immutable revision from the
   asset manifest. If the feedback names no revision ("the latest cut"),
   confirm the exact render entry with the user before recording anything.
2. Record each piece of feedback as a finding bound to the render revision
   and, when positional, its timecode range. Classify: change request,
   question, observation, or approval/rejection.
3. Record an approval only with the full binding tuple: render id + revision,
   reviewer and their authority, scope approved (whole cut, or named aspects
   such as pacing or grade — scoped approval is not full approval), timestamp,
   and unresolved exceptions. Ask the user to fill a missing tuple field
   rather than inferring it. An approval is a journaled state change: return
   it in the reconciliation payload so the PM records it at once.
4. On a new render revision, evaluate each prior approval: it does **not**
   carry forward. Report which approvals lapsed and what scope must be
   re-reviewed; a superseding decision's `preserves` list may keep named
   aspects (brand palette, CTA) current — cite it when so.
5. When feedback or a decision invalidates an approved render, route the
   `validity: stale` mark to `production:track-assets` and record the review
   consequence here; never rewrite the historical approval.
6. Return every created or updated review record in `generated_files`.

## Verification

- Every disposition names its render id, immutable revision, reviewer,
  authority, scope, and timestamp; positional feedback carries timecodes.
- No approval was inferred, widened beyond its scope, or carried across
  revisions; lapsed approvals are reported, not silently dropped.
- Historical records are append-only: nothing was rewritten or deleted.

## Completion

Report the render id and revision, findings by classification, approvals
recorded or lapsed, reconciliation hand-offs to the PM, and
`generated_files`.
