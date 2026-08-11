# Manifest-scoped lifecycle save

Save a lifecycle-owned closed set without capturing or disturbing unrelated
developer work in the same checkout. This route is forced only by a paired
`--paths-from=<manifest> --manifest-sha256=<sha256>` invocation. It performs
local history mutation only; final commit QA and remote publication remain with
their normal owners.

## Producer contract

The lifecycle parent writes immutable JSON under
`<work-root>/artifacts/history/save-manifests/<manifest-sha256>.json`. The hash is
SHA-256 of the exact file bytes and is passed separately on invocation; the
manifest cannot authenticate itself. The artifacts directory and manifest must
be ignored by the target repository, and neither may be reached through a
symlink.

To avoid hand-computed hashes or status records, the parent first writes an
ignored scope request with schema
`state-scoped-save-request/v1`, `work_id`, `scope_complete: true`,
the full `publication_paths` as `{path, origin}` entries, the exact dirty
`selected_paths`, and the child `generated_file_manifests` used to derive them.
Invoke `coding:commit --prepare-paths-from=<scope-request>`; this no-history
route resolves `repo`, `work_root`, and `base_rev` from the active work state and
runs only:

```bash
bash "${CODING_COMMIT_SKILL_DIR}/scripts/validate-scoped-save.sh" build \
  --repo "<repo>" --work-root "<work-root>" --base-rev "<base_rev>" \
  --scope "<scope-request>"
```

The dependency-free bundled helper recomputes the complete Git inventory,
file/link hashes, deletion states, repository identity, and exclusions, seals
canonical JSON with no-clobber semantics, and returns the exact manifest
path/hash plus `/coding:commit --paths-from=... --manifest-sha256=...`
invocation. Preparation never stages, saves, finalizes, or publishes.

Every path named by `generated_file_manifests` must resolve to an ignored,
regular artifacts file under the active work root and contain canonical JSON
with this exact producer schema:

```json
{
  "schema": "state-generated-files/v1",
  "producer": "<child skill identity>",
  "base_rev": "<same immutable revision id>",
  "generated_files": [
    {
      "path": "src/example.ts",
      "state": "file|symlink|deleted",
      "sha256": "<physical content/link-text hash, null only for deleted>",
      "mode": "100644|100755|120000|null for deleted"
    }
  ]
}
```

The helper validates each receipt against physical bytes, deletion state, and
mode; rejects duplicate claims; and requires the union of all
`generated_files` to equal `publication_paths` exactly. It stores the
receipt's repository-relative path and SHA-256 in the sealed manifest and
rehashes and fully reconciles the receipt at preflight and verification. A
receipt is evidence, not an unchecked pointer or arbitrary `{}` marker.

The manifest contains:

```json
{
  "schema": "state-scoped-save/v1",
  "work_id": "<resolved-work-id>",
  "repository": {
    "canonical_root": "<realpath>",
    "vcs": "jj-colocated|git",
    "git_common_dir": "<realpath>"
  },
  "base_rev": "<immutable revision id>",
  "build_state": {
    "head_commit": "<HEAD when this manifest was sealed>",
    "jj": null
  },
  "publication_paths": [
    {
      "path": "docs/specs/example/README.md",
      "state": "file|symlink|deleted",
      "sha256": "<content-or-link-text hash, null only for deleted>",
      "mode": "100644|100755|120000|null for deleted",
      "origin": "<child/generated-files or lifecycle artifacts pointer>"
    }
  ],
  "selected_paths": [
    {
      "path": "src/example.ts",
      "state": "file|symlink|deleted",
      "sha256": "<content-or-link-text hash, null only for deleted>",
      "mode": "100644|100755|120000|null for deleted",
      "origin": "<child/generated-files or lifecycle artifacts pointer>",
      "status": "<canonical worktree/index status including mode and staged oid>"
    }
  ],
  "excluded_dirty_paths": [
    {
      "path": "notes.txt",
      "state": "file|symlink|deleted",
      "sha256": "<content-or-link-text hash, null only for deleted>",
      "mode": "100644|100755|120000|null for deleted",
      "status": "<canonical worktree/index status including mode and staged oid>"
    }
  ],
  "scope_attestation": {
    "complete": true,
    "generated_file_manifests": [
      {
        "path": ".state/works/<work-id>/artifacts/children/coding.json",
        "sha256": "<exact canonical receipt bytes hash>"
      }
    ],
    "excluded_owner": "user"
  }
}
```

For `jj-colocated`, `build_state.jj` is an exact object containing the sealed
operation id, working-copy commit id and change id, its exact sole parent,
the matching Git HEAD, `mutable: true`, `conflicts: false`,
`divergent: false`, and the selected jj diff hash. A plain Git manifest must
use `jj: null`.

`publication_paths` is the full, exact set of lifecycle-created, modified, or
deleted project artifacts intended for eventual publication, including source,
tests, project documentation, durable specification carriers, and provenance
receipts. `selected_paths` is its exact subset that is currently dirty and must
enter this save. `excluded_dirty_paths` is every other dirty or untracked path
in the repository. Expand untracked directories to individual files. A dirty
path must occur in exactly one of `selected_paths` or `excluded_dirty_paths`.

The producer reconciles all child `generated_files` receipts with the diff
from `base_rev`; the save helper independently performs the strict union and
content reconciliation above. The producer must block rather than attest
`complete: true` when a
lifecycle-owned publishable path is omitted, a selected file also contains
unrelated user-owned edits, or ownership cannot be determined. Paths under the
active `.state/works/` root, `.state/working.md`, the scoped-save
manifest/receipt, and any other ignored work state are never publication or
selected paths. A publishable generated path that is unexpectedly ignored is
a configuration blocker, not a reason to force-add it.

## Validate before mutation

Perform all checks again immediately before the first history or index
mutation:

```bash
bash "${CODING_COMMIT_SKILL_DIR}/scripts/validate-scoped-save.sh" preflight \
  --repo "<repo>" --manifest "<manifest>" \
  --manifest-sha256 "<sha256>"
```

1. Resolve the repository independently. Require its canonical root, VCS mode,
   and canonical Git common directory to equal `repository`; require `base_rev`
   to resolve in that repository. Require current `HEAD` and, when applicable,
   the complete jj operation/working-copy state to equal sealed `build_state`.
   Any history writer between preparation and preflight makes the manifest
   stale even when selected file bytes did not change.
2. Require the manifest's real path to be inside the resolved work artifacts
   directory, all existing ancestors to be real directories rather than
   symlinks, and `git check-ignore` to confirm it is ignored. Hash the exact
   bytes and compare the full lowercase 64-hex digest to both the argument and
   filename. Before reading `--scope`, `--manifest`, `--snapshot`, the work
   root, or a linked generated-file artifacts path, reject lexical `.`/`..`,
   repeated/trailing separators, relative CLI paths, and any other
   non-normalized component; normalization after access is not validation.
3. Reject duplicate or case-colliding paths, directories, submodule interiors,
   absolute paths, pathspec magic, control characters, empty components, `.`
   or `..`, and any path whose existing parent is a symlink. A selected leaf
   symlink is allowed only when it is the versioned object itself; hash its
   link text without dereferencing it. For a deletion, validate the nearest
   existing parent. Every resolved parent must remain inside the canonical
   repository root.
4. Recompute exact file/link hashes, Git object modes, deletion state, index
   modes/oids, and a NUL-safe porcelain-v2 dirty inventory. Directly compare
   the physical worktree, index, and `HEAD` tree for every publication path;
   porcelain is not the sole source of truth. Reject any tracked
   assume-unchanged or skip-worktree flag because it can suppress dirty state,
   and reject `core.filemode=false` repository-wide because executable-mode
   preservation is otherwise ambiguous.
   Require every publication, selected, and excluded entry to match the
   manifest and require the selected set to be exactly the dirty publication
   subset. A new, missing, or changed byte, mode, deletion, or status entry
   makes the manifest stale; stop without mutation and return to the lifecycle
   owner for review and a new immutable manifest.
5. Re-read every bound producer receipt, require its exact stored hash, validate
   its strict schema and current physical hashes/modes/deletions, and require
   the reconciled generated-file union to remain exactly the publication set.
6. Before creating an index backup, pathspec, or history change, reject a
   selected path with `filter`, `text`, `eol`, `working-tree-encoding`, or
   `ident` clean attributes, and reject file selections when
   `core.autocrlf` is active. This fail-closed rule prevents Git's clean
   conversion from making the saved blob differ from the reviewed physical
   bytes.
7. Require every selected path to be isolatable as a whole file. If selected
   and user-owned hunks share one path, the repository is mid-merge, the index
   has unmerged entries, a hook/tool cannot preserve an unrelated staged
   entry, or the installed VCS cannot express the exact selection, stop
   `blocked_scope`; never broaden the save, stash the checkout, or reset paths.

Capture a tool-native rollback handle, old HEAD/change id, and the exact raw
Git index bytes, original existence, and file mode before mutation. Store the
index in an ignored, immutable checksum-bound backup beside the preflight
snapshot. Also retain the canonical
`excluded_dirty_paths` inventory as the preservation baseline. The helper's
preflight output supplies an ignored immutable snapshot and a NUL-delimited
literal Git pathspec file; consume those exact returned paths.

<IMPORTANT>
Treat the selected set as closed. Never interpolate manifest text into a shell
command, use a glob or directory operand, run `git add .`, stage all changes,
stash, clean, reset a non-selected path, or accept an interactive selection.
Pass each validated path as a literal argv operand or through a NUL-delimited
literal pathspec file.
</IMPORTANT>

## Save through the repository owner

### jj-colocated repository

Do not infer colocation from prose printed by `jj`. The helper requires the jj
workspace root to equal the canonical Git worktree root, `jj git root` to
equal both Git's canonical `--git-dir` and `--git-common-dir`, and the
repository to be non-bare and not a linked Git worktree. It dynamically probes
the required commands, revsets, templates, `--ignore-working-copy`, and
`--at-operation` syntax; do not rely on a nominal jj version floor. An
unsupported capability returns `blocked_scope`.

Before the one intentional `jj status` snapshot, require
`git diff-index --cached --quiet HEAD --` to prove there are no ambient staged
Git entries. Capture the resulting operation id, and make every remaining jj
identity and diff read with `--ignore-working-copy` pinned to that exact
operation. Require `@` to be uniquely mutable, conflict-free, non-divergent,
present in the colocated Git object store, and based on exact sole parent
`HEAD`.

Require all selected dirty bytes to be in the mutable working-copy change
`@`. When excluded dirty paths also exist, use the existing whole-file
`jj split` mechanism with exactly the selected paths; the selected change is
described with a validated conventional message and the remainder stays on
`@`. When no excluded dirty path exists, use the normal local-save mechanism
over exactly that already-validated working-copy change. Do not use an
interactive hunk split or move content from an earlier saved change.

Before describing or emitting the Git commit, verify that the selected
change's name set is exactly `selected_paths` and its tree has every expected
file/link hash or deletion. Then complete the existing split/save-local route
and start the fresh working-copy change it prescribes. No bookmark or remote is
updated.

### Plain Git repository

Use Git's path-limited commit mechanism with `--only` and a NUL-delimited file
containing literal pathspecs for exactly `selected_paths`; never rely on the
ambient index. If a selected untracked file requires intent-to-add, apply that
state only to the selected literal path. Preserve any pre-existing unrelated
staged entries. If the installed Git cannot path-limit every selected state
(including new files and deletions) while preserving the captured index,
return `blocked_scope` without committing.

Validate the conventional message before the commit. No amend, reset, branch,
bookmark, or remote operation belongs to this route.

## Prove isolation

After the save and before reporting success:

```bash
bash "${CODING_COMMIT_SKILL_DIR}/scripts/validate-scoped-save.sh" verify \
  --repo "<repo>" --manifest "<manifest>" \
  --manifest-sha256 "<sha256>" --snapshot "<preflight-snapshot>" \
  --snapshot-sha256 "<preflight-snapshot-sha256>" \
  --saved-rev "<saved-revision>"
```

1. Require the saved change/commit diff name set to equal the preflight
   `selected_paths` set exactly. Verify each saved tree object's type and
   SHA-256 plus exact `100644`/`100755`/`120000` mode against the manifest;
   require each declared deletion to be absent. In plain Git, also require the
   saved commit's parent to equal the preflight `old_head` exactly.
2. Require every selected path to be clean relative to the saved change and no
   publication path to have acquired unmanifested dirty bytes.
3. Recompute the full non-selected dirty inventory, worktree file/link hashes,
   deletion states, index modes/oids, and staged/unstaged status. Require it to
   be byte-for-byte and entry-for-entry identical to the pre-mutation
   `excluded_dirty_paths` baseline.
4. Prove the saved revision is still the current history boundary. In plain
   Git, its parent must equal preflight `old_head` and current `HEAD` must equal
   the exact saved commit. In a jj-colocated workspace, the preflight operation
   must remain in the current operation ancestry; the saved commit must be
   present by exact commit/change identity with exactly the preflight
   working-copy parents; and the freshly snapshotted current working-copy
   change must be mutable, conflict-free, non-divergent, and have exactly the
   saved commit as its sole parent. An intervening commit/change returns
   `blocked_scope`; never hand a polluted descendant to finalization.
5. Run the normal integrity and project checks. These checks may read the full
   project but may not repair or stage non-selected paths.

If any proof fails, stop. For plain Git, while current `HEAD` is still exactly
the failed saved commit and its sole parent is preflight `old_head`, run:

```bash
bash "${CODING_COMMIT_SKILL_DIR}/scripts/validate-scoped-save.sh" recover \
  --repo "<repo>" --manifest "<manifest>" \
  --manifest-sha256 "<sha256>" --snapshot "<preflight-snapshot>" \
  --snapshot-sha256 "<preflight-snapshot-sha256>" \
  --failed-head "<failed-saved-revision>"
```

Recovery first requires every selected and excluded physical byte, link,
deletion, and mode to remain at its preflight value. It then compare-and-swaps
`HEAD` back to `old_head`, restores the exact backed-up index bytes/existence/
mode, proves the working tree did not change during recovery, and re-runs the
complete pre-save inventory proof. If current history or working-tree bytes
have moved, it refuses recovery; do not reset or overwrite that newer work.
For jj, use the preflight operation id with the repository's jj rollback
mechanism and repeat all proofs; the Python helper's `recover` command is
plain-Git-only.

After either route, report `blocked_scope`. Never report a successful scoped
save after a partial proof or silently keep a commit that captured extra
paths.

Write an immutable ignored result receipt beside the manifest containing the
manifest path/hash, old and new revision/change ids, selected path set and
saved-tree hashes, pre/post excluded-inventory digest, rollback handle,
verification results, current Git HEAD or jj operation/working-copy-parent
proof, and `non_selected_preserved: true`. Finalization and publication owners
must require this PASS receipt before consuming the saved change.
