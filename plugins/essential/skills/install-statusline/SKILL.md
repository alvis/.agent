---
name: install-statusline
description: 'Install the bundled Bullet Train statusline into ~/.claude and wire settings.json statusLine. Use when setting up Claude Code on a new machine, installing or restoring the statusline, or repairing its configuration; preserve the bundled executable and report permission or platform limitations.'
requirements:
  intelligence: low
---

# Install Statusline

Installs the version-controlled statusline bundled with this skill onto the
current machine. The statusline renders: time · ⎇ branch with jj/git state
markers (✎±N undescribed work, ±N dirty files, ∅ empty jj @, ××N conflicts,
↑N/↓N sync arrows) · repo|relative-path · ❯❯❯ · model · ⬩ context % (tokens) ·
5h/7d rate-limit braille bars · output style. In jj-colocated repos it reads
`@` metadata with `--ignore-working-copy` (no snapshot churn) and resolves the
branch label from the nearest bookmark.

## Boundaries

- Use for: installing the bundled statusline on a new machine, restoring it
  after removal, or repairing a broken `statusLine` configuration.
- Do not use for: changing what the statusline renders — that is a source
  change to the bundled `scripts/statusline`, not an install task.

## Inputs

- **Required**: nothing beyond invocation.
- **Prerequisites**: `jq` on PATH and a writable `~/.claude` directory; the
  installer aborts with an install hint when `jq` is missing.

## Workflow

1. **Run the installer.**

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/skills/install-statusline/scripts/install-statusline.sh"
   ```

   The script is idempotent and safe to re-run. It:

   1. Verifies `jq` is available (aborts with an install hint if not)
   2. Copies `scripts/statusline` → `~/.claude/bin/statusline` and marks it
      executable (copy, not symlink, so it survives plugin relocation)
   3. Sets `statusLine` in `~/.claude/settings.json` to
      `{"type": "command", "command": "~/.claude/bin/statusline"}` — atomic
      write, with a timestamped backup taken only when the value actually
      changes
   4. Smoke-tests the installed binary with a fixture JSON
   5. Retires legacy `~/.claude/statusline-command.sh` /
      `statusline-command-backup.sh` by moving them to `/tmp/` (restorable
      until the next reboot/cleanup)

   If it aborts because `jq` is missing, install it (`brew install jq` on
   macOS) and re-run.

2. **Verify the install** with the smoke test in the verification below.
3. Run the verification below; when a check fails, fix the cause and re-run
   that check. Repeat until every check passes or a concrete blocker remains,
   then report the blocker instead of looping.

## Verification

- Pipe a sample status JSON into the installed binary and confirm a rendered
  statusline appears:

  ```bash
  printf '%s' '{"model":{"display_name":"Claude"},"workspace":{"current_dir":"'"$PWD"'","project_dir":""},"output_style":{"name":"default"},"context_window":{"total_input_tokens":120000,"used_percentage":60}}' | ~/.claude/bin/statusline
  ```

- `~/.claude/settings.json` has `statusLine.command` pointing at
  `~/.claude/bin/statusline`, and the binary is executable.

## Completion

Tell the user:

- Installed path (`~/.claude/bin/statusline`) and the rendered sample line
- Settings backup path, if one was created
- `/tmp/` location of any retired legacy scripts (restore with `mv` if ever
  needed)
- The statusline takes effect on the next render — no restart required

A blocked install reports the failing step verbatim (for example the `jq`
abort or a permission error under `~/.claude`) and what would clear it.
