# Observability Standards

_Compact operational rules for error modeling, logging behavior, and observability safety._

## Dependent Standards

You MUST also read the following standards together with this file:

- Universal Coding Principles (standard:universal) - root-cause and consistency baseline
- Function Design Standards (standard:function) - boundary handling and side-effect placement

## What's Stricter Here

This standard enforces requirements beyond common logging practices:

| Standard Practice                     | Our Stricter Requirement                   |
|---------------------------------------|--------------------------------------------|
| Generic `Error` commonly used         | **Use specific error classes by scenario** |
| Console logging tolerated in app code | **Transactional logger only**              |
| Flexible log message style            | **Canonical message format is required**   |
| Broad context logging by default      | **Strict sensitive-data exclusion**        |

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

- `ERR-HAND-*`: Error modeling and boundary-handling rules.
- `LOG-OPER-*`: Logging operation quality (logger use, levels, format, structure).
- `LOG-RISK-*`: Compliance, privacy, and audit/performance risk controls.
