# Python: Compliant Code Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.
> **Compliance**: Also follow `scan.md` in this directory to avoid violations during writing. When unsure about a specific rule, consult its detailed guidance in `rules/<rule-id>.md`.

## Key Principles

- Strictness at boundaries, clarity everywhere else — validate once at the edge, then trust typed internals.
- Both `ruff` AND `ty` must pass; lint covers style/safety, type-check covers correctness.
- Every rule declares a **Tool Coverage** line — the standard exists only where tooling cannot enforce judgment.
- Target Python 3.13+: PEP 695 `type X = ...`, `Self`, `@override`, `ExceptionGroup` / `except*`, `asyncio.TaskGroup`.
- Pydantic at trust boundaries only (CLI, config, HTTP, external APIs); internal components use `@dataclass(frozen=True, slots=True)`.
- Never `from __future__ import annotations` — it breaks runtime type introspection on 3.13+.

## Core Rules Summary

### Core Discipline (PYT-CORE)

- Explicit type hints on every public signature; no implicit `Any`. `# type: ignore[code]  # reason: ...` format is mandatory and always reviewed.

### Imports (PYT-IMPT)

- Ordered `stdlib → third-party → first-party → local`, each group separated by a blank line. No wildcard imports; no `from __future__ import annotations`.

### Module Layout (PYT-MODL)

- File order: imports, constants, types/aliases, classes, functions. Public/orchestration symbols precede private/leaf helpers. `__all__` defines the public surface of shipped packages.

### Parameters (PYT-PARM)

- Keyword-only at trust boundaries and for any function with >2 arguments or booleans. Never use mutable defaults (`[]`, `{}`, `set()`). Required args first, optional second, callbacks last.

### Type System (PYT-TYPE)

- Protocol for structural contracts, ABC for nominal inheritance with shared behavior, `@dataclass(frozen=True, slots=True)` for internal value objects, Pydantic for boundary DTOs. PEP 695 `type X = ...` for aliases; `NewType` for identity-only distinctions.

### Async (PYT-ASYNC)

- Structured concurrency via `asyncio.TaskGroup` — `gather` is forbidden except for trivially homogeneous fan-outs. Always hold strong references to fire-and-forget tasks.

### Exceptions (PYT-EXCP)

- Every domain defines a single base `<Domain>Error(Exception)`; leaves end in `Error`. Catch with `except*` when dealing with `TaskGroup`/`ExceptionGroup`. Never `raise Exception(...)`; never inherit from `BaseException`.

### Consistency (PYT-CONS)

- American spelling in identifiers/docs. Snake_case for functions/variables, PascalCase for types. No deprecated constructs (`typing.List`, `typing.Optional`, `collections.OrderedDict` when `dict` suffices).

## Patterns

### Public function with full hints

```python
def charge_invoice(invoice_id: str, *, amount: int, retry: bool = False) -> Receipt:
    """Charge the invoice and return a receipt."""
    ...
```

### Frozen dataclass — internal value object

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Money:
    amount: int
    currency: str
```

### Pydantic BaseModel — CLI / config boundary

```python
from pathlib import Path
from pydantic import BaseModel, Field

class CliConfig(BaseModel):
    """Parsed from argv + config file — the edge of the system."""
    source: Path
    workers: int = Field(default=4, ge=1, le=64)
    dry_run: bool = False

config = CliConfig.model_validate(raw_args)  # validate once, trust after
```

### Protocol — structural contract

```python
from typing import Protocol

class Cache(Protocol):
    def get(self, key: str) -> bytes | None: ...
    def set(self, key: str, value: bytes) -> None: ...
```

### PEP 695 type alias

```python
type JsonValue = None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]
type UserId = str
```

### TaskGroup — structured concurrency

```python
import asyncio

async def fetch_all(urls: list[str]) -> list[bytes]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch(url)) for url in urls]
    return [t.result() for t in tasks]
```

### ExceptionGroup + `except*`

```python
try:
    await fetch_all(urls)
except* TimeoutError as eg:
    logger.warning("timeouts: %d", len(eg.exceptions))
except* BillingError as eg:
    for err in eg.exceptions:
        logger.error("billing failed", exc_info=err)
```

### Custom exception hierarchy

```python
class BillingError(Exception):
    """Base for all billing-domain failures."""

class InvoiceNotFoundError(BillingError): ...
class PaymentDeclinedError(BillingError): ...
```

### Type-ignore — exact format

```python
result = legacy_api()  # type: ignore[no-untyped-call]  # reason: vendor stubs missing, tracked in TICKET-482
```

### Keyword-only boundary signature

```python
def schedule(*, retry: bool, timeout: int, on_error: Callable[[Exception], None]) -> None: ...
```

## Anti-Patterns

- `def f(x: Any) -> Any` — use `object`, a generic, a `Protocol`, or a union.
- `Optional[X]` / `Union[A, B]` — write `X | None` and `A | B`.
- `Dict[str, int]`, `List[str]`, `Tuple[int, ...]` from `typing` — use builtins `dict`, `list`, `tuple`.
- `from __future__ import annotations` — breaks Pydantic/dataclasses/`get_type_hints`.
- `await asyncio.gather(*tasks)` — use `TaskGroup`; gather loses exceptions or orphans siblings.
- `except Exception:` in business code — catch the domain base or let it propagate.
- `def f(items: list[str] = [])` — mutable default shared across calls; use a `None` sentinel.
- `# type: ignore` bare — always pin the code and explain: `# type: ignore[attr-defined]  # reason: ...`.
- Pydantic `BaseModel` for purely internal value objects — pay validation cost for no boundary benefit.
- `class Foo(BaseException):` — reserved for interpreter exits; inherit from `Exception`.
- `raise Exception("...")` — define a domain-rooted exception instead.

## Quick Decision Tree

**"I need to represent structured data — what do I use?"**

1. **Is the value crossing a trust boundary?** (CLI args, file input, HTTP body, external API, message queue payload)
   → **Pydantic `BaseModel`**. Validate at the edge; never pass raw dicts inward.

2. **Do I need a contract across unrelated implementations (duck-typed)?**
   → **`Protocol`**. Add `@runtime_checkable` only if `isinstance()` is genuinely required.

3. **Do I need shared behavior plus a nominal "is-a" relationship?**
   → **`ABC` with `@abstractmethod`**. Use when subclasses inherit real code, not just a shape.

4. **Is it an immutable internal value object (equality by fields, hashable)?**
   → **`@dataclass(frozen=True, slots=True)`**. Default choice for internal data.

5. **Is it a lightweight dict-shaped payload I already can't change (e.g. third-party JSON I pass through)?**
   → **`TypedDict`**. Pure structural typing over an existing `dict`, no runtime cost.

6. **Is it the same primitive as something else, but semantically distinct (e.g. `UserId` vs `OrderId`, both `str`)?**
   → **`NewType`**. Identity-only wrapper; zero runtime overhead, blocks accidental mixing.

7. **Is it a reusable type shape (union, generic, complex alias)?**
   → **PEP 695 `type Alias = ...`**. Never `TypeAlias` from `typing`.

**Tie-breaker:** when two options fit, prefer the one with the smallest runtime surface — `NewType` < `TypedDict` < `dataclass` < `Protocol`/`ABC` < `Pydantic`.
