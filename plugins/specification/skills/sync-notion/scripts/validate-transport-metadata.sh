#!/usr/bin/env bash
# Read-only validation of transport-owned identity and revision metadata in one
# or more Notion transport files. This script never changes file bytes or
# interprets body syntax.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $(basename "$0") <file.mdc> [<file.mdc> ...]" >&2
  exit 2
fi

status=0
for file in "$@"; do
  case "$file" in
    *.mdc) ;;
    *) echo "invalid (not .mdc): $file" >&2; status=1; continue ;;
  esac
  if [ -L "$file" ] || [ ! -f "$file" ]; then
    echo "invalid (not a regular non-symlink file): $file" >&2; status=1; continue
  fi
  if [ "$(head -n 1 "$file")" != "---" ]; then
    echo "invalid (front matter does not start at byte zero): $file" >&2
    status=1
    continue
  fi

  if metadata="$({
    awk '
      function capture(name, line, prefix) {
        counts[name] += 1
        sub(prefix, "", line)
        values[name] = line
        if (line == "") empty[name] = 1
      }
      NR == 1 { in_frontmatter = 1; next }
      in_frontmatter && /^---$/ {
        closed = 1
        in_frontmatter = 0
        next
      }
      in_frontmatter && /^ref:[[:space:]]*/ {
        capture("ref", $0, "^ref:[[:space:]]*")
        next
      }
      in_frontmatter && /^parent:[[:space:]]*/ {
        capture("parent", $0, "^parent:[[:space:]]*")
        next
      }
      in_frontmatter && /^last_edited_time:[[:space:]]*/ {
        capture("last_edited_time", $0, "^last_edited_time:[[:space:]]*")
      }
      END {
        if (!closed) exit 3
        if (counts["ref"] > 1 || counts["parent"] > 1 ||
            counts["last_edited_time"] > 1) exit 4
        if (empty["ref"] || empty["parent"] || empty["last_edited_time"]) exit 5
        if (!counts["ref"] && !counts["parent"]) exit 6
        if (!counts["ref"] && counts["last_edited_time"]) exit 7
        ref = counts["ref"] ? values["ref"] : "<absent>"
        parent = counts["parent"] ? values["parent"] : "<absent>"
        edited = counts["last_edited_time"] ? values["last_edited_time"] : "<absent>"
        printf "transport_ref=%s transport_parent=%s transport_last_edited_time=%s\n", ref, parent, edited
      }
    ' "$file"
  })"; then
    printf 'validated %s: %s\n' "$file" "$metadata"
  else
    echo "invalid (malformed, duplicate, or missing transport identity metadata): $file" >&2
    status=1
  fi
done

exit "$status"
