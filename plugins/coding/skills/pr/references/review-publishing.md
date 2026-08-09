# Publishing the review to GitHub

Load this from the *Publish the review* step of `coding:pr review`.

Submit body, verdict, and every inline comment in one `POST`. The create-pending /
add-comments / submit sequence leaves a half-populated pending review on the PR when
any step fails, and a pending review is invisible to the author but blocks the next
run.

```bash
gh api --hostname "$HOST" --method POST \
  "repos/$OWNER/$REPO/pulls/$PR_NUMBER/reviews" --input "$REVIEW_PAYLOAD"
```

## Payload

```json
{
  "commit_id": "<the pinned HEAD_OID>",
  "body": "<overall review, from ../templates/overall-review.md>",
  "event": "REQUEST_CHANGES | APPROVE | COMMENT",
  "comments": [
    { "path": "src/auth/session.ts", "line": 42, "side": "RIGHT", "body": "**{{marker}} Guard the empty case** — …" },
    { "path": "src/auth/session.ts", "start_line": 51, "line": 58, "side": "RIGHT", "body": "**{{marker}} Batch these lookups** — …" }
  ]
}
```

- `{{marker}}` is the badge, tag, or emoji that opens every comment. [review-tone.md](review-tone.md) owns
  that markup and is the only place it is written out; render from there rather than
  copying a literal badge URL into this file, which would drift the moment a colour
  or a wrapper changes.
- `commit_id` is mandatory here even though the API treats it as optional. Without
  it GitHub anchors against the current head, so a push mid-review silently
  relocates every comment.
- Immediately before assembling this payload, re-read `headRefOid`, `baseRefName`,
  and `baseRefOid` for the PR. A stacked review re-reads and compares those three
  values for every `PR_SURFACES` entry. If any value differs from its pinned
  capsule, stop before writing or submitting the payload and return a concurrency
  blocker; never publish against a moved head or base.
- For a black-zone `APPROVE`, the review workflow must also run
  `scripts/verify-black-zone-authorization.sh` immediately before payload
  assembly against those same live head/base OIDs. Parse its compact JSON
  receipt and require `comment_url`, `comment_id`, `comment_node_id`,
  `author_login`, `head_oid`, `base_oid`, `authorization_body`, and the three
  `rationale` strings. Use `authorization_body` and `rationale` as the sole semantic authorization-review input;
  never substitute an earlier fetched
  comment or body. Missing authorization or an invalid receipt caps the event
  at `COMMENT`; it does not prevent `REQUEST_CHANGES`.
- `line` is the line number in the file at `commit_id`, not a diff offset.
- `start_line` must be below `line` on the same `side`.

Assemble the file with `jq` and shell redirection into the review tree. Comment
bodies carry newlines, backticks, and code fences, so string-concatenated JSON breaks
on the first one — and a file-writing tool is denied by this agent's `Write`/`Edit`
fence.

## Failure recovery

| Response | Cause | Action |
|---|---|---|
| 422 naming a comment path or line | The line is not in the diff | Drop that comment, null its anchoring fields, set `subject` to its path, and re-render it from the finding into the overall body. Resubmit once. |
| 422 on `APPROVE`/`REQUEST_CHANGES` | Self-review | Resubmit with `COMMENT`; state the downgrade in the body. |

Recovery moves the *finding*, never the rendered comment. The inline body already
opens with its marker, and the body's bullet prepends one of its own, so relocating
the posted text verbatim would ship two markers on one finding and break the
exactly-one rule in [review-tone.md](review-tone.md).

Never answer a 422 by re-anchoring the comment to a nearby line that happens to be
in the diff. A comment on the wrong line costs more author time than no comment.

## Re-review hygiene

- Skip a finding whose path, line, and substance already appear in
  `gh api --hostname "$HOST" repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments`.
  The author has seen it.
- Re-evaluate every existing unresolved P0/P1/P2 thread against the pinned head
  and return `still_applies`, `fixed`, or `does_not_apply` in completion. Do not
  repost it.
- A previously reported finding that is now fixed gets one line in the overall body,
  not a new inline comment. Acknowledging the fix is what makes the next round land.
- Never resolve or reply to another reviewer's threads. This skill adds its own
  review; it does not moderate the conversation.
