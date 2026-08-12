# Coordinator lease and write mechanics

Read this before performing coordinator writes — the core contract carries
the rule (one writer, on-disk lease, never write under a foreign lease,
takeover only via the explicit verb); this reference carries the choreography.

## Holding the lease

The lease lives at `works/<work-id>/lease.json` and is operated by
`"$ESSENTIAL_ROOT/scripts/state-lease"` (see `--help` for verbs and
defaults). Before the first coordinator write in a session, run the
idempotent `ensure` verb: it acquires when the lease is free, heartbeats when
this session already holds it, and revives an expired lease this session
still owns. `contended` means a live foreign coordinator owns the stream —
stop and report, never write. `takeover_required` means the lease expired
under another owner: claim it only with the explicit `takeover` verb and
journal the returned payload as a `lease` event; never silently replace it.
Keep the returned plaintext token in session context — the file stores only
its digest, so reading `lease.json` never confers the lease.

## First-use work-memory bootstrap

After the PM completes
[directions/establish-work-stream.md](directions/establish-work-stream.md) and
the resolver returns `resolved` with `state_ignored: true`, it invokes the
resolver once more with the confirmed ID and `--bootstrap`, before delegating
or creating any other work artifact:

```bash
"$ESSENTIAL_ROOT/scripts/resolve-state-workspace" \
  --work-id=<confirmed-work-id> --bootstrap
```

Identity selection remains separate and interactive: `--bootstrap` never
derives or mints an ID, and it cannot bypass `work_id_required` or
`requires_ignore`. The resolver owns the mechanical bootstrap; the PM alone
may request it while holding the coordinator lease. It creates the work
directory, `state/`, and whichever of `goal.md`, `state/working.md`,
`state.md`, and `state/journal.md` is missing; each file is created with
no-clobber semantics, an existing regular file is preserved byte-for-byte,
and symlinked or non-regular components are refused on every invocation —
safe to rerun after an interrupted first use. The initial files carry
identity, revision counters at `1`, explicit placeholders, and the journal's
append-only header; downstream owners replace placeholders with observed
truth. The resolver returns exact paths in `bootstrap_created` and preserved
paths in `bootstrap_existing`; the PM adds created paths to the combined
`generated_files` manifest.

## Writing under the lease

Perform every coordinator write through
`"$ESSENTIAL_ROOT/scripts/state-write"`: it verifies the presented
token against the lease, refuses when the lease is free, expired, or foreign,
heartbeats the lease, and applies the content by temp-file write and atomic
rename in one call — so a working coordinator cannot expire its own lease by
working, and a coordinator that lost the lease gets a hard error before the
write instead of a doctor finding after it. On each `state.md` write, bump
the monotonic `State revision: N` in the content and carry `rev:<N>` on the
journal line.

Release the lease at handover, retirement, and session end. TTL default is
30 minutes; long-running work that writes through the state-write helper
stays fresh without explicit heartbeats.
