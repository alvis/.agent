#!/usr/bin/env bash

PR_URL=$1
PR_METADATA=$(bash "${CODING_PR_SKILL_DIR}/scripts/resolve-pr.sh" "$PR_URL") || exit $?
HOST=$(jq -er .host <<<"$PR_METADATA") || exit $?
OWNER=$(jq -er .owner <<<"$PR_METADATA") || exit $?
REPO=$(jq -er .repo <<<"$PR_METADATA") || exit $?
PR_NUMBER=$(jq -er .number <<<"$PR_METADATA") || exit $?
gh api --hostname "$HOST" "repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments" --paginate
gh api --hostname "$HOST" "repos/$OWNER/$REPO/issues/$PR_NUMBER/comments" --paginate
gh api graphql --hostname "$HOST" \
  -F owner="$OWNER" -F name="$REPO" -F number="$PR_NUMBER" \
  -f query='
query($owner:String!,$name:String!,$number:Int!,$threadCursor:String){
  repository(owner:$owner,name:$name){
    pullRequest(number:$number){
      reviewThreads(first:100,after:$threadCursor){
        pageInfo{hasNextPage endCursor}
        nodes{id isResolved comments(first:100){
          pageInfo{hasNextPage endCursor}
          nodes{databaseId body url path line commit{oid} author{login}}
        }}
      }
    }
  }
}'
