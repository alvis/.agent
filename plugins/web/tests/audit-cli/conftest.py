"""Shared pytest config — make the CLI package importable from tests/."""

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2] / "scripts/audit-cli"
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
