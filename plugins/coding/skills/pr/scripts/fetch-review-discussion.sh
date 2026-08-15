#!/usr/bin/env bash

gh api --hostname "$HOST" "repos/$OWNER/$REPO/issues/$PR_NUMBER/comments" --paginate
gh api --hostname "$HOST" "repos/$OWNER/$REPO/pulls/$PR_NUMBER/reviews" --paginate
gh api --hostname "$HOST" "repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments" --paginate
gh api graphql --hostname "$HOST" \
  -F owner="$OWNER" -F name="$REPO" -F number="$PR_NUMBER" -f query='
query($owner:String!,$name:String!,$number:Int!,$cursor:String){
  repository(owner:$owner,name:$name){
    pullRequest(number:$number){
      reviewThreads(first:100,after:$cursor){
        pageInfo{hasNextPage endCursor}
        nodes{id isResolved comments(first:100){
          pageInfo{hasNextPage endCursor}
          nodes{databaseId body url path line commit{oid} author{login}}
        }}
      }
    }
  }
}'
