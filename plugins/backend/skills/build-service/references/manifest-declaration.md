# Manifest Declaration — Schema & Operation Patterns

Consulted by workflow step 2 (Declare operation manifests) when a new manifest
package must be created or new operations added to an existing manifest. Skip
when all operations already have manifests.

## Dispatch prompt (one subagent per operation, at most 3 concurrent)

Each dispatch prompt contains the assignment, steps, schema patterns, and
report contract below.

<IMPORTANT>
The subagent performs the task itself; it must not delegate the work to
another subagent.
</IMPORTANT>

**Assignment**: create schema and manifest for operation `[OPERATION_NAME]`
in service `[SERVICE_NAME]`.

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path passed by the orchestrator. If unavailable, stop
artifact writes and report the missing contract. Use the mission capsule's
explicit work id/root, assigned spec/plan and acceptance paths, operation
slice, and target paths. Read `state/working.md` only when the capsule lacks
navigation required to proceed; read `state.md` only for resume, cross-slice,
or alignment work, and only the relevant sections. Never edit PM-owned work
files, and leave sizing of eligible work Markdown inside the target
`.state/` to the PM.

**Steps**:

1. Create the operation directory with camelCase naming under
   `manifests/{service}/source/operations/`
2. Define the input schema using the `as const satisfies JsonSchema` pattern
3. Define the output schema (when the operation returns data)
4. Export TypeScript types using the `FromSchema` pattern
5. Create the operation manifest with `createOperationManifest`, including a
   comprehensive mock
6. Register the operation in `source/index.ts` (alphabetical order)

**Schema patterns**:

Input schema:

```typescript
import type { JsonSchema } from '@theriety/manifest';
export default {
  type: 'object',
  additionalProperties: false,
  required: ['field1'],
  properties: { field1: { type: 'string', format: 'uuid', description: '...' } },
} as const satisfies JsonSchema;
```

Schema export:

```typescript
import input from './input';
import output from './output';
import type { FromSchema } from '@theriety/manifest';
export type Input = FromSchema<typeof input>;
export type Output = FromSchema<typeof output>;
export default { input, output };
```

Manifest:

```typescript
import { createOperationManifest } from '@theriety/manifest';
import schema from './schema';
import type { Input, Output } from './schema';
export default createOperationManifest({
  path: import.meta.url,
  schema,
  async: true,
  mock: async (input: Input): Promise<Output> => ({ /* realistic mock */ }),
});
```

**Report** (under 1000 tokens):

<report>

```yaml
status: success|failure|partial
summary: 'Schema and manifest created for [operation]'
modifications: ['schema/input.ts', 'schema/output.ts', 'schema/index.ts', 'index.ts']
generated_files: ['/absolute/path/schema/input.ts', ...]
outputs:
  input_schema_created: true|false
  output_schema_created: true|false|not_required
  manifest_created: true|false
issues: []
```

</report>

## Review and decision

- Review TypeScript compilation, schema format, `FromSchema` types, and
  requirements alignment. Reviews are read-only — a review subagent must not
  modify files.
- Proceed to the next workflow step when all schemas validate; on compilation
  failures, re-dispatch only the failed operations (bound retries to 2, then
  report the remaining issues).

## Manifest project structure (when creating a new manifest package)

```
manifests/{name}/
├── package.json
├── source/
│   ├── index.ts
│   └── operations/
│       └── {operationName}/
│           ├── index.ts      # Operation manifest
│           └── schema/
│               ├── index.ts  # Schema exports + types
│               ├── input.ts  # Input schema
│               └── output.ts # Output schema (if not void)
└── spec/
    └── index.spec.ts
```
