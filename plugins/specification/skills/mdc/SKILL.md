---
name: mdc
description: Read, edit, and author Notion-backed MDC files safely with native text tools while preserving @theriety/mdc grammar and ref identity. Use for any authored .mdc body change. Keep transport, pairing, and conflict orchestration in sync-notion and sync-spec.
model: sonnet
argument-hint: "[<path-to-.mdc>] [--mode=read|edit|author]"
---

# MDC

Before any script call, set `SPECIFICATION_MDC_SKILL_DIR` to the absolute
directory containing this loaded `SKILL.md`. This works in both harnesses;
ordinary Codex shell calls do not receive a plugin-root environment variable.

Safely read or author Notion-backed MDC (`@theriety/mdc`) while preserving its
block tree, annotations, refs, closing markers, and YAML frontmatter.

## Boundaries

- This is the only skill that authors `.mdc` body content. `notion-sync` may
  materialize transport files or update pairing metadata through
  `specification:sync-notion`, but callers must not hand-edit MDC.
- `.mdc` is reserved for Notion-backed files. In engineering work, author only
  an exact path explicitly supplied by the caller, returned by transport, or
  recorded in the active work pairing. A project may conventionally keep a
  mirror beneath `.state/`, but this skill does not require or derive it.
- `last_edited_time` is remote revision metadata owned by Notion transport.
  Local read, edit, and author flows never add, stamp, or rewrite it. Record a
  local edit time in work evidence or a receipt, not in MDC frontmatter.
- Do not derive or rename notion-sync paths, sync to Notion, or promote durable
  `docs/specs/` content here.
- Refuse a non-`.mdc` target, ambiguous edit location, or operation requiring
  the parser runtime rather than safe text editing.

## Inputs

- **Required**: target `.mdc` path, or destination plus content for authoring.
- **Optional**: `--mode=read|edit|author`; otherwise infer from existence and
  request verb.

## Mandatory invariants

<IMPORTANT>
1. Indent exactly two spaces per nesting level; never introduce tabs.
2. A block annotation is immediately adjacent to its target block.
3. Frontmatter, when present, starts at byte zero, uses exact `---` delimiter
   lines, and is valid YAML.
4. Annotation bodies are YAML object syntax and close on the same line.
5. Inline annotations immediately follow `]` or `)`.
6. Every closing marker is `--{ ref: <name> }--`, matches the opening ref, and
   has the opening block's indentation.
7. Preserve required escapes outside parser-opaque fenced code.
</IMPORTANT>

Full grammar: [references/syntax.md](references/syntax.md). Marker rationale:
[references/closing-markers.md](references/closing-markers.md).

## Workflow

1. Before creating or materially rewriting a project artifact, read the
   absolute `engineering-work.md` path injected by Essential. If unavailable,
   stop artifact writes and report the missing contract. This gate applies to
   `edit` and `author`; read mode remains non-mutating. Run the absolute
   `scripts/resolve-state-workspace` path declared by that reference, passing
   `--work-id` only for an explicit override. Use paths only from `resolved`;
   ask on `work_id_required` and stop/report on `requires_ignore`. If the
   resolver is missing, non-executable, or refuses the workspace, stop before
   mutation. Validate that an engineering MDC target is the exact caller-supplied,
   transport-returned, or active-work-paired path and lies within its declared
   output root. Before authoring at a selected transport-mirror path, independently
   require that actual root to be effectively ignored and untracked; otherwise
   stop with `requires_ignore` and return its owning workspace's exact
   `ignore_file` before writing. Read only the active-work pointers required to
   validate that target.
2. Load mode references before touching content: `read` → syntax; `edit` →
   syntax, closing markers, and
   [references/editing-rules.md](references/editing-rules.md); `author` →
   syntax, closing markers, and [references/examples.md](references/examples.md).
3. Locate non-trivial edits by `ref:`, unique text, or exact line range, then
   read enough surrounding structure to determine parentage and indentation.
   Before mutation, capture the exact values and multiplicity of transport-
   owned frontmatter, including `ref`, `parent`, and `last_edited_time`, so the
   post-edit check can prove they did not drift. For a locally authored,
   unsynced page, omit `last_edited_time`; only transport may populate it.
4. Apply the smallest coherent operation. Safe edits include annotation scalar
   changes, same-type text replacement, and correctly indented child append.
   Confirm before moving/deleting a subtree, changing inferred type, or
   renaming a referenced `ref:`. Preserve notion-sync frontmatter and path.
5. Re-read every modified region and apply the invariant checklist. Preserve
   existing markers; add the stringifier-default marker to a ref-bearing block
   when it gains children; remove an orphan only when its last child is removed.
6. After all changed MDC files pass review, validate their transport metadata
   together once with the read-only validator:

   ```bash
   bash "${SPECIFICATION_MDC_SKILL_DIR}/scripts/validate-transport-metadata.sh" \
     path/to/a.mdc path/to/b.mdc
   ```

   The script must not change file bytes. Compare its reported values to the
   pre-edit capture and reject any local change to transport-owned metadata.
   Store local edit timestamps, if useful, only in work evidence/receipts.
   Investigate any non-zero exit.
7. Return explicit final paths generated or materially rewritten as
   `generated_files`.

## Verification

- A fresh read passes all syntax, indentation, adjacency, marker, and YAML
  checks for each changed region.
- The read-only metadata validation covered exactly the changed edit/author
  files once at the end and did not change their bytes.
- Path and all transport-owned metadata, including `ref:`, `parent:`, and
  `last_edited_time`, remain byte-for-byte stable during local authoring.

## Completion

Report mode, file paths, refs and operations, marker disposition, invariants,
transport-metadata validation, the work-evidence location for any local edit
time, and `generated_files`. Read mode reports an empty manifest. A refusal
names the boundary and the required ref or exact target.
