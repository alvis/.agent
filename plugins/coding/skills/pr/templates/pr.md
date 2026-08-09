<!--
Default PR template for `coding:pr create` and `coding:pr update`
(`coding:commit --create-pr` delegates to `create`).

This is the **default** PR template used when the repo has no GitHub PR
template of its own checked in (e.g. `.github/PULL_REQUEST_TEMPLATE.md`).
When a repo template exists, that template takes precedence and is emitted
verbatim instead of this one.

Publication metadata: every PR receives exactly one existing GitHub archetype
label (`rfc`, `code-spec`, `contract`, `domain-model`, `implementation`,
`integration`, `feature-flag`, `migration`, `ui`, `mechanical-refactor`,
`cleanup`, or `observability`). The label is never rendered in the title or
body. Publication blocks when it is absent from the repository and never
creates labels.

Always required: Summary + Verification. Yellow and red zones also require
Risk + Test plan; red also requires Why this size. Context, Implementation,
Breaking, Rollback, Feature Flag, Screenshots, Generated Files, Related,
Boundary, and Notes are conditional.

The order is a single arc — why, what, what it costs, what to check, where it
stops — with lookup material last. Authors fill placeholders in
`{{double_braces}}`; the guidance comment above each one says what belongs
there.

Placeholders (for non-LLM callers performing literal substitution):

  Name                       Required  Source / Description
  -------------------------  --------  ----------------------------------------
  summary_paragraph          yes       Plain-language purpose, ≤3 sentences. Derived from commit body lead paragraph.
  context_body               no        Why this change is needed; bug links; design background. Drop section if empty.
  implementation_body        no        What was implemented; trade-offs; design choices; evidence and results. Drop section if empty.
  breaking_changes_body      no        Breaking-change list + migration notes. Drop section if commit subject lacks `!` and no `BREAKING CHANGE:` trailer.
  risk_body                  by zone   Concrete failure modes and mitigations. Required for yellow/red.
  test_plan_body             by zone   Checks covering the named risks. Required for yellow/red.
  why_this_size_body         by zone   Concise, specific indivisibility rationale. Required for red.
  rollback_body              by type   Rollback steps or explicit forward-only mitigation. Required for migration.
  feature_flag_body          by type   Flag name, default, removal target, and rollout plan. Required for feature-flag.
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
- Output MUST be byte-stable for the same input map (deterministic ordering,
  trailing newline, no trailing whitespace).
-->

📌

<!-- purpose and main changes in plain language, ≤3 sentences -->
{{summary_paragraph}}

## 🧵 Context

<!-- why this change is needed: the problem and symptoms, related bug or ticket
     links, what problem it solves and why, and relevant design background -->
{{context_body}}

## 🛠️ Implementation

<!-- features or behavior implemented and how the solution was achieved;
     trade-offs, architectural choices, and design patterns; evidence and
     results belong here, not in Verification -->
{{implementation_body}}

## 💥 Breaking Changes

<!-- what breaks, and the migration for it -->
{{breaking_changes_body}}

## ⏪ Rollback

<!-- migration rollback steps; when irreversible, say so and document the
     forward-only mitigation; required for migration -->
{{rollback_body}}

## 🚩 Feature Flag

<!-- flag name, default state, removal target, and rollout plan; team ownership
     belongs in CODEOWNERS or forge assignments; required for feature-flag -->
{{feature_flag_body}}

## 🖼️ Screenshots

<!-- before/after screenshots and relevant accessibility notes; required for ui -->
{{screenshots_body}}

## 🏭 Generated Files

<!-- every generated path plus its source or generator; required whenever any
     generated files exist even when platform metadata collapses their diffs -->
{{generated_files_body}}

## Risk

<!-- concrete failure modes, impact, and mitigations; required for yellow/red -->
{{risk_body}}

## Test plan

<!-- checks that exercise the named risks; required for yellow/red -->
{{test_plan_body}}

## Why this size

<!-- concise, specific reason this review surface is one indivisible change;
     required for red; generic justification does not satisfy it. Do not add
     file counts, zone metadata, or reviewer-time estimates. -->
{{why_this_size_body}}

## 🧪 Verification

<!-- checks that must pass before sign-off, specific to this change, ticked as
     each one is confirmed; a check, never a result or an observation.
     Change-specific checks are required; these standard checks supplement
     rather than replace them: tests added or updated · docs updated where
     user-visible · CI green locally · no new lint or type errors.
     Add one reviewer triplet for each reviewer required by the standard-owned
     active size-zone policy and any project override, in slot order. Do not
     duplicate reviewer counts here; derive them from
     `plugins/coding/standards/git/write.md` (GIT-PR-SIZE-03):
       - [ ] Reviewer slot N assigned
       - [ ] Reviewer slot N reviewed `<head-oid>` against `<base-oid>`
       - [ ] Reviewer slot N approved `<head-oid>` against `<base-oid>`
     Text-only authoring keeps the identity-free slot label. Publication
     replaces it with the assigned `@login` when known. Compare the PR's
     pre-publication and verified post-publication head/base OID pairs. When
     either differs, replace both OID placeholders and reset that reviewer's
     reviewed and approved tasks until that reviewer acts on the new surface; a
     no-op publication preserves evidence bound to the unchanged pair. -->
{{verification_body}}

## 🚫 Boundary

<!-- bullets naming adjacent work the instruction placed outside this change
     and where it lives, plus anything a reader would reasonably expect here
     that was not requested; not the author's own judgment calls -->
{{boundary_body}}

## 📋 Additional Notes

<!-- known limitations, follow-ups, anything else a maintainer needs -->
{{additional_notes_body}}

## 🔗 Related Issues

<!-- related tickets, issues, RFCs, specs, and discussions, for example:
     Closes #N · See #N · Spec: <link> · Discussion: <link> -->
{{related_issues_body}}
