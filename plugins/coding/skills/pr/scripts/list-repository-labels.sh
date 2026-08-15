#!/usr/bin/env bash
set -euo pipefail

host=$1
repository=$2

pages=$(gh api --hostname "$host" --paginate --slurp \
  "repos/$repository/labels?per_page=100")
jq -ce '[.[][] | {name, description}] | sort_by(.name, (.description // ""))' \
  <<<"$pages"
