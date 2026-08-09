"""Fixture for the py-future-annotations scanner."""

# violation: stringifies every annotation, breaks runtime introspection
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Invoice:
    # compliant: real runtime annotation on 3.13+ — no future import needed
    id: str
    amount: int | None = None
