#!/usr/bin/env bash

case "$MISSING_SECRET_NAMES" in
  "")
    CI_PARITY_SECRET_GATE=run_local
    CI_PARITY_OVERALL=pending_local_run
    ;;
  *)
    if test "${MISSING_SECRET_APPROVED-false}" = true \
      && test "${MISSING_SECRET_APPROVAL_SHA-}" = "$TARGET_SHA" \
      && test "${MISSING_SECRET_APPROVAL_NAMES-}" = "$MISSING_SECRET_NAMES"
    then
      CI_PARITY_SECRET_GATE=approved_without_local_run
      CI_PARITY_OVERALL=approved_without_local_run
    else
      printf 'CI_PARITY_SECRET_GATE=stop_before_push\n'
      printf 'CI_PARITY_OVERALL=blocked\n'
      exit 42
    fi
    ;;
esac
printf 'CI_PARITY_SECRET_GATE=%s\n' "$CI_PARITY_SECRET_GATE"
printf 'CI_PARITY_OVERALL=%s\n' "$CI_PARITY_OVERALL"
