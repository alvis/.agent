# Auto-detected edit

Use this route when the user asks to amend a specific mutable change, including
a bug found during review of stacked commits, branches, or PRs. Apply the
complete edit procedure in `coding:references/jj.md`; do not restate or vary its
operators here.

## Commit-skill gates

- Resolve the named change, its saved stack tip, and every downstream bookmark.
- Confirm the owning change is mutable and unmerged. An immutable or merged
  target routes to [workflow-correct-merged.md](workflow-correct-merged.md).
- Run the commit skill's rewrite backup before `jj edit` and retain the
  operation ID required by the shared guide.
- Validate any changed description against
  [conventional-commits.md](conventional-commits.md).
- After the shared guide restores `@` to the saved stack tip, run the commit
  integrity check plus every affected project gate.
- Return the affected bottom-to-top bookmark and PR map to
  `coding:pr update`; this reference never publishes it.

When fixes belong to multiple ancestors, route to
[workflow-retrospective.md](workflow-retrospective.md). When a rewritten public
export affects consumer projects, run each consumer's build before handoff.
