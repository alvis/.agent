# Auto-detected parallel workspace

Use this route when proposed work is independent of the current working-copy
change. Apply the initialization, linked-Git-worktree guard, workspace
procedure, integration choices, and teardown in `coding:references/jj.md`; do
not restate or vary those operators here.

## Commit-skill gates

- Confirm the tasks share no files or semantic dependency. Otherwise keep the
  work in the current change and use [workflow-split.md](workflow-split.md) if
  the result contains multiple concerns.
- Reuse the selected work ID and its repository-approved workspace location.
- Record the default change, parallel change, workspace name, and rollback
  operation before integration.
- Run the normal save and verification route inside the parallel workspace.
- After the shared guide's selected integration disposition, verify the final
  graph and run the commit integrity check.
- Return any affected bookmark or PR map to `coding:pr create|update`; this
  reference never publishes it.

An unresolved base, divergent change, registered workspace that still owns
work, or failed integrity proof blocks teardown and publication.
