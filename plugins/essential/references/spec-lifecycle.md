# Specification and Notion lifecycle

Read this when materializing, revalidating, or completing specification work.

## Sources and mirrors

An explicit local path, approved inline candidate, or selected Notion
identity may supply a specification. Inline prompt text is evidence only:
before planning or implementation it becomes a complete approved candidate
and a content-equivalent durable `docs/specs/<capability>/README.md` carrier.
A local source retains its exact path and gains the same durable
carrier/provenance. Neither path claims a Notion round trip.

`.state/notion/` is the conventional ignored mirror in a registered
default workspace, not a path fixed by the generic resolver. The Notion owner
may receive another explicit output root and must resolve the required
default workspace, validate the actual root's ignore state, and report that
root's remediation path. A mirror contains exact `.mdc` paths owned by
notion-sync. Never derive, rename, or publish assumptions about those
filenames. Transport bodies are opaque to this marketplace. Semantic creation
or change requires one explicitly selected external
`--body-author=<plugin:skill>`, passed unchanged through every nested
specification and transport call; this marketplace supplies no default.

`sync-spec` materializes only the required temporary working specification
under the active work's `spec/`. Record stable Notion page/block IDs, exact
returned paths, source revision/hash, and dependent-work revalidation state
in `state.md`.

## Freshness and the revalidation sweep

Spec freshness is checked at named moments, not left to chance:
materialize before planning, before each dispatch batch (a cheap `unchanged`
check), before review, and at completion. A stream that was idle past any
of those moments re-materializes before proceeding. When materialization or
completion returns `next_action: revalidate`, the coordinator runs one
revalidation sweep against the new base-id: mark every non-done task row
whose definition, targets, or acceptance depend on the changed content
`! blocked` with `unblock: revalidate against <base-id>` (revalidation is
expressed in the existing status vocabulary — there is no separate task
status for it). A `✓ done` row stays done — append
`validity: stale (revalidate against <base-id>)` to its Evidence cell and add
remediation tasks with new IDs for any invalidated closure that must be
redone. Re-check each `SC-n` in `goal.md` against the new base and escalate
charter drift to the user, and append the sweep to `state/journal.md`.
Implementation continues only after the sweep.

Revalidation is guaranteed only for locally discoverable, registered
workspaces. Enumerate each local Git worktree from `git worktree list
--porcelain`. For jj, enumerate names with `jj workspace list` and resolve
every registered name with `jj workspace root --name <name>`. Mark affected
work found under those explicit roots. Never claim that every remote or
copied work directory was updated. The completion receipt lists affected
external task, PR, and Notion anchors plus every known or unknown remote
dependent that still needs revalidation.

The authored-docs sweep rides the same trigger: on any
`next_action: revalidate` outcome, check `docs/README.md` and the
`docs/architecture/` and `docs/design/` documents that reference the changed
capability, and journal each file's disposition (`unaffected`, `updated`, or
`superseded`) — only `docs/specs/` is hash-bound to the source, so ADRs and
design documents drift silently without this sweep.

## Completion

For a Notion-backed specification, completion closes review dispositions and
identifies approved changes against an exact source hash. The explicitly
selected body-author capability applies them to the selected transport path.
The completion entrypoint
delegates outbound push, merge, and conflict resolution to `sync-notion`,
then re-pulls and verifies stable identity, explicit conflict dispositions,
and zero unexpected diff. Regenerate affected `docs/specs/<capability>/`
content and record source and derivation hashes. A zero exit code without
this receipt is not successful synchronization. Local and inline sources
instead re-verify their carrier and provenance hashes and never invoke Notion
transport merely to complete.
