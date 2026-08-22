#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: resolve-pr.sh <pr-number-or-url> [--repo <owner/name>]" >&2
  exit 2
}

[ "$#" -eq 1 ] || [ "$#" -eq 3 ] || usage
pr_input=$1
repo_args=()
if [ "$#" -eq 3 ]; then
  [ "$2" = "--repo" ] || usage
  repo_args=(--repo "$3")
fi

# macOS ships bash 3.2, where "${repo_args[@]}" is an unbound-variable error
# under set -u when the array is empty; this expansion stays safe on both.
metadata=$(gh pr view "$pr_input" ${repo_args[@]+"${repo_args[@]}"} \
  --json number,url,title,body,state,isDraft,baseRefName,baseRefOid,\
headRefName,headRefOid,headRepositoryOwner,changedFiles,additions,deletions,\
author,statusCheckRollup)
url=$(jq -r .url <<<"$metadata")
if [[ "$url" =~ ^https://([^/]+)/([^/]+)/([^/]+)/pull/([0-9]+)$ ]]; then
  host=${BASH_REMATCH[1]}
  owner=${BASH_REMATCH[2]}
  repo=${BASH_REMATCH[3]}
  url_number=${BASH_REMATCH[4]}
else
  echo "unrecognized canonical PR URL: $url" >&2
  exit 2
fi
[ "$(jq -r .number <<<"$metadata")" = "$url_number" ] || {
  echo "canonical PR number disagrees with metadata" >&2
  exit 2
}

jq --arg host "$host" --arg owner "$owner" --arg repo "$repo" \
  '. + {host:$host, owner:$owner, repo:$repo}' <<<"$metadata"
