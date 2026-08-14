# DOCUMENT Mode — Codebase-Extraction Workflow

DOCUMENT mode derives specification content from an existing codebase. It
updates the active work specification and ultimately the versioned capability
docs; it implies no remote destination.

## When DOCUMENT Mode Activates

- A codebase exists but no authoritative capability specification is present,
  OR
- The instruction explicitly requests documentation of existing code.

## Step A — Analyze Existing Codebase (Step 1.3 in parent workflow)

- Scan project structure using the Glob tool.
- Read `package.json` to identify dependencies and extract the package name.
- Analyze file organization and architecture.
- Identify key components from imports and exports.
- Extract tech stack from dependencies (with versions).
- Map the actual implementation onto the specification template structure.

## Step B — Tech Stack Extraction (Step 4 in parent workflow)

DOCUMENT mode does NOT research; it extracts.

- Pull the tech stack from the Step A codebase analysis.
- Identify versions from `package.json`.
- Document the actual technologies in use.
- Note framework and library choices made.
- Record actual versions (no speculative recommendations).

## Step C — Architecture Extraction (Step 5 in parent workflow)

- Extract architecture from code structure.
- Identify layers from file organization.
- Document actual patterns in use.
- Map component relationships from imports.
- Describe data flow from code analysis.
- Use mermaid code blocks for diagrams unless explicitly specified otherwise.

## Step D — Component Extraction (Step 6 in parent workflow)

- Analyze directory structure to identify components.
- Read key files to understand component boundaries.
- Map component responsibilities from code.
- For each component, document:
  - Purpose and responsibilities (from actual code behavior).
  - Key classes/modules/functions present.
  - Data structures and models actually used.
  - Error handling approach as implemented.

## Step E — API Extraction (Step 7, if applicable)

- Read routing files to enumerate endpoints.
- Document actual endpoints (paths, methods, handlers).
- Extract request/response shapes from code (types, schemas, validators).
- Read model/schema files to extract data models.
- Document actual database structure and relationships.
- Extract validation rules from code.

## Step F — UI Extraction (Step 8, if applicable)

- Analyze component files to map screen/page organization.
- Document actual routing from code.
- Read component files to extract props and state from TypeScript types.
- Note the actual styling approach used.
- Document reusable components as they exist.

## Step G — Artifact generation

- Generate work-local design evidence and a specification for the explicitly
  selected destination based on code analysis.
- Document actual implementation under template sections.
- Fill all template sections with discovered information.
- Note where the implementation differs from best practices (if relevant).
- Apply transport and derivation metadata from `references/frontmatter.md`.
- For a local or inline destination, author the work-local specification and
  derive reviewed versioned capability docs directly. Do not search a Notion
  database, create a remote page, author MDC, or claim a 1:1 remote mapping.
- Only for an explicitly selected Notion destination, require the caller's
  exact `--body-author=<plugin:skill>`; select `specification:mdc` for MDC,
  author through that installed capability, and follow the transport flow
  below.

## Notion sync considerations

Only when the caller explicitly selects a Notion destination:

- Preserve existing properties. Set or change a property only when the caller
  supplies an explicit destination-owned mapping and the approved body-author
  policy authorizes that value; this marketplace defines no status labels.
- For a new page, author the explicit local transport path with its parent first
  through the bound `body_author`, then
  create it through `Skill(sync-notion)`, accept the canonical `ref` only from
  its conformance-bound create output, and verification-pull that identity.
- For an existing paired specification, delegate completion to
  `Skill(sync-spec)`, which delegates transport and conflict mechanics to
  `Skill(sync-notion)`.

Do not infer a Notion destination from installed tooling, template metadata, a
project convention, or the absence of a local source.

## Examples

```bash
/spec-code "Document the existing Express API in this codebase" --capability=express-api
# Auto-detected DOCUMENT (codebase exists, no capability specification).
# Extracts package name from package.json (e.g., "express-api").
# Analyzes structure, extracts tech stack, documents architecture from code.
# Identifies components, extracts API endpoints from route files.
# Generates work-local evidence and reviewed versioned capability docs.
# No Notion database search, page creation, MDC, or remote sync occurs.
```

```bash
/spec-code "Retrospectively document this Next.js application" --capability=web-app --type=web-app --source-direction=local-to-notion --transport-root=<dir> --local-mdc=<path> --parent=<notion-parent-ref> --body-author=specification:mdc
# Scans Next.js project structure.
# Documents actual pages, components, API routes.
# Extracts UI component tree from code.
# Captures current tech decisions, follows template structure.
# Because the caller explicitly selected Notion and `specification:mdc`, authors the given MDC path,
# creates the page under the given parent through the validated create route,
# and verification-pulls the canonical ref returned by transport.
```

```bash
/spec-code "Document the authentication module only" --capability=authentication
# Partial-codebase DOCUMENT.
# Analyzes auth-related files only.
# Documents auth component architecture and API endpoints.
# Produces a focused local capability specification and durable derivation.
# Does not search or mutate a remote database.
```
