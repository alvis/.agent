# Reviews

Read this when opening, writing, or reconciling review artifacts.

`review.md` is the current roll-up. Details live under `reviews/` in the
seven canonical **review** areas:

| File | Question |
| --- | --- |
| `alignment.md` | Does the implementation match the approved contract and scope? |
| `correctness.md` | Is behavior semantically correct, including unspecified cases? |
| `security.md` | Are trust boundaries, data, permissions, and abuse cases safe? |
| `quality.md` | Is it maintainable, reliable, and appropriately structured? |
| `testing.md` | Is intended behavior verified sufficiently and reliably? |
| `docs.md` | Are engineer and user explanations accurate and sufficient? |
| `style.md` | Does the change follow mechanical and idiomatic conventions? |

The seven names are exhaustive for lifecycle reviews — do not create
`audit.md` or `deviations.md`. A domain plugin may additionally record its
own review truth in a **plugin-namespaced area**, `reviews/<plugin>-<area>.md`
(for example `reviews/production-render.md`), under the same finding and
disposition lifecycle below; `review.md`'s roll-up covers namespaced areas
alongside the canonical seven.

A finding is `open`, `fixed`, `acknowledged`, `deferred`, or `skipped`.
`fixed` is closed only by verified evidence. `acknowledged` and `skipped` are
closed non-fixed risk dispositions only with non-placeholder rationale, an
accountable owner, and an explicit recheck condition; P0/P1 additionally
require explicit risk-acceptance authority and durable acceptance evidence.
`open` and `deferred` are outstanding and block review closure. A malformed
`acknowledged` or `skipped` entry remains outstanding. `review.md` records
both the five disposition counts and derived `closed` and `outstanding`
counts using exactly this mapping.

Contract/completeness audit findings belong to `alignment.md`; semantic bugs
belong to `correctness.md`. Plan deviations belong in `state.md` and also in
`alignment.md` only when they cause contract drift. Work closes only when
`review.md` agrees with every detail. Reviewers own only assigned area
details and return roll-up deltas; the coordinator-lease holder alone
reconciles `review.md` after all review writers finish. A nested review
workflow without that lease returns a summary delta instead of touching the
roll-up. Every approval recorded in a review carries the binding tuple from
[approvals.md](approvals.md).
