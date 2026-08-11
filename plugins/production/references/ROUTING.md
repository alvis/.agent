# Production routing

Route by the requested action, not the subject noun.

| Request | Skill |
| --- | --- |
| Register footage, audio, fonts, LUTs, or templates; record a render; declare provenance, rights, or delivery of a media artifact | `production:track-assets` |
| Review a cut or render; capture stakeholder feedback; record or check an approval; decide whether an approval still applies after a change | `production:review-render` |

Neither skill edits media bytes; both maintain versioned text manifests and
review records. Work-stream lifecycle (state, decisions, journal,
handover) stays with Essential — a production work stream declares a
`media-project` or `asset-store` anchor per `anchors.md` in the essential
plugin's `references/` directory and follows the same state
contract as any other stream.
