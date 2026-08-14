#!/bin/bash

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSET_DIR="$SKILL_DIR/assets"
OUTPUT_DIR="${HOME:?}/.claude/output-styles"

shopt -s nullglob
assets=("$ASSET_DIR"/*.md)
if (( ${#assets[@]} == 0 )); then
    echo "error: no bundled output styles found in $ASSET_DIR" >&2
    exit 1
fi

if [[ -L "$OUTPUT_DIR" ]]; then
    echo "error: output directory is a symlink: $OUTPUT_DIR" >&2
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

if [[ -L "$OUTPUT_DIR" ]]; then
    echo "error: output directory became a symlink: $OUTPUT_DIR" >&2
    exit 1
fi

for source in "${assets[@]}"; do
    filename="${source##*/}"
    destination="$OUTPUT_DIR/$filename"

    if [[ -L "$destination" ]]; then
        echo "error: destination is a symlink: $destination" >&2
        exit 1
    fi

    if [[ -e "$destination" && ! -f "$destination" ]]; then
        echo "error: destination is not a regular file: $destination" >&2
        exit 1
    fi

    if [[ -f "$destination" ]] && cmp -s "$source" "$destination"; then
        echo "unchanged: $destination"
        continue
    fi

    if [[ -e "$destination" ]]; then
        backup_base="$destination.bak.$(date +%Y%m%d%H%M%S)"
        backup="$backup_base"
        backup_suffix=0
        while [[ -e "$backup" || -L "$backup" ]]; do
            backup_suffix=$((backup_suffix + 1))
            backup="$backup_base.$backup_suffix"
        done
        cp "$destination" "$backup"
        echo "backup: $backup"
    fi

    temporary="$(mktemp "$OUTPUT_DIR/.${filename}.tmp.XXXXXX")"
    trap 'rm -f "$temporary"' EXIT
    cp "$source" "$temporary"
    mv -f "$temporary" "$destination"
    trap - EXIT
    echo "installed: $destination"
done
