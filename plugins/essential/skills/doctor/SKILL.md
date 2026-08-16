---
name: doctor
description: Check the integrity of local state and durable ADRs with the structural doctor, diagnose folder-structure and format drift against current contracts, and offer user-approved migration or repair. Use for health checks of .state/ or docs/architecture/decisions/, before resuming old work, or after suspected corruption or drift; this skill repairs records, never the work itself.
metadata:
  intelligence: medium
argument-hint: "[work-id] [--strict]"
---

# Doctor

Diagnose the `.state/` work memory — centralized in the default source
tree, so every checkout diagnoses the same one — plus durable ADR layout and
integrity. With approval, bring findings to the latest structure. Diagnosis is
mechanical (`state-doctor`); judgement is not: what "latest" means is
whatever the current Essential contracts say, so migration is decided by
reading them — never by a version token, and never by guessing from memory.

## Boundaries

- Use for integrity checks, drift diagnosis, and contract-format migration of
  work memory and ADR records. Do not implement, review, or resume the work
  itself (`essential:takeover` owns resumption) and do not touch another source
  tree's `works/`.
- Diagnosis never mutates anything. Repairs and migrations happen only after
  explicit user approval, per stream, under that stream's coordinator lease.
- Never rewrite a state file merely because the convention moved on — older
  formats are valid history and migrate lazily. Migration here is an explicit
  user-approved coordinator rewrite: the only sanctioned
  *structure-changing* rewrite of work memory, as opposed to the content
  updates other coordinator skills make under the normal write protocol.
- Never falsify history: journal lines, tombstones, completed marks, and
  superseded decisions are preserved; migration reshapes structure, not
  truth. Unrecognized files are reported and preserved, never deleted,
  renamed, or reinterpreted by guesswork.
- For every ADR finding, always present an explicit repair offer. ADR repair
  needs user approval even when the mechanical action is obvious; prose
  integrity findings are questions for the user, never silent rewrites.

## State gate

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential; if unavailable, stop
artifact writes and report the missing contract. Read its work-state contract
sibling and `truth.md` as well — together they define the current canonical
topology and file shapes that "latest" means. Run the resolver read-only to
locate the active workspace and `.state/`; on `requires_ignore` or
`work_id_required`, report per the contract rather than proceeding.

## Workflow

1. **Scope.** With `[work-id]`, check that one stream
   (`--work-dir <work_dir>`); otherwise check everything
   (`--state-dir <state_root>/.state`, covering every
   stream plus `overview.md`) and the repository's
   `docs/architecture/decisions/` tree. `state_root` comes from the resolver and
   owns centralized work memory; pass the resolver's `durable_root` as
   `--repository-root` so ADRs are read from the active source tree, including
   secondary worktrees or jj workspaces. A missing `.state/` or ADR tree is a
   clean report, not an error.
2. **Run the doctor.** Invoke
   `"$ESSENTIAL_ROOT/skills/doctor/scripts/state-doctor" --json` with the scope from
   step 1 and `--repository-root <durable_root>`, passing `--strict` through
   when given. Collect the findings; the
   doctor is read-only. ADR findings include a `fix` offer; its silence about
   prose outside the ADR integrity contract is not an endorsement.
3. **Inspect structure the doctor cannot judge.** Compare each stream's
   on-disk layout with the canonical topology and file shapes in the current
   contracts: files that predate the present format (for example a stream
   without a charter, journal, or revision counters), children in
   unexpected places, oversized files never split, orphaned overview rows,
   or a layout that matches an older convention. The `Written under:` stamp
   in `state.md` is provenance for exactly this judgement — "written under
   contract X, current is Y" explains drift and orders migration by
   staleness, but confers no authority: the current contracts always judge.
   Classify every observation:
   - **defect** — broken structure the doctor flagged (dangling
     dependencies, contradictory statuses, lease conflicts, broken links,
     an inferred `Location`, a `completed` stream with no merge evidence or
     with unowned outlives-me debt, a stream with no charter at all, a
     `state.md` whose phase does not parse);
   - **format drift** — valid but older shapes that would migrate at the
     next explicit rewrite (a retired lifecycle word, a non-conforming work
     ID, an overview that still carries environment narrative);
   - **informational** — unrecognized-but-harmless files, or free-form
     sections the doctor could not parse.
   A retired lifecycle word is **always** drift and never a defect: the record
   was true when it was written. A `state-metadata` finding is repaired and
   re-run **before** the rest of the scope is judged: while a phase is
   unreadable, every phase-gated check reports zero for that stream, and a
   zero read under it means nothing.
   For ADRs, read `${ESSENTIAL_ROOT}/references/adr.md` and classify each
   finding against its contract: effective ADRs are direct children of
   `decisions/`, archived ADRs are direct children of `decisions/superseded/`
   with the prepended header, and the architecture index lists effective ADRs
   only. If history is requested for a known current ADR, inspect only archived
   files whose `Superseded by` header links to that ADR.
4. **Propose, per stream.** Present findings grouped by stream — ordered by
   staleness when `Written under:` stamps allow it — with a concrete
   repair/migration plan derived from the current contracts: what would
   change, what is preserved byte-for-byte, and what stays untouched.
   Migrate stream-by-stream, never as one mass rewrite. For a stream idle
   long past its last journal entry, propose **parking** into
   `.state/archive/<work-id>/` per Essential's `retirement.md` as the
   remediation instead of migration. For a stream whose work memory was
   destroyed (for example by `git clean -fdx`), offer **recovery from a
   copy**: restore the `.state/works/<work-id>/` directory from a backup
   or another tree that holds it, then run `essential:takeover`. Recovered
   facts cite the restored files, and anything that postdates the copy is
   reported as lost, never invented.
   Where the doctor reports structure drift, offer the migration in
   **Structure migration** below rather than inventing one.
   Always include an ADR repair offer in the proposal, even when no stream
   migration is needed. Use the graphical or structured user-input capability to ask which streams to
   repair, migrate, park, or recover and which ADR fixes to approve;
   informational items need no action and defects in prose meaning are
   surfaced as questions, not silently "fixed".
5. **Repair under the lease.** For each approved stream: check
   `lease.json` via `state-lease` — a live foreign lease stops that
   stream with a report; an expired lease is claimed with the explicit
   `takeover` verb and journaled. Then apply the approved plan as ordinary
   coordinator rewrites: journal the migration first, preserve all history
   (append, restructure, and relink — never rewrite recorded events), and
   follow the contract's write protocol. For an approved ADR repair, preserve
   the historical body, move a superseded ADR under
   `docs/architecture/decisions/superseded/`, prepend the standard header,
   remove it from the current index, and leave the successor ADR unchanged
   unless the user separately approves an integrity correction. A successor
   ADR must not be rewritten to mention the old ADR. Release the lease when
   done.
6. **Confirm.** Re-run the doctor over the repaired scope and require the
   approved findings to be gone; anything remaining is reported with a
   reason. Return every created or materially rewritten path in
   `generated_files`.

## Structure migration

Any repository can be brought to the current structure with these offers. Each
answers one doctor `check`; none is applied without that stream's approval, and
none rewrites what a record already claims about the past.

| `check` | Offer |
|---|---|
| `overview-monolith` | Move environment narrative into `.state/environment.md` and symptom→cause→do-this-instead lines into `.state/traps.md`, creating either when missing. `Goal` and `Requirements` are authored, never derived: carry them byte-for-byte. Drop a preamble paragraph only where the current table contradicts it, and say which. |
| `lifecycle-vocabulary` | Rewrite the field as phase plus a nullable `Blocked on:` line — `initialized`→`planned`, `active`→`working`, `blocked`→`Blocked on: <who or what>` at the phase the stream actually sits in, `retiring`→`completed` + `Blocked on: retention`. Never an unnamed blocker: name it, or write `unknown`. |
| `motion-vocabulary` | Rewrite the retired `- Motion:` line — `running`→drop the line (nothing is blocking the stream), `idle <N>d`→`Blocked on: unknown` (no reason was ever recorded, and inventing one would be false), `waiting: X`→`Blocked on: X`, bare `waiting:`→`Blocked on: unknown`, anything else by hand as the named blocker or `unknown`. Duration is never typed: it derives from `Last progress`. |
| `last-progress` | Derive the value from the last genuine journal `status` event. Where the journal is absent, a stub, or older than what `state.md` records, fall back to `state.md`'s dated lifecycle or merge evidence and mark the cell `(from state.md)` — an unmarked fallback is false freshness in a different costume. |
| `journal-segments` | Resolve the journal to its newest `NN-journal-*.md` segment before reading or appending; `journal.md` is an index there and its tail is not an event. |
| `journal-freshness` | Record the missing transition, or take the marked `state.md` fallback. Never write a `status` line to make a stale stream look fresh. |
| `location` | Record the absolute path plus tree kind, or `-`. An inferred anchor is replaced by `-`, never kept: inferring manufactures a fact the tree never stated. |
| `overview-budget` | Replace the cell with one imperative sentence under 200 characters and move the narrative into the stream's `state/working.md`. |
| `retention` (`warning`) | Move `works/<id>/` to `.state/archive/<id>/` **first**, then drop the overview row. While the stream sits in `works/` the row is its only index, so dropping it first hides live work; the order is not negotiable. |
| `retention` (`info`) | A completed stream at `Blocked on: <named blocker>` **does not archive**, however old: `archive/` is resolver-skipped, so archiving drops its open question out of `Awaiting you`. Answer the named blocker, or give its answer a carrier that outlives the stream; the stream archives then and not before. `Blocked on: unknown` names no question, so it holds nothing and archives on the ordinary schedule. |
| `state-metadata` | Split `Phase` and any `Blocked on:` onto their own lines, or add `Phase`. The reader is anchored one key per line, so a packed `- Phase: \`x\` · Blocked on: \`y\`` parses as neither — and `retention`, `merge-evidence`, `blocked-on` and `outlives-me` then skip the stream in silence and report a clean zero for it. `Blocked on:` is nullable: absent means not blocked, and is never added to satisfy a shape. |
| `work-id-naming` | **Report only.** A work ID is an identity and is never renamed or reused; the fix is forward-only, on the next stream. |
| `charter-provenance` | Add `Charter: approved \| reconstructed \| absent` to `goal.md`, recording what is true. Mark `approved` only where the user approved it; reconstruct from recorded history otherwise and leave it `reconstructed` until they do. |
| `merge-evidence` | Record the merged pull request(s) or the observation on the default branch; where neither holds, return the stream to `reviewing`. An author's assertion is never merge evidence. |
| `outlives-me` | Give every item an owner: promote it, open a successor stream, or file it in `.state/backlog.md` as id, one clause, source stream, owner or `unowned`. Filing is a rehoming that survives the row drop, not a deletion. |

Two rules bind every migration above:

- **Journal a migration as `sweep`, never `status`.** A `status` line dates
  today against a transition made weeks ago and destroys the freshness signal
  the migration exists to produce.
- **Absent is not empty.** Where a stream has no `state/unresolved.md`, the
  overview's `Awaiting you` records *no source*, never "no open questions".

## Verification

- Diagnosis ran read-only; nothing changed before user approval.
- Every applied repair traces to an approved finding; unrecognized files
  were preserved and reported.
- No journal line, tombstone, completed mark, or superseded decision was
  removed or reworded; migrations were journaled as `sweep` under the
  stream's lease, and no work ID was renamed.
- The post-repair doctor run confirms the approved findings are resolved.
- Every ADR finding had a repair offer, and every applied ADR repair had
  explicit user approval.

## Completion

Report the scope, finding counts by classification and severity, per-stream and
ADR approval decisions, repairs applied with their journal entries, findings
deliberately left (with reasons), the post-repair doctor result, and
`generated_files`.
