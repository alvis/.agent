# Code Review Standards

_Requirements for accurate, constructive reviews that prioritize material risk and produce actionable feedback._

## Dependent Standards

You MUST also read the following standard together with this file:

- General Coding Principles (standard:universal) - Defines the implementation baseline and is the canonical authority for suppression policy, including `GEN-SAFE-01`.

## What's Stricter Here

This standard enforces requirements beyond common review practice:

| Standard Practice | Our Stricter Requirement |
|---|---|
| Reviewer discretion on blockers | **Any confirmed rule violation blocks submission unless its owning standard permits an exception** |
| Informal suppression review | **Every suppression is checked against canonical `GEN-SAFE-01` approval and root-cause requirements** |
| Unstructured feedback | **Every finding states severity, evidence, impact, and a concrete disposition** |
| Equal attention to all comments | **Correctness and security take priority over performance, maintainability, testing, and style** |

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

If exception note is missing, submission is rejected. Exceptions to dependency rules follow the owning standard's policy.

## Rule Groups

- `CRV-CORR-*`: Correctness, security, and suppression enforcement.
- `CRV-PRIO-*`: Review depth and impact-based prioritization.
- `CRV-FDBK-*`: Constructive, actionable feedback and collaboration.
