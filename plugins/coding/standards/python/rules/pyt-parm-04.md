# PYT-PARM-04: Max Five Parameters, Then Bundle

**Tool Coverage:** ruff:PLR0913

## Intent

A function signature may have at most **five parameters** (excluding `self` / `cls`). Beyond that, bundle related arguments into a `@dataclass(frozen=True, slots=True)` request/config object. Long signatures hurt call-site readability, make test setup tedious, and turn every new option into a positional-reshuffling breaking change. A dataclass gives you names, defaults, validation hooks, and immutability for free.

## Fix

```python
# ✅ GOOD: bundle a request object once signatures grow
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class DeployRequest:
    service: str
    version: str
    environment: str
    dry_run: bool = False
    verbose: bool = False
    max_retries: int = 3
    timeout_seconds: int = 30

def deploy(request: DeployRequest) -> DeployResult:
    ...

deploy(DeployRequest(
    service="billing",
    version="2.3.1",
    environment="staging",
    dry_run=True,
))
```

```python
# ❌ BAD: seven-parameter signature, every new option shifts positions
def deploy(
    service: str,
    version: str,
    environment: str,
    dry_run: bool,
    verbose: bool,
    max_retries: int,
    timeout_seconds: int,
) -> DeployResult:
    ...
```

### Why `frozen=True, slots=True`

- `frozen=True` prevents accidental mutation of a request mid-call — the object represents intent, not state.
- `slots=True` eliminates the per-instance `__dict__`, cutting memory and speeding attribute access.
- Together they give you a type-safe, hashable, immutable value object.

## Edge Cases

- Methods count `self` / `cls` as parameter zero; the five-parameter budget applies to the remaining arguments.
- `*args` / `**kwargs` each count as one parameter; if you need both plus three named args you are already at the limit.
- Closely related parameters (e.g., `host`, `port`, `username`, `password` → `ConnectionConfig`) often want bundling well before hitting five — use judgment.

## Related

PYT-PARM-01, PYT-TYPE-02, PYT-CORE-05
