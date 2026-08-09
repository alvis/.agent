# Data Entity Standards

_Rules for aligned TypeScript entity contracts and Prisma persistence models._

## Dependent Standards

You MUST also read the following standards together with this file:

- TypeScript Standards (plugin:coding:standard:typescript) - Type safety and interface conventions for entity contracts.
- Documentation Standards (plugin:coding:standard:documentation) - Field and schema documentation conventions.

## What's Stricter Here

| Standard Practice | Our Stricter Requirement |
|---|---|
| Entity fields may be arranged organically | **Fields are grouped consistently by role and documented.** |
| ORM mapping may remain implicit | **Application and Prisma shapes explicitly align on names, nullability, states, defaults, timestamps, and relations.** |
| Indexes are added reactively | **Frequently filtered fields receive an explicit index decision.** |

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

- `DEN-SHAP-*`: Application entity field organization, documentation, and explicit types.
- `DEN-PRIS-*`: Prisma alignment, mappings, constraints, defaults, relations, timestamps, and indexes.
