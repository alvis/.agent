# Schema Implementation — Prisma Subagent Dispatch

Consulted by workflow step 2 (Implement the Prisma schema). One comprehensive
subagent implements all entity models for the domain.

## Dispatch prompt

<IMPORTANT>
The subagent performs the task itself; it must not delegate the work to
another subagent.
</IMPORTANT>

**Read the following assigned standards** and follow them recursively (when
standard A references standard B, read B too):

- plugin:coding:standard:documentation/write
- plugin:coding:standard:naming/write
- plugin:coding:standard:typescript/write
- standard:data-entity

**Assignment**: implement the Prisma schema for domain `{domain}` with
entities `{entity list}`.

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path passed by the orchestrator. If unavailable, stop
artifact writes and report the missing contract. Use the mission capsule's
explicit work id/root, assigned materialized spec sections, acceptance slice,
and target paths. Read `state/working.md` only when the capsule lacks navigation
required to proceed; read `state.md` only for resume, cross-slice, or alignment
work, and only the relevant sections. Never fetch Notion or edit PM-owned work
files.

**Steps**:

1. Validate the project structure (`prisma/` folder, `package.json`)
2. Translate each assigned materialized entity into Prisma schema syntax
3. Write individual schema files with JSDoc documentation for every field
4. Ensure proper relationships, constraints, and indexes
5. Run `npx prisma generate` to create TypeScript types
6. Run the package build to verify no breaking changes
7. Fix compilation errors within the assigned slice

**Report** (under 1000 tokens):

<report>

```yaml
status: success|failure|partial
summary: 'Schema implementation results'
modifications: ['entity1.prisma', ...]
generated_files: ['/absolute/path/entity1.prisma', ...]
outputs:
  entity_count: N
  entity_list: ['Entity1', ...]
  prisma_generation: success|failed
issues: []
```

</report>

## Review and decision

- Run a read-only schema validation review; a review subagent must not modify
  files.
- Proceed when the schemas are valid and `npx prisma generate` succeeded; on
  compilation errors, fix and re-dispatch (bound retries to 2, then report the
  remaining issues instead of looping).
