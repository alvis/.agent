#!/usr/bin/env bash

TARGET=$1
case "$TARGET_ROUTE" in
  remote-only|synchronized)
    jj git push --bookmark "$TARGET"
    ;;
  local-only|new-target)
    jj git push --bookmark "$TARGET" --allow-new
    ;;
  *)
    exit 3
    ;;
esac
