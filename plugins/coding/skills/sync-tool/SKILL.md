---
name: sync-tool
description: 'Install or update registered coding CLI tools (brew, jj, gh, fallow, python) across macOS, Linux, and Windows. Use when tools are missing, stale, or needed on PATH for a sibling skill, including requests to install jj/gh/brew, update coding tools, or verify CLI dependencies before work.'
metadata:
  intelligence: low
argument-hint: "[--only <name1,name2>] [--check] [--dry-run] [--force]"
---

# Sync Tool

Before any `jj` decision or command, follow
`coding:references/jj.md`. This skill installs the
tool; the guide owns repository initialization and use.

Set `CODING_SYNC_TOOL_SKILL_DIR` to the absolute directory containing this
loaded `SKILL.md` before invoking its scripts.

Idempotently installs or updates a fixed registry of coding CLI tools from
their official upstream sources so any sibling skill (for example
`coding:commit`, which needs `jj` and `gh`) can rely on them being on `PATH`
at minimum versions. The registry — order, minimum versions, installer
contract — lives in [references/tool-registry.md](references/tool-registry.md);
`scripts/sync.py` executes it.

## Boundaries

- Use for: installing or updating registered tools, verifying they are
  present at minimum versions (`--check`), previewing installer commands
  (`--dry-run`), forcing a reinstall (`--force`), or bootstrapping a fresh
  machine for coding work.
- Do not use for: arbitrary package management — the registry is deliberately
  closed (see [references/tool-registry.md](references/tool-registry.md) for
  why, and for how to register a new tool).
- Never run interactive auth: for `gh`, the pipeline polls `gh auth status`
  and prints a banner instructing the user — it never invokes `gh auth login`.

## Inputs

- **Required**: none — no arguments runs the full registry in order.
- **Optional**:
  - `--only <csv>` — subset of registered tool names (registry order is
    preserved regardless of CSV order); reject names that are not in
    [references/tool-registry.md](references/tool-registry.md).
  - `--check` — status-only; no installation, non-zero exit if any selected
    tool is missing or below its minimum version.
  - `--dry-run` — print each planned installer command without executing
    (sets `DRY_RUN=1` for each installer).
  - `--force` — reinstall/upgrade even when already at minimum version
    (sets `FORCE=1`).
  - `SYNC_TOOL_NO_WAIT=1` (env var) — for `gh` post-install: print the auth
    banner once and exit non-zero instead of polling, so CI and other
    non-interactive callers fail fast.
- **Prerequisites**: `bash` (Git-Bash/MSYS/Cygwin on Windows), `python3`
  (3.8+) on `PATH`, and network access to upstream package sources (Homebrew,
  GitHub releases, apt/dnf, winget, crates.io).

## Workflow

1. Parse flags, validate any `--only` names against the registry, and resolve
   the tool list (default = full registry, in order; order matters because
   `brew` must precede the other tools on macOS).
2. Run the pipeline: `python3 "${CODING_SYNC_TOOL_SKILL_DIR}/scripts/sync.py" [flags]`.
   For each selected tool the script detects the OS via `uname -s`, runs
   `scripts/installers/<tool>.sh` with the `DRY_RUN`/`FORCE` env vars,
   verifies `<tool> --version` against the registry minimum, and — for `gh`
   only — polls `gh auth status` until authenticated, aborted, or
   `SYNC_TOOL_NO_WAIT=1` short-circuits. Per-OS install methods are documented
   in [references/platforms.md](references/platforms.md).

   ```bash
   # Only sync jj and gh (e.g., from coding:commit)
   python3 "${CODING_SYNC_TOOL_SKILL_DIR}/scripts/sync.py" --only=jj,gh

   # Non-interactive: skip the gh auth poll, fail fast
   SYNC_TOOL_NO_WAIT=1 python3 "${CODING_SYNC_TOOL_SKILL_DIR}/scripts/sync.py" --only=gh
   ```

3. Review the per-tool status lines: a tool passes when its status is
   `installed`, `updated`, `already_current`, or `skipped`; it fails
   otherwise. With `--check`, any missing or below-minimum tool fails the run
   by contract.
4. Decide, then re-verify; repeat until every check passes or a concrete
   blocker remains, then report the blocker instead of looping:
   - All tools pass — report the results.
   - `gh` auth failure (`gh-auth-aborted` or `gh-auth-no-wait` action) —
     surface the banner instructions and defer to the caller; never auto-retry
     interactive auth.
   - Installation error — retry once with `--only=<that-tool>` and the same
     mode flags; if the retry also fails, report the underlying error.
   - In `--check` or `--dry-run` mode — never retry; just report.

## Verification

- Each selected tool's `<tool> --version` meets its registry minimum, or its
  failure is reported with the installer's stderr message.
- Exit code is `0` only when every selected tool ended in
  `installed | updated | already_current | skipped`; `--check` exits non-zero
  when anything is missing or outdated.

## Completion

<report>

Echo the pipeline output verbatim:

- one status line per tool, `{tool}: {status} ({action})`, where
  `status ∈ {installed, updated, already_current, skipped, failed}` and
  `action` is the command run (`noop` for `already_current`);
- the trailing line
  `summary: N tools — X installed, Y updated, Z already_current, W skipped, V failed`;
- the exit code and the mode flags used.

</report>

State separately any `gh` auth follow-up the user must perform (for example
`gh auth login` in another terminal). A partial or failed run must name the
failing tool and its error.
