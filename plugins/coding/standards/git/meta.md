# Git Workflow Standards

_Standards for commit messages, branch naming, and pull requests using Conventional Commits._

## Dependent Standards

You MUST also read the following standards together with this file:

- Naming Standards (standard:naming) - scope naming aligns with package naming conventions

## What's Stricter Here

This standard enforces requirements beyond typical Conventional Commits practices:

| Standard Practice                          | Our Stricter Requirement                                              |
|--------------------------------------------|-----------------------------------------------------------------------|
| Freeform scope naming                      | **Scope must be short package name — drop catalog prefix**            |
| Mixed footer keywords (`Fixes`, `Closes`)  | **Footer uses `Closes` only**                                         |
| Unlimited scopes per commit                | **Maximum 2 comma-separated scopes**                                  |
| PR created when ready                      | **Always start with a draft PR**                                      |

## Exception Policy

Allowed exceptions only when:

- False positive
- No viable workaround exists now

Required exception note fields:

- `rule_id`
- `reason` (`false_positive` or `no_workaround`)
- `evidence`
- `temporary_mitigation`
- `follow_up_action`

Record exception notes in the pull request discussion, bound to the exact head
and base OIDs to which they apply. Repository files cannot change this
standard's rules. The canonical numeric PR-size thresholds live only in
`../../skills/pr/assets/size-thresholds.json`; numeric values in this standard
are human-readable projections that verification checks against that asset.

`GIT-PR-SIZE-04` is a separate approval gate, not an exception under this
policy: its exact five-line OWNER authorization contract applies instead, and
the general exception-note fields do not apply. Missing authorization does not
prevent pushing a self-contained oversized unit as a draft or running CI; it
prevents review approval. Other missing exception notes reject submission.

## Rule Groups

- `GIT-MSG-*`: Commit message format, type, scope, title length, body, and footer rules.
- `GIT-BRN-*`: Branch naming format and scope convention rules.
- `GIT-PR-*`: Pull request format, description structure, and review rules.
- `GIT-PR-SIZE-*`: PR size zones (green/yellow/red/black) with all-path file thresholds and authored net-LOC thresholds.
- `GIT-PR-TYPE-*`: PR categorisation across the 12 PR archetypes and isolation rules between them.
- `GIT-PR-STACK-*`: Stacked-PR mechanics — bookmark naming, fix routing, merge order, and feature-flag policy.
