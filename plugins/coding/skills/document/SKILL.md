---
name: document
description: Create or update source-backed package usage documentation and durable architecture documentation. Use after meaningful code changes, when docs are missing or stale, or when a package needs an architecture overview under docs/architecture; route specifications and Notion content to specification skills.
model: opus
argument-hint: "[--project=<path>] [--architecture|--no-architecture] [--readme-only] [--force-plan] [notes]"
---

# Document package

Set `CODING_DOCUMENT_SKILL_DIR` to the absolute directory containing this loaded
`SKILL.md` before invoking its scripts.

Produce accurate package documentation from code. This skill owns package
`readme.md` content and durable `docs/architecture/*.md` artifacts; it does not
author product specifications, Notion pages, or implementation changes.

## Boundaries

- Use for: creating or refreshing a package `readme.md`, adding source-backed durable
  architecture documentation, and realigning documentation after code changes.
- Do not use for: product specifications or Notion documentation (specification skills), implementation changes, or documenting a package other than the resolved selector.
- Never invent API behavior: every claim must trace to package metadata, exports, entry points, scripts, configuration, or relevant source/tests.
- Reject a missing project root, unreadable source, or a request to document a different package without changing the selector.

## Inputs

- **Required**: none — the project resolves from the working directory. Resolution order: explicit `--project`, nearest workspace/package manifest containing the target, then repository root. In a monorepo, document only the selected package unless the selector is the workspace root.
- **Optional**: `--architecture` is on by default; `--no-architecture` and `--readme-only` disable it. `--force-plan` asks for an outline even when a local template or sibling README is authoritative. Free-form notes may clarify audience or positioning but cannot override code evidence.
- **Prerequisites**: readable package metadata, exports, entry points, scripts, configuration, and relevant source/tests.

## State gate

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential. If unavailable, stop artifact
writes and report the missing contract. Use the resolver and ask only on
`work_id_required`. When delegated, start from the mission capsule's exact source,
specification, and design paths. Read `state/working.md` only when navigation is
missing, and `state.md` only for resume, cross-slice dependency, or alignment
work. Never write PM-owned work pointers or overview files.

## Workflow

Load [references/authoring-rules.md](references/authoring-rules.md) for the
concrete drafting rules (section order, TOC discipline, Support Matrix, folder
notation, banned behaviors), the ARCHITECTURE tree/diagram/split rules, the
independent-review audit checklist, and the retry/rollback criteria.

1. Resolve the package/workspace and its anchors. Precedence is local explicit
   template/checklist, existing `readme.md` and `docs/architecture/` structure,
   repository documentation rules, then closest same-archetype sibling. Use
   this skill's bundled templates and one matching example only when repository
   anchors do not decide the shape. A bundled template/example entrypoint may
   be a split manifest; when it is, load every linked child in manifest order
   before drafting.
2. When `--force-plan` is set, or neither a repository anchor nor a bundled template decides the document shape, propose a section outline with a one-line rationale per section and wait for user approval before drafting.
3. Build an evidence map before drafting: manifest metadata, public exports, entry points, scripts, environment/configuration, tested examples, error behavior, dependency direction, and important source modules. Classify the package archetype (library, CLI, service, data/IaC, stateless app, or monorepo) and map each intended claim to a file or executable command.
4. Keep artifact ownership separate. `readme.md` explains audience, installation,
   quick start, public usage/API, configuration, and links. A durable
   `docs/architecture/<architecture-slug>.md` explains boundaries, components,
   runtime/data flow, dependency direction, extension points, and operational
   constraints; do not duplicate usage tutorials. Compute links relative to
   the package `readme.md` rather than assuming the documents are siblings.
   New files use lowercase names. If only a legacy uppercase README exists, do
   not create a duplicate: report the compatibility migration and rename it
   with all links atomically only when repository evidence makes that safe.
5. Draft from the evidence map. Use real imports, commands, paths, inputs, outputs, and failure cases that were verified against code/tests. Never invent a convenience API. Preserve the existing voice and integrate updates into the owning sections.
6. Generate a table of contents only when the document benefits from one. Use `${CODING_DOCUMENT_SKILL_DIR}/scripts/toc_width.py` for width calculations; never use a checkout-specific absolute path.
7. Create or update `docs/architecture/<architecture-slug>.md` when explicitly
   requested or when the package has multiple public/runtime entry points,
   cross-process or persistent data flow, meaningful dependency layering, or
   at least three cooperating components whose relationship is not clear from
   `readme.md`. Name it per `naming.md` in the essential plugin's
   `references/` directory and repository capability, not a task title.
   At this write decision, read
   `${ESSENTIAL_ROOT}/templates/docs/docs-root-readme.template.md` and
   `${ESSENTIAL_ROOT}/templates/docs/architecture-readme.template.md`, using
   the root derived from the injected state contract.
   Reconcile `docs/architecture/README.md` and `docs/README.md`; individual
   architectural choices remain ADRs under `docs/architecture/decisions/`.
   Before creating or superseding one, apply the ADR contract at
   `${ESSENTIAL_ROOT}/references/adr.md` and the template at
   `${ESSENTIAL_ROOT}/templates/docs/adr.template.md`: effective ADRs are
   indexed directly under `decisions/`, superseded ADRs move under
   `decisions/superseded/`, and a new successor stands alone without naming the
   old ADR.
8. Run the verification below; when a check fails, fix the cause and re-run that check. Repeat until every check passes or a concrete blocker remains, then report the blocker instead of looping. Decide review outcomes per the criteria in references/authoring-rules.md (proceed, targeted retry with at most two attempts per issue, or rollback).

## Verification

- Every documented export, command, environment variable, path, link, and dependency exists in the evidence map and matches the source.
- Documentation/build/test examples were executed where safe, and each ran as documented.
- An independent read-only review (delegated) found no unsupported claims,
  wrong archetype, README/architecture overlap, unusable examples, stale text,
  or broken durable-index links.
- Any generated table of contents was produced with `toc_width.py`, not by hand.

## Completion

Report project path and archetype, anchors/templates/examples used, evidence-map
coverage, architecture create/skip decision, commands/examples verified,
independent-review verdict, stale claims removed, and unresolved gaps. Return
every created or materially rewritten final path as `generated_files`. Do not
measure or split `docs/**` or project README files: durable documentation has no
mechanical size limit, but it is still length-calibrated — see
`essential:references/output-manifest.md`. The PM size-checks only eligible work
Markdown inside the target `.state/` after all artifact writers finish.
