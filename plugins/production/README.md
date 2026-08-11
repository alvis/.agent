# Production

Media and creative production lifecycle: giving footage, renders, and
campaign deliverables the same truth discipline code enjoys. Depends on
`essential`. A production work stream is an ordinary work stream
that declares a `media-project` or `asset-store` anchor
(`essential/references/anchors.md`); this plugin adds the two things media
work needs beyond that: **asset identity** and **revision-bound review**.

Why: `Interview-final-final-2.mov` is not a provenance system. A filesystem
path is not identity, and "approved" without a revision is not an approval.
Media bytes stay outside Git; their identity and lineage do not.

## Skills

| Skill | Use when |
| --- | --- |
| `production:track-assets` | Registering assets (footage, audio, fonts, LUTs, templates) with content hashes, rights, and consent refs; recording each render with its exact inputs, settings, and output hash; marking entries stale when a decision invalidates them. Manifest shape: `production/templates/asset-manifest.template.md`. |
| `production:review-render` | Capturing stakeholder feedback and approvals bound to an exact render revision and timecode range; deciding which approvals survive a new revision (none carry forward automatically; a decision's `preserves` list may keep named aspects current). |

Both skills maintain versioned text manifests and review records — they never
edit media. Reproducing any render is a technical operation: its manifest
entry names the timeline revision, asset-manifest hash, render settings, and
output hash it was built from.

Production owns the semantic asset-manifest template. Essential owns the
shared `docs/production/README.md` and item `README.md` entrypoint shapes.
