# Backend (manifest name: `theriety`)

Domain-specific service and data orchestrator lifecycle for Theriety: build
and audit services and data layers from approved work-local specifications.
Depends on `coding`, `specification`, and `essential`. Note the known naming
mismatch: the marketplace entry is `backend`, the plugin manifest name is
`theriety`, so its skills invoke as `theriety:<skill>`.

## Skills

| Skill | Use when |
| --- | --- |
| `theriety:build-service` | Building or extending a backend service: manifests, implementation, tests, canonical review, handoff. |
| `theriety:build-data` | Building or extending a data orchestrator: schema, operations, controller integration, tests. |
| `theriety:audit-service` | Auditing a service against its authoritative spec across the canonical review areas, with optional approved remediation. |
| `theriety:audit-data` | Auditing a data orchestrator (schema, operations, controller, testing, data quality). |

Service manifests follow `skills/build-service/references/manifest-declaration.md`.
Agents contributed: `data-architect`, `service-implementation-engineer`,
`ml-engineer`, `ai-research-lead`, and others under `agents/`.
