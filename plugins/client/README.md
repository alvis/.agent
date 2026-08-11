# Client

Client-facing screen-design contracts and UX documentation with Notion
integration. Depends on `essential`. Screen designs are treated like any
other specification: temporary exploration stays in the active work item,
approved content synchronizes through an explicitly selected external body
author and Notion transport, and durable design docs are promoted with
provenance. This plugin ships no body grammar, body-author capability, or
template/parent/collection defaults.

Depends on `essential` for work-state ownership and `specification` for the
validated Notion transport boundary.

## Skills

| Skill | Use when |
| --- | --- |
| `client:create-screen-design` | A new responsive screen-design contract from user-selected product and specification context. |
| `client:update-screen-design` | Updating explicitly selected existing screen-design contracts (requires a selector or `--all`), preserving identity and approved content. |
