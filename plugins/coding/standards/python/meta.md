# Python Standards

_Compact Python rules for type-system hygiene, imports, module structure, concurrency, exceptions, and naming._

## Target

Python **3.13+**. Rules assume and exploit modern features: PEP 695 `type X = ...` aliases and generic syntax, `@override`, `Self`, `TypeIs`, `ExceptionGroup` / `except*`, and runtime-introspectable annotations.

## Tooling

All Python code MUST pass **both** tools on every commit:

- **`ruff`** - linter and formatter (Astral, Rust-based). Single tool for style, lint, import sorting, and formatting.
- **`ty`** - static type checker (Astral, Rust-based). Validates types, protocols, and overloads.

Every rule in this standard declares a `Tool Coverage:` line stating which checks are enforced by `ruff`, which by `ty`, and which require human review. Reviewers MUST NOT re-litigate mechanical checks the tools already enforce - focus review effort on semantic rules the tools cannot verify.

## Dependent Standards

You MUST also read the following standards together with this file:

- General Coding Principles (standard:universal) - baseline correctness and consistency constraints
- Naming Standards (standard:naming) - overlaid and specialized by `PYT-NAME-*` for Python conventions (`snake_case`, `PascalCase`, `_protected`, dunders)
- Documentation Standards (standard:documentation) - exported symbols and public APIs require compliant docstrings
- Function Design Standards (standard:function) - function contracts and parameter design must stay aligned

## What's Stricter Here

This standard enforces requirements beyond typical Python practices:

| Standard Practice                            | Our Stricter Requirement                                             |
|----------------------------------------------|----------------------------------------------------------------------|
| `mypy` OR `pyright` alone is enough          | **`ruff` and `ty` must both pass - zero errors**                     |
| `# type: ignore` used freely                 | **Exactly `# type: ignore[code]  # reason: ...` - code and reason required** |
| `from __future__ import annotations` common  | **Forbidden - breaks runtime introspection used by dataclasses, Pydantic, and `ty`** |
| Pydantic models used everywhere              | **Pydantic only at trust boundaries; internal types use `@dataclass(frozen=True, slots=True)`** |
| `Any` as a speed escape hatch                | **`Any` is forbidden; prefer `object` + narrowing or a precise `Protocol`** |
| Wildcard and implicit relative imports       | **Absolute imports only; explicit ordering via ruff**                |
| Bare `except:` tolerated                     | **Narrow exception types required; `ExceptionGroup` for aggregation** |

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

Testing rules are out of scope here and live in `standard:testing`; ruff's `PT*` checks cover the mechanical pytest bits.

## Rule Groups

- `PYT-CORE-*`: Type-system hygiene - forbids `Any`, mandates `# type: ignore` format, bans `from __future__ import annotations`, requires strict `ty` settings (5 rules).
- `PYT-IMPT-*`: Import discipline - absolute imports, ordering, no wildcard, no cyclic, `TYPE_CHECKING` block usage (5 rules).
- `PYT-TYPE-*`: Type-shape selection - when to use `Protocol` vs ABC, `TypedDict` vs dataclass, Pydantic at trust boundaries only, `Literal`, generics via PEP 695 (6 rules).
- `PYT-PARM-*`: Parameter ergonomics - keyword-only boundaries, no mutable defaults, positional-only for primitives, `Self` return types (4 rules).
- `PYT-ASYNC-*`: Structured concurrency - `asyncio.TaskGroup` over bare `gather`, cancellation discipline, no sync-in-async, timeout contracts (4 rules).
- `PYT-EXCP-*`: Exception discipline - narrow `except`, no bare `raise`, `ExceptionGroup` / `except*` for aggregation, chaining via `from`, custom hierarchy (5 rules).
- `PYT-MODL-*`: Module and package structure - `__init__.py` shape, `__all__` declaration, top-level symbol ordering, no side effects at import time (4 rules).
- `PYT-NAME-*`: Naming conventions - `snake_case` / `PascalCase` / `SCREAMING_SNAKE`, `_protected` and `__private`, dunder restraint, module names (4 rules).
