# GIT-PR-STACK-02: Fix in the Earliest Owning Unmerged Change

## Severity

error

## Intent

When review surfaces a bug in a stacked PR, fix it in the **earliest unmerged change that owns the buggy code**, not in a later PR layered on top. In Jujutsu this is `jj edit <change>` then `jj absorb`; in Git it is a `fixup!` commit replayed with `git rebase --interactive --autosquash`, or `gt absorb` / `gt modify --commit <ref>` when Graphite is in use.

Patching a later PR for a lower PR's bug poisons the stack: the lower PR continues to merge a known-broken state, and the fix becomes invisible to anyone reviewing the lower PR in isolation.

## Fix

Stack:

```text
auth-rewrite/01-spec   (open, in review)
auth-rewrite/02-impl   (open, in review)
auth-rewrite/03-int    (open, in review)
```

Reviewer of `02-impl` finds a bug whose root cause is in `01-spec`'s type definition. Author response:

```bash
# Jujutsu
jj edit auth-rewrite/01-spec
# ... edit the type, save ...
jj absorb              # absorbs into the owning change
jj rebase -d main      # rebase the rest of the stack
```

Or with Git:

```bash
git switch auth-rewrite/01-spec
# ... edit the type, save ...
git commit --fixup <owning-commit>
git rebase --interactive --autosquash main   # folds the fixup, replays the stack
# or, with Graphite
gt checkout auth-rewrite/01-spec
gt modify --commit
gt restack             # rebases 02-impl and 03-int onto fixed 01-spec
```

Then push all three branches; each PR's diff updates with the fix in its rightful place.

### Why this matters

- A merged stack should be a sequence of individually correct PRs, each one bisectable.
- Layering fixes on top hides the bug from the lower PR's review history and breaks `git bisect`.
- Routing fixes to the right level reinforces the discipline that each PR has a single, coherent purpose.

## Edge Cases

- If the lower PR has already merged, `GIT-PR-STACK-03` applies — open a corrective PR; do not rewrite history.
- If the bug is genuinely a regression introduced by a higher PR (e.g. integration revealed a flaw the spec did not anticipate), the fix belongs in the higher PR — but consider whether the spec PR should be re-issued.
- For tooling that does not support absorb/restack natively, use the underlying primitives (`git rebase -i`, `jj squash`) — never use `--no-verify` to bypass hooks while restacking.

## Related

GIT-PR-STACK-01, GIT-PR-STACK-03, GIT-PR-STACK-05
