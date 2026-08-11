<!--
Canonical inline-review template for `coding:pr review`.

Render one finding into one comment. The finding schema and priority/kind
selection live in `references/review-checklist.md`; voice and marker meaning
live in `references/review-tone.md`. This file alone owns the posted markup.

Placeholders:

  Name     Required  Source / Description
  -------  --------  ---------------------------------------------------------
  marker   yes       One rendered priority badge, process tag, or kind emoji.
  title    yes       One-line imperative for an ask; plain statement otherwise.
  body     yes       Specific evidence, consequence, and actionable correction.

Substitution rules:
- Substitute literal `{{name}}` tokens without nesting or expressions.
- `marker` contains no surrounding bold markup and no trailing colon.
- Emit exactly one marker. Never add `issue:`, `suggestion:`, `todo:`, or `nit:`.
- Keep the title and marker inside one bold span, followed by an em dash.
- Strip this guidance block and end the rendered comment with one newline.
- Output is byte-stable for the same placeholder map, with no trailing spaces.

Render a priority marker as:
`<sub><sub>![P<level> Badge](https://img.shields.io/badge/P<level>-<color>?style=flat)</sub></sub>`

Colors: P0 `red`, P1 `orange`, P2 `yellow`, P3 `blue`, P4 `lightgrey`.

Render a process chore as:
`<sub><sub>![WARNING Badge](https://img.shields.io/badge/WARNING-yellow?style=flat)</sub></sub>`

Render a non-priority kind as its one emoji: question `❓`, thought `💭`, note
`📝`, or praise `💯`.
-->

**{{marker}} {{title}}** — {{body}}
