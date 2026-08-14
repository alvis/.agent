# Auto-detected edit (user wants to edit a prior change)

Triggered when the user explicitly says "edit commit X" / "fix the previous commit" / "amend change C". The skill switches `@` to that change, accepts edits in place, and re-emerges cleanly. See [SKILL.md](../SKILL.md).

## When triggered

- User names a specific change ID, bookmark, or relative ref (e.g. `@-`, `feat-x/02-service`)
- The target change is mutable (NOT on `main@origin`'s immutable revset)
- The target is NOT already merged on origin — else → [workflow-correct-merged.md](./workflow-correct-merged.md)

## Procedure

### 1. Resolve target

```bash
jj log -r <change_id_or_bookmark> --no-graph
```

Confirm the right change is selected. Capture its short id.

### 2. Hard rule: confirm unmerged on origin

```bash
# Find bookmarks pointing at or downstream of the target
jj bookmark list -r '<change_id>::'
```

For each bookmark with an open PR, check state:

```bash
gh pr view <bookmark> --json state -q .state
```

If any returns `MERGED`, STOP → route to [workflow-correct-merged.md](./workflow-correct-merged.md).

### 3. Snapshot rollback handle

```bash
jj op log -n1 --no-graph -T 'self.id().short()'
```

Record the op id; `jj op restore <id>` rewinds if the edit goes wrong.

### 4. Switch working copy to the target

```bash
jj edit <change_id>
```

`@` is now the target change. The working copy contents match what that change introduced (combined with its ancestors). Edits made now amend this change directly.

### 5. Modify files

Make the intended edits. jj auto-snapshots on every subsequent op.

When done, optionally update the description:

```bash
jj describe @ -m "<conventional-subject>" -m "<body>"
```

### 6. Leave the edited change

Two options:

**a. Leave `@` on the edited change and create a new empty child** (typical when more work comes next):

```bash
jj new
```

This creates a fresh `@` on top of the edited change. Existing downstream changes are auto-rebased on top of the new history.

**b. Squash the edits into an ancestor** (when the edits actually belong further up the chain):

```bash
# jj edit selected the wrong target; absorb the edits into <ancestor>
jj squash --from @ --into <ancestor>
```

This is closer to [workflow-retrospective.md](./workflow-retrospective.md); prefer that workflow if multiple ancestors are involved.

### 7. Verify chain integrity

```bash
jj log -r '<change_id>::' --no-graph
```

All descendants should be auto-rebased and free of conflicts. If conflicts appear, resolve in working copy and `jj squash` (or `jj resolve`).

## Hard rules

- Target MUST be unmerged on origin. Otherwise → [workflow-correct-merged.md](./workflow-correct-merged.md).
- Target MUST be mutable. `jj edit` rejects immutable revs.
- Description regex enforced if a new title is written.
- Never `git commit --amend` directly; jj owns the rewrite.

## Mandatory follow-ups

- If any unmerged bookmark sits at or below the edited change, follow the
  [SKILL.md](../SKILL.md) publication handoff with the resolved stack metadata
  after local integrity passes. Discover open PRs for the selected heads and
  report their states without mutating them. The caller separately authorizes
  any `coding:pr update` needed for force-with-lease republication and PR
  reparenting.

- The [SKILL.md](../SKILL.md) integrity check and project scripts (`npm run lint/test/build`) MUST pass.

## Error / edge cases

| Symptom | Action |
|---|---|
| `jj edit` rejects target (immutable) | Confirm target is not on `main@origin`. If it is, route to [workflow-correct-merged.md](./workflow-correct-merged.md). |
| Conflicts in descendants after edit | Resolve in `@` (which sits on edited change), then `jj new` and re-resolve any remaining conflicts in descendants. |
| Multiple ancestors need edits | Switch to [workflow-retrospective.md](./workflow-retrospective.md) — single-pass absorb + blame is cheaper than serial `jj edit`. |
| Edit changes the public API of an exported symbol | After Step 6, run the dependency check from [ALLAGENT.md](../../../hooks/ALLAGENT.md): `npm run build` in every consumer project. |
