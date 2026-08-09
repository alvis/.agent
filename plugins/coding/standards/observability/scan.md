# Observability: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md` to confirm the violation and follow its fix guidance.

> **During linting**: Only apply a rule's fix if it is a mechanical correction — formatting, naming, documentation, casing, import ordering, or field/function reordering. If the fix would add new logic, change control flow, introduce runtime validation, or alter program behavior, report the violation without fixing it.

> **Scanner-backed rules**: `ERR-HAND-02` has advisory mechanical scanner support (`plugins/coding/scripts/scanners/`). The scanner surfaces candidates only — always re-verify each hit against the rule guide before flagging.

## Quick Scan

- DO NOT throw generic errors for domain failures [`ERR-HAND-01`]
- DO NOT swallow errors silently, such as `catch { return }` without rethrow or typed failure [`ERR-HAND-02`]
- DO NOT drop error context chains [`ERR-HAND-03`]
- DO NOT use conditional branching on base `Error` in catch blocks instead of casting [`ERR-HAND-04`]
- DO NOT use console logging in app/runtime flow [`LOG-OPER-01`]
- DO NOT use log levels that do not match outcome severity, such as `logger.info("payment failed")` [`LOG-OPER-02`]
- DO NOT write log messages without clear action/outcome, such as `logger.info("payment")` [`LOG-OPER-03`]
- DO NOT omit required structured log context fields [`LOG-OPER-04`]
- DO NOT use inconsistent domain terminology [`LOG-OPER-05`]
- DO NOT log sensitive data, such as tokens, passwords, or auth headers [`LOG-RISK-01`]
- DO NOT skip audit logging for security-relevant actions [`LOG-RISK-02`]
- DO NOT omit timing/threshold signals for long operations [`LOG-RISK-03`]

## Rule Matrix

| Rule ID | Violation | Bad Examples |
|---|---|---|
| `ERR-HAND-01` | Generic error used for domain failure | `throw new Error("not found")`; `throw new Error('User not found')` |
| `ERR-HAND-02` | Error is swallowed silently | `catch { return }` |
| `ERR-HAND-03` | Error context chain is not preserved | `logger.error(error.message)` |
| `ERR-HAND-04` | Conditional branching on base `Error` in catch instead of casting | `error instanceof Error ? error.message : String(error)` |
| `LOG-OPER-01` | Console logging used in app flow | `console.log("processing")`; `console.log("This is wrong")` |
| `LOG-OPER-02` | Log level does not match outcome | `logger.info("payment failed")` |
| `LOG-OPER-03` | Message lacks action/outcome clarity | `logger.info("payment")`; `logger.error("Error: " + error.message)` |
| `LOG-OPER-04` | Logs omit structured context fields | `logger.info("done")` |
| `LOG-OPER-05` | Domain terminology is inconsistent | `logger.info("client login failed")` |
| `LOG-RISK-01` | Sensitive data appears in logs | `logger.info("token", { token })`; `logger.warn("auth failed", { password })` |
| `LOG-RISK-02` | Security-relevant action not audited | `updateUserRole(data)` |
| `LOG-RISK-03` | Long operation has no timing signal | `generateInvoice(data); // no duration metric/log` |
