#!/usr/bin/env bash

REPOSITORY=$(gh repo view --json nameWithOwner --jq '.nameWithOwner') || exit $?
STACKS_JSON=$(gh api --paginate --slurp \
  -H 'Accept: application/vnd.github+json' \
  "repos/$REPOSITORY/stacks?per_page=100") || exit $?
jq '[.[][] | {
  number,
  url,
  base: .base.ref,
  open,
  pullRequests: [.pull_requests[] | {
    number,
    state,
    draft,
    mergedAt: .merged_at,
    head: .head.ref,
    headSha: .head.sha
  }]
}] | sort_by(.number) | reverse' <<<"$STACKS_JSON" || exit $?
