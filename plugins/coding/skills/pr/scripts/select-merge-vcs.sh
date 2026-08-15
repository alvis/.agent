#!/usr/bin/env bash

if command -v jj >/dev/null 2>&1 && \
  GIT_HEAD=$(git rev-parse HEAD 2>/dev/null) && \
  JJ_HEAD=$(jj log -r @- --no-graph -T 'commit_id' 2>/dev/null) && \
  [ "$GIT_HEAD" = "$JJ_HEAD" ]; then
  VCS=jj
  jj status
  jj log -r "$DESTINATION@$REMOTE..@" --no-graph
  jj bookmark list
  jj workspace list
else
  VCS=git
  git status --short
  git branch --list
  git worktree list
fi
gh auth status
git fetch --prune -- "$REMOTE"
if [ "$VCS" = jj ]; then
  jj git fetch --remote "$REMOTE"
fi
