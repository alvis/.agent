#!/usr/bin/env bash

RECEIPT_TARGET_SHA=$(jq -er \
  '.target.sha | select(type == "string" and length > 0)' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
RECEIPT_TARGET_BASE=$(jq -er \
  '.target.base | select(type == "string" and length > 0)' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
RECEIPT_TARGET_KIND=$(jq -er \
  '.target.kind | select(type == "string" and length > 0)' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
RECEIPT_APPLICABILITY_MODE=$(jq -er \
  '.applicability_mode | select(type == "string" and length > 0)' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
RECEIPT_EXECUTION_ENGINE=$(jq -er \
  '.execution_engine | select(. == "jj-run")' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
RECEIPT_COMMAND_RESULTS_JSON=$(jq -ecS \
  '.workflow_command_results | select(type == "array")' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
EXPECTED_COMMAND_RESULTS_JSON=$(jq -ecS \
  'select(type == "array")' \
  <<<"$CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON") || exit 42
test "$RECEIPT_TARGET_SHA" = "$TARGET_SHA" || exit 42
test "$RECEIPT_TARGET_BASE" = "$TARGET_BASE" || exit 42
test "$RECEIPT_TARGET_KIND" = "$TARGET_KIND" || exit 42
test "$RECEIPT_APPLICABILITY_MODE" = conservative_pull_request || exit 42
test "$RECEIPT_EXECUTION_ENGINE" = jj-run || exit 42
test "$RECEIPT_COMMAND_RESULTS_JSON" = "$EXPECTED_COMMAND_RESULTS_JSON" || exit 42

RECEIPT_OVERALL=$(jq -er '.overall | select(type == "string")' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
CANONICAL_EXPECTED_SECRET_NAMES_JSON=$(jq -ec \
  'select(type == "array" and . == (sort | unique))' \
  <<<"$CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON") || exit 42
CANONICAL_RECEIPT_SECRET_NAMES_JSON=$(jq -ec \
  '.missing_secret_approval.names
   | select(type == "array" and . == (sort | unique))' \
  <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
test "$CANONICAL_RECEIPT_SECRET_NAMES_JSON" = \
  "$CANONICAL_EXPECTED_SECRET_NAMES_JSON" || exit 42
case "$RECEIPT_OVERALL" in
  pass)
    test "$CANONICAL_EXPECTED_SECRET_NAMES_JSON" = '[]' || exit 42
    jq -e 'all(.workflow_command_results[];
      (.status | type) == "number" and .status == 0)' \
      <<<"$CI_PARITY_RECEIPT_JSON" >/dev/null || exit 42
    jq -e '.missing_secret_approval == {
      "approved": false, "names": [], "sha": null
    }' <<<"$CI_PARITY_RECEIPT_JSON" >/dev/null || exit 42
    ;;
  approved_without_local_run)
    EXPECTED_SECRET_NAMES_JSON=$(jq -ec \
      'select(type == "array" and length > 0)
       | select(all(.[]; type == "string" and length > 0))
       | select(. == (sort | unique))' \
      <<<"$CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON") || exit 42
    RECEIPT_SECRET_NAMES_JSON=$(jq -ec \
      '.missing_secret_approval.names
       | select(type == "array" and length > 0)
       | select(all(.[]; type == "string" and length > 0))
       | select(. == (sort | unique))' \
      <<<"$CI_PARITY_RECEIPT_JSON") || exit 42
    test "$(jq -er '.missing_secret_approval.approved' \
      <<<"$CI_PARITY_RECEIPT_JSON")" = true || exit 42
    test "$(jq -er '.missing_secret_approval.sha' \
      <<<"$CI_PARITY_RECEIPT_JSON")" = "$TARGET_SHA" || exit 42
    test "$RECEIPT_SECRET_NAMES_JSON" = "$EXPECTED_SECRET_NAMES_JSON" || exit 42
    jq -e 'all(.workflow_command_results[];
      .status == "not_run_missing_secret")' \
      <<<"$CI_PARITY_RECEIPT_JSON" >/dev/null || exit 42
    ;;
  *)
    exit 42
    ;;
esac
printf 'CI_PARITY_RECEIPT_GATE=accepted\n'
