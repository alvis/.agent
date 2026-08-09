# Data Operations Standards

_Rules for typed, predictable data operations, controllers, and repository organization._

## Dependent Standards

You MUST also read the following standards together with this file:

- Entity Standards (standard:data-entity) - Entity interfaces in TypeScript and Prisma.
- TypeScript Standards (plugin:coding:standard:typescript) - Type safety and interfaces for data operations.
- Functions Standards (plugin:coding:standard:function) - Function structure for operation implementations.
- Function Naming Standards (plugin:coding:standard:naming) - Naming conventions for operation functions.
- Testing Standards (plugin:coding:standard:testing) - Repository and operation testing patterns.
- Documentation Standards (plugin:coding:standard:documentation) - Operation and API contract documentation.
- General Principles (plugin:coding:standard:universal) - Core principles for all operations.

This standard requires the coding plugin for its cross-plugin dependencies.

## What's Stricter Here

| Standard Practice | Our Stricter Requirement |
|---|---|
| CRUD verbs vary by service | **Operations use `search`, `list`, `get`, `set`, and `drop` with fixed semantics.** |
| Missing-result behavior varies | **Single reads and deletes return `null`; collections return an empty array.** |
| Create and update are separate by default | **`set` uses a typed upsert contract for both paths.** |
| Deletes rely on caller discipline | **`drop` enforces an allowed-status constraint.** |
| Query bounds are optional | **Collection operations define sensible filtering and pagination defaults.** |

## Exception Policy

Allowed exceptions only when:

- False positive
- No viable workaround exists now

Required exception note fields:

- `rule_id`
- `reason` (`false_positive` or `no_workaround`)
- `evidence`
- `temporary_mitigation`
- `follow_up_action`

If exception note is missing, submission is rejected.

## Rule Groups

- `DOP-CONT-*`: Canonical naming, typing, validation, and return contracts.
- `DOP-SING-*`: Get, set, and drop single-entity semantics.
- `DOP-COLL-*`: List/search distinction, filters, pagination, sorting, and result semantics.
- `DOP-STRU-*`: Entity colocation, operation/controller organization, and tests.
