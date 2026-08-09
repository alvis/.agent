#!/bin/bash

# Install the bundled statusline into ~/.claude and wire settings.json.
# Idempotent: safe to re-run; only backs up settings when actually changing them.

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$SKILL_DIR/scripts/statusline"
CLAUDE_DIR="$HOME/.claude"
DEST_DIR="$CLAUDE_DIR/bin"
DEST="$DEST_DIR/statusline"
SETTINGS="$CLAUDE_DIR/settings.json"

# preflight
if ! command -v jq >/dev/null 2>&1; then
    echo "error: jq is required (brew install jq)" >&2
    exit 1
fi
if [[ ! -f "$SRC" ]]; then
    echo "error: bundled statusline not found at $SRC" >&2
    exit 1
fi

# install binary (copy, not symlink — survives plugin relocation/reinstall)
mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST"
chmod +x "$DEST"
echo "installed: $DEST"

# wire settings.json (atomic write; backup only when statusLine changes)
desired='{"type":"command","command":"~/.claude/bin/statusline"}'
mkdir -p "$CLAUDE_DIR"
if [[ ! -f "$SETTINGS" ]]; then
    echo '{}' > "$SETTINGS"
fi
current=$(jq -c '.statusLine // empty' "$SETTINGS")
if [[ "$current" != "$(jq -c . <<<"$desired")" ]]; then
    backup="$SETTINGS.bak.$(date +%Y%m%d%H%M%S)"
    cp "$SETTINGS" "$backup"
    echo "settings backup: $backup"
    tmp=$(mktemp)
    jq --argjson sl "$desired" '.statusLine = $sl' "$SETTINGS" > "$tmp"
    mv "$tmp" "$SETTINGS"
    echo "settings.json: statusLine now points to $DEST"
else
    echo "settings.json: statusLine already up to date"
fi

# smoke test: the installed binary must render a non-empty line
now=$(date +%s)
fixture=$(printf '{"model":{"display_name":"Claude"},"workspace":{"current_dir":"%s","project_dir":""},"output_style":{"name":"default"},"context_window":{"total_input_tokens":120000,"used_percentage":60},"rate_limits":{"five_hour":{"used_percentage":25,"resets_at":%s},"seven_day":{"used_percentage":40,"resets_at":%s}}}' "$HOME" "$((now + 7200))" "$((now + 86400))")
out=$(printf '%s' "$fixture" | "$DEST")
if [[ -z "$out" ]]; then
    echo "error: smoke test produced empty output" >&2
    exit 1
fi
echo "smoke test ok: $out"

# retire legacy statusline scripts (restorable from /tmp)
for legacy in "$CLAUDE_DIR/statusline-command.sh" "$CLAUDE_DIR/statusline-command-backup.sh"; do
    if [[ -f "$legacy" ]]; then
        mv "$legacy" "/tmp/$(basename "$legacy")"
        echo "retired: $legacy -> /tmp/$(basename "$legacy")"
    fi
done

echo "done — statusline takes effect on next render"
