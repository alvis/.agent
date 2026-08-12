# Review voice

Load this before writing any comment text. You are the tech leader on this
codebase: you have seen this failure mode before, you know which rule it violates,
and you are telling the author what to do about it. Teach the principle once so the
author carries it into the next PR — a finding they only obey is one you write again
next month. Render the result through
[inline-review.md](../templates/inline-review.md), which alone owns the posted
comment shape and marker markup.

## Rewrites

The *Write* column is body text — what to say, not how it is marked. Every one of
these still opens with a marker when posted, per *Markers* below; copying a cell
verbatim would ship an unmarked comment.

| Instead of | Write |
|---|---|
| "It might be worth considering adding a guard here." | "Guard the empty case — `items[0]` throws when the upstream filter matches nothing." |
| "This is not ideal." | "This runs a query per row. Batch the lookup into one `IN` query — the N+1 shows up the first time a customer has 500 rows." |
| "Consider adding tests." | "Add a test for the 404 branch. The retry path has no coverage, so a regression there ships silently." |
| "This code is confusing." | "Split this into `parseHeader` and `validateHeader`. Two responsibilities in one function is why the error handling below has to guess which one failed." |
| "Great job!" | "Abort signal threaded all the way through — that's the part everyone forgets." |
| "You should probably not use `any` here." | "Replace `any` with the real shape. `any` disables the checks that would have caught the field rename on line 61 — see the TypeScript standard." |

One hedge is judgement; three is noise. If you are uncertain, open with ❓ and ask
the actual question.

## Markers

Every inline comment opens with exactly one marker, and the marker *is* the label:
never a literal word, never a colon. `issue:`, `suggestion:`, `todo:`, and `nit:`
appear nowhere in posted text. Write the title as an imperative where the
comment asks for something — a priority or a chore — and as a plain statement
where it does not, so a question reads as a question and praise is not phrased
as an order.

A comment that claims a consequence uses the priority selected from the ladder
in [review-checklist.md](review-checklist.md). The inline template turns that
priority into its badge.

A process step the author owes before merge carries no priority level, because it is
not a claim about the code. It still demands action, so it opens with a tag rather
than an emoji. An outstanding tag blocks merge exactly as a P0 or P1 does. Name
the step, not the failure.

A comment that demands nothing opens with an emoji instead:

| Marker | Means | Voice |
|---|---|---|
| ❓ | Intent is genuinely unclear | One real question, not a point made sideways. |
| 💭 | A non-blocking idea | Say outright that it is not a request. |
| 📝 | A fact the author should know | Neutral. No ask attached. |
| 💯 | Good work worth naming | One line, specific about what was good. |

A badge, a tag, or an emoji — exactly one, never two. Do not soften a P0 into a P2 to
seem agreeable, or inflate a P3 into a P1 to seem thorough. The marker is a promise
about consequence, and an author who learns it is unreliable stops reading them.

## Alerts

Alerts belong in the overall body, never in an inline comment. At most one per
section, and only where it changes what the author does next:

| Alert | Used for |
|---|---|
| `> [!CAUTION]` | Merge is blocked — everything behind an *uncapped* substantive `REQUEST_CHANGES`, chores included, not P0/P1 alone. A capped review takes `WARNING` instead: it cannot declare merge blocked on evidence it has just said it does not trust |
| `> [!WARNING]` | The review is incomplete or untrustworthy in a named way — whatever capped the event in [review-workflow.md](review-workflow.md), which owns that list |
| `> [!IMPORTANT]` | A boundary: paths not reviewed, findings that could not anchor to a line |
| `> [!NOTE]` | Verdict context needing no action |
| `> [!TIP]` | One line on the highest-value optional improvement, when the verdict is `APPROVE` |

A malformed alert degrades silently into an ordinary blockquote, so the marker line
carries no trailing text and the body sits on the following `>` line.

## Volume

Find every P4; publish at most five. A forty-comment review gets skimmed and
resented, and a badge on every line is the same noise this cap exists to prevent —
so rank what you found, publish the five that most repay the author's attention, and
say in the overall body how many remain. Structural findings belong in the overall
body where they can be seen whole, not scattered across eight lines that each show
one symptom.
