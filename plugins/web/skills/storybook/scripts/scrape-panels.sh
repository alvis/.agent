#!/usr/bin/env bash
# scrape-panels.sh — harvest a11y + interactions addon panel state per story.
#
# Navigates the Storybook iframe (idempotent — same URL as capture-states),
# evaluates the two injections, merges their JSON into panels.json. Missing
# addons degrade gracefully: stderr warning + `available: false` flag, never
# a hard fail.
#
# Usage:
#   scrape-panels.sh --cdp PORT --url URL --story ID [--run-dir DIR]
set -euo pipefail

CDP=""
URL=""
STORY=""
RUN_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cdp) CDP="$2"; shift 2 ;;
    --url) URL="$2"; shift 2 ;;
    --story) STORY="$2"; shift 2 ;;
    --run-dir) RUN_DIR="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$CDP" || -z "$URL" || -z "$STORY" ]]; then
  echo "usage: $0 --cdp PORT --url URL --story ID [--run-dir DIR]" >&2
  exit 2
fi

if [[ -z "$RUN_DIR" ]]; then
  marker="${TMPDIR:-/tmp}/storybook-audit/.current-run-id"
  if [[ -f "$marker" ]]; then
    run_id="$(cat "$marker")"
    RUN_DIR="${TMPDIR:-/tmp}/storybook-audit/${run_id}"
  else
    echo "no --run-dir given and no marker at $marker" >&2
    exit 2
  fi
fi

STORY_DIR="$RUN_DIR/stories/$STORY"
mkdir -p "$STORY_DIR"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
INJ_DIR="$PLUGIN_DIR/scripts/injections"
A11Y_JS="$(cat "$INJ_DIR/a11y-results.js")"
INTERACT_JS="$(cat "$INJ_DIR/interactions.js")"

# Idempotent navigate — same URL as capture-states.sh.
IFRAME_URL="${URL%/}/iframe.html?id=${STORY}&viewMode=story"
agent-browser --cdp "$CDP" batch --bail --json <<<"$(jq -nc --arg u "$IFRAME_URL" '[["open", $u]]')" >/dev/null 2>&1 || true

# Allow the panels to populate after render.
sleep 0.5

run_eval_json() {
  local expr="$1"
  local payload
  payload="$(jq -nc --arg expr "$expr" '[["eval", $expr, "--json"]]')"
  printf '%s' "$payload" | agent-browser --cdp "$CDP" batch --bail --json 2>/dev/null \
    | jq -c '.[0].result // {"available": false}'
}

A11Y_JSON="$(run_eval_json "$A11Y_JS")"
INTERACT_JSON="$(run_eval_json "$INTERACT_JS")"

if [[ "$(printf '%s' "$A11Y_JSON" | jq -r '.available // false')" != "true" ]]; then
  echo "warn: @storybook/addon-a11y not available for story $STORY" >&2
fi
if [[ "$(printf '%s' "$INTERACT_JSON" | jq -r '.available // false')" != "true" ]]; then
  echo "warn: @storybook/addon-interactions not available for story $STORY" >&2
fi

jq -n \
  --argjson a11y "$A11Y_JSON" \
  --argjson interactions "$INTERACT_JSON" \
  --arg story "$STORY" \
  '{ "story": $story, "a11y": $a11y, "interactions": $interactions }' \
  > "$STORY_DIR/panels.json"

echo "{\"story\":\"$STORY\",\"panels_json\":\"$STORY_DIR/panels.json\"}"
