# GIT-PR-STACK-06: Always Start PRs in Draft

## Severity

error

## Intent

Every PR — stacked or standalone — opens in draft. Draft mode communicates "the author is still iterating; CI is the audience, not reviewers" and prevents premature reviewer notifications while a stack is still settling. Reinforces and sharpens `GIT-PR-01` for stack workflows where multiple PRs land in flight at once.

The PR converts to ready-for-review only after: CI passes, the author has self-reviewed the diff, the body satisfies the canonical template for its zone, and lower stack PRs (if any) have either merged or are also marked ready.

## Fix

Open the PR as draft from the CLI:

```bash
gh pr create --draft \
  --base main \
  --head auth-rewrite/02-impl \
  --title "feat(orders): add archiveOrder" \
  --body-file .pr-body.md
```

When the author is ready:

```bash
gh pr ready auth-rewrite/02-impl
```

For stacked PRs created via Graphite or jj-aware tooling, configure the tool to default to draft:

```toml
# .graphite_config or .jj/config.toml
[pr]
default_draft = true
```

### Why this matters

- Reviewer attention is finite; pinging reviewers on a not-yet-ready PR burns goodwill and trains people to ignore review requests.
- Draft mode is the only state where force-pushes (within the unmerged portion of a stack — see `GIT-PR-STACK-03`) are unambiguously safe.
- A stack with mixed draft/ready PRs is a clear signal of progress; uniformly ready stacks invite out-of-order review (`GIT-PR-STACK-05`).

## Edge Cases

- Hotfix PRs may skip draft only when a documented incident is in flight — the incident commander records the override.
- Auto-generated PRs (dependabot, renovate, codemod sweeps) follow the platform's default; this rule applies to human-authored PRs.
- Converting back to draft after review is acceptable when scope expands materially; comment only when reviewers need material context.

## Related

GIT-PR-01, GIT-PR-STACK-01, GIT-PR-STACK-03, GIT-PR-STACK-05
