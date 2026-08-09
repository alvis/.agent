# Python: Violation Scan

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

Any single violation blocks submission by default.
If a violation is detected, load the matching rule guide at `./rules/<rule-id>.md` to confirm the violation and follow its fix guidance.

> **During linting**: Only apply a rule's fix if it is a mechanical correction — formatting, naming, documentation, casing, import ordering, or field/function reordering. If the fix would add new logic, change control flow, introduce runtime validation, or alter program behavior, report the violation without fixing it.

> **Scanner-backed rules**: `PYT-CORE-03`, `PYT-IMPT-03`, and `PYT-IMPT-05` have advisory mechanical scanner support (`plugins/coding/scripts/scanners/`). The scanner surfaces candidates only — always re-verify each hit against the rule guide before flagging.

## Quick Scan

- DO NOT leave public boundaries without explicit type hints, such as `def charge(invoice, *, retries=3):` [`PYT-CORE-01`]
- DO NOT use `Any` in production/runtime paths — prefer `object`, generics, `Protocol`, or `Never` [`PYT-CORE-02`]
- DO NOT use blanket `# type: ignore` or omit the `  # reason: <text>` postfix [`PYT-CORE-03`]
- DO NOT use a manual `TypeVar("T", bound="Cls")` dance for fluent returns, `__enter__`, or `from_*` classmethods — use `typing.Self` [`PYT-CORE-04`]
- DO NOT use `Optional[X]` or implicit-optional defaults (`def f(x: int = None)`); use `X | None` [`PYT-CORE-05`]
- DO NOT use cross-package relative imports, such as `from ..billing import InvoiceService` [`PYT-IMPT-01`]
- DO NOT mix import groups, or add comment labels above groups (e.g. `# third-party`); use blank-line separation only [`PYT-IMPT-02`]
- DO NOT use `from __future__ import annotations` — it stringifies annotations and breaks runtime introspection [`PYT-IMPT-03`]
- DO NOT rely on `TYPE_CHECKING` to paper over a real runtime cycle; move the shared type instead [`PYT-IMPT-04`]
- DO NOT omit `__all__` from a public package `__init__.py` [`PYT-IMPT-05`]
- DO NOT use `Pydantic` for internal value objects (reserve it for trust boundaries); use `Protocol`/`ABC`/`@dataclass` otherwise [`PYT-TYPE-01`]
- DO NOT declare value objects without `frozen=True, slots=True` [`PYT-TYPE-02`]
- DO NOT use bare `str` for finite state values — use `Literal[...]` or `StrEnum` [`PYT-TYPE-03`]
- DO NOT share a primitive type across sibling IDs (`user_id: str`, `order_id: str`); use `NewType` [`PYT-TYPE-04`]
- DO NOT use `TypedDict` for internal models — reserve it for external JSON shapes [`PYT-TYPE-05`]
- DO NOT declare type aliases with `TypeAlias` or bare assignment; use the PEP 695 `type` statement [`PYT-TYPE-06`]
- DO NOT use positional arguments at public boundaries for booleans, or for signatures with 3+ parameters [`PYT-PARM-01`]
- DO NOT omit the `/` marker on self-explanatory single-argument utilities (`def slugify(text: str, /) -> str`) [`PYT-PARM-02`]
- DO NOT use mutable defaults (`=[]`, `={}`, `=datetime.now()`) — use `None` sentinels [`PYT-PARM-03`]
- DO NOT declare signatures with more than five parameters; bundle into a frozen dataclass request object [`PYT-PARM-04`]
- DO NOT use `asyncio.gather` for fan-out — use `asyncio.TaskGroup` for structured concurrency [`PYT-ASYNC-01`]
- DO NOT call blocking I/O inside a coroutine (`requests.get`, `time.sleep`, sync file/DB) — route via `asyncio.to_thread` or an async client [`PYT-ASYNC-02`]
- DO NOT catch `asyncio.CancelledError` without re-raising it [`PYT-ASYNC-03`]
- DO NOT manage async resources with manual `open`/`close` pairs; use `async with` [`PYT-ASYNC-04`]
- DO NOT raise bare `Exception` — every domain error must inherit from a single domain base class [`PYT-EXCP-01`]
- DO NOT catch `BaseException` or use bare `except:` — narrow to `Exception` or a specific subclass [`PYT-EXCP-02`]
- DO NOT re-raise inside `except` without `from exc` (chain) or `from None` (deliberate suppression) [`PYT-EXCP-03`]
- DO NOT handle concurrent fan-out failures with plain `except` — use `ExceptionGroup` and `except*` [`PYT-EXCP-04`]
- DO NOT raise exceptions without identifying context (record id, tenant, operation); "not found" alone is useless [`PYT-EXCP-05`]
- DO NOT ship a distributable package without a `src/<package>/` layout [`PYT-MODL-01`]
- DO NOT place logic or side effects in `__init__.py`; restrict it to imports, `__all__`, and a docstring [`PYT-MODL-02`]
- DO NOT collect unrelated symbols in `utils.py`/`helpers.py`/`common.py`; one public symbol per module [`PYT-MODL-03`]
- DO NOT omit `__init__.py` from a package directory (implicit namespace packages) [`PYT-MODL-04`]
- DO NOT use `camelCase`/`PascalCase` for functions, methods, variables, parameters, or module filenames [`PYT-NAME-01`]
- DO NOT use `snake_case` for classes, `Protocol`s, PEP 695 `type` aliases, or `TypeVar`s; use `PascalCase` [`PYT-NAME-02`]
- DO NOT use `UPPER_SNAKE_CASE` outside of module-level constants and enum members [`PYT-NAME-03`]
- DO NOT use double-underscore (`__attr`) for "private"; use single leading underscore (`_attr`) unless name-mangling is genuinely needed [`PYT-NAME-04`]

## Rule Matrix

| Rule ID | Summary | Tool Coverage | Review Signal |
|---|---|---|---|
| `PYT-CORE-01` | Public function, method, module-level variable, or class attribute lacks an explicit type hint. | ruff:ANN001,ANN201,ANN202 (partial) | `def charge(invoice, *, retries=3):` |
| `PYT-CORE-02` | `Any` is used in production/runtime code. | ruff:ANN401 (partial) | `def log_event(payload: Any)` |
| `PYT-CORE-03` | `# type: ignore` is blanket or missing the `  # reason: <text>` postfix. | ruff:PGH003 (partial) | `value = lib.fetch()  # type: ignore` |
| `PYT-CORE-04` | Fluent return / `__enter__` / `from_*` classmethod uses `TypeVar(... bound=...)` instead of `typing.Self`. | standard-only | `def with_limit(self: T, limit: int) -> T` |
| `PYT-CORE-05` | `Optional[X]` used, or implicit-optional default (`def f(x: int = None)`). | ruff:RUF013,UP007 (partial) | `def find_user(id: str) -> Optional[User]`; `def send(reply_to: str = None)` |
| `PYT-IMPT-01` | Cross-package relative import (`..pkg`, `...pkg`) used in place of an absolute import. | ruff:TID252 | `from ..billing import InvoiceService` |
| `PYT-IMPT-02` | Import groups are not ordered stdlib → third-party → first-party → local, or groups carry comment labels. | ruff:I001 | Mixed `import httpx` / `import json` / `from .helpers import x` with no blank lines |
| `PYT-IMPT-03` | `from __future__ import annotations` present. | standard-only | `from __future__ import annotations` at top of a module |
| `PYT-IMPT-04` | `TYPE_CHECKING` is used to mask a real runtime cycle, or a typing-only import leaks to runtime. | ruff:TC001,TC002,TC003,TC004 (partial) | `if TYPE_CHECKING: from billing import X` hiding a true cycle |
| `PYT-IMPT-05` | Public package `__init__.py` omits `__all__`. | ruff:F822 (partial) | `__init__.py` with re-exports and no `__all__ = (...)` |
| `PYT-TYPE-01` | Wrong shape chosen (Pydantic for internal value object, `type` for behavior, etc.). | standard-only | `class InternalMoney(BaseModel)` |
| `PYT-TYPE-02` | Value-object dataclass is missing `frozen=True` or `slots=True`. | ruff:RUF008 (partial) | `@dataclass` without `frozen=True, slots=True` |
| `PYT-TYPE-03` | Bare `str` used for a finite state value instead of `Literal[...]` / `StrEnum`. | standard-only | `def describe(status: str)` for a closed set of values |
| `PYT-TYPE-04` | Sibling ID parameters share primitive types without `NewType` distinction. | standard-only | `def charge(order_id: str, user_id: str)` |
| `PYT-TYPE-05` | `TypedDict` used for an internal model instead of a `dataclass`. | standard-only | `class User(TypedDict): ...` for an internal domain type |
| `PYT-TYPE-06` | Type alias uses legacy `TypeAlias` or bare assignment instead of PEP 695 `type` statement. | standard-only | `UserId: TypeAlias = str`; `JsonValue = str | int` |
| `PYT-PARM-01` | Public function has boolean positional arguments, or ≥3 parameters without `*` keyword-only separator. | ruff:FBT001,FBT002 (partial) | `def deploy(service, dry_run=False, verbose=False)` |
| `PYT-PARM-02` | Self-explanatory single-argument utility omits the `/` positional-only marker. | standard-only | `def slugify(text: str) -> str` (no `/`) |
| `PYT-PARM-03` | Mutable default argument (`=[]`, `={}`, `=datetime.now()`, etc.). | ruff:B006,B008 | `def append(history: list = [])` |
| `PYT-PARM-04` | Function signature has more than five parameters. | ruff:PLR0913 | Seven-parameter `def deploy(service, version, environment, dry_run, verbose, max_retries, timeout_seconds)` |
| `PYT-ASYNC-01` | `asyncio.gather` used for fan-out instead of `asyncio.TaskGroup`. | standard-only | `await asyncio.gather(*tasks)` |
| `PYT-ASYNC-02` | Blocking I/O (`requests`, `time.sleep`, sync file/DB) called inside a coroutine. | ruff:ASYNC210,ASYNC212,ASYNC220,ASYNC221,ASYNC222,ASYNC230,ASYNC240,ASYNC250,ASYNC251 (partial) | `async def fetch(): return requests.get(url).json()` |
| `PYT-ASYNC-03` | `asyncio.CancelledError` caught without re-raise. | standard-only | `except asyncio.CancelledError: await sink.flush()` (no `raise`) |
| `PYT-ASYNC-04` | Async resource managed with manual `open`/`close` instead of `async with`. | standard-only | `broker = await connect(); ...; await broker.close()` |
| `PYT-EXCP-01` | Domain error raised without inheriting from a single domain base class. | ruff:TRY002 (partial) | `raise Exception(f"invoice {id} not found")` |
| `PYT-EXCP-02` | `BaseException` caught, or bare `except:` used. | ruff:E722 (partial) | `except BaseException:`; `except:` |
| `PYT-EXCP-03` | `raise NewError(...)` inside `except` without `from exc` / `from None`. | ruff:B904 | `except db.RecordNotFound: raise InvoiceNotFoundError(...)` |
| `PYT-EXCP-04` | Concurrent fan-out code uses plain `except` instead of `ExceptionGroup` / `except*`. | ruff:B029 (partial) | `async with TaskGroup(): ...; except TimeoutError:` |
| `PYT-EXCP-05` | Exception message lacks identifying context (record id, tenant, operation). | standard-only | `raise InvoiceNotFoundError("not found")` |
| `PYT-MODL-01` | Distributable package placed at repo root instead of `src/<package>/`. | standard-only | `myproject/myproject/__init__.py` (no `src/`) |
| `PYT-MODL-02` | `__init__.py` contains logic or side effects beyond imports, `__all__`, and docstring. | standard-only | `logging.basicConfig(...)` or network call inside `__init__.py` |
| `PYT-MODL-03` | Module holds multiple unrelated public symbols (`utils.py`, `helpers.py`, `common.py`). | standard-only | `utils.py` with `slugify`, `parse_iso_date`, `EmailClient`, `CacheWrapper` |
| `PYT-MODL-04` | Package directory missing `__init__.py` (implicit namespace package). | ruff:INP001 | `src/myproject/api/routes.py` without `src/myproject/api/__init__.py` |
| `PYT-NAME-01` | `camelCase`/`PascalCase` used for a function, method, variable, parameter, or module filename. | ruff:N802,N803,N806,N816 | `def createUser(fullName)`; `UserService.py` module filename |
| `PYT-NAME-02` | `snake_case` used for a class, `Protocol`, PEP 695 `type` alias, or `TypeVar`; or exception name does not end in `Error`. | ruff:N801,N818 | `class invoice_service:`; `type user_id = str`; `class PaymentDeclined(Exception)` |
| `PYT-NAME-03` | `UPPER_SNAKE_CASE` used outside of module-level constants and enum members. | standard-only | `class Status(Enum): active = "active"`; `REQUEST_COUNTER += 1` |
| `PYT-NAME-04` | Double-underscore (`__attr`) used for privacy outside mixin/collision scenarios, or a custom dunder invented. | standard-only | `self.__repo = repo` for plain internal state; `def __my_init__(self)` |

## Review Signals Legend

- **ruff:CODE** — ruff detects the violation under the listed rule code(s); lint catches it mechanically.
- **ruff:CODE (partial)** — ruff flags a subset of cases; the remaining cases (architectural intent, runtime paths, policy decisions) require reviewer judgement.
- **standard-only** — no tool coverage; the rule is enforced exclusively in code review against this standard.
