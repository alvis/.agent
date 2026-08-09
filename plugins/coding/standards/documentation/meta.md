# Documentation Standards

_Compact rules for comments, JSDoc, inline documentation, and maintenance._

## Dependent Standards

You MUST also read the following standards together with this file:

- General Coding Principles (standard:universal) - clarity, maintainability, and consistency baseline

## What's Stricter Here

This standard enforces requirements beyond common documentation practices:

| Standard Practice                 | Our Stricter Requirement                                    |
|-----------------------------------|-------------------------------------------------------------|
| Comments may restate code         | **Comments must explain intent, constraints, or rationale** |
| Flexible casing in comments       | **Lowercase sentence style by default**                     |
| TODO/FIXME can linger             | **Temporary tags must not be committed**                    |
| JSDoc formatting varies by author | **Canonical sentence style and structure required**         |

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

- `DOC-CONT-*`: Documentation content quality and anti-noise rules.
- `DOC-FORM-*`: JSDoc/comment formatting and sentence-style rules.
- `DOC-LIFE-*`: Documentation lifecycle hygiene (temporary/review/maintenance tags).
