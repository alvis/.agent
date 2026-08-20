---
name: create-standard
description: Create a new technical standard at a plugin's canonical standards root using meta.md, scan.md, write.md, and per-rule guides. Use when establishing new coding standards, documenting technical requirements, or creating compliance guidelines for reusable policy with explicit dependencies, detection, compliant patterns, and stable rule IDs. Route existing-standard revisions to update-standard.
requirements:
  intelligence: high
argument-hint: "<plugin>/<standard-name> [--detail=...]"
---

# Create Standard

Set `GOVERNANCE_CREATE_STANDARD_SKILL_DIR` to the absolute directory containing
this loaded `SKILL.md` before invoking its validator.

Create exactly one new directory at
`plugins/<plugin>/standards/<standard-name>/` holding the
three-tier standard (meta.md, scan.md, write.md, rules/). `update-standard`
owns revisions to existing standards.

## Boundaries

- Use for: establishing a missing reusable policy as a new three-tier
  standard with a unique rule-ID prefix.
- Do not use for: revising an existing standard (`update-standard`), creating
  skills (`write-skill`), writing to a repository-level shorthand root,
  overwriting an existing directory, or policy that belongs to an existing
  owner.

## Inputs

- **Required**: the target plugin and a lowercase kebab-case standard name,
  plus enough policy intent to define scope and rules.
- **Optional**: `--detail=...` with domain specifics that shape examples and
  rule guidance.
- **Prerequisites**: the installed governance templates
  [standard-meta.md](../../skills/create-standard/templates/standard-meta.md),
  [standard-scan.md](../../skills/create-standard/templates/standard-scan.md), and
  [standard-write.md](../../skills/create-standard/templates/standard-write.md).

## Workflow

1. Read all three tier templates, the target plugin's workflow references,
   and neighboring standards. Search every standard under
   `plugins/*/standards/` for the proposed prefix and rule IDs.
   Reject a duplicate target, duplicate prefix/ID, unknown plugin, missing
   templates, or policy that belongs to an existing owner.
2. Define scope, non-goals, dependent standards, stricter requirements,
   exception policy, rule groups, and stable IDs before drafting examples.
   The rule prefix is a unique short uppercase mnemonic.
3. Create the target directory and `rules/`. Populate `meta.md` from the meta
   template: dependencies use `standard:<name>` within the plugin or
   `plugin:<plugin>:standard:<name>` across plugins; every declared group
   matches the chosen prefix.
4. Populate `scan.md` from the scan template. Every quick-scan item and
   matrix row names one declared rule ID and describes a mechanically or
   reviewably detectable violation.
5. Populate `write.md` from the write template. Every rule ID has actionable
   compliant guidance; patterns and decisions do not contradict scan
   criteria.
6. Create `rules/<lowercase-rule-id>.md` for every rule that requires detail.
   Link it from the tiers using relative links and ensure no guide introduces
   an undeclared ID.
7. Remove all template placeholders and instructions. Keep examples only when
   they disambiguate detection or compliance.
8. Run the verification below; when a check fails, fix the cause and re-run
   that check. Repeat until every check passes or a concrete blocker remains,
   then report the blocker instead of looping.

## Verification

- Cross-tier consistency: build sets of IDs from meta groups, scan
  bullets/matrix, write summaries, and rule filenames. Fail when an ID is
  undeclared, missing from scan or write, duplicated, uses another prefix, or
  links to a missing guide.
- Resolve every local Markdown link from its containing file. Verify
  dependent-standard targets exist and no dependency cycle is introduced.
- Run `claude plugin validate --strict plugins/<plugin>` and
  `bun run "${GOVERNANCE_CREATE_STANDARD_SKILL_DIR}/../write-skill/scripts/quick_validate.ts" plugins/<plugin>`
  for repository policy checks.
- Exercise at least one violating and one compliant example per rule group
  against the scan/write guidance.

## Completion

Return the target path, source templates, prefix, complete rule-ID list,
dependency and link check results, validation commands with their results,
and any unresolved policy questions.
