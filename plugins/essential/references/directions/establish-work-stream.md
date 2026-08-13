# Establish a work stream

Use this direction before planning, delegation, or implementation when work is
substantial enough to need durable state.

## Select the work identity

Inspect the active context and every open stream before proposing an identity.
Use the first suitable choice:

1. Continue the current work ID when the requested outcome belongs to its
   confirmed charter.
2. Extend another open work stream when its charter already owns the outcome;
   switch to that stream rather than creating a competing identity.
3. Propose a new type-free work ID only when no open stream is suitable.

Never broaden an existing stream beyond its confirmed goal or requirements to
avoid creating a new identity. Follow [naming.md](../naming.md) for work-ID and
collision rules.

## Confirm substantial work

Ask four separately answerable questions before workspace bootstrap. Infer the
proposals from the conversation and repository context; ask the user to confirm
or correct them rather than asking them to author the charter from scratch.

1. **Work ID.** Propose the selected existing or new identity and state whether
   this continues the current stream, extends another open stream, or creates a
   new stream.
2. **Goal.** Propose one verifiable outcome that states what will be true when
   the work succeeds, with evidence by which it can be confirmed.
3. **Behavioral requirements.** Propose only the observable behavior the work
   must demonstrate. Exclude universal delivery obligations such as passing
   tests, updating documentation, following standards, or routine review.
4. **Direction.** Present at least two viable approaches with their material
   trade-offs, mark one `Recommended`, and ask which approach or adjustment
   should guide the work. A direction becomes a requirement only when the user
   explicitly promotes it.

The questions may share one harness prompt, but each needs its own answer. An
explicit confirmation of all proposals settles all four. When one answer is
corrected, revise and reconfirm it; keep the others settled unless affected.

## Select the workspace

After confirmation, prefer a jj workspace when jj is functionally initialized
for the repository. Otherwise offer a fresh local branch, a Git worktree, or
the current branch according to repository support and isolation needs. New
workspaces live at `~/.workspaces/<project-root-folder-name>/<work-id>`.

Never use a provider-specific workspace or worktree path such as
`.claude/worktrees/`; durable work must remain portable across harnesses.

## Bootstrap state

Run the resolver with the confirmed ID. After it returns `resolved` with
`state_ignored: true`, acquire the coordinator lease and invoke the resolver
with `--bootstrap` before creating another work artifact. Replace the generated
charter placeholders with the confirmed goal and behavioral requirements.

[state.md](../state.md) owns resolution and lifecycle semantics;
[lease.md](../lease.md) owns the lease-verified invocation and no-clobber
mechanics.
