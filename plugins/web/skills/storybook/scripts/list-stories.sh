#!/usr/bin/env bash
# list-stories.sh -- enumerate stories from a running Storybook.
#
# Contract:
#   list-stories.sh --cdp <PORT> --url <URL>
#
# Strategy:
#   1. Prefer GET /index.json (Storybook 7+). If 200 and parseable, normalize.
#   2. Fallback: attach agent-browser to <PORT>, navigate <URL>, and eval the
#      reusable extractor in injections/story-index.js (covers Storybook v6
#      via __STORYBOOK_STORY_STORE__ and v7+ via __STORYBOOK_PREVIEW__).
#
# Writes:
#   $RUN_DIR/stories.json -- a JSON array of:
#     { "id": "...", "title": "...", "name": "...", "importPath": "...", "tags": [...] }
#
# Exit codes:
#   0  At least zero stories materialised (empty list is legal)
#   2  Usage / dependency error
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: list-stories.sh --cdp <PORT> --url <URL>

Materialize the full story list (v7 /index.json preferred, v6+ in-page
store as fallback) and write a normalized array to $RUN_DIR/stories.json.
EOF
}

CDP=""
URL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cdp) CDP="${2:-}"; shift 2 ;;
    --url) URL="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *)
      printf 'list-stories.sh: unknown flag: %s\n' "$1" >&2
      usage; exit 2 ;;
  esac
done

if [[ -z "$CDP" || -z "$URL" ]]; then
  printf 'list-stories.sh: --cdp and --url are required\n' >&2
  exit 2
fi

for tool in jq curl agent-browser; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'list-stories.sh: %s is required but not installed\n' "$tool" >&2
    exit 2
  fi
done

# resolve the plugin directory so we can find shared injections regardless of cwd.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
INJECTION="$PLUGIN_DIR/scripts/injections/story-index.js"

ROOT="${TMPDIR:-/tmp}/storybook-audit"
mkdir -p "$ROOT"
CURRENT_FILE="$ROOT/.current-run-id"
if [[ -s "$CURRENT_FILE" ]]; then
  RUN_ID="$(cat "$CURRENT_FILE")"
else
  RUN_ID="$(date +%Y%m%d-%H%M%S)-$$"
  printf '%s\n' "$RUN_ID" > "$CURRENT_FILE"
fi
RUN_DIR="$ROOT/$RUN_ID"
mkdir -p "$RUN_DIR"

OUT="$RUN_DIR/stories.json"
RAW="$RUN_DIR/.stories.raw.json"

# Common normalizer (jq filter): accept any of:
#   - Storybook v7 /index.json    {v:N, entries:{<id>:{id,title,name,importPath,tags,type}}}
#   - Storybook v6 stories.json   {v:N, stories:{<id>:{id,kind,name,importPath,...}}}
#   - In-page extract             [{id,title,name,importPath,tags}]
# and emit a flat array of stories only (type=="story" when typed, all when not).
NORMALIZE='
  def from_entries(obj):
    [obj | to_entries[]
      | select((.value.type // "story") == "story")
      | {
          id:         (.value.id // .key),
          title:      (.value.title // .value.kind // ""),
          name:       (.value.name // ""),
          importPath: (.value.importPath // .value.parameters.fileName // ""),
          tags:       (.value.tags // [])
        }
    ];
  if type == "array" then
    map({
      id:         (.id // ""),
      title:      (.title // .kind // ""),
      name:       (.name // ""),
      importPath: (.importPath // ""),
      tags:       (.tags // [])
    })
  elif type == "object" then
    if (.entries | type) == "object" then from_entries(.entries)
    elif (.stories | type) == "object" then from_entries(.stories)
    else []
    end
  else []
  end
'

EMPTY=true
# 1. Try /index.json over HTTP.
if curl -fsS --max-time 5 "$URL/index.json" -o "$RAW" 2>/dev/null; then
  if jq -e '.' "$RAW" >/dev/null 2>&1; then
    EMPTY=false
  fi
fi

# 2. Try /stories.json (legacy v6) over HTTP if v7 missing.
if [[ "$EMPTY" == "true" ]]; then
  if curl -fsS --max-time 5 "$URL/stories.json" -o "$RAW" 2>/dev/null; then
    if jq -e '.' "$RAW" >/dev/null 2>&1; then
      EMPTY=false
    fi
  fi
fi

# 3. Last resort: evaluate the in-page extractor.
if [[ "$EMPTY" == "true" ]]; then
  if [[ ! -f "$INJECTION" ]]; then
    printf 'list-stories.sh: missing injection: %s\n' "$INJECTION" >&2
    printf '[]\n' > "$OUT"
    exit 0
  fi
  agent-browser --cdp "$CDP" open "$URL" >/dev/null 2>&1 || true
  EXPR="$(cat "$INJECTION")"
  # Wrap the expression so agent-browser eval returns its evaluation directly.
  RAW_OUT="$(agent-browser --cdp "$CDP" eval "JSON.stringify(($EXPR))" 2>/dev/null || echo '"[]"')"
  # agent-browser eval may return JSON-quoted; unwrap once if so.
  if printf '%s' "$RAW_OUT" | jq -e 'type == "string"' >/dev/null 2>&1; then
    printf '%s' "$RAW_OUT" | jq -r '.' > "$RAW"
  else
    printf '%s' "$RAW_OUT" > "$RAW"
  fi
fi

if [[ -s "$RAW" ]] && jq -e '.' "$RAW" >/dev/null 2>&1; then
  jq -c "$NORMALIZE" "$RAW" > "$OUT"
else
  printf '[]\n' > "$OUT"
fi

rm -f "$RAW"
printf '%s\n' "$OUT"
exit 0
