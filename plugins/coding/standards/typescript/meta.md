# TypeScript Standards

_Compact TypeScript rules for type safety, imports, module structure, and interface contracts._

## Dependent Standards

You MUST also read the following standards together with this file:

- General Coding Principles (standard:universal) - baseline correctness and consistency constraints
- Naming Standards (standard:naming) - symbol naming must align with the naming contract
- Documentation Standards (standard:documentation) - exported types and APIs require compliant docs
- Function Design Standards (standard:function) - function contracts and parameter design must stay aligned

## What's Stricter Here

This standard enforces requirements beyond typical TypeScript practices:

| Standard Practice                | Our Stricter Requirement                            |
|----------------------------------|-----------------------------------------------------|
| `any` used for speed             | **`any` is forbidden**                              |
| Double-casting for compatibility | **No `as unknown as` in production code**           |
| Mixed import styles tolerated    | **Strict import ordering and type/code separation** |
| Default export is common         | **Named exports preferred**                         |
| Loose file layout                | **Top-level symbol ordering is mandatory**          |

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

- `TYP-CORE-*`: Global type-safety and language-baseline rules.
- `TYP-IMPT-*`: Import ordering and subpath usage rules.
- `TYP-MODL-*`: Module layout, export-shape, and barrel re-export strategy rules.
- `TYP-PARM-*`: Parameter and contract-shape rules.
  - `TYP-PARM-04`: Dependency-contract fields model named capabilities (action functions like `readContextSource`), not infrastructure containers (`database`, `logger`, `httpClient`).
- `TYP-TYPE-*`: Type-system and narrowing strategy rules.
