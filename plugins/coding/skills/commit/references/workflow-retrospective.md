# `--retrospective` — distribute pending edits into prior changes

Single flag, three-stage execution. Subsumes the old commit-old `--retrospective` (git-only) and stack-code `--fix-up` (absorb-only). See [SKILL.md](../SKILL.md).

## When triggered

- User passes `--retrospective`
- `@` contains edits that logically belong in earlier mutable ancestors (typo fix, missed test case, comment update, etc.)
- All affected ancestors are UNMERGED on origin — else → [workflow-correct-merged.md](./workflow-correct-merged.md)

## Three-stage execution

The skill tries the cheapest mechanism first and falls through.

### Stage 1 — `jj absorb` (content-matching)

`jj absorb` automatically distributes each hunk on `@` into the nearest mutable ancestor whose context matches that hunk. This handles the common "I made a typo in commit C" case with zero LLM reasoning.

```bash
# Snapshot rollback handle first
jj op log -n1 --no-graph -T 'self.id().short()'

# Distribute all hunks
jj absorb

# Or interactively pick hunks
jj absorb -i

# Or scope by file
jj absorb path/to/file.ts
```

After absorb, check what (if anything) remains on `@`:

```bash
jj diff --stat
```

- Empty → success; proceed to mandatory follow-ups.
- Non-empty → Stage 2 for residue.

### Stage 2 — blame-tracing (for absorb residue)

For hunks that absorb couldn't place (typically new lines that lack matching context in any ancestor), trace each via `jj blame` and squash manually.

For each residual hunk on `@`:

1. Identify file and line range from `jj diff`.
2. Find the change that last touched the surrounding lines:

   ```bash
   jj blame @ <file> -L <start>,<end>
   ```

   Use the IMMEDIATE ANCESTOR of the new line in blame output — that's the change the new line conceptually belongs to.

3. Build a hunk→target map. Present to user for confirmation:

   ```text
   Residual hunks (3):
   - src/user/avatar.ts L42-58  → change abc123 (feat(user-profile): add avatar upload)
   - src/user/avatar.ts L60-71  → change abc123 (same)
   - src/auth/token.ts  L10-12  → change def456 (fix(auth): correct token expiry off-by-one)
   ```

4. Apply per cluster:

   ```bash
   # If all residual hunks for one file go to one target:
   jj squash --from @ --into <target> <file>

   # If a file's hunks need to split across multiple targets:
   jj split <file>   # interactive — separate the hunks into discrete changes
   jj squash --from <new_change_id> --into <target_a>
   jj squash --from @ --into <target_b>
   ```

5. After all squashes, `jj diff --stat` on `@` should be empty.

### Stage 3 — git fallback (rare)

Only when a target ancestor is a git-only commit NOT visible to jj (e.g. predates the jj-colocated init, or sits on a foreign branch jj can't reach). Detect via:

```bash
jj log -r <target_sha> --no-graph
# If "no such revision" → git-only
```

Procedure:

```bash
# Create a fixup commit pointing at the git target
git commit --fixup=<target_sha>

# Re-emit history with autosquash; suppress interactive editor
GIT_SEQUENCE_EDITOR=true git rebase --interactive --autosquash <target_sha>^
```

After git rebase completes, jj will see the rewritten objects on next op; run `jj git import` if needed.

## Hard rules

- EVERY target ancestor must be UNMERGED on origin. Per-target check:

  ```bash
  jj bookmark list -r '<target>::'
  # For each bookmark with a PR:
  gh pr view <bookmark> --json state -q .state
  ```

  Any `MERGED` → STOP, route to [workflow-correct-merged.md](./workflow-correct-merged.md).

- Conventional regex still applies if a target description is updated.
- Never amend descriptions silently — if a hunk's intent doesn't fit the target's description, surface to user.
- Stage 1 ALWAYS runs first. Don't skip absorb in favour of manual blame-trace; absorb is faster and more accurate when it works.

## Mandatory follow-ups

- Whenever any unmerged bookmark sits at or below a rewritten change, follow
  the [SKILL.md](../SKILL.md) publication handoff with the resolved stack
  metadata after local integrity passes. Discover open PRs for the selected
  heads and report their states without mutating them. The caller separately
  authorizes any publication or restacking through the
  [publication workflow](../../pr/references/create-update.md#3-publish-bottom-up)
  that owns pushing and PR-base repair.

- Integrity check ([SKILL.md](../SKILL.md) Verification) — the dual-checksum backup ensures the merged tree at `@` matches pre-state (since logically the same content lands, just redistributed across ancestors).
- Project scripts: `npm run lint`, `npm run test`, `npm run build` for EACH affected change (check by `jj edit <change_id>` then build).

## Error / edge cases

| Symptom | Action |
|---|---|
| `jj absorb` rejects an ancestor (immutable) | That ancestor is on a protected revset; it's likely already merged → [workflow-correct-merged.md](./workflow-correct-merged.md). |
| All hunks remain after Stage 1 | Absorb found no matching context; proceed to Stage 2. |
| User disagrees with blame mapping | Re-cluster; allow user to override target per hunk; re-confirm before squash. |
| `jj blame` shows the change itself (`@`) | The hunk is genuinely new — it belongs as a new commit, not a retrospective. Surface and let user decide: keep on `@` and route to [workflow-save-local.md](./workflow-save-local.md). |
| Descendants conflict after squash | jj auto-rebases; resolve conflicts before final restack. |
| Stage 3 needed but target sha resolves in jj | You're in Stage 2 territory — re-run `jj log -r <sha>` to confirm; if visible, use `jj squash`, not git rebase. |
