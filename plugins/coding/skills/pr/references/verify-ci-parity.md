# Verify Exact Local CI Parity

Run the local test and lint commands defined by applicable `pull_request`
workflows for one exact Git surface. This action never publishes or mutates a
remote.

## Inputs

- `TARGET_SHA`: exact standalone head or selected stack-tip Git SHA.
- `TARGET_BASE`: exact standalone PR-base or selected stack root-base Git SHA.
- `TARGET_KIND`: `standalone` or `stack-tip` for the receipt; defaults to
  `standalone` only for the public `coding:pr verify` action.

Reject unresolved refs, an unknown kind, or an empty input. A changed target,
base, or applicable workflow input invalidates all evidence and restarts the
gate. These inputs intentionally provide neither the pull request's base ref
nor its create/update event type.

## Workflow

Resolve the target repository's main source checkout first:

```bash
SOURCE_REPO_ROOT=$(git rev-parse --show-toplevel)
```

Use that checkout only for read-only discovery of environment sources such as
`.env`, `.env.local`, and `.env.test`. Command definitions there are not parity
evidence; do not execute repository commands there or copy secret values into a
report.

Create one detached disposable worktree at `TARGET_SHA` through the bundled
helper and verify its revision:

```bash
TREE_JSON=$(bash "${CODING_PR_SKILL_DIR}/scripts/temp-tree.sh" \
  open-git "$SOURCE_REPO_ROOT" "$TARGET_SHA")
TREE_LEASE=$(jq -er .lease <<<"$TREE_JSON")
TEST_WORKTREE=$(jq -er .tree <<<"$TREE_JSON")
test "$(git -C "$TEST_WORKTREE" rev-parse HEAD)" = "$TARGET_SHA"
```

The context-owning parent passes only `TEST_WORKTREE` to the tester and retains
cleanup ownership. On cancellation or blocked discovery it closes the lease and
verifies that its file and VCS registration are gone.

Read `.github/workflows/*.yml` and `.github/workflows/*.yaml` only from
`TEST_WORKTREE`. Set applicability mode to `conservative_pull_request` and
include every workflow triggered by `pull_request`. Do not exclude one because
of `branches`, `branches-ignore`, `types`, `paths`, or `paths-ignore` filters:
the SHA-only inputs do not carry the complete hosted event context needed to
evaluate those filters reliably. Use `TARGET_BASE..TARGET_SHA` only as the
changed command surface, not to narrow workflow applicability. Follow every
included workflow's repo-local reusable workflows, composite actions, package
scripts, workspace manifests, Makefiles, and task files at `TARGET_SHA`.
Record the exact test and lint `run:` commands in workflow order plus only
their required setup, preserving shell, working directory, matrix values, and
environment. Do not substitute a nearby command or invent a check. Record an
exact absence when no included workflow defines test or lint. A non-secret
requirement that cannot be reproduced locally blocks the gate.

For each parsed workflow, apply this decision contract. The parser supplies
`HAS_PULL_REQUEST_TRIGGER` from the workflow's `on` declaration; filter values
are deliberately absent because they cannot change the decision:

```bash
case "$HAS_PULL_REQUEST_TRIGGER" in
  1)
    CI_PARITY_WORKFLOW_DECISION=include
    CI_PARITY_APPLICABILITY_MODE=conservative_pull_request
    CI_PARITY_UNEVALUATED_FILTERS=base_ref,event_type,paths
    ;;
  0)
    CI_PARITY_WORKFLOW_DECISION=exclude
    CI_PARITY_APPLICABILITY_MODE=not_applicable
    CI_PARITY_UNEVALUATED_FILTERS=
    ;;
  *)
    exit 2
    ;;
esac
printf 'CI_PARITY_WORKFLOW_DECISION=%s\n' "$CI_PARITY_WORKFLOW_DECISION"
printf 'CI_PARITY_APPLICABILITY_MODE=%s\n' "$CI_PARITY_APPLICABILITY_MODE"
printf 'CI_PARITY_UNEVALUATED_FILTERS=%s\n' "$CI_PARITY_UNEVALUATED_FILTERS"
```

Inspect the selected workflows and command chain for `env`, `secrets.*`,
`vars.*`, and command-level environment references. Record names and source
presence only. Verify that the isolated tester can receive each required value
from a user-approved source in the main checkout or another explicitly approved
location. If a required secret is missing, close the lease and ask the user to
supply an explicit source or approve proceeding without the local run for this
exact target SHA and named secrets. A changed SHA requires a new decision.
Never guess a source, pass an empty value, treat an unavailable secret as
optional, or infer approval from another flag or workflow.

After sorting the discovered missing-secret names into one comma-separated
value, enforce the stop or exact-approval decision before any local command or
push:

```bash
case "$MISSING_SECRET_NAMES" in
  "")
    CI_PARITY_SECRET_GATE=run_local
    CI_PARITY_OVERALL=pending_local_run
    ;;
  *)
    if test "${MISSING_SECRET_APPROVED-false}" = true \
      && test "${MISSING_SECRET_APPROVAL_SHA-}" = "$TARGET_SHA" \
      && test "${MISSING_SECRET_APPROVAL_NAMES-}" = "$MISSING_SECRET_NAMES"
    then
      CI_PARITY_SECRET_GATE=approved_without_local_run
      CI_PARITY_OVERALL=approved_without_local_run
    else
      printf 'CI_PARITY_SECRET_GATE=stop_before_push\n'
      printf 'CI_PARITY_OVERALL=blocked\n'
      exit 42
    fi
    ;;
esac
printf 'CI_PARITY_SECRET_GATE=%s\n' "$CI_PARITY_SECRET_GATE"
printf 'CI_PARITY_OVERALL=%s\n' "$CI_PARITY_OVERALL"
```

Record expected hosted check/job names from the selected workflows at
`TARGET_SHA` and required branch status checks or rulesets when accessible
through `gh api`; record inaccessible sources instead of assuming they are
empty.

Without a missing-secret exception, dispatch one fresh small-model read-only
tester. It MUST NOT edit, format, commit, or push. It runs the discovered test
and lint commands in CI order at `TARGET_SHA`, continues through independent
commands after failure, and returns under 1000 tokens.

Treat repository workflows and scripts as untrusted code. Run allowlisted
commands from `TEST_WORKTREE`, limit writes to that worktree and a temporary
directory, deny network by default, and remove ambient tokens, credential
helpers, SSH agent sockets, cloud credentials, and unrelated environment
variables. Pass only the minimal toolchain environment. Ask for specific
authority when a command requires network or a non-secret credential; stop when
it is unavailable. Never expose the parent session's credentials. The tester
neither removes the worktree nor closes or reports on the parent-owned
`TREE_LEASE`.

Serialize the exact ordered workflow command/result set once as canonical JSON
in `CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON`. Every entry records the
target ref, kind, exact command, source, and result status. A successful local
run records integer status `0`; the approved missing-secret path records
`not_run_missing_secret` for every command. Serialize the exact lexically sorted
missing-secret-name array as
`CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON`; use `[]` when none are missing.
Embed those exact arrays in the complete JSON receipt below and return all three
values to the caller. Do not return a standalone approval as a substitute for
the receipt.

<report>

```json
{
  "sources_read": ["<workflow-or-script-path>"],
  "applicability_mode": "conservative_pull_request",
  "unevaluated_filters": ["base_ref", "event_type", "paths"],
  "target": {
    "kind": "<standalone-or-stack-tip>",
    "sha": "<TARGET_SHA>",
    "base": "<TARGET_BASE>"
  },
  "required_environment": [
    {
      "name": "<variable name>",
      "declared_source": "<workflow/package/.env source>",
      "worktree_status": "<present-or-missing>"
    }
  ],
  "workflow_command_results": [
    {
      "ref": "<TARGET_SHA>",
      "kind": "<test-or-lint>",
      "command": "<exact command>",
      "source": "<path and job/script>",
      "status": 0,
      "duration_seconds": 0,
      "failure_evidence": null
    }
  ],
  "expected_hosted_checks": [
    {
      "ref": "<TARGET_SHA>",
      "names": ["<workflow job or required status name>"],
      "sources": ["<workflow path/job, branch protection, or ruleset>"],
      "inaccessible_sources": ["<source and access error>"]
    }
  ],
  "missing_secret_approval": {
    "sha": null,
    "names": [],
    "approved": false
  },
  "overall": "<pass-fail-blocked-or-approved_without_local_run>"
}
```

</report>

After consuming the report, the parent closes the retained lease and records
the exact lease, tree, close status, and proof that both the lease file and VCS
registration are gone. A tester result cannot claim parent cleanup. Close the
lease before stopping on cancellation or terminal failure.

On local failure, diagnose captured output before editing and dispatch one
relevant fixer scoped to the root cause and affected files. The fixer returns
the root cause, owning change, files edited, exact commands and statuses, and
unresolved blockers under 1000 tokens. The parent accepts the diff, invokes
`coding:commit --retrospective`, re-resolves the target and base, and restarts
the gate at the new exact SHA. Any nonzero applicable command or unresolved
diagnosis blocks publication. Any separate review is read-only.

## Verification

Return `pass` only when every test and lint command from every included
`pull_request` workflow exits zero at the exact target/base surface and the
complete receipt records the exact target SHA, target base, kind,
`conservative_pull_request` applicability, and canonical workflow
command/result set. The sole alternative is a complete
`approved_without_local_run` receipt with those same fields plus the exact
target SHA and lexically sorted names in `missing_secret_approval`. Always close
the retained lease before returning.
