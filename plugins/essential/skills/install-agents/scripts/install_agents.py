#!/usr/bin/env python3
"""Discover, preflight, stitch, and install enabled plugin agent templates."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from stitch_agent import (
    LEAD_AGENT_DIRECTION_ALIAS,
    LEAD_AGENT_DIRECTION_PATH,
    AgentTemplateError,
    load_agent_sources,
    stitch_agent_definition,
    stitch_codex_agent_definition,
)

CACHE_COMPONENT = re.compile(r"^[A-Za-z0-9._-]+$")
# NOTE: Versions additionally admit "+" because SemVer build metadata is
# path-safe and part of the repository's accepted plugin-version contract.
CACHE_VERSION_COMPONENT = re.compile(r"^[A-Za-z0-9._+-]+$")


@dataclass(frozen=True)
class AgentTemplate:
    owner: str
    name: str
    path: Path


def _plugin_templates(owner: str, plugin_root: Path) -> Iterable[AgentTemplate]:
    templates_root = plugin_root / "agents"
    if not templates_root.is_dir():
        return
    resolved_plugin_root = plugin_root.resolve()
    for path in sorted(templates_root.iterdir()):
        if path.is_dir():
            try:
                path.resolve().relative_to(resolved_plugin_root)
            except ValueError as error:
                raise AgentTemplateError(
                    f"template symlink or path escapes plugin root: {path}"
                ) from error
            yield AgentTemplate(owner=owner, name=path.name, path=path)


def _read_plugin_records(harness: str) -> list[dict[str, Any]]:
    command = (
        ["claude", "plugin", "list", "--json"]
        if harness == "claude"
        else ["codex", "plugin", "list", "--json"]
    )
    installed_label = "" if harness == "claude" else "codex "
    try:
        completed = subprocess.run(
            command,
            text=True,
            capture_output=True,
            check=False,
        )
    except OSError as error:
        raise AgentTemplateError(
            f"cannot list installed {installed_label}plugins: {error}"
        ) from error
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip()
        raise AgentTemplateError(
            f"cannot list installed {installed_label}plugins: {detail}"
        )
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise AgentTemplateError(
            f"invalid JSON from {harness} plugin list: {error}"
        ) from error
    if harness == "claude":
        if not isinstance(payload, list):
            raise AgentTemplateError(
                "claude plugin list --json did not return a list"
            )
        records = payload
    else:
        installed = payload.get("installed") if isinstance(payload, dict) else None
        if not isinstance(installed, list):
            raise AgentTemplateError(
                "codex plugin list --json did not return an installed list"
            )
        records = [
            {
                "id": record.get("pluginId"),
                "enabled": record.get("enabled"),
                "version": record.get("version"),
                "lastUpdated": record.get("lastUpdated"),
            }
            for record in installed
            if isinstance(record, dict)
        ]
    return [record for record in records if isinstance(record, dict)]


def _last_updated(record: dict[str, Any]) -> str:
    value = record.get("lastUpdated")
    return value if isinstance(value, str) else ""


def _codex_cache_plugin_root(
    essential_root: Path,
    record: dict[str, Any],
) -> Path:
    plugin_id = record.get("id")
    version = record.get("version")
    if not isinstance(plugin_id, str) or plugin_id.count("@") != 1:
        raise AgentTemplateError(f"invalid installed Codex plugin id: {plugin_id!r}")
    plugin_name, marketplace = plugin_id.split("@", 1)
    if (
        not isinstance(version, str)
        or plugin_name in {".", ".."}
        or marketplace in {".", ".."}
        or version in {".", ".."}
        or not CACHE_COMPONENT.fullmatch(plugin_name)
        or not CACHE_COMPONENT.fullmatch(marketplace)
        or not CACHE_VERSION_COMPONENT.fullmatch(version)
    ):
        raise AgentTemplateError(
            f"invalid installed Codex plugin cache coordinates: {plugin_id!r} "
            f"version {version!r}"
        )
    cache_root = essential_root.parent.parent.parent
    candidate = cache_root / marketplace / plugin_name / version
    try:
        resolved = candidate.resolve().relative_to(cache_root.resolve())
    except ValueError as error:
        raise AgentTemplateError(
            f"installed Codex plugin cache path escapes cache root: {candidate}"
        ) from error
    installed_root = cache_root / resolved
    if not installed_root.is_dir():
        raise AgentTemplateError(
            f"installed Codex plugin cache root is absent: {installed_root}"
        )
    return installed_root


def _installed_plugin_roots(
    essential_root: Path,
    records: list[dict[str, Any]],
    harness: str,
    include_marketplaces: Iterable[str] = (),
) -> list[tuple[str, Path]]:
    resolved_essential = essential_root.resolve()
    if harness == "codex":
        if (
            essential_root.parent.name != "essential"
            or essential_root.parent.parent.parent.name != "cache"
        ):
            raise AgentTemplateError(
                f"Codex skill is not loaded from an installed plugin cache: "
                f"{essential_root}"
            )
        cache_marketplace = essential_root.parent.parent.name
        essential_records = [
            record
            for record in records
            if record.get("enabled") is True
            and isinstance(record.get("id"), str)
            and record["id"].count("@") == 1
            and record["id"].split("@", 1)[0] == "essential"
            and record["id"].rsplit("@", 1)[1] == cache_marketplace
            and _codex_cache_plugin_root(essential_root, record).resolve()
            == resolved_essential
        ]
    else:
        essential_records = [
            record
            for record in records
            if isinstance(record.get("installPath"), str)
            and Path(record["installPath"]).resolve() == resolved_essential
            and isinstance(record.get("id"), str)
            and record["id"].count("@") == 1
            and record["id"].split("@", 1)[0] == "essential"
        ]
    if not essential_records:
        raise AgentTemplateError(
            f"essential plugin is absent from {harness} plugin list: {essential_root}"
        )
    if len(essential_records) != 1:
        raise AgentTemplateError(
            f"multiple essential plugin records use install path: {essential_root}"
        )
    essential_record = essential_records[0]
    essential_id = essential_record["id"]
    if "@" not in essential_id:
        raise AgentTemplateError(f"installed plugin id has no marketplace: {essential_id}")
    marketplace = essential_id.rsplit("@", 1)[1]
    if not marketplace:
        raise AgentTemplateError(f"installed plugin id has no marketplace: {essential_id}")
    marketplaces = {marketplace}
    for included in include_marketplaces:
        if (
            included in {".", ".."}
            or not CACHE_COMPONENT.fullmatch(included)
        ):
            raise AgentTemplateError(
                f"invalid included marketplace name: {included!r}"
            )
        marketplaces.add(included)
    best_by_id: dict[str, dict[str, Any]] = {}
    for record in records:
        plugin_id = record.get("id")
        install_path = record.get("installPath")
        if (
            record.get("enabled") is not True
            or not isinstance(plugin_id, str)
            or "@" not in plugin_id
            or (harness != "codex" and not isinstance(install_path, str))
        ):
            continue
        record_marketplace = plugin_id.rsplit("@", 1)[1]
        if record_marketplace not in marketplaces:
            continue
        current = best_by_id.get(plugin_id)
        if current is None or _last_updated(record) > _last_updated(current):
            best_by_id[plugin_id] = record

    roots = sorted(
        (
            (
                plugin_id.rsplit("@", 1)[0],
                (
                    _codex_cache_plugin_root(essential_root, record)
                    if harness == "codex"
                    else Path(record["installPath"])
                ),
            )
            for plugin_id, record in best_by_id.items()
        ),
        key=lambda item: item[0],
    )
    return roots


def discover_agent_templates(
    essential_root: Path,
    plugin_records: list[dict[str, Any]] | None = None,
    harness: str = "claude",
    include_marketplaces: Iterable[str] = (),
) -> list[AgentTemplate]:
    """Discover source siblings or explicitly trusted enabled installs."""
    essential_root = Path(essential_root)
    if essential_root.parent.name == "plugins":
        roots = [
            (path.name, path)
            for path in sorted(essential_root.parent.iterdir())
            if path.is_dir()
        ]
    else:
        roots = _installed_plugin_roots(
            essential_root,
            (
                plugin_records
                if plugin_records is not None
                else _read_plugin_records(harness)
            ),
            harness,
            include_marketplaces,
        )
    return [
        template
        for owner, plugin_root in roots
        for template in _plugin_templates(owner, plugin_root)
    ]


def _preflight(
    templates: list[AgentTemplate],
    harness: str,
    *,
    essential_root: Path,
    reference_root: Path,
    allow_legacy: bool,
) -> list[tuple[str, str]]:
    if not templates:
        raise AgentTemplateError("no agent templates discovered")
    seen: dict[str, AgentTemplate] = {}
    staged: list[tuple[str, str]] = []
    for template in templates:
        sources = load_agent_sources(template.path, allow_legacy=allow_legacy)
        name = sources.metadata["name"]
        previous = seen.get(name)
        if previous is not None:
            raise AgentTemplateError(
                f"duplicate agent name {name!r}: {previous.path} and {template.path}"
            )
        seen[name] = template
        content = (
            stitch_agent_definition(
                template.path,
                essential_root=essential_root,
                reference_root=reference_root,
                allow_legacy=allow_legacy,
            )
            if harness == "claude"
            else stitch_codex_agent_definition(
                template.path,
                essential_root=essential_root,
                reference_root=reference_root,
                allow_legacy=allow_legacy,
            )
        )
        staged.append((name, content))
    return staged


def _replace_file(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        dir=target.parent,
        prefix=f".{target.name}.",
        suffix=".tmp",
        delete=False,
    ) as temporary_file:
        temporary_path = Path(temporary_file.name)
    try:
        shutil.copy2(source, temporary_path)
        os.replace(temporary_path, target)
    finally:
        temporary_path.unlink(missing_ok=True)


def install_agents(
    essential_root: Path,
    destination: Path,
    plugin_records: list[dict[str, Any]] | None = None,
    harness: str = "claude",
    include_marketplaces: Iterable[str] = (),
) -> int:
    """Install every discovered template after a complete roster preflight."""
    essential_root = Path(essential_root).resolve()
    templates = discover_agent_templates(
        essential_root,
        plugin_records,
        harness,
        include_marketplaces,
    )
    installs_lead_direction = any(
        LEAD_AGENT_DIRECTION_ALIAS
        in (template.path / "base.md").read_text(encoding="utf-8")
        for template in templates
    )
    source_direction = essential_root / LEAD_AGENT_DIRECTION_PATH
    if installs_lead_direction and not source_direction.is_file():
        raise AgentTemplateError(f"missing Essential lead direction: {source_direction}")
    destination = Path(destination)
    installed_essential_root = (destination / ".essential").resolve()
    staged_definitions = _preflight(
        templates,
        harness,
        essential_root=essential_root,
        reference_root=installed_essential_root,
        allow_legacy=essential_root.parent.name != "plugins",
    )
    suffix = ".md" if harness == "claude" else ".toml"
    with tempfile.TemporaryDirectory(prefix=f"{harness}-agents-") as temporary:
        stage = Path(temporary)
        staged_direction = stage / LEAD_AGENT_DIRECTION_PATH
        if installs_lead_direction:
            staged_direction.parent.mkdir(parents=True)
            shutil.copy2(source_direction, staged_direction)
        for name, content in staged_definitions:
            (stage / f"{name}{suffix}").write_text(content, encoding="utf-8")
        destination.mkdir(parents=True, exist_ok=True)
        if installs_lead_direction:
            installed_direction = installed_essential_root / LEAD_AGENT_DIRECTION_PATH
            _replace_file(staged_direction, installed_direction)
            print(f"installed: {installed_direction}")
        for name, _ in staged_definitions:
            target = destination / f"{name}{suffix}"
            _replace_file(stage / target.name, target)
            print(f"installed: {target}")
    print(f"done — installed {len(staged_definitions)} agent(s) into {destination}")
    return len(staged_definitions)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--plugin-root",
        type=Path,
        default=Path(__file__).resolve().parents[3],
    )
    parser.add_argument(
        "--harness",
        choices=("claude", "codex"),
        default="claude",
    )
    parser.add_argument(
        "--destination",
        type=Path,
    )
    parser.add_argument(
        "--include-marketplace",
        action="append",
        default=[],
        help="also discover enabled agent templates from this trusted marketplace",
    )
    args = parser.parse_args()
    if args.destination is not None:
        destination = args.destination
    elif args.harness == "codex":
        destination = Path(
            os.environ.get("CODEX_HOME", Path.home() / ".codex")
        ) / "agents"
    else:
        destination = Path.home() / ".claude/agents"
    try:
        install_agents(
            args.plugin_root,
            destination,
            harness=args.harness,
            include_marketplaces=args.include_marketplace,
        )
    except AgentTemplateError as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
