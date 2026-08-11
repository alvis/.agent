# Auto-detected parallel workspace (work unrelated to current `@`)

Triggered when the proposed work is **completely unrelated** to the work currently on `@` in the default workspace — different domain, different feature, no shared file paths. Rather than layering onto a dirty `@`, the skill spins up a parallel `jj workspace` so the two tasks evolve independently. See [SKILL.md](../SKILL.md).

## When triggered

- `@` has uncommitted changes (or undescribed described changes)
- Proposed work touches a disjoint set of files / packages / scopes
- No semantic dependency between the two tasks

If proposed work shares any files or layering with `@`, do NOT branch off — keep working in place per [ALLAGENT.md](../../../hooks/ALLAGENT.md) §2.

## Strict guard: `git worktree` ≠ `jj workspace`

If the user (or a sibling agent) has carried work out inside a linked `git worktree`, you MUST `AskUserQuestion` to move that work back to HEAD before continuing. `git worktree` and `jj workspace` are different primitives:

- `git worktree`: separate working tree, shared `.git` dir, NO jj awareness — jj operations in a git worktree corrupt state.
- `jj workspace`: separate working copy AND separate `@` per workspace, shared jj operation log; safe for parallel work.

## Procedure

### 1. Confirm parallel work is the right route

```bash
jj diff --stat                              # current @ has changes
jj log -r 'visible_heads()' --no-graph       # surface state
```

Decision:

- Shared files with proposed work → reject parallel route, keep working on `@`.
- Disjoint → proceed.

### 2. Ask the user

Use `AskUserQuestion`:

```text
Proposed work looks unrelated to current @ (different domain / files).
Open a parallel jj workspace?
[Y] Yes (default) — `jj workspace add ~/.workspaces/<project-root-folder-name>/<work-id>` on `main@origin`
[N] No — keep work on current @, accept mixed history
```

Default is yes. On no, return to default save flow ([workflow-save-local.md](./workflow-save-local.md)) and route any multi-concern via [workflow-split.md](./workflow-split.md) at end.

### 3. Create the workspace

Reuse the work ID — the same kebab id at `.state/works/<work-id>`; no new slug. The workspace lives **outside** the current repo dir under `~/.workspaces/<project-root-folder-name>/`, where `<project-root-folder-name>` is the basename of the git/jj root. If two distinct repos share a root basename (e.g. two checkouts both named `app`), their `~/.workspaces/<basename>/` parents collide — disambiguate by choosing a distinct workspace parent (append a short suffix) for one of them.

```bash
# From inside the default workspace:
jj workspace add ~/.workspaces/<project-root-folder-name>/<work-id> --revision main@origin
```

This creates a workspace directory under `~/.workspaces/<project-root-folder-name>/` containing a fresh checkout rooted at `main@origin`, with its own working-copy change `@` per workspace. The default workspace remains untouched.

### 4. Work in the new directory

```bash
cd ~/.workspaces/<project-root-folder-name>/<work-id>
```

The skill operates **in-place** on the new workspace's `@` — describe, split, save flows are unchanged. Same `/coding:commit` invocations work; jj routes them to this workspace's `@`.

### 5. Finish the parallel task

When the work is done and described as a clean change (or chain of changes):

**Option A — rebase the parallel change(s) back onto the default workspace's `@`:**

```bash
# Back in the default workspace dir:
cd <default-workspace>
jj rebase -s <parallel_change_id> -d @
```

The parallel changes land on top of the default workspace's current `@`.

**Option B — merge both heads (when both should land together as siblings):**

```bash
jj new <default_change_id> <parallel_change_id>
```

Creates a merge change with both as parents.

**Option C — leave them parallel** (no integration yet; publish each saved
change through [`coding:pr create`](../../pr/references/create-update.md) when requested).

### 6. Tear down the workspace

Once the parallel work is integrated:

```bash
# In the default workspace:
jj workspace forget <workspace-name>
rm -rf ~/.workspaces/<project-root-folder-name>/<work-id>
```

`jj workspace forget` removes the workspace's working-copy change from the op log. Failing to forget leaves a phantom `@` that can show as divergent → [scenario-divergent.md](./scenario-divergent.md).

## Hard rules

- NEVER `git worktree` for parallel jj work. Always `jj workspace add`.
- Each workspace has its OWN `@`; never reach across with `jj edit <other-workspace-@>`.
- Workspaces share the jj op log: ops in one are visible in the other.
- Workspace name = directory basename (the `<work-id>`); keep it disposable.
- The built-in `EnterWorktree` harness tool uses `.claude/worktrees/` (harness-owned) and is NOT governed by this `~/.workspaces/` convention.

## Mandatory follow-ups

- After integrating back (Option A or B), verify chain via `jj log -r '::@'` and run the [SKILL.md](../SKILL.md) integrity check.
- If the integrated work touched any unmerged bookmark, follow the
  [SKILL.md](../SKILL.md) publication handoff with the affected stack metadata.

## Error / edge cases

| Symptom | Action |
|---|---|
| User used `git worktree` by accident | `AskUserQuestion` to move work back to default HEAD; abandon the worktree before continuing. |
| `jj workspace add` fails ("revision not found") | `jj git fetch` first; confirm `main@origin` exists locally. |
| Phantom `@` shows after `jj workspace forget` skipped | Run `jj workspace forget` retroactively; if change is divergent → [scenario-divergent.md](./scenario-divergent.md). |
| Two workspaces edited the same change | One side becomes divergent — resolve via [scenario-divergent.md](./scenario-divergent.md). |
