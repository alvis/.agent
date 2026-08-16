---
name: update-standard
description: Update explicitly selected plugin standards to the current meta.md, scan.md, write.md, and rules contract while preserving valid policy and stable rule IDs. Use when applying scoped rule changes, migrating standards to a template revision, or batch-updating the standards library. Require a path, glob, or --all; route missing targets to create-standard.
requirements:
  intelligence: high
context: fork
argument-hint: "<standard path, name, or glob> [--changes=...] [--all]"
---

# Update Standard

Set `GOVERNANCE_UPDATE_STANDARD_SKILL_DIR` to the absolute directory containing
this loaded `SKILL.md` before invoking its validator.

Update standard directories only under
`plugins/<plugin>/standards/<standard-name>/`, folding requested
changes into the existing three tiers. `create-standard` owns missing
standards.

## Boundaries

- Use for: scoped rule changes and bounded template migrations on explicitly
  selected standards.
- Do not use for: creating missing standards (`create-standard`), modifying
  the governance templates themselves, or renumbering rule IDs without
  explicit approval — rule IDs are public anchors and are preserved unless
  the request authorizes migration and all inbound references are updated.
- An empty or ambiguous selector is rejected; a library-wide migration
  requires explicit `--all`.

## Inputs

- **Required**: a standard path, name, or glob — or explicit `--all`.
- **Optional**: `--changes=...` describing the requested rule or structure
  changes.
- **Prerequisites**: [standard-meta.md](../../skills/create-standard/templates/standard-meta.md),
  [standard-scan.md](../../skills/create-standard/templates/standard-scan.md), and
  [standard-write.md](../../skills/create-standard/templates/standard-write.md).

## Workflow

1. Read the three tier templates, then each selected standard's complete
   `meta.md`, `scan.md`, `write.md`, `rules/`, dependent standards, and
   inbound local links. List exact targets and snapshot existing IDs,
   prefixes, dependencies, exceptions, detection criteria, compliant
   guidance, examples, and external references. Reject an empty/ambiguous
   selector, missing tier, malformed request, duplicate target, or unapproved
   rule-ID renumbering.
2. Map each requested change across all affected tiers before editing:
   rationale/dependency in meta, violation detection in scan, compliant
   behavior in write, detailed guide and links in rules.
3. Reconcile structure with the exact templates without replacing valid
   content with placeholders. Fold new policy into existing sections and
   remove superseded contradictions; do not append changelogs.
4. Keep meta concise and authoritative for dependencies, stricter
   requirements, exception policy, and groups. Keep scan violation-oriented
   and write compliance-oriented.
5. Update every affected `rules/<lowercase-rule-id>.md` and every
   inbound/outbound local link. Preserve unrelated rule examples and IDs.
6. For multiple independent targets, bounded delegation per
   [delegation guidance](../../standards/delegation/) is
   allowed — at most 3 standard directories per batch (each directory is 3
   tier files plus rules) and 8 parallel subagent dispatches per request — but
   review the combined ID/dependency/link graph before validation.
7. Run the verification below; when a check fails, fix the cause and re-run
   that check. Repeat until every check passes or a concrete blocker remains,
   then report the blocker instead of looping.

## Verification

- Cross-tier consistency per selected standard: compare the declared meta
  groups and IDs with scan bullets/matrix, write summaries, rule filenames,
  and repository references. Fail on missing/extra/duplicate IDs, prefix
  drift, contradictory scan/write wording, unresolved links, missing
  dependencies, invalid exception fields, orphan guides, or unapproved
  breaking renames.
- Run `claude plugin validate --strict plugins/<plugin>` and
  `python3 "${GOVERNANCE_UPDATE_STANDARD_SKILL_DIR}/../write-skill/scripts/quick_validate.py" plugins/<plugin>`
  for repository policy checks.
- Exercise representative violating and compliant examples for changed rule
  groups.
- For `--all`, record every target and its per-target result; one failed
  target makes the migration partial.

## Completion

Return the selector, targets, templates used, preserved/added/deprecated IDs,
cross-tier and link check results, validation and evaluation evidence, and
unresolved issues. A partial migration must list which targets failed and
why.
