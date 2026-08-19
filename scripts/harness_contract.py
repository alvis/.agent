"""The one home for how a hook command resolves its plugin root.

Claude Code sets `CLAUDE_PLUGIN_ROOT` and Codex sets `PLUGIN_ROOT`, so every
shipped hook command resolves the two through one ordered chain. Adding a
harness extends that chain by one segment, and this module is the place that
edit happens: `pytest.ini` puts `scripts` on `pythonpath`, so every test that
asserts on the chain imports it from here rather than restating it. A second
copy would let one file be updated for a new harness while the other silently
kept passing against the old chain — the exact drift the chain exists to stop.
"""

PLUGIN_ROOT_ANCHOR = "${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}"

HARNESS_ROOT_VARIABLES = ("CLAUDE_PLUGIN_ROOT", "PLUGIN_ROOT")

# Terminates the chain. Without it an unrecognized harness expands the anchor
# empty, `sed` reads a path rooted at "/", and `jq -Rs` still prints a complete
# envelope at rc 0 — so the hook injects nothing and reports success. Exiting
# non-zero makes the next harness announce itself instead.
PLUGIN_ROOT_GUARD = (
    f'[ -n "{PLUGIN_ROOT_ANCHOR}" ] '
    '|| { echo "plugin root unset" >&2; exit 1; }; '
)
