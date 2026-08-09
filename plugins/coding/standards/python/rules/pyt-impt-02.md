# PYT-IMPT-02: Import Group Ordering

**Tool Coverage:** ruff:I001

## Intent

Import blocks are ordered in four groups separated by a single blank line: standard library → third-party → first-party (this project's packages) → local (same-package relative). Within each group, sort alphabetically. This matches `isort` / `ruff` conventions and keeps diffs stable.

## Fix

```python
# ✅ GOOD: four groups, blank line between each
import json
from pathlib import Path

import httpx
from pydantic import BaseModel

from myapp.config import Settings
from myapp.services.billing import InvoiceService

from .helpers import normalize
from .models import Invoice
```

### Group Definitions

1. **Standard library** — `json`, `pathlib`, `asyncio`, `typing`, `collections`, …
2. **Third-party** — anything installed from PyPI (`httpx`, `pydantic`, `pytest`, …)
3. **First-party** — modules inside this project's top-level package(s)
4. **Local** — same-package relative imports (`from . import …`, `from .sub import …`)

```python
# ❌ BAD: groups not separated, order mixed
import httpx
from myapp.config import Settings
import json
from .helpers import normalize
from pydantic import BaseModel
```

## Edge Cases

- `__future__` imports are forbidden entirely (see PYT-IMPT-03) — there is no "group 0".
- Configure ruff/isort to recognize your project's top-level package(s) so first-party is classified correctly; do not rely on manual sorting.
- Do not add comment labels (`# stdlib`, `# third-party`) above groups — blank-line separation already makes the structure self-evident.

## Related

PYT-IMPT-01, PYT-IMPT-03, PYT-IMPT-04
