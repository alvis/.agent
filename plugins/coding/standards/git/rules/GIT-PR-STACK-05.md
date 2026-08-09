# GIT-PR-STACK-05: Bottom-to-Top Merge Order

## Severity

error

## Intent

Stacked PRs merge **bottom-to-top**: the lowest unmerged PR lands first; after it lands, the next PR in the stack rebases onto `main` and becomes the new bottom. Merging out of order, or skipping the rebase step, leaves the stack pointing at a stale base and produces a noisy diff that mixes already-merged code with new work.

## Fix

Merge cycle for `auth-rewrite/01..04`:

```bash
# 1. land the bottom
gh pr merge auth-rewrite/01-spec --squash

# 2. rebase the next layer onto main
jj rebase -d main -s auth-rewrite/02-impl
# or
git rebase --onto main auth-rewrite/01-spec auth-rewrite/02-impl
# or
gt sync && gt restack

# 3. push the rebased stack
jj git push --change auth-rewrite/02-impl
# or
git push --force-with-lease origin auth-rewrite/02-impl
# or
gt submit --stack

# 4. land the new bottom; repeat
gh pr merge auth-rewrite/02-impl --squash
```

After step 2, the diff for `auth-rewrite/02-impl` shows only the impl change, not the spec it just absorbed.

### Why this matters

- A stack PR that has not been rebased after its predecessor merged shows the predecessor's code in its own diff — reviewers waste cycles re-reading already-approved code.
- Bottom-to-top is the only order in which each PR's tests run against the actual base it will live on.
- CI caching, code-owner review routing, and bisect all assume linear merge order.

## Edge Cases

- If a higher PR is genuinely independent of the lower (e.g. a spec PR that does not need its predecessor), it can be hoisted out of the stack and reviewed standalone — but then it is not a stack member.
- If the lower PR is rejected and abandoned, the stack collapses one level: the next PR rebases directly onto `main` and inherits the bottom slot.
- Some platforms (Graphite, Sapling) automate the rebase; verify the rebase actually happened by reading the PR's "base branch" label after the lower lands.

## Related

GIT-PR-STACK-01, GIT-PR-STACK-02, GIT-PR-STACK-03, GIT-PR-STACK-06
