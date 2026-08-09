"""Serialise a ``Report`` to ``report.json`` and manage crop assets."""

from __future__ import annotations

import dataclasses
import json
import shutil
from pathlib import Path
from typing import Any, Mapping

from audit_cli.types import Report


def write_report(report: Report, out_dir: Path) -> Path:
    """Write ``report.json`` under ``out_dir`` and return its path."""
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "crops").mkdir(parents=True, exist_ok=True)
    payload = report_to_dict(report)
    target = out_dir / "report.json"
    target.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return target


def report_to_dict(report: Report) -> dict[str, Any]:
    """Return a JSON-safe dict representation of the report."""
    raw = dataclasses.asdict(report)
    pruned = _prune_none(raw)
    if isinstance(pruned, dict):
        return pruned
    raise TypeError("report pruning yielded a non-dict top-level value")


def copy_crop(source: Path, out_dir: Path, *, name: str) -> Path:
    """Copy a crop into ``<out_dir>/crops/<name>`` and return the new path."""
    crops_dir = out_dir / "crops"
    crops_dir.mkdir(parents=True, exist_ok=True)
    target = crops_dir / name
    shutil.copyfile(source, target)
    return target


def _prune_none(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _prune_none(v) for k, v in value.items() if v is not None}
    if isinstance(value, list):
        return [_prune_none(item) for item in value]
    if isinstance(value, tuple):
        return [_prune_none(item) for item in value]
    return value


def load_report(path: Path) -> Mapping[str, Any]:
    """Parse a previously emitted ``report.json`` back into a mapping."""
    raw = path.read_text(encoding="utf-8")
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError(f"report.json at {path} is not an object")
    return parsed
