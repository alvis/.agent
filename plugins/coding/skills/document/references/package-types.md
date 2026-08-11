# Package-Type Detection & Per-Type Bundled Examples

This reference is consulted by **Step 6 (Draft README)** and **Step 7 (Draft ARCHITECTURE)** when the writer is using bundled templates and needs to (a) classify the package and (b) pick the type-matched bundled example.

## Type Resolution Order

`<type>` is resolved from the Step 5 `package_type` (plan-mode path) when present; otherwise fall back to the detection rules below using the Step 3 code profile.

## Detection Fallback (Step 3 profile, first match wins)

- `bin` present → **cli**
- `pulumi/` / `cdk/` / `*.tf` / `*.bicep` present → **iac**
- root `workspaces` field + no `src` → **monorepo-root**
- `prisma/schema.prisma` AND `src/operations` AND `src/prisma` → **data-controller**
- `src/operations` AND no `prisma/` AND (server entry OR manifest export) → **stateless**
- HTTP endpoints + DB + `adapters/` → **microservice**
- else → **library**

## OSS Signals (README only — applied on top of the base type)

A package is treated as **OSS** if ANY of the following is true:

- repo root has a `LICENSE` file
- `package.json.repository.url` points to a public host (`github.com`, `gitlab.com`, `bitbucket.org`, `codeberg.org`, etc.)
- `package.json.publishConfig.access === "public"`
- `package.json` does NOT have `"private": true`

An **OSS monorepo root** is OSS AND has a top-level `workspaces` field AND sub-packages are present under that `workspaces` glob.

OSS overrides the bundled example **only for `library` and `monorepo-root`**; all other archetypes (`cli` / `microservice` / `data-controller` / `iac` / `stateless`) ignore the OSS flag and use their existing example.

## README Bundled Example Map (Step 6)

Resolve to `<skill_root>/references/README.example.<type>.md`:

- `library` (internal) → `README.example.library.md`
- `library` (OSS) → `README.example.oss-library.md`
- `cli` → `README.example.cli.md`
- `microservice` → `README.example.microservice.md`
- `stateless` → no bundled example; use `README.template.md` plus source evidence
- `data-controller` → no bundled example; use `README.template.md` plus source evidence
- `iac` → `README.example.iac.md`
- `monorepo-root` (internal) → `README.example.monorepo.md`
- `monorepo-root` (OSS) → `README.example.oss-monorepo.md`

## ARCHITECTURE Bundled Example Map (Step 7)

Resolve to `<skill_root>/references/ARCHITECTURE.example.<type>.md` (no OSS variants):

- `library` → `ARCHITECTURE.example.library.md`
- `cli` → `ARCHITECTURE.example.cli.md`
- `microservice` → `ARCHITECTURE.example.microservice.md`
- `stateless` → no bundled example; use `ARCHITECTURE.template.md` plus source evidence
- `data-controller` → no bundled example; use `ARCHITECTURE.template.md` plus source evidence
- `iac` → `ARCHITECTURE.example.iac.md`
- `monorepo-root` → `ARCHITECTURE.example.monorepo.md`

## Usage Note

When using bundled templates, read the type-matched example to see the template instantiated, then re-skin emojis/TOC to match any sibling READMEs found in Step 2 (bundled templates carry the `@example` flavor). An entrypoint that contains an ordered child manifest is an overview, not the complete source: read every linked child in order. Bundled compatibility entrypoints may retain legacy uppercase names, but newly generated project artifacts and split-child paths are lowercase.
