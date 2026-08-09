# PYT-IMPT-03: Never Use `from __future__ import annotations`

**Tool Coverage:** standard-only

## Intent

`from __future__ import annotations` is **forbidden** in this codebase. It makes every annotation a string at runtime (PEP 563), which silently breaks the tools we rely on: `dataclasses.fields(...).type` returns strings, Pydantic cannot resolve forward references without extra `model_rebuild()` plumbing, `typing.get_type_hints()` requires the exact globals of the defining module, and `ty`'s flow-sensitive inference degrades on stringified forms. Python 3.13 already supports PEP 604 unions (`X | Y`) and PEP 585 generics (`list[int]`) without the future import — we gain nothing and lose runtime introspection.

## Fix

```python
# ✅ GOOD: real runtime annotations on 3.13+
from dataclasses import dataclass, fields

@dataclass(frozen=True, slots=True)
class Invoice:
    id: str
    amount: int | None = None

# runtime introspection works: fields(Invoice)[1].type is `int | None`, not a string
```

```python
# ❌ BAD: stringifies every annotation, breaks dataclass/Pydantic/get_type_hints
from __future__ import annotations

from dataclasses import dataclass

@dataclass
class Invoice:
    id: str
    amount: int | None = None  # runtime type is now the string "int | None"
```

### Why Tooling Cannot Catch This

Ruff actually ships the opposite rules (`FA100`, `FA102`) that *suggest adding* `from __future__ import annotations`. No linter flags its presence as wrong, because most codebases welcome it. Our policy is project-specific — enforcement lives here, in review, and (optionally) in a grep-based pre-commit hook (`grep -r "from __future__ import annotations" src/`).

## Edge Cases

- For genuine forward references (a class referring to itself or a later class), quote the single annotation (`list["Node"]`) or use `typing.Self` (see PYT-CORE-04). Do not reach for the future import.
- Do not configure ruff `FA100`/`FA102`; they push the wrong direction for this project. Disable them explicitly in `ruff.toml` if your preset enables them.

## Related

PYT-CORE-04, PYT-CORE-05, PYT-TYPE-02
