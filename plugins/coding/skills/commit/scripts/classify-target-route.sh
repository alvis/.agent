#!/usr/bin/env bash

case "$REMOTE_TARGET_SHA" in
  "")
    case "$LOCAL_TARGET_SHA" in
      "")
        TARGET_ROUTE=new-target
        TARGET_BASE=$TARGET_CREATION_BASE
        ;;
      *)
        if test "$TARGET_CREATION_BASE" != "$LOCAL_TARGET_SHA"; then
          printf '%s\n' 'HEAD must equal local target before partial commit' >&2
          exit 1
        fi
        TARGET_ROUTE=local-only
        TARGET_BASE=$LOCAL_TARGET_SHA
        ;;
    esac
    ;;
  *)
    if test -n "$LOCAL_TARGET_SHA"; then
      if test "$LOCAL_TARGET_SHA" != "$REMOTE_TARGET_SHA"; then
        printf '%s\n' \
          'local and remote target bookmarks diverge; reconcile before partial commit' >&2
        exit 1
      fi
      if test "$TARGET_CREATION_BASE" != "$LOCAL_TARGET_SHA"; then
        printf '%s\n' \
          'HEAD must equal synchronized target before partial commit' >&2
        exit 1
      fi
      TARGET_ROUTE=synchronized
      TARGET_BASE=$LOCAL_TARGET_SHA
    else
      if test "$TARGET_CREATION_BASE" != "$REMOTE_TARGET_SHA"; then
        printf '%s\n' 'HEAD must equal fetched target before partial commit' >&2
        exit 1
      fi
      TARGET_ROUTE=remote-only
      TARGET_BASE=$REMOTE_TARGET_SHA
    fi
    ;;
esac
test -n "$TARGET_BASE"
printf 'TARGET_ROUTE=%s\nTARGET_BASE=%s\n' "$TARGET_ROUTE" "$TARGET_BASE"
