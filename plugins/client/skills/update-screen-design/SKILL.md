---
name: update-screen-design
description: Update explicitly selected responsive screen-design contracts from user-selected product and specification context, preserving identity and approved content while recording temporary work design and promoting durable versioned design. Require a selector or --all; route missing pages to create-screen-design.
requirements:
  intelligence: high
argument-hint: "[--work-id=<id>] [--product=<name>] [--screens=<selector>] [--changes=<request>] [--context=<path-or-ref>] [--context-direction=<direction>] [--transport-root=<dir>] [--transport-profile=<absolute-file>] [--body-author=<plugin:skill>] [--template-ref=<ref>] [--parent-ref=<ref>] [--collection-ref=<ref>] [--all]"
---

# Update Screen Design

Update selected existing screen contracts while separating Notion transport,
temporary work reasoning, and durable design documentation.

## Boundaries and inputs

- Require an explicit bounded selector/product or `--all`; omission never means
  all. Missing pages route to create. For a direct run, run Essential's
  workspace resolver with `--work-id` only for an explicit user override and
  accept its deterministic environment, Git-branch/jj-workspace, or
  sole-existing-work match. Ask only on `work_id_required`, using the returned
  candidates; a delegated run receives the explicit id/root.
- Preserve approved content, alternatives, relations, attachments, links,
  responsive/accessibility decisions, and stable Notion identity.
- Temporary detail belongs under the active work's `design/` with PM-owned
  `design.md`; durable detail belongs under `docs/design/`. Never create a root
  design artifact or edit the canonical template.
- Notion transport bodies are opaque here. This plugin ships no body grammar,
  body author, or template/parent/collection defaults. Require those refs
  explicitly when the selected update uses them. Before any semantic body
  change, require a canonical external `--body-author=<plugin:skill>` and pass
  the identical selector through every nested `specification:sync-notion`
  operation. Remote operations also require an absolute transport profile.

## Workflow

1. Before creating or materially rewriting a project artifact, read the
   absolute `state.md` path injected by Essential. If unavailable,
   stop artifact writes and report the missing contract. Use the workspace
   resolver result as the active work root. Read only the work pointers and
   spec/design sources required for the selected screens.
2. Materialize required product/spec context from the source, location, and
   direction supplied by the user or active work state. Use local or inline
   context directly. For a remote source, invoke
   `specification:sync-notion` in `notion-to-local` mode with the explicit
   transport profile. Never assume a body author,
   template/parent/collection ref, default mirror, or fixed transport
   directory. Pull the caller-selected template and screen tree into the
   explicitly selected transport root, preserve returned paths, and identify
   pages by stable ref, never filename.
3. Resolve and record the exact selection before mutation. Map each ref to
   product relation, requested change, source revision/hash, and existing
   durable design path. Block missing/duplicate identity or incomplete pulls.
4. Build a section-preservation map and a lowercase work-local design child for
   each meaningful revision. Integrate only requested/template changes while
   retaining substantive content; present material alternatives/decisions for
   approval. Return index/status rows to the PM rather than editing
   `design.md`/`state.md`.
5. Resolve and validate the caller's `body_author` once, record
   `selection_source: explicit_argument|delegated_caller`, and apply approved
   Notion body edits only through that exact capability with the approved body
   and exact path. Pass the identical selector and transport profile to
   `specification:sync-notion` for diff, push/conflict handling, and a
   verification pull into an explicit location. Apply any template, parent, or
   collection ref only from the caller's explicit inputs. Stop the batch on a
   missing/changed selector, auth, conflict, identity, or uncertain remote
   state; never retry blindly.
6. Regenerate the approved durable `docs/design/<slug>.md` derivation with
   stable Notion ids, source revision/hash, decision/supersession links, and
   current behavior. Promote only system-wide rules to `docs/design/system.md`
   and link rather than duplicate them. Read
   `${ESSENTIAL_ROOT}/templates/docs/docs-root-readme.template.md` and
   `${ESSENTIAL_ROOT}/templates/docs/design-readme.template.md`, using the root
   derived from the injected state contract, then maintain
   `docs/README.md` and `docs/design/README.md` links.
7. Reverify requested change, preservation map, relations, responsive states,
   accessibility, remote identity, and durable derivation. Confirm no
   unselected page changed.
8. Return explicit final paths generated or materially rewritten as
`generated_files`, plus PM reconciliation. Do not run file sizing; the PM
checks only eligible work Markdown inside the target `.state/`.

## Verification

- Every selected changed page retains one stable ref and verified canonical
  relations; unchanged/unselected pages were not pushed.
- Requested/template changes landed without losing mapped approved content.
- Temporary and durable designs use correct lowercase paths/provenance;
  system-wide rules are single-owned.
- No transport body was hand-written, PM-owned files were not edited, the
  body-author selector stayed unchanged, and the manifest is complete.

## Completion

Return status, selector, caller-supplied template/parent/collection refs,
body-author capability and selection source, source manifest,
changed/compliant/failed pages, preservation/remote verification,
durable/system promotion, PM reconciliation, recovery actions, and
`generated_files`.
