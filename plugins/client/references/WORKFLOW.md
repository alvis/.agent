# Client workflow

Read this before creating or updating a client-facing screen-design contract.

## Actions

| Action | Instruction |
| --- | --- |
| Create a new responsive screen-design contract | `client:create-screen-design` |
| Update explicitly selected existing screen-design contracts | `client:update-screen-design` |
| Create or semantically change a Notion body | Require an explicit external `--body-author=<plugin:skill>` and pass it unchanged through `specification:sync-notion`; this plugin supplies no author or template/parent/collection defaults |
| Create or materially rewrite project artifacts | Follow the injected `essential:references/state.md` contract |

Use only user-selected product, source-contract, and transport context. Existing screen identity, approved content, responsive behavior, accessibility decisions, and provenance remain authoritative during updates.

## Standards

Client owns no standards. Follow the selected skill, the declared
`specification:sync-notion` transport boundary, and
`essential:references/state.md`; do not import standards from another plugin.
