---
name: commit
description: 'Save code changes cleanly with jj-first, git-compatible routing. Use for commits, manifest-scoped lifecycle saves, split/absorb/edit operations, stacked changes, history reordering, retrospective blame fixes, or the --create-pr compatibility handoff; preserve the repository history policy and keep coding:commit as the sole history-mutation owner.'
model: opus
argument-hint: "[--prepare-paths-from=<scope-request> | --paths-from=<manifest> --manifest-sha256=<sha256>] [--retrospective] [--reorder [--up-to <rev>]] [--create-pr] [--branch-prefix <name>] [--no-verify] [--dry-run] [--allow-rewrite-merged]"
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_PLUGIN_ROOT}/skills/commit/scripts/pre-commit-hook.sh"
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_PLUGIN_ROOT}/skills/commit/scripts/post-rewrite-hook.sh"
---

# Save Any Code Change — jj-first, git-compatible

Before any script call, set `CODING_COMMIT_SKILL_DIR` to the absolute directory
containing this loaded `SKILL.md`. This works in both harnesses; ordinary Codex
shell calls do not receive a plugin-root environment variable.

This skill is the single entrypoint for saving work: local snapshots, edits to prior changes, splits, reorders, parallel tasks, the two exceptional direct-bookmark sync routes, and the compatibility route from `--create-pr` to `coding:pr create`. It auto-routes based on working-copy state; flags exist only for explicit operations and behavioural overrides. It is the sole owner of history mutations — `coding:finalize-commits` verifies stacks, and `coding:pr create` authors PR text, owns PR publication, and drives CI convergence.

This skill owns commit, branch, and local-history directions. The PR action
references own publication directions; `coding:standards/git/` separately owns
findings in rendered PR messages and implementation diffs.

**Coherence Mandate.** Every edit must produce one continuous, deliberate work. Rewrite over restructure, restructure over integrate, never append. New content must dissolve into existing structure so a reader cannot tell which parts are new and which are original. Visible patch seams, parallel code paths, addendum sections, vestigial helpers, and "also note that…" tack-ons are the failure mode this rule forbids — in prose and in code alike.

## Commit and branch directions

Inspect the working tree, branch or bookmark graph, remote refs, and open PRs
before mutation. Plan domain-coherent changes that compile, test, and remain
reviewable without forward references; preserve unrelated dirty paths.

Use lowercase kebab-case branch segments. An ordinary branch is
`<type>/<kebab-summary>`; preserve an established `<type>/<scope>/<topic>`
shape when the repository uses scoped branches. A work stream uses exactly the
single-PR or numbered-stack shape from `essential:references/naming.md`; its
work ID is an identity, not a commit scope. Delete merged branches.

Never rewrite a commit already merged into a shared destination. Fix merged
work with a corrective commit or PR. Rewriting a merged non-destination branch
requires explicit user consent and coordination; rewriting the shared
destination tip is forbidden. Route an unmerged stack fix to the earliest
change that owns the faulty artifact, then restack its descendants through
`coding:pr update`.

## Boundaries

- Use for: committing or describing changes, saving an exact lifecycle-owned
  path set while preserving unrelated dirty work, splitting mixed work, editing
  prior changes, retrospective blame fixups, reordering history, parallel
  workspaces, direct bookmark sync for the correct-merged and
  partial-to-branch routes, and preserving the `--create-pr` compatibility
  entrypoint.
- Do not use for: composing PR titles or bodies, general remote publication, or opening, updating, and polling PRs (`coding:pr create`), per-commit QA of an unpushed stack (`coding:finalize-commits`), or diagnosing code failures (`coding:fix`).
- Tool precedence: `jj` first wherever it is installed and initialized for the repository — every change is then a jj change and jj auto-snapshots `@` on every op. On a jj-colocated repo `git commit` acts only as the conventional-commit emitter inside the save flow; on a git repository it is the save itself, and every route below runs its documented git form. Neither is hand-run outside this skill. `gh` is retained for history routes that inspect remote PR state; `coding:pr create` owns PR publication and CI, while this skill may run `jj git push` only in the two named direct-sync routes.

<IMPORTANT>
- Every workflow MUST end with a linear clean chain + working code. No exceptions. If a workflow cannot guarantee this, STOP and surface to the user.
- This skill never opens, updates, or polls PRs. Its only pushes are the explicit, single-bookmark sync steps in `workflow-correct-merged.md` Option 2 and `workflow-partial-to-branch.md`; `coding:pr create` owns PR publication and CI convergence.
- Before either sanctioned direct push, bind the exact pushed Git SHA and pass
  the revision-bound test/lint parity gate owned by
  `coding:pr` create/update Step 2. `--no-verify` never skips this direct-sync
  publication gate. Running the gate does not make a direct bookmark sync PR
  publication.
- NEVER rewrite merged-on-origin history without explicit consent. Detected target → `AskUserQuestion`, default = the corrective-PR route in [workflow-correct-merged.md](references/workflow-correct-merged.md). `--allow-rewrite-merged` skips the prompt.
- Every change MUST be self-contained: compile + lint + tests pass for each change in isolation. Shared files (package.json, tsconfig, lockfiles) evolve incrementally — no forward references.
- `--paths-from` is a closed-set save, not a path suggestion. Never save,
  stage, reset, stash, or rewrite a non-selected dirty path, and never continue
  when exact isolation or the before/after preservation proof is unavailable.
- The Conventional Commits subject regex MUST match BEFORE any mutation (see [references/conventional-commits.md](references/conventional-commits.md)); no emoji prefixes in commit subjects.
- `git worktree` ≠ `jj workspace`. If the user accidentally used a git worktree, `AskUserQuestion` to move work back to HEAD before continuing.
</IMPORTANT>

## Inputs

- **Required**: none — the route is read from working-copy state.
- **Optional** (history flags force a route; publication and behavior flags modify it):

| Flag | Purpose |
|---|---|
| `--prepare-paths-from=<scope-request>` | No-history preparation route for a lifecycle parent. Seal its ignored work-artifacts scope request into an immutable manifest and return the exact `--paths-from` invocation; do not save, finalize, or publish. |
| `--paths-from=<manifest>` | Save only the manifest's exact dirty `selected_paths`; validate the ignored work-artifacts manifest and use [references/workflow-save-manifest.md](references/workflow-save-manifest.md). Requires `--manifest-sha256`. |
| `--manifest-sha256=<sha256>` | Expected SHA-256 of the exact manifest bytes. Valid only with `--paths-from`; prevents a path or manifest swap between lifecycle handoff and save. |
| `--retrospective` | Distribute pending edits on `@` into prior changes (stage 1: `jj absorb`; stage 2: `jj blame` + `jj squash --from @ --into <ancestor>`; stage 3: git fixup fallback). See `references/workflow-retrospective.md`. |
| `--reorder [--up-to <rev>]` | Reorder history into a clean linear chain up to target rev (default `main@origin`). Content-equivalence guard via `verify.sh`. See `references/workflow-reorder.md`. |
| `--create-pr` | Compatibility entrypoint: finish the selected save/history route, then invoke `coding:pr create` with the resolved change or stack. |
| `--branch-prefix <name>` | Forward the branch/bookmark prefix to `coding:pr create` when `--create-pr` is present. |
| `--no-verify` | Skip this skill's ordinary pre-commit and post-commit lint/test/build checks. It does not waive or pre-authorize the exact-revision gate before a PR handoff or sanctioned direct push. |
| `--dry-run` | Print the plan, don't mutate. |
| `--allow-rewrite-merged` | Explicit consent to rewrite history already merged on origin (skips the `AskUserQuestion` corrective-PR prompt). |

- **Prerequisites**: a git repository, jj-colocated or not. The
  manifest-scoped route additionally requires a checksum-bound manifest under
  the resolved work root's ignored artifacts directory. Producer receipts must
  use the strict generated-files schema and reconcile exactly to the
  publication set. The helper capability-probes the installed jj commands,
  revsets, templates, operation pinning, and structural Git colocation; no jj
  version string alone authorizes the scoped route. Publication
  prerequisites are checked by `coding:pr create`. The directions above bind
  branch naming, earliest-owner fix routing, and public-history safety.
  Pull-request size and implementation-composition standards are review inputs
  and informational here.

## Workflow

The skill self-routes by reading the working-copy diff, the changes since the parent, and bookmark or branch state through whichever tool the repository uses. Open the matching reference file for the full procedure:

| Trigger | How invoked | Reference |
|---|---|---|
| Prepare exact lifecycle scope | `--prepare-paths-from=<scope-request>` | `references/workflow-save-manifest.md` producer contract only |
| Exact lifecycle-owned save | `--paths-from=<manifest> --manifest-sha256=<sha256>` | `references/workflow-save-manifest.md` |
| Default save | (no flag) | `references/workflow-save-local.md` |
| Multiple concerns on `@` | auto-detected | `references/workflow-split.md` |
| User asks "edit commit X" | auto-detected | `references/workflow-edit.md` |
| Proposed work unrelated to current `@` | auto-detected | `references/workflow-parallel.md` |
| `@` is empty | auto-detected | `references/scenario-empty-changes.md` |
| Divergent change ID in `jj log` | auto-detected | `references/scenario-divergent.md` |
| Target already merged on origin | auto-detected | `references/workflow-correct-merged.md` |
| Blame-trace fixups into prior changes | `--retrospective` | `references/workflow-retrospective.md` |
| Reorder existing history | `--reorder [--up-to <rev>]` | `references/workflow-reorder.md` |
| Partial hunks → existing branch | user names a target branch + asks to save part of `@` | `references/workflow-partial-to-branch.md` |
| Publish saved change or stack | `--create-pr` | Required handoff to `coding:pr create` after local history work |

Before writing any new code, plan the change structure so commits/PRs end up independent — see `references/workflow-plan-structure.md`. End-to-end transcripts of every flag and auto-detected route: `references/examples.md`.

1. **Pre-flight.** Backup only runs for history-rewriting routes; plain saves (default, split, parallel, empty) do not touch prior changes and skip `backup.sh` entirely:

   | Route | Rewrites history? | Backup |
   |---|---|---|
   | Manifest-scoped save (`jj split` or Git path-limited commit) | No prior history | capture sealed HEAD/jj state plus the route's immutable exact-index backup and rollback handle |
   | Default save (`jj describe` + `git commit`) | No | skip |
   | Split current change (`jj split`) | No | skip |
   | Parallel workspace (`jj new` / `jj workspace add`) | No | skip |
   | Empty / divergent | No | skip |
   | Edit prior change (`jj edit`) | Yes | run |
   | `--retrospective` (`jj absorb` / `jj squash`) | Yes | run |
   | `--reorder` (`jj rebase`) | Yes | run |
   | Partial hunks → existing branch (`git add -p` + `git commit` + `jj git import` + `jj bookmark move --allow-backwards`) | Yes (bookmark move, possibly backward) | run |
   | Correct merged target (`git rebase` fallback) | Yes | run |

   When backup runs, the PreToolUse hook fires it on the first rewriting op and injects `Auto-backup: GIT_TREE_SHA=... CONTENT_HASH=... BACKUP_PATH=...` into context. If the route rewrites history but the hook didn't fire, run manually:

   ```bash
   bash "${CODING_COMMIT_SKILL_DIR}/scripts/backup.sh"
   ```

   For every route, capture `jj op log -n1 --no-graph -T 'self.id().short()'` as a rollback handle (`jj op restore <id>` undoes any jj operation).

2. **Detect mode.** `--prepare-paths-from` runs only the producer contract and
   returns before proposing or mutating history; it cannot combine with another
   operation flag. A valid `--paths-from`/`--manifest-sha256` pair forces the
   manifest-scoped route and cannot be combined with `--retrospective`,
   `--reorder`, a named partial-to-branch target, or `--create-pr`. Otherwise,
   read working-copy state and pick exactly one route:

   ```bash
   jj diff --stat               # file count + LOC          (git: git diff --stat HEAD)
   jj log -r 'visible_heads()'  # bookmarks, divergence     (git: git log --oneline @{upstream}..HEAD)
   jj bookmark list             # existing stack state      (git: git branch --list)
   ```

   Choose by the routing table above. A history-operation flag forces its
   route; `--create-pr` adds the post-save publication handoff.

3. **Propose the plan** to the user before any mutation. For multi-change routes (`--retrospective`, `--reorder`, `--create-pr`, auto-split), show the ordered list of operations. With `--dry-run`, skip local mutation but still perform the `coding:pr create --dry-run` handoff when `--create-pr` is present.

4. **Execute local history.** Complete the matching save/edit/reorder/parallel procedure and resolve the exact change or bottom-to-top stack. A manifest-scoped save must return its manifest hash, saved change ids, and a PASS preservation receipt before any later owner may continue. If its post-save proof fails, run the manifest reference's plain-Git `recover` command or restore the captured jj operation, prove the pre-save inventory again, and report `blocked_scope`; never leave an unproved saved change as success. Do not reproduce any bookmark, push, PR, restack, or CI workflow here except the bookmark move and direct-sync steps explicitly owned by the correct-merged and partial-to-branch references.

5. Run the verification below; when a check fails, fix the cause (or take the integrity table's prescribed action) and re-run that check. Repeat until every check passes or a concrete blocker remains — an integrity STOP awaiting the user, or a failure outside this skill's scope — then report the blocker instead of looping.

6. **Synchronize or hand off after local work is complete.** The correct-merged Option 2 and partial-to-branch references perform their own direct bookmark sync only after their exact-revision publication gate; those syncs are not PR publication. With `--create-pr` on every other route, invoke `coding:pr create <resolved-change-or-stack>` and forward `--branch-prefix <name>` and `--dry-run` when present. Never forward `--no-verify`: the PR workflow runs its own exact-revision test and lint gate, and only it may ask for user approval when a required secret is missing. After another local rewrite affects an unmerged PR stack, return its metadata to an existing `coding:pr update` caller or invoke that subcommand once for remote restacking. The [`coding:pr` create/update workflow](../pr/references/create-update.md#3-publish-bottom-up) owns PR publication, restacking, base repair, and CI convergence.

## Verification

The PostToolUse hook auto-runs `verify.sh` after any successful rewriting op and prints `── Integrity Check ──` to stderr. Read the table:

| `GIT_TREE_MATCH` | `CONTENT_MATCH` | Action |
|---|---|---|
| PASS | PASS | OK → report |
| FAIL | PASS | git tree drift → STOP, show diff, await user |
| PASS | FAIL | filesystem drift → STOP, show diff, await user |
| FAIL | FAIL | corruption → STOP, recover via `jj op restore <id>` |

If the hook didn't fire, run manually:

```bash
bash "${CODING_COMMIT_SKILL_DIR}/scripts/verify.sh"
```

Then run the project's own lint, test, and build commands (skip if `--no-verify`) — `npm run lint`/`test`/`build` where `package.json` defines them, otherwise the equivalents its language standard mandates — and confirm the final chain is linear with each change self-contained.

The direct-sync publication gate in the two sanctioned push references is
separate from these ordinary checks and remains mandatory with `--no-verify`.

## Completion

Report the route taken (save, manifest-scoped save, split, edit, parallel,
retrospective, reorder, create-pr compatibility handoff, partial-to-branch,
empty, divergent, or correct-merged), changes touched (change IDs), any
directly synchronized bookmark, the last jj op id as the rollback handle, and
verification results — lint/test/build as PASS/SKIP/FAIL plus the integrity
outcome. A manifest-scoped result also reports the exact manifest path/hash,
selected paths, saved-tree hash evidence, preservation receipt, and whether all
non-selected dirty bytes and index/status entries remained identical. When a
plain-Git scoped save was recovered, report the immutable recovery receipt and
restored HEAD/index hash instead of a PASS preservation receipt. When
`--create-pr` ran, preserve the PR URLs and final green state returned by
`coding:pr create`; this skill itself never opens, updates, or polls PRs.
