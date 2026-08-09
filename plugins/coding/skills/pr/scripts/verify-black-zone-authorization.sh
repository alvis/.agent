#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: verify-black-zone-authorization.sh <host> <owner/repo> <pr-number> <head-oid> <base-oid>" >&2
  exit 2
}

authorization_required() {
  echo "authorization_required" >&2
  exit 1
}

[ "$#" -eq 5 ] || usage
host=$1
repository=$2
pr_number=$3
expected_head_oid=$4
expected_base_oid=$5

[[ "$host" =~ ^[A-Za-z0-9.-]+$ ]] || usage
[[ "$repository" =~ ^[^/[:space:]]+/[^/[:space:]]+$ ]] || usage
[[ "$pr_number" =~ ^[1-9][0-9]*$ ]] || usage
[[ "$expected_head_oid" =~ ^[0-9a-f]{40}$ ]] || usage
[[ "$expected_base_oid" =~ ^[0-9a-f]{40}$ ]] || usage

pull=$(gh api --hostname "$host" "repos/$repository/pulls/$pr_number") ||
  authorization_required
live_head_oid=$(jq -er '.head.sha' <<<"$pull") || authorization_required
live_base_oid=$(jq -er '.base.sha' <<<"$pull") || authorization_required
[ "$live_head_oid" = "$expected_head_oid" ] || authorization_required
[ "$live_base_oid" = "$expected_base_oid" ] || authorization_required

comments=$(gh api --hostname "$host" --paginate --slurp \
  "repos/$repository/issues/$pr_number/comments?per_page=100") ||
  authorization_required

authorization_receipt=$(jq -cer \
  --arg head_oid "$expected_head_oid" \
  --arg base_oid "$expected_base_oid" '
    [
      .[] | .[]
      | select(.author_association == "OWNER")
      | select(.user.type == "User")
      | ((.body // "") | gsub("\r\n"; "\n") | sub("\n$"; "")
          | split("\n")) as $lines
      | select(($lines | length) == 5)
      | select($lines[0] == "Black-zone authorization")
      | select($lines[1] == ("Head OID: `" + $head_oid + "`"))
      | select($lines[2] == ("Base OID: `" + $base_oid + "`"))
      | select($lines[3]
          == "Authorization: I authorize this one-off black-zone publication.")
      | ($lines[4] | capture(
          "^Indivisibility: (?<subject>.+) because (?<coupling>.+); otherwise (?<consequence>.+)$"
        )) as $rationale
      | select(all(
          $rationale.subject, $rationale.coupling, $rationale.consequence;
          test("[[:alnum:]]")
        ))
      | select(($lines[4] | ascii_downcase | test(
          "too large|many files|review takes longer|because (they|these) are related|would be inconvenient"
        ) | not))
      | select(.html_url | type == "string" and length > 0)
      | select(.id | type == "number")
      | select(.node_id | type == "string" and length > 0)
      | select(.user.login | type == "string" and length > 0)
      | {
          comment_url: .html_url,
          comment_id: .id,
          comment_node_id: .node_id,
          author_login: .user.login,
          head_oid: $head_oid,
          base_oid: $base_oid,
          authorization_body: .body,
          rationale: $rationale
        }
    ]
    | first // empty
  ' <<<"$comments") || authorization_required

[ -n "$authorization_receipt" ] || authorization_required
printf '%s\n' "$authorization_receipt"
