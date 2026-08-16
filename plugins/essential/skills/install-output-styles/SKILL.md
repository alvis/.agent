---
name: install-output-styles
description: "Install bundled Claude Code output-style Markdown files into ~/.claude/output-styles. Use when asked to install, refresh, or repair a response style shipped with this skill; do not use for editing style content or project-scoped .claude/output-styles files."
requirements:
  intelligence: low
---

# Install Output Styles

Install the output-style Markdown files bundled with this skill for the current
user. This skill is for Claude Code and writes user-scoped files under
`~/.claude/output-styles/`.

## Boundaries

- Use for installing or refreshing a bundled output style.
- Do not use for editing a style's source content; update the bundled asset in
  this skill instead.
- Do not use for project-scoped `.claude/output-styles/` files or for changing
  which style Claude Code has selected.

## Inputs

- **Required**: nothing beyond invocation.
- **Prerequisites**: Claude Code with `CLAUDE_PLUGIN_ROOT` set and a writable
  `~/.claude` directory.

## Workflow

<IMPORTANT>
Invoking this skill loads these instructions into context; it does not run
anything by itself. Step 1's command is an action to execute immediately with
a tool call, not documentation to read and assume complete. Never report an
install as done, unchanged, or already-run without a tool call in this turn
whose output shows the installer actually executed and step 2's checks
actually passed.
</IMPORTANT>

1. Run the installer now, in this turn:

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/skills/install-output-styles/scripts/install-output-styles.sh"
   ```

   The installer creates `~/.claude/output-styles/`, copies every bundled
   `assets/*.md` file by its existing filename, and reports each installed or
   unchanged file. When an existing file differs, it saves a timestamped
   `.bak` copy before replacing it.

2. Verify each expected file exists and matches its bundled asset, by actually
   running the checks below rather than assuming step 1 succeeded. For the
   current bundle, run:

   ```bash
   test -f "$HOME/.claude/output-styles/eli5.md"
   cmp -s "${CLAUDE_PLUGIN_ROOT}/skills/install-output-styles/assets/eli5.md" "$HOME/.claude/output-styles/eli5.md"
   ```

3. Tell the user how to activate the style: run `/config`, choose `ELI5`
   under Output style, and start a new Claude Code session. Installing a file
   does not change the selected style.

<IMPORTANT>
If `CLAUDE_PLUGIN_ROOT` is missing, the target directory is not writable, or a
copy fails, report the exact failing path and stop. Do not claim installation
until the matching-file check in step 2 has actually run and passed in this
turn.
</IMPORTANT>

## Verification

- The installer exits successfully.
- Every expected file exists under `~/.claude/output-styles/`.
- Every installed file matches the corresponding bundled asset byte for byte.

## Completion

Report the installed paths, any backup paths, the verification result, and the
activation step. A blocked install reports the exact failing command or path
and what would clear it.
