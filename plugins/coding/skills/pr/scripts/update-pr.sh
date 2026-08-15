#!/usr/bin/env bash

gh pr edit "$PR" --title "$TITLE" --body-file - --base "$PR_BASE" <<<"$BODY"
gh pr ready "$PR" --undo
