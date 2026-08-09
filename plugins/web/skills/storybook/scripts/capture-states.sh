#!/usr/bin/env bash
# capture-states.sh — per-story screenshot capture for 4 interaction states.
#
# For a single story id, navigates the Storybook iframe, captures default /
# hover / active / focus-visible screenshots, dedupes non-default states
# against default via ImageMagick pHash, and emits a states.json manifest.
#
# Resolved policy:
# - Serial execution (caller may parallelise across stories).
# - Play-function stories: we wait for `storyRendered` (set post-play by our
#   listener) before capturing, so screenshots are POST-PLAY.
# - Focus-visible: detection failure is itself a finding emitted via
#   states.json (`focus_visible_detected: false`) → report.sh treats as P2.
#
# Usage:
#   capture-states.sh --cdp PORT --url URL --story ID [--run-dir DIR]
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

ab() {
  # agent-browser batch wrapper: forwards a single command array as JSON.
  local payload
  payload="$(jq -nc --args '[$ARGS.positional]' -- "$@")"
  printf '%s' "$payload" | agent-browser --cdp "$CDP" batch --bail --json
}

ab_eval() {
  ab eval "$1" >/dev/null 2>&1 || true
}

ab_eval_capture() {
  # Capture eval result via batch --json envelope.
  local payload
  payload="$(jq -nc --arg expr "$1" '[["eval", $expr, "--json"]]')"
  printf '%s' "$payload" | agent-browser --cdp "$CDP" batch --bail --json 2>/dev/null \
    | jq -r '.[0].result // empty'
}

# Install storyRendered listener BEFORE navigation so we don't miss the event.
# Storybook fires `storyRendered` on the addons channel after `play()` settles.
ab_eval "window.__STORY_RENDERED__ = false; try { const ch = window.__STORYBOOK_ADDONS_CHANNEL__ || (window.parent && window.parent.__STORYBOOK_ADDONS_CHANNEL__); if (ch && !window.__STORY_RENDERED_LISTENER__) { ch.on('storyRendered', () => { window.__STORY_RENDERED__ = true; }); window.__STORY_RENDERED_LISTENER__ = true; } } catch(e) {}"

# Navigate to the iframe URL for this story.
IFRAME_URL="${URL%/}/iframe.html?id=${STORY}&viewMode=story"
ab open "$IFRAME_URL" >/dev/null 2>&1 || true

# Re-install listener after navigation (channel may have been reset).
ab_eval "window.__STORY_RENDERED__ = false; try { const ch = window.__STORYBOOK_ADDONS_CHANNEL__ || (window.parent && window.parent.__STORYBOOK_ADDONS_CHANNEL__); if (ch) { ch.on('storyRendered', () => { window.__STORY_RENDERED__ = true; }); } } catch(e) {}"

# Poll for storyRendered (≤5s), fallback sleep on timeout.
deadline=$((SECONDS + 5))
while [[ $SECONDS -lt $deadline ]]; do
  ready="$(ab_eval_capture 'window.__STORY_RENDERED__ === true')"
  if [[ "$ready" == "true" ]]; then break; fi
  sleep 0.25
done
if [[ "${ready:-false}" != "true" ]]; then
  # Fallback: give the page a moment in case the listener missed.
  sleep 1
fi

# Primary interactive element cascade — first match wins.
PRIMARY_SELECTOR_JS=$(cat <<'EOF'
(function(){
  const sels = ['[role=button]','button','[role=link]','a','[role=textbox]','input','[data-testid="root"]','#storybook-root > *'];
  for (const s of sels) {
    const el = document.querySelector(s);
    if (el) return s;
  }
  return null;
})()
EOF
)

# --- default screenshot ---
DEFAULT_PNG="$STORY_DIR/default.png"
ab screenshot "$DEFAULT_PNG" >/dev/null 2>&1 || true

# --- hover screenshot ---
HOVER_PNG="$STORY_DIR/hover.png"
ab_eval "(function(){const sels=['[role=button]','button','[role=link]','a','[role=textbox]','input','[data-testid=\"root\"]','#storybook-root > *'];let el=null;for(const s of sels){el=document.querySelector(s);if(el)break;}if(el){const r=el.getBoundingClientRect();const ev=(t)=>el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));ev('mouseover');ev('mouseenter');ev('mousemove');window.__STATE_EL__=el;}})()"
sleep 0.15
ab screenshot "$HOVER_PNG" >/dev/null 2>&1 || true
# Clear hover.
ab_eval "(function(){const el=window.__STATE_EL__;if(el){el.dispatchEvent(new MouseEvent('mouseout',{bubbles:true}));el.dispatchEvent(new MouseEvent('mouseleave',{bubbles:true}));}})()"

# --- active screenshot (mousedown, no mouseup) ---
ACTIVE_PNG="$STORY_DIR/active.png"
ab_eval "(function(){const el=window.__STATE_EL__||document.querySelector('button,[role=button],a,#storybook-root > *');if(el){const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));window.__STATE_EL__=el;}})()"
sleep 0.15
ab screenshot "$ACTIVE_PNG" >/dev/null 2>&1 || true
ab_eval "(function(){const el=window.__STATE_EL__;if(el){const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,button:0,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));}})()"

# --- focus-visible screenshot ---
FOCUS_PNG="$STORY_DIR/focus-visible.png"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROBE_JS_PATH="$PLUGIN_DIR/scripts/injections/focus-visible-probe.js"
PROBE_JS="$(cat "$PROBE_JS_PATH")"
# Run probe and capture result.
PROBE_PAYLOAD="$(jq -nc --arg expr "$PROBE_JS" '[["eval", $expr, "--json"]]')"
PROBE_RESULT="$(printf '%s' "$PROBE_PAYLOAD" | agent-browser --cdp "$CDP" batch --bail --json 2>/dev/null | jq -c '.[0].result // {}')"
FOCUS_VISIBLE_DETECTED="$(printf '%s' "$PROBE_RESULT" | jq -r '.matches_focus_visible // false')"
sleep 0.1
ab screenshot "$FOCUS_PNG" >/dev/null 2>&1 || true

# --- pHash dedupe vs default ---
phash() {
  # magick compare writes the metric to stderr; combine and grep the number.
  local a="$1" b="$2"
  if [[ ! -s "$a" || ! -s "$b" ]]; then
    echo "999"
    return
  fi
  local out
  out="$(magick compare -metric PHASH "$a" "$b" null: 2>&1 || true)"
  # Output may be like "1.234" or "1.234 (0.001)" — take first numeric token.
  echo "$out" | awk '{print $1; exit}' | grep -Eo '^[0-9]+(\.[0-9]+)?' || echo "999"
}

HOVER_PHASH="$(phash "$DEFAULT_PNG" "$HOVER_PNG")"
ACTIVE_PHASH="$(phash "$DEFAULT_PNG" "$ACTIVE_PNG")"
FOCUS_PHASH="$(phash "$DEFAULT_PNG" "$FOCUS_PNG")"

below_threshold() {
  awk -v v="$1" 'BEGIN { exit !(v+0 <= 2.0) }'
}

HOVER_KEPT=true
ACTIVE_KEPT=true
FOCUS_KEPT=true

if below_threshold "$HOVER_PHASH";  then HOVER_KEPT=false;  rm -f "$HOVER_PNG";  fi
if below_threshold "$ACTIVE_PHASH"; then ACTIVE_KEPT=false; rm -f "$ACTIVE_PNG"; fi
if below_threshold "$FOCUS_PHASH";  then FOCUS_KEPT=false;  rm -f "$FOCUS_PNG";  fi

# --- write states.json ---
jq -n \
  --arg default_path "$DEFAULT_PNG" \
  --arg hover_path "$HOVER_PNG" \
  --argjson hover_kept "$HOVER_KEPT" \
  --argjson hover_phash "${HOVER_PHASH:-999}" \
  --arg active_path "$ACTIVE_PNG" \
  --argjson active_kept "$ACTIVE_KEPT" \
  --argjson active_phash "${ACTIVE_PHASH:-999}" \
  --arg focus_path "$FOCUS_PNG" \
  --argjson focus_kept "$FOCUS_KEPT" \
  --argjson focus_phash "${FOCUS_PHASH:-999}" \
  --argjson focus_detected "$FOCUS_VISIBLE_DETECTED" \
  '{
    "default":       {"path": $default_path, "kept": true},
    "hover":         {"path": $hover_path, "kept": $hover_kept, "phash": $hover_phash},
    "active":        {"path": $active_path, "kept": $active_kept, "phash": $active_phash},
    "focus-visible": {"path": $focus_path, "kept": $focus_kept, "phash": $focus_phash, "focus_visible_detected": $focus_detected}
  }' > "$STORY_DIR/states.json"

echo "{\"story\":\"$STORY\",\"states_json\":\"$STORY_DIR/states.json\"}"
