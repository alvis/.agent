# PYT-IMPT-01: Absolute Imports Across Packages

**Tool Coverage:** ruff:TID252

## Intent

Use absolute imports for any cross-package reference. Same-package relative imports (`from . import sibling`) are acceptable; cross-package relative imports (`from ..other_pkg import x`) are forbidden because they silently break when files or packages move, and they hide the real module path from readers and refactor tools.

## Fix

```python
# ✅ GOOD: absolute import across packages
from myapp.services.billing import InvoiceService
from myapp.utils.text import slugify

# ✅ GOOD: same-package relative (sibling module)
from . import models
from .helpers import normalize

# ❌ BAD: cross-package relative traversal
from ..billing import InvoiceService
from ...utils.text import slugify
```

### Why Absolute Beats Parent-Relative

Parent-relative imports (`..`, `...`) couple the module to its *position* in the tree. Moving `myapp/api/v1/users.py` to `myapp/api/v2/users.py` silently rewrites what `..billing` means. Absolute paths encode the true identity of the dependency and fail loudly if the target moves.

## Edge Cases

- Single-dot relative imports within the same package (`from . import x`, `from .sibling import y`) are allowed — they keep intra-package cohesion visible without brittle traversal.
- Scripts executed directly (`python script.py`) cannot use relative imports at all; use absolute imports or run as a module (`python -m pkg.script`).
- Test files that mirror the package layout follow the same rule: absolute imports to production code, same-package relative only between test helpers.

## Related

PYT-IMPT-02, PYT-IMPT-04, PYT-MODL-02
