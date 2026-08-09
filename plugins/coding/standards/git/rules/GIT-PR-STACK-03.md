# GIT-PR-STACK-03: Never Rewrite Public History

## Severity

error

## Intent

Once a stack PR has merged into a shared branch (typically `main`), its history is **public** and immutable. A bug discovered after merge is fixed by a corrective PR (`fix:`, `revert:`, or a fresh `implementation`) — never by force-pushing, amending, or rewriting commits that have entered shared history.

## Fix

Bug found after `auth-rewrite/01-spec` already merged:

```text
# correct
fix-archive/01-fix    fix(orders): correct ArchiveReason union to allow "expired"
```

Link the original PR naturally in the canonical template's Summary or Context.
Do not publish internal rule IDs or a dedicated process-explanation section.

What this rule forbids:

```bash
# ❌ never on a merged stack PR
git push --force origin main
git rebase -i HEAD~5      # if any of those commits already merged
jj abandon <merged-change>
```

### Why this matters

- Force-pushing shared history breaks every other engineer's working copy and CI cache.
- A corrective PR is reviewable, attributable, and bisectable; a rewritten history is none of those.
- The rule pairs with `GIT-PR-STACK-02`: fixes for unmerged stack PRs go in-place; fixes for merged stack PRs go forward.

## Edge Cases

- The narrow exception is when a force-push is required to remove a leaked secret or compliance-violating content; that is a security incident, not a workflow choice, and follows incident response — not this rule.
- "Squash on merge" performed by the platform (GitHub/GitLab) is not a history rewrite; it is the agreed merge strategy.
- Reverting a merged PR via `git revert` is the canonical corrective action when forward-fix is not viable.

## Related

GIT-PR-STACK-02, GIT-PR-STACK-05, GIT-MSG-01
