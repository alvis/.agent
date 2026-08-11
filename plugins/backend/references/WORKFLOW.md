# Backend workflow

Read this before schema, data-model, pipeline, service, API, or ML/AI work. Use the owning skill, then follow the standards named for that action.

## Actions

| Action | Instruction |
| --- | --- |
| Build or extend a schema, data model, controller, or pipeline | `backend:build-data` |
| Audit data schemas, operations, migrations, or pipelines | `backend:audit-data` |
| Build or extend a service or API | `backend:build-service` |
| Audit a service against its specification | `backend:audit-service` |
| Materialize or synchronize an implementation specification | `specification:sync-spec` |
| Write, test, review, save, or publish code | Read `coding:references/WORKFLOW.md`, then use its action owner |
| Create or materially rewrite project artifacts | Follow the injected `essential:references/state.md` contract |

Before work delegation, read `backend:references/ROUTING.md`.

## Standards

Read every file in a listed standards directory, following its cross-references.

| Applies to | Standards |
| --- | --- |
| Entity and schema work | `backend:standards/data-entity/` |
| Data operations, controllers, and repositories | `backend:standards/data-operation/` |
| TypeScript backend code | `coding:standards/universal/`, `coding:standards/function/`, `coding:standards/typescript/`, `coding:standards/naming/`, `coding:standards/testing/`, and `coding:standards/documentation/` |
| Errors, logging, and operational behavior | `coding:standards/observability/` |
| Python ML/AI code | `coding:standards/universal/`, `coding:standards/function/`, `coding:standards/python/`, `coding:standards/testing/`, and `coding:standards/observability/` |
| Review | `coding:standards/code-review/` plus the implementation standards above |
| Files and project setup | `coding:standards/file-structure/` |
| Commits, branches, and pull requests | `coding:standards/git/` |
