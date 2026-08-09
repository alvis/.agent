# File and Directory Structure Standards

_Requirements for discoverable file names, coherent exports, bounded modules, and predictable environment configuration._

## Dependent Standards

You MUST also read the following standards when applicable:

- Naming Standards (standard:naming) - Defines identifier and verb-first function naming.
- TypeScript Standards (standard:typescript) - Defines module and barrel export behavior, including `TYP-MODL-04`.

## What's Stricter Here

This standard enforces requirements beyond common project conventions:

| Standard Practice | Our Stricter Requirement |
|---|---|
| Descriptive multiword filenames | **Prefer one specific domain word and remove path-redundant type suffixes** |
| Arbitrary large-file splitting | **Relocate misplaced concerns first, then use a thin entry plus a same-base helper directory** |
| Flexible barrel exports | **Barrel-to-barrel exports use subpath aliases; barrel-to-leaf exports are explicit** |
| Environment samples optional | **Every used environment suffix has a documented `.env.<suffix>.example`** |

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

- `FST-NAME-*`: File casing, specificity, path context, and export alignment.
- `FST-MODL-*`: Module cohesion, barrel boundaries, and long-file decomposition.
- `FST-ENVR-*`: Environment file naming, samples, and override order.
