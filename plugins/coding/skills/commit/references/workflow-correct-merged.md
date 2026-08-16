# Auto-detected: target of edit/absorb is already merged on origin

Triggered any time the skill would rewrite a change whose bookmark is associated with a `MERGED` PR. Default = the corrective PR on top required by the [commit and branch directions](../SKILL.md#commit-and-branch-directions). Rewrite-with-consent is opt-in. See [SKILL.md](../SKILL.md).

## When triggered

Any of:

- [workflow-edit.md](./workflow-edit.md) Step 2 detects a merged ancestor
- [workflow-retrospective.md](./workflow-retrospective.md) blame map includes a merged target
- [workflow-reorder.md](./workflow-reorder.md) range includes a merged change
- Any other rewrite that would touch git history already on origin

Detection:

```bash
# For each bookmark pointing at or downstream of the target:
gh pr view <bookmark> --json state -q .state
# MERGED → this workflow
```

## Procedure

### 1. Ask the user (unless `--allow-rewrite-merged`)

If the user did NOT pass `--allow-rewrite-merged`, use the graphical or structured user-input tool:

```text
Target change <change_id> is already on origin and its PR is MERGED.

Rewriting merged history breaks consumers and conflicts with the public-history
direction.
How would you like to proceed?

[1] Corrective PR on top (recommended, default)
    — create a NEW change that fixes the issue
    — open a new PR targeting the same branch
[2] Rewrite the branch (explicit consent)
    — force-push a rewritten history
    — may insert new jj changes into history already on origin
    — requires coordinating with reviewers / consumers
```

If `--allow-rewrite-merged` is set, skip the prompt and proceed directly to Option 2.

### 2. Option 1 — corrective PR (default, recommended)

Follow the direction's corrective-PR route: preserve merged history and layer a
fix on top.

```bash
# Start a fresh change on top of main@origin
jj new main@origin

# Apply the corrective changes (the original edits that triggered this workflow)
# (LLM applies the file edits here)

# Validate + describe
jj describe @ -m "<conventional-subject>" -m "Body explaining what the corrective change fixes from <merged_pr_url>."
```

Then follow the normal save flow ([workflow-save-local.md](./workflow-save-local.md)) and, if the user wants a PR, follow the [SKILL.md](../SKILL.md) publication handoff for the saved corrective change.

The corrective PR title typically uses `fix(scope): ...` referencing the regression. Link to the original merged PR in the body.

### 3. Option 2 — rewrite the branch (explicit consent)

Only on user choice [2] or `--allow-rewrite-merged`.

```bash
# Snapshot rollback handle
jj op log -n1 --no-graph -T 'self.id().short()'
```

Apply the originally-intended rewrite (edit, retrospective squash, reorder, or insertion of new jj changes into already-pushed history).

Examples:

```bash
# Edit a merged change
jj edit <merged_change_id>
# (modify files)
jj new

# Insert a new change before a merged one
jj new <merged_change_parent>
# (add code)
jj rebase -s <merged_change> -d @
```

After the local rewrite and integrity guard pass, fetch remote state:

```bash
jj git fetch
```

Bind `TARGET_SHA` to the rewritten bookmark's exact Git commit and
`TARGET_BASE` to the fetched pre-push `<affected-bookmark>@origin` commit:

```bash
TARGET_SHA=$(jj log -r <affected-bookmark> --no-graph -T 'commit_id')
TARGET_BASE=$(jj log -r '<affected-bookmark>@origin' --no-graph -T 'commit_id')
TARGET_KIND=standalone
```

Before any push, invoke the public parity action for this standalone surface:

```text
coding:pr verify --target "$TARGET_SHA" --base "$TARGET_BASE" --kind "$TARGET_KIND"
```

Capture the action's complete `CI_PARITY_RECEIPT_JSON`, its canonical
`CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON`, and its canonical
`CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON`, then consume them before the
push:

```bash
source "${CODING_COMMIT_SKILL_DIR}/../../scripts/validate-ci-parity-receipt.sh"
```

On the exception path, its `sha` equals the exact `TARGET_SHA` and its `names`
equal the verifier's exact lexically sorted missing-secret names. A SHA-only
approval or any name/order mismatch cannot form a complete receipt and stops
before the push. Neither `--no-verify` nor `--allow-rewrite-merged` skips this
gate. This is direct synchronization of the already-authorized bookmark, not
PR publication; do not invoke a publication action.

Synchronize only the existing bookmark whose rewrite the user authorized:

```bash
jj git push --bookmark <affected-bookmark>
```

The tracked remote bookmark gives `jj git push` force-with-lease semantics: a
remote change since the fetch rejects the push. Do not include descendants or
any other bookmark in this command. The explicit Option 2 consent authorizes
this affected bookmark only.

If open downstream PRs remain, inspect their current checks read-only with
`gh pr checks`; do not invoke mutating `coding:pr update` as a monitor. Updating
or restacking descendants requires separate explicit user consent. With no
relevant downstream PR, skip monitoring.

Verify the integrity guard in [SKILL.md](../SKILL.md) passes.

### 4. Communicate to reviewers (Option 2 only)

After the affected bookmark is synchronized, the user MUST notify any open
downstream PRs / consumers that their base has been rewritten. This is
procedural, not automated — the skill surfaces a reminder:

```text
Rewrote merged-on-origin history at <bookmark>.
Notify reviewers and downstream consumers:
  - <list of open PRs / branches built on top>
```

## Hard rules

- Default route is ALWAYS the corrective PR. Only deviate on explicit user choice or `--allow-rewrite-merged`.
- `--allow-rewrite-merged` skips the graphical or structured user-input tool prompt but does NOT skip the integrity or exact-revision publication gate.
- Conventional regex enforced on any new change introduced.
- A rewrite that touches main@origin's tip itself is forbidden — surface and abort regardless of consent.

## Mandatory follow-ups

- Option 1: normal save follow-ups ([workflow-save-local.md](./workflow-save-local.md)).
- Option 2: integrity check, ordinary project scripts unless `--no-verify`,
  mandatory exact-revision publication gate, direct force-with-lease sync of
  the affected bookmark only, then read-only `gh pr checks` for relevant
  downstream PRs. Updating or restacking them needs separate explicit consent.
- Always: report the chosen route per [SKILL.md](../SKILL.md) Completion.

## Error / edge cases

| Symptom | Action |
|---|---|
| Force-push rejected by branch protection | Branch is protected against rewriting (correct posture for merged main). Route back to Option 1 (corrective PR). |
| User picks Option 2 then changes mind mid-flow | Before the push, `jj op restore <op_id>` rewinds locally. After the push, restoring the remote again requires fresh explicit consent and another lease-protected sync. |
| Multiple merged targets in one rewrite | Run the prompt ONCE listing all targets; user's choice applies to the whole batch. |
