#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: list-repository-labels.sh <host> <owner/repository>" >&2
  exit 2
}

[ "$#" -eq 2 ] || usage
host=$1
repository=$2

[[ "$host" =~ ^[A-Za-z0-9.-]+$ ]] || usage
[[ "$repository" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] || usage

pages=$(gh api --hostname "$host" --paginate --slurp \
  "repos/$repository/labels?per_page=100")
jq -ce '[.[][] | {name, description}] | sort_by(.name, (.description // ""))' \
  <<<"$pages"
