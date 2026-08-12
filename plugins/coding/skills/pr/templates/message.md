<!--
Default PR message template for `coding:pr create` and `coding:pr update`
(`coding:commit --create-pr` delegates to `create`).

`coding:standards/git/` owns conformance findings. Validate rendered output
with `scripts/scan-pr-message.py`; this file alone owns the bundled shape.

This is the **default** PR template used when the repo has no GitHub PR
template of its own checked in (e.g. `.github/PULL_REQUEST_TEMPLATE.md`).
When a repo template exists, that template takes precedence and is emitted
verbatim instead of this one.

Publication metadata: classify every PR with the archetype selected in
[create-update.md](../references/create-update.md#select-the-pr-archetype).
Before publication, inspect the
repository's existing labels
and attach the selected archetype when it is available. If unavailable, omit
it, report it as skipped, and continue; never create or substitute labels. The
label is never rendered in the title or body.

Always required: Summary + Goal + Requirements + Context + Verification. Goal
states the outcome; Requirements lists observable behavior, never generic
process gates.
Yellow, red, and black zones also require Risk + Test Plan; red and black
require Why This Size. Implementation, Breaking, Rollback, Feature Flag,
Screenshots, Generated Files, Risk, Test Plan, Why This Size, Related,
Boundary, and Notes are conditional and carry the `[ Optional ]` suffix in this
authoring template even when a zone, archetype, or diff makes one mandatory for
that PR. Remove `[ Optional ]` from every heading in the final rendered PR
message. Every section heading starts with an emoji.

The order is a single arc — why, what, what it costs, what to check, where it
stops — with lookup material last. Authors fill placeholders in
`{{double_braces}}`; the guidance comment above each one says what belongs
there.

Placeholders (for non-LLM callers performing literal substitution):

  Name                       Required  Source / Description
  -------------------------  --------  ----------------------------------------
  summary_paragraph          yes       Plain-language purpose, ≤3 sentences. Derived from commit body lead paragraph.
  goal_body                  yes       Outcome this PR is intended to achieve and why it matters; no implementation detail.
  requirements_body          yes       Testable, observable behavior required from the result; no generic quality/process gates.
  context_body               yes       Why this change is needed; bug links; design background.
  implementation_body        no        What was implemented; trade-offs; design choices; evidence and results. Drop section if empty.
  breaking_changes_body      no        Breaking-change list + migration notes. Drop section if commit subject lacks `!` and no `BREAKING CHANGE:` trailer.
  risk_body                  by zone   Concrete failure modes and mitigations. Required for yellow/red/black.
  test_plan_body             by zone   Checks covering the named risks. Required for yellow/red/black.
  why_this_size_body         by zone   Concise, specific indivisibility rationale. Required for red/black.
  rollback_body              by type   Rollback steps or explicit forward-only mitigation. Required for migration.
  feature_flag_body          by type   Flag name, default, removal target, rollout plan, and cleanup change. Required for feature-flag.
  screenshots_body           by type   Before/after screenshots and relevant accessibility notes. Required for ui.
  generated_files_body       by diff   Generated paths and their source/generator. Required whenever any generated files exist.
  verification_body          yes       Checklist of the checks that must pass before sign-off, ticked as each is confirmed.
  boundary_body              no        Related work the instruction placed outside this change. Drop section if empty.
  additional_notes_body      no        Known limitations, follow-ups. Drop section if empty.
  related_issues_body        no        `Closes #N`, spec links. Drop section if empty.

Substitution rules:
- All placeholders are literal `{{name}}` tokens; no nesting, no expressions.
- An optional placeholder whose value is empty/whitespace MUST cause its entire
  section header (`## ...`) and body to be omitted from the rendered output.
- Every guidance comment is author-facing and MUST be stripped from the
  rendered body, including this block.
- Verification is required: it is never dropped, even when every item is still
  unticked.
- Zone-required placeholders are never dropped or filled with generic stubs.
- Remove `[ Optional ]` from every included section heading in rendered output.
- Output MUST be byte-stable for the same input map (deterministic ordering,
  trailing newline, no trailing whitespace).
-->

📌

<!-- purpose and main changes in plain language, ≤3 sentences -->
{{summary_paragraph}}

## 🎯 Goal

<!-- the outcome this PR intends to achieve and why it matters; describe the
     desired end state, not the implementation -->
{{goal_body}}

## ✅ Requirements

<!-- bullets describing observable behavior the result must provide; exclude
     generic gates such as passing tests, following standards, or keeping CI green -->
{{requirements_body}}

## 🧵 Context

<!-- why this change is needed: the problem and symptoms, related bug or ticket
     links, what problem it solves and why, and relevant design background -->
{{context_body}}

## 🛠️ Implementation [ Optional ]

<!-- features or behavior implemented and how the solution was achieved;
     trade-offs, architectural choices, and design patterns; evidence and
     results belong here, not in Verification -->
{{implementation_body}}

## 💥 Breaking Changes [ Optional ]

<!-- what breaks, and the migration for it -->
{{breaking_changes_body}}

## ⏪ Rollback [ Optional ]

<!-- migration rollback steps; when irreversible, say so and document the
     forward-only mitigation; required for migration -->
{{rollback_body}}

## 🚩 Feature Flag [ Optional ]

<!-- flag name, default state, removal target, rollout plan, and cleanup change;
     team ownership belongs in CODEOWNERS or forge assignments; required for
     feature-flag -->
{{feature_flag_body}}

## 🖼️ Screenshots [ Optional ]

<!-- before/after screenshots and relevant accessibility notes; required for ui -->
{{screenshots_body}}

## 🏭 Generated Files [ Optional ]

<!-- every generated path plus its source or generator; required whenever any
     generated files exist even when platform metadata collapses their diffs -->
{{generated_files_body}}

## ⚠️ Risk [ Optional ]

<!-- concrete failure modes, impact, and mitigations; required for yellow/red/black -->
{{risk_body}}

## 🧭 Test Plan [ Optional ]

<!-- checks that exercise the named risks; required for yellow/red/black -->
{{test_plan_body}}

## 📐 Why This Size [ Optional ]

<!-- concise, specific reason this review surface is one indivisible change;
     required for red/black; generic justification does not satisfy it. Do not add
     file counts, zone metadata, or reviewer-time estimates. -->
{{why_this_size_body}}

## 🧪 Verification

<!-- checks that must pass before sign-off, specific to this change, ticked as
     each one is confirmed; a check, never a result or an observation.
     Change-specific checks are required; these standard checks supplement
     rather than replace them: tests added or updated · docs updated where
     user-visible · CI green locally · no new lint or type errors.
     Add one reviewer triplet for each reviewer required by the standard-owned
     active size-zone policy, in slot order. Do not
     duplicate reviewer counts here; derive them from the active size-zone
     policy in `coding:standards/git/`:
       - [ ] Reviewer slot N assigned
       - [ ] Reviewer slot N reviewed `<head-oid>` against `<base-oid>`
       - [ ] Reviewer slot N approved `<head-oid>` against `<base-oid>`
     Text-only authoring keeps the identity-free slot label. Publication
     replaces it with the assigned `@login` when known. Compare the PR's
     pre-publication and verified post-publication head/base OID pairs. When
     either differs, replace both OID placeholders and reset that reviewer's
     reviewed and approved tasks until that reviewer acts on the new surface; a
     no-op publication preserves evidence bound to the unchanged pair.
     Authoring may publish these tasks pending; review conformance requires all
     three tasks checked for the active pair. -->
{{verification_body}}

## 🚫 Boundary [ Optional ]

<!-- bullets naming adjacent work the instruction placed outside this change
     and where it lives, plus anything a reader would reasonably expect here
     that was not requested; not the author's own judgment calls -->
{{boundary_body}}

## 📋 Additional Notes [ Optional ]

<!-- known limitations, follow-ups, anything else a maintainer needs -->
{{additional_notes_body}}

## 🔗 Related Issues [ Optional ]

<!-- related tickets, issues, RFCs, specs, and discussions, for example:
     Closes #N · See #N · Spec: <link> · Discussion: <link> -->
{{related_issues_body}}
