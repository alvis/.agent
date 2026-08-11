# GIT-PR-STACK-01: Stack Bookmark Naming

## Severity

error

## Intent

Every stacked-PR bookmark (Jujutsu bookmark, Git branch, or Graphite branch) follows the format `<feature-slug>/NN-<scope>` where `<feature-slug>` is the shared kebab-case feature identifier, `NN` is a zero-padded ordinal, and `<scope>` is a short kebab-case summary of what that PR does.

`<scope>` is free-form. It is not drawn from the `GIT-PR-TYPE-01` labels, and it need not match the conventional-commit scope either — the PR's GitHub label declares its archetype, so encoding one in the bookmark would only duplicate it less reliably. Write whatever names the slice: `02-impl`, `03-token-refresh`, `04-rollback-path`.

Consistent bookmark naming makes the stack legible at a glance, lets tooling sort the stack lexicographically, and tells a reviewer what each PR covers before they open it.

When the stack belongs to a work stream, `<feature-slug>` is that stream's branch, whose shape is defined by `naming.md` in the essential plugin's `references/` directory — the one authority on it. This rule adds only the `NN-<scope>` suffix beneath it. Naming the stack that way is what lets the stream be identified from any bookmark in it, instead of being asked for at every transition.

## Fix

```text
auth-rewrite/01-spec
auth-rewrite/02-impl
auth-rewrite/03-integration
auth-rewrite/04-feature-flag
auth-rewrite/05-cleanup
```

Any short kebab-case summary works; these read as categories only because that is often the clearest way to say what a slice does:

```text
order-archive/01-migration
order-archive/02-feature-flag
order-archive/03-impl
order-archive/04-ui
```

For single-PR work that is not part of a stack, the existing branch convention from `GIT-BRN-01` and `GIT-BRN-02` applies — `<type>/(<scope>)/<topic>`. The stack format kicks in only when a stack exists. A work stream splits the same way, but by its own contract: `naming.md` owns its single-PR shape, its stacked shape, and the transition between them, which is a rename rather than an addition because the two cannot coexist as refs.

### Why this matters

- Lexicographic sort matches review order, so `jj log` or `git branch --list` shows the stack top-to-bottom correctly.
- The ordinal makes "land the next one" unambiguous; the scope says what the diff covers.
- The shared slug groups the stack across `gh pr list`, dashboards, and CI artefacts.

## Edge Cases

- Reordering a stack mid-flight: re-number from the changed point downward and force-update bookmarks for any stack PR not yet merged. Once a PR has merged, its number is frozen (`GIT-PR-STACK-03`).
- If two stacks share a slug (e.g. two phases of `auth-rewrite`), suffix the slug: `auth-rewrite-phase2/01-spec`.
- Tooling (Graphite, Sapling, jj) sometimes injects its own naming. Configure it to follow this format; do not let tooling defaults override the standard.

## Related

GIT-BRN-01, GIT-BRN-02, GIT-PR-TYPE-01, GIT-PR-STACK-03, GIT-PR-STACK-05
