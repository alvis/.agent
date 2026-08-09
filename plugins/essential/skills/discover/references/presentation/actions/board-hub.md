# Board hub direction

Use this direction when a session produces several boards and the user needs one
place to move between them. The hub is a lightweight index, not a content
surface of its own: it names each sibling board and links it by session-relative
href so a reader can traverse the workspace without losing the thread. Reach for
it once a discovery run spans more than one board — a specimen board plus a
ranked-options board, for example.

## Structural fidelity

1. Give the hub board root a stable `data-board-id` (`board-hub`) alongside the
   usual `data-discovery-page`, action, and goal attributes.
2. Provide one `data-board-hub` section holding a `.discovery-board-index`
   `[data-board-index]` list.
3. List every board in the session, including the hub itself, as a
   `.discovery-board-link` `[data-board-link="<board-id>"]` anchor with a
   session-relative href (`./specimen-board.html`, `./board-hub.html`). Mark the <!-- doc-path-gate: ignore -->
   current board with `aria-current="page"`.
4. Keep hrefs session-relative; they are valid only because every board lives in
   the same session workspace, and the whole workspace is discarded after
   transfer to the ledger.
5. Carry the full shared shell and one folded generated prompt so the hub itself
   stays annotatable and readable without JavaScript.

## Interaction instructions

- Annotate the index section and the generated-prompt section.
- Links are ordinary `<a>` elements and stay keyboard reachable; the runtime
  includes the board id in the generated prompt's review context.
- Do not manufacture a decision for the hub; it navigates, and any decisions
  belong to the boards it links.
- Regenerate the one prompt when any annotation changes.

Keep the hub minimal. Its job is orientation, not analysis — add a board link
whenever the session grows a new board, and nothing more.
