# Review checklist and finding schema

Load this from the *Review* step of `coding:pr review`. Evidence rules come from
[the shared review mandates](../../review-code/references/mandates.md); this file
adds what is specific to reviewing a PR diff.

## Depth

Scale reading depth to the size zone: green reviews line by line, yellow leads
with the key areas then goes line by line, and red leads with architecture and
goes line-level only where it matters. A black PR first proves that it is one
genuinely self-contained unit, such as a large-area edit or rename, then
receives a full review whose depth is not capped solely by size. Authorization
does not control review depth; it controls whether the final event may be
`APPROVE`.
The zone shapes how you read, never what you may find — nothing downstream can
recover a finding you chose not to make.

Before approving a black-zone PR, require specific Risk, Test plan, and Why
this size evidence in its canonical body. Then inspect only the authorization
helper's live structured receipt as semantic authorization evidence; do not use
an earlier fetched comment or body. The receipt's `authorization_body` and
`rationale` must identify an atomic
subject, the concrete coupling that prevents a safe split, and the consequence
of splitting in the grammar
`<atomic subject> because <coupling>; otherwise <consequence>`. A generic or
tautological rationale blocks approval even when the helper accepted its
structure.

Selectivity belongs to publication, not detection, and it caps only optional
polish. Publish every P0 through P3 finding you found, however many that is;
ranking decides the order they are read in, never whether they appear. P4 is the
sole capped level — [review-tone.md](review-tone.md) publishes the five highest-ranked and
counts the rest in the overall body — so a 2,000-line review of trivia teaches
nothing, while a long list of real defects is the review doing its job.

One finding per problem, at the highest priority that applies. The same mistake in
eight places is one finding on the clearest instance, noting that it applies
throughout.

## Checks worth reading outside the diff for

These are the findings a diff-only reader cannot make, and they are usually the
most valuable ones in the review:

- **Does it really work as intended?** Trace every stated goal and behavioral
  requirement through the implementation, callers, failure paths, edge cases,
  and tests. Exercise or otherwise prove the relevant runtime path when static
  reading cannot establish behavior. Report behavior that only appears to work
  on the happy path.
- **Is this the best solution?** Walk the lean ladder in
  [WORKFLOW.md](../../../references/WORKFLOW.md). Search the repository before
  accepting new code, content, tests, helpers, types, fixtures, utilities, or
  constants. Reimplementing what a foundational module, nearby code, the
  platform, or an installed dependency already provides is a finding, as is an
  abstraction with one caller.
- **Is this the right place?** A correct change in the wrong location is still a
  finding. Watch for a guard repeated at every call site that belongs in the callee,
  validation in a controller that belongs in the domain layer, a constant copied
  locally that belongs in shared constants, and a symptom patched downstream of the
  function that actually produced the bad value. Propose the destination by exact
  path in `alternative`, and explain what moving it buys — usually that the other
  callers get the fix too. Root-cause-versus-symptom placement is P1, because the bug
  stays live everywhere else; ordinary layering misplacement is P2. When the right
  home is a lower PR in the stack, say so and point at `coding:commit --reorder`,
  which owns reparenting; never reshape history from here.
- **Callers of what changed.** Follow a changed signature, return shape, or thrown
  error into its actual call sites. A caller that now receives `undefined`, ignores
  a new error, or breaks on a renamed field is a verified finding — anchor it to the
  changed line that breaks it, and name the call site in the body.
- **Siblings the new file should resemble.** Open the files with the same role in
  the same directory and compare naming, parameter and return shape, error, log,
  retry, and cache behavior. Unexplained divergence from an established local
  pattern is the most common real finding in a PR review.
- **Scope against the stated goal.** The PR title, body, and any resolvable
  goal/spec are the contract. Report what the PR claims but does not do, and what it
  does without claiming — scope creep is a finding, not a bonus.
- **Does it follow every applicable standard?** Review file placement against
  `file-structure/`, behavior and APIs against `universal/` and `function/`,
  tests against `testing/`, docs and comments against `documentation/`, and
  each changed language against its language-specific standard. Cite the exact
  rule for a violation.
- **Can anything be removed without changing the result?** Flag code, content,
  tests, helpers, wrappers, assertions, or repeated prose whose removal leaves
  required behavior and readability unchanged. Repetition is justified only
  when it materially improves readability or preserves a required boundary.
- **Secrets and trust boundaries the diff introduces.** Any token, credential,
  internal hostname, or widened trust boundary entering the repository in this diff.
- **Docs the change makes wrong.** Read the README, API doc, or example the changed
  surface belongs to, and flag it when the diff contradicts it.

`style` reports only what the candidate scan surfaced plus naming-policy gaps, each
with its rule id. Never run project lint — `coding:lint` owns that.

## Finding schema

Record each finding as:

<report>

```yaml
findings:
  - path: <repo-relative path as it appears in the diff, or null when the finding anchors to no line>
    line: <line number in the head revision, or null wherever path is null>
    side: RIGHT | LEFT, or null wherever path is null
    start_line: <first line of a multi-line range, or null>
    subject: <what the finding is about, for an unanchored finding: a repo-relative path, or null for the PR as a whole>
    concern: alignment | correctness | security | quality | testing | docs | style | process
    priority: P0 | P1 | P2 | P3 | P4 | null
    kind: question | thought | note | chore | praise | null
    title: <concise raw title without marker or template markup>
    body: <raw explanatory body without marker or title wrapper>
    evidence: <the rule, failure path, or repository precedent it rests on>
    alternative: <exact path this change belongs in instead, or null>
goal_spec_alignment: matches | diverges | skipped_unknown
intent_behavior: matches | diverges | skipped
standards_alignment: matches | diverges | skipped
reuse: no_missed_reuse | missed_reuse | skipped
minimality: lean | removable_content | skipped
not_reviewed:
  - path: <path>
    reason: <binary, generated, vendored, deleted, or too large>
```

</report>

`title` and `body` are the authoritative raw finding. Render them through the
selected review template only while assembling a GitHub payload. Retaining raw
fields lets failure recovery move an unanchored finding and render it into the
overall body without copying inline-only markers or markup.

- `path` and `line` must come from the changed-line map. A finding rooted in
  unchanged code anchors to the changed line that causes it.
- A finding that anchors to no line is posted in the body's *Not anchored to a line*
  section, and every anchoring field goes null together: `path`, `line`, `side`, and
  `start_line`. They describe one anchor between them, so a surviving non-null `side`
  would assert a diff position the finding does not have. Null is the only
  alternative to a real anchor: inventing a plausible line to satisfy the schema is
  how a merge blocker ends up attached to code that has nothing to do with it.
- `subject` carries identity where `path` carried anchor, and only the anchored case
  lets one field do both jobs. A deleted or missing file has a real path and no line
  to point at; a rebase `chore` has neither. Set `subject` to that path where the
  finding is about a file, and leave it null only where the finding is genuinely
  about the PR as a whole — the body renders a null `subject` as `This PR`, which is
  a lie about a finding that actually names a file.
- `side` is `RIGHT` for added lines and `LEFT` for removed ones; most findings are
  `RIGHT`. `start_line` opens a multi-line range and must be below `line` on the
  same side — use it when the problem is a block, not a line.
- `priority` is about consequence, not effort: **P0** breaks correctness, security,
  or data integrity; **P1** violates a standard or will cause a real defect; **P2**
  is maintainability or design; **P3** is optional polish; **P4** is trivia. It
  drives the verdict.
- `concern` is what the finding is about. Every value but `process` grades the code;
  `process` is the one that does not, and it exists so a `chore` — which demands a
  step the author owes rather than a change to the diff — has somewhere honest to
  sit. Every `chore` is `process`, and nothing else is.
- `kind` classifies a comment that makes no priority claim: `chore` for a process
  step the author owes before merge, `question` where intent is genuinely unclear,
  `thought` for a non-blocking idea that is explicitly not a request, `note` for a
  fact the author should know, `praise` where the work is genuinely good.
- Exactly one of `priority` and `kind` is non-null. A comment that claims a
  consequence carries a priority; one that does not carries a kind.
  [review-tone.md](review-tone.md) selects the marker semantics and
  [inline-review.md](../templates/inline-review.md) renders them,
  so this field decides the marker and no judgement is left at render time.
- `chore` is the one kind that blocks merge, because it demands an action even though
  it grades nothing. An outstanding `chore` drives the verdict exactly as a P0 or P1
  does; every other kind leaves the verdict untouched.
- `evidence` is mandatory. A finding that cannot name the rule it applies or the
  failure it predicts is an opinion, and opinions are not posted.
- `alternative` carries a real path, not a direction. "Move this to the service
  layer" is not actionable; `src/orders/order.service.ts` is. Leave it `null` unless
  a better location was actually found.
- `goal_spec_alignment` is `skipped_unknown` when no goal or spec can be resolved.
  Never infer a goal from the diff and then grade the diff against it.
- The other verdict fields summarize the corresponding mandatory checks; use
  `skipped` only when the concern could not be completed and name that blocker
  in `not_reviewed`.

## When a concern cannot be finished

Name it in the completion report and cap the verdict at `COMMENT` per
[review-publishing.md](review-publishing.md). Never present a partial review as complete, and
never fill the gap by dispatching another reviewer.
