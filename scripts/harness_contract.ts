export const PLUGIN_ROOT_ANCHOR = "${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}";

export const HARNESS_ROOT_VARIABLES = [
  "CLAUDE_PLUGIN_ROOT",
  "PLUGIN_ROOT",
] as const;

export const PLUGIN_ROOT_GUARD =
  `[ -n "${PLUGIN_ROOT_ANCHOR}" ] || { echo "plugin root unset" >&2; exit 1; }; `;
