# Authoring rules — README and durable architecture drafting

Referenced from SKILL.md Workflow steps 3–7. These are the concrete rules the
drafts and the independent review are held to.

## README drafting

- **Section order (progressive disclosure)**: title & one-liner → badges (only
  if sibling READMEs use them) → TOC (only if the anchor style uses one) →
  Overview → Quick Start → Core Concept (only for a non-obvious central
  abstraction) → Architecture → Usage → API/CLI Reference → Related Packages →
  footer mirroring repo style. Skip License/Contributing when the monorepo root
  handles them.
- **Overview**: two paragraphs — problem/purpose, then positioning and unique
  value. Pull vocabulary from `package.json.description` and user notes without
  quoting weak phrasing verbatim.
- **Quick Start**: show install commands for every package manager the repo
  uses (detect from `pnpm-workspace.yaml`/`pnpm-lock.yaml`/`yarn.lock`/
  `package-lock.json`), then a minimal runnable example grounded in actual
  exports.
- **Usage**: an intro block describing what the examples demonstrate, followed
  by 2–4 `### Example: <Realistic Use Case Title>` subsections, each with a
  scenario sentence and a code block compilable against the real exports.
- **API/CLI Reference**: enumerate the public surface. Libraries use
  `<details>`-style collapsible sections per export when the template does;
  CLIs use a command/flag/description table.
- **Related Packages**: workspace-internal relations only, linked with relative
  paths.

### Support Matrix (conditional)

Emit a `## 🧰 Support Matrix` section when any of these hold: (a) the source
has an `adapters/`, `plugins/`, `drivers/`, or `providers/` directory; (b) the
package is a unified interface over multiple providers; (c) the README
advertises runtime/platform support consumers must verify. Legend, exactly:

`| ✅ Supported | ⚠️ Partial (see note) | ❌ Unsupported | 🔜 Planned |`

Columns are dimensions (Feature / Platform / Runtime / Action); rows are
adapters, providers, or runtimes.

### TOC discipline

- Exactly one line, ≤110 **displayed** characters.
  `bun run "${CODING_DOCUMENT_SKILL_DIR}/scripts/toc_width.ts" <file>` is the source of truth —
  run it before finalizing; any `OVER` row fails (non-zero exit).
- Counting rules (mirror the script): `&emsp;` = 2; `&nbsp;`/`&ensp;` = 1;
  emoji/CJK = 2; combining marks (VS16/ZWJ) = 0; `[caption](url)` counts the
  caption only; ASCII = 1. Exclude the `<div align="center">…</div>` wrapper
  but include the leading `•&emsp;&emsp;` and trailing `&emsp;&emsp;•`.
- Prioritize hard-to-spot, high-value anchors; skip anchors already obvious on
  first scroll (e.g. Quick Start at the top).
- Shortening: prefer full words with full meaning — `Architecture` not `Arch`.
  Collapse only when a shorter synonym preserves full meaning (`How to Deploy`
  → `Deployment`). Never abbreviate; never drop meaning-bearing words.
- Link format: emoji OUTSIDE the brackets with one space —
  `💡 [Core Concept](#-core-concept)`. The text inside `[...]` is plain
  caption only.

### Banned behaviors

- Inventing exports, files, env vars, or CLI commands absent from the evidence
  map.
- Rewriting sections whose subject matter did not change (update mode preserves
  them verbatim).
- Placeholder URLs (`https://example.com`, `your-org`) — derive real values
  from `package.json` (`repository`, `homepage`) or omit the badge/link.
- Multi-line TOC link rows (blank lines inside the centering `<div>` are
  required by GitHub's parser and do not count as multi-line).
- Trailing `/` in folder names — anywhere: TOCs, tree fences, component
  references, prose.
- Duplicating durable architecture content in the README (the file tree may appear in
  both at different depths).
- Hardcoded colors in Mermaid blocks (`style` directives, `fill:#…`,
  `stroke:#…`).

## Durable architecture drafting

- **Opening**: one paragraph (≤3 sentences) naming the architectural model
  (layered, pipeline, CLI dispatcher…). The reader has not read the README —
  re-establish name, one-line purpose, and target runtime, then go deep.
- **File Structure**: a plain fenced tree, depth 2–3, with an aligned
  `# comment` per entry explaining its role; align 2 spaces after the longest
  path within each directory level.
- **Main Components**: bullets of the form
  `- **ComponentName** (\`path/to/file.ts\`): what it does and why it exists` —
  components, not helpers; rationale, not restatement.
- **Optional sub-sections** only when applicable: Data Flow (numbered steps),
  Execution Model (runners/CLIs), Extension Points (frameworks), Testing
  Strategy (only if the repo conventionally documents it here).
- **Diagrams**: Mermaid only, theme-neutral (no `style`, `fill:`, `stroke:`,
  hex, or named colors; `classDef` only with default Mermaid classes). Pick the
  type by shape: `flowchart` for pipelines/dependency graphs/decision trees,
  `stateDiagram-v2` for lifecycles, `sequenceDiagram` for inter-component
  calls, `classDiagram` for type hierarchies, `erDiagram` for relational
  schemas, `journey` for user-facing flows, `block-beta`/`C4Context` for system
  context and deployment (preferred for IaC and services). `references/
  snippets/` ships reusable starting-point diagrams to customize.
- **Path**: write `docs/architecture/<architecture-slug>.md`, naming the slug
  per `naming.md` in the essential plugin's `references/` directory and
  repository capability. Reconcile
  `docs/architecture/README.md` and `docs/README.md`. Never derive the slug
  from a task title.
- **Split rule**: `docs/**` has no mechanical byte limit. Split a durable
  architecture document only when distinct ownership or navigation materially
  improves; keep the original path as the overview and use lowercase semantic
  child names under `docs/architecture/<architecture-slug>/`.
- **Separation**: when a durable architecture document exists, the README's Architecture
  section shrinks to ≤8 lines — one-line summary, a file-tree snippet of max
  depth 2, and a link. Diagrams, design patterns, invariants, data flow, and
  extension points live in durable architecture only.

### `docs/architecture/README.md`

Essential's
`${ESSENTIAL_ROOT}/templates/docs/architecture-readme.template.md` owns the
entrypoint's required shape; its
`${ESSENTIAL_ROOT}/templates/docs/docs-root-readme.template.md` owns the parent
catalog. Read both at the write decision rather than copying their section
contract here.

Reconciling it means: add, update, or remove the Documents line for the document
just written or renamed, and revise Goal, Requirements, or Constraints only when
the change alters them. Never restate a component document's internals here.

For ADR rows and ADR changes, apply the canonical
`${ESSENTIAL_ROOT}/references/adr.md` contract and use its template.
The index contains effective ADRs only; history is selected from
`decisions/superseded/` by the successor link when a current ADR is known.

## Independent review audits

The read-only reviewer checks each item and returns pass/fail per audit with
itemized fatals and warnings:

1. **Evidence integrity** — every export, CLI command, flag, env var, file
   path, and script mentioned in the docs exists in the evidence map or actual
   source (grep as needed, read-only).
2. **Export completeness** — every public export appears in the API Reference;
   silent omissions fail like inventions.
3. **Style consistency** — section order, emojis, TOC style, and code-fence
   languages match the anchor (template or sibling).
4. **Tree accuracy** — the architecture file tree matches the real structure at
   depth 2–3.
5. **Link integrity** — relative links resolve to actual files.
6. **TOC discipline** — run `toc_width.ts` against every drafted file; any
   `OVER` row is fatal. Shorten captions, never change anchors.
7. **Folder notation** — no trailing `/` in any path (regex check).
8. **Diagram theme** — no `style`/`fill:`/`stroke:`/hex in Mermaid fences; no
   undefined node references.
9. **README/architecture separation** — when both exist, README's Architecture
   section is ≤8 lines.
10. **Support Matrix presence** — present when an adapter-style directory
    exists.

## Decision criteria after review

- **Proceed**: review passes with no fatals.
- **Targeted retry**: specific fatals/warnings → fix only the flagged sections,
  then re-run the review (max 2 retries).
- **Rollback**: structural failure that section-level edits cannot fix (wrong
  anchor followed, wrong package profiled) → revert the drafts, restart from
  anchor discovery or path decision, and escalate to the user.
