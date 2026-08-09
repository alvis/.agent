# Universal Coding Standards

_Core engineering principles that apply to all implementation work._

## Dependent Standards

You MUST also read the following standards if applicable together with this file:

- TypeScript Standards (standard:typescript) - strict typing and import discipline
- Naming Standards (standard:naming) - identifier consistency and intent clarity
- Documentation Standards (standard:documentation) - contract and rationale documentation rules

## What's Stricter Here

This standard enforces requirements beyond common team conventions:

| Standard Practice                       | Our Stricter Requirement                                           |
|-----------------------------------------|--------------------------------------------------------------------|
| Suppression comments used pragmatically | **Suppression is exceptional and requires explicit user approval** |
| Wrapper functions often tolerated       | **Zero wrapper tolerance unless value is added**                   |
| Optimize while implementing             | **Profile first, optimize second**                                 |
| Mixed style tolerated                   | **Must match established project patterns**                        |
| Quick fixes accepted                    | **Root-cause remediation required**                                |

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

- `GEN-SAFE-*`: Safety and root-cause remediation guardrails.
- `GEN-DESN-*`: Core design hygiene (responsibility, DRY, wrapper value).
- `GEN-CONS-*`: Consistency and readability conventions.
- `GEN-SCAL-*`: Performance/scalability decision discipline.
