"""Violation: public package re-exports but declares no __all__."""

# the future import and bare stdlib import below are NOT re-exports — the
# scanner must skip them and anchor on the genuine `from ... import` line.
from __future__ import annotations

import os

from violating_pkg.billing import InvoiceService
from violating_pkg.users import UserService

CONFIG_PATH = os.getenv("CONFIG_PATH", "config.toml")
