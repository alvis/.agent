#!/usr/bin/env bash

SELECTED_HEAD_COUNT=$(jq -er 'length | select(. > 0)' <<<"$SELECTED_STACK_JSON")
TARGET_SHA=$(jq -er '.[-1].head | select(type == "string" and length > 0)' \
  <<<"$SELECTED_STACK_JSON")
TARGET_BASE=$(jq -er '.[0].base | select(type == "string" and length > 0)' \
  <<<"$SELECTED_STACK_JSON")
case "$SELECTED_HEAD_COUNT" in
  1)
    TARGET_KIND=standalone
    ;;
  *)
    test "$SELECTED_HEAD_COUNT" -gt 1 || exit 2
    TARGET_KIND=stack-tip
    ;;
esac
printf 'TARGET_KIND=%s\nTARGET_SHA=%s\nTARGET_BASE=%s\n' \
  "$TARGET_KIND" "$TARGET_SHA" "$TARGET_BASE"
