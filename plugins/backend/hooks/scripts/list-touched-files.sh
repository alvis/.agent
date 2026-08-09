#!/usr/bin/env bash
set -euo pipefail
command -v jq >/dev/null 2>&1 || exit 0
TRANSCRIPT="${1:-}"
[[ -n "$TRANSCRIPT" && -f "$TRANSCRIPT" ]] || exit 0

jq -rs '
  . as $all
  | ($all
     | map(
         .type == "user"
         and (
           (.message.content | type) == "string"
           or ((.message.content // []) | type == "array"
               and (all(.[]?; .type != "tool_result")))
         )
       )
     | reverse | index(true)) as $r
  | (if $r == null then 0 else ($all | length) - $r end) as $start
  | $all[$start:]
  | map(select(.type == "assistant"))
  | map(.message.content // [] | .[]?
        | select(.type == "tool_use"
                 and (.name | IN("Edit","Write","MultiEdit","NotebookEdit"))))
  | map(.input.file_path // .input.notebook_path // empty)
  | unique_by(.) | .[]
' "$TRANSCRIPT" 2>/dev/null || true
