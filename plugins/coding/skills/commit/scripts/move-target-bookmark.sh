#!/usr/bin/env bash

TARGET=$1
NEW_CHANGE_ID=$2
case "$TARGET_ROUTE" in
  remote-only)
    jj bookmark create "$TARGET" --revision "$REMOTE_TARGET_SHA"
    jj bookmark move "$TARGET" --to "$NEW_CHANGE_ID"
    ;;
  local-only|synchronized)
    jj bookmark move "$TARGET" --to "$NEW_CHANGE_ID"
    ;;
  new-target)
    jj bookmark set "$TARGET" --revision "$NEW_CHANGE_ID"
    ;;
  *)
    exit 3
    ;;
esac
