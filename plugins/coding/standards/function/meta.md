# Function Standards

_Compact rules for function design, interfaces, parameters, purity, and immutability._

## Dependent Standards

You MUST also read the following standards together with this file:

- General Coding Principles (standard:universal) - baseline design constraints and consistency rules

## What's Stricter Here

This standard enforces requirements beyond typical function-style guidance:

| Standard Practice                  | Our Stricter Requirement                      |
|------------------------------------|-----------------------------------------------|
| Return types often inferred        | **Explicit return types required**            |
| Parameter style left to preference | **Positional/object contract is mandatory**   |
| Mutable implementations accepted   | **Immutability by default**                   |
| Multi-purpose functions tolerated  | **Single-responsibility boundaries required** |

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

- `FUNC-SIGN-*`: Signature, parameter, and exported contract rules.
  - `FUNC-SIGN-06`: Avoid conditional spread for optional keys; pass the value directly unless the consumer distinguishes missing from undefined.
  - `FUNC-SIGN-07`: Constructor takes exactly one object parameter (XXXParams or XXXConfig); destructure each capability into a named #privateField; no #dependencies bag.
- `FUNC-STAT-*`: State safety (mutation, immutability, purity, side-effects).
- `FUNC-ARCH-*`: Structural function-design rules and helper patterns.
  - `FUNC-ARCH-04`: Never inject the parent class into a child; use a parent factory method (private parent state) or a standalone module-level helper (public parent surface).
  - `FUNC-ARCH-05`: Remove short-circuit guards before small loops; use optional chaining at the call site.
