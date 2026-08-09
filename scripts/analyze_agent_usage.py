#!/usr/bin/env python3
"""Analyze Claude Code JSONL transcripts to produce agent-usage statistics."""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator


BUILTIN_PLUGIN = "built-in"


@dataclass
class Invocation:
    canonical_id: str
    plugin: str
    agent: str
    timestamp: datetime | None
    session_id: str
    source_file: str


@dataclass
class AgentTally:
    canonical_id: str
    plugin: str
    count: int = 0
    earliest: datetime | None = None
    latest: datetime | None = None
    sessions: set[str] = field(default_factory=set)


@dataclass
class Stats:
    files_scanned: int
    sessions: set[str]
    total_invocations: int
    range_from: datetime | None
    range_to: datetime | None
    tallies: dict[str, AgentTally]
    defined_agents: dict[str, dict]


def discover_plugin_agents(plugins_dir: Path) -> dict[str, dict]:
    """Discover distributed plugins/*/agents/* metadata."""
    result: dict[str, dict] = {}
    if not plugins_dir.is_dir():
        return result
    for plugin_path in sorted(plugins_dir.iterdir()):
        if not plugin_path.is_dir():
            continue
        agents_dir = plugin_path / "agents"
        if not agents_dir.is_dir():
            continue
        for metadata_path in sorted(agents_dir.glob("*/frontmatter/meta.json")):
            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            name = metadata.get("name") if isinstance(metadata, dict) else None
            if not isinstance(name, str) or not name:
                continue
            canonical_id = f"{plugin_path.name}:{name}"
            result[canonical_id] = {
                "plugin": plugin_path.name,
                "agent": name,
                "path": str(metadata_path),
            }
    return result


def _parse_timestamp(raw: str | None) -> datetime | None:
    if not raw or not isinstance(raw, str):
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _iter_tool_uses(message: dict) -> Iterator[dict]:
    content = message.get("content")
    if not isinstance(content, list):
        return
    for entry in content:
        if not isinstance(entry, dict):
            continue
        if entry.get("type") != "tool_use":
            continue
        if entry.get("name") not in {"Agent", "Task"}:
            continue
        yield entry


def _extract_invocation(record: dict, file_path: Path) -> Iterator[Invocation]:
    message = record.get("message")
    if not isinstance(message, dict):
        return
    top_ts = record.get("timestamp")
    msg_ts = message.get("timestamp")
    timestamp = _parse_timestamp(top_ts) or _parse_timestamp(msg_ts)
    session_id = file_path.stem
    for tool_use in _iter_tool_uses(message):
        tool_input = tool_use.get("input")
        if not isinstance(tool_input, dict):
            continue
        subagent = tool_input.get("subagent_type")
        if not isinstance(subagent, str) or not subagent:
            continue
        plugin, agent = _split_canonical(subagent)
        yield Invocation(
            canonical_id=subagent,
            plugin=plugin,
            agent=agent,
            timestamp=timestamp,
            session_id=session_id,
            source_file=str(file_path),
        )


def _split_canonical(canonical_id: str) -> tuple[str, str]:
    if ":" in canonical_id:
        plugin, agent = canonical_id.split(":", 1)
        return plugin, agent
    return BUILTIN_PLUGIN, canonical_id


def scan_transcripts(projects_dir: Path) -> Iterator[Invocation]:
    """Yield Invocation rows from every .jsonl file under projects_dir."""
    if not projects_dir.is_dir():
        return
    for jsonl_path in projects_dir.rglob("*.jsonl"):
        try:
            with jsonl_path.open("r", encoding="utf-8", errors="replace") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        record = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if not isinstance(record, dict):
                        continue
                    yield from _extract_invocation(record, jsonl_path)
        except OSError:
            continue


def _count_files(projects_dir: Path) -> int:
    if not projects_dir.is_dir():
        return 0
    return sum(1 for _ in projects_dir.rglob("*.jsonl"))


def tally(invocations: Iterable[Invocation], defined_agents: dict[str, dict], files_scanned: int) -> Stats:
    tallies: dict[str, AgentTally] = {}
    ids_by_name: dict[str, list[str]] = {}
    for canonical_id, definition in defined_agents.items():
        ids_by_name.setdefault(definition["agent"], []).append(canonical_id)
    unique_ids_by_name = {
        name: canonical_ids[0]
        for name, canonical_ids in ids_by_name.items()
        if len(canonical_ids) == 1
    }
    sessions: set[str] = set()
    range_from: datetime | None = None
    range_to: datetime | None = None
    total = 0
    for inv in invocations:
        canonical_id = inv.canonical_id
        plugin = inv.plugin
        if plugin == BUILTIN_PLUGIN and inv.agent in unique_ids_by_name:
            canonical_id = unique_ids_by_name[inv.agent]
            plugin = defined_agents[canonical_id]["plugin"]
        total += 1
        sessions.add(inv.session_id)
        bucket = tallies.get(canonical_id)
        if bucket is None:
            bucket = AgentTally(canonical_id=canonical_id, plugin=plugin)
            tallies[canonical_id] = bucket
        bucket.count += 1
        bucket.sessions.add(inv.session_id)
        if inv.timestamp is not None:
            if bucket.earliest is None or inv.timestamp < bucket.earliest:
                bucket.earliest = inv.timestamp
            if bucket.latest is None or inv.timestamp > bucket.latest:
                bucket.latest = inv.timestamp
            if range_from is None or inv.timestamp < range_from:
                range_from = inv.timestamp
            if range_to is None or inv.timestamp > range_to:
                range_to = inv.timestamp
    return Stats(
        files_scanned=files_scanned,
        sessions=sessions,
        total_invocations=total,
        range_from=range_from,
        range_to=range_to,
        tallies=tallies,
        defined_agents=defined_agents,
    )


def _sorted_top(tallies: dict[str, AgentTally], top_n: int) -> list[AgentTally]:
    items = sorted(tallies.values(), key=lambda t: (-t.count, t.canonical_id))
    return items[:top_n]


def _per_plugin(tallies: dict[str, AgentTally], total: int) -> list[tuple[str, int, float]]:
    plugin_counts: dict[str, int] = {}
    for bucket in tallies.values():
        plugin_counts[bucket.plugin] = plugin_counts.get(bucket.plugin, 0) + bucket.count
    rows = [
        (plugin, count, (count / total) if total else 0.0)
        for plugin, count in plugin_counts.items()
    ]
    rows.sort(key=lambda row: (-row[1], row[0]))
    return rows


def _low_usage_plugin_agents(stats: Stats, threshold: int) -> list[tuple[str, int]]:
    rows: list[tuple[str, int]] = []
    for cid in stats.defined_agents:
        bucket = stats.tallies.get(cid)
        count = bucket.count if bucket is not None else 0
        if count <= threshold:
            rows.append((cid, count))
    rows.sort(key=lambda row: (row[1], row[0]))
    return rows


def _builtin_table(tallies: dict[str, AgentTally]) -> list[AgentTally]:
    builtins = [bucket for bucket in tallies.values() if bucket.plugin == BUILTIN_PLUGIN]
    builtins.sort(key=lambda t: (-t.count, t.canonical_id))
    return builtins


def _format_date(ts: datetime | None) -> str:
    if ts is None:
        return "-"
    return ts.astimezone(timezone.utc).strftime("%Y-%m-%d")


def _format_iso(ts: datetime | None) -> str:
    if ts is None:
        return "-"
    return ts.astimezone(timezone.utc).isoformat()


def format_human(stats: Stats, top_n: int, low_usage_threshold: int) -> str:
    lines: list[str] = []
    lines.append("Agent usage analysis")
    lines.append("=" * 60)
    lines.append(f"Files scanned:      {stats.files_scanned}")
    lines.append(f"Unique sessions:    {len(stats.sessions)}")
    lines.append(f"Total invocations:  {stats.total_invocations}")
    lines.append(f"Date range:         {_format_iso(stats.range_from)} -> {_format_iso(stats.range_to)}")
    lines.append("")

    lines.append(f"Top {top_n} agents (by invocation count)")
    lines.append("-" * 60)
    lines.append(f"{'#':>3}  {'agent':<48} {'count':>6}  {'share':>7}  {'last used':<10}")
    for idx, bucket in enumerate(_sorted_top(stats.tallies, top_n), start=1):
        share_pct = (bucket.count / stats.total_invocations * 100) if stats.total_invocations else 0.0
        lines.append(
            f"{idx:>3}  {bucket.canonical_id:<48} {bucket.count:>6}  {share_pct:>6.2f}%  {_format_date(bucket.latest):<10}"
        )
    lines.append("")

    lines.append("Per-plugin totals")
    lines.append("-" * 60)
    lines.append(f"{'plugin':<24} {'count':>8}  {'share':>7}")
    for plugin, count, share in _per_plugin(stats.tallies, stats.total_invocations):
        lines.append(f"{plugin:<24} {count:>8}  {share * 100:>6.2f}%")
    lines.append("")

    low_usage = _low_usage_plugin_agents(stats, low_usage_threshold)
    lines.append(f"Low-usage plugin agents (count <= {low_usage_threshold}) ({len(low_usage)})")
    lines.append("-" * 60)
    if low_usage:
        lines.append(f"{'agent':<48} {'count':>6}  {'share':>7}")
        for cid, count in low_usage:
            share_pct = (count / stats.total_invocations * 100) if stats.total_invocations else 0.0
            lines.append(f"{cid:<48} {count:>6}  {share_pct:>6.2f}%")
    else:
        lines.append("  (none)")
    lines.append("")

    builtins = _builtin_table(stats.tallies)
    lines.append(f"Built-in (non-plugin) agents ({len(builtins)})")
    lines.append("-" * 60)
    lines.append(f"{'agent':<32} {'count':>8}")
    for bucket in builtins:
        lines.append(f"{bucket.canonical_id:<32} {bucket.count:>8}")
    return "\n".join(lines) + "\n"


def format_json(stats: Stats, top_n: int, low_usage_threshold: int) -> str:
    total = stats.total_invocations
    payload = {
        "scanned": {
            "files": stats.files_scanned,
            "sessions": len(stats.sessions),
            "invocations": stats.total_invocations,
            "from": _format_iso(stats.range_from) if stats.range_from else None,
            "to": _format_iso(stats.range_to) if stats.range_to else None,
            "low_usage_threshold": low_usage_threshold,
        },
        "top": [
            {
                "rank": idx,
                "id": bucket.canonical_id,
                "count": bucket.count,
                "share": round((bucket.count / total) if total else 0.0, 6),
                "last_used": _format_date(bucket.latest) if bucket.latest else None,
            }
            for idx, bucket in enumerate(_sorted_top(stats.tallies, top_n), start=1)
        ],
        "per_plugin": [
            {"plugin": plugin, "count": count, "share": round(share, 6)}
            for plugin, count, share in _per_plugin(stats.tallies, stats.total_invocations)
        ],
        "low_usage": [
            {"id": cid, "count": count, "share": round((count / total) if total else 0.0, 6)}
            for cid, count in _low_usage_plugin_agents(stats, low_usage_threshold)
        ],
        "builtin": [
            {"id": bucket.canonical_id, "count": bucket.count}
            for bucket in _builtin_table(stats.tallies)
        ],
    }
    return json.dumps(payload, indent=2, sort_keys=False)


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze Claude Code agent usage from JSONL transcripts.")
    parser.add_argument("--top", type=int, default=15, help="Number of top agents to display (default: 15)")
    parser.add_argument(
        "--projects",
        type=str,
        default="~/.claude/projects",
        help="Directory containing JSONL transcripts (default: ~/.claude/projects)",
    )
    parser.add_argument(
        "--plugins",
        type=str,
        default=str(Path(__file__).resolve().parents[1] / "plugins"),
        help="Directory containing plugin definitions (defaults to this repository's plugins)",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of human-readable tables")
    parser.add_argument(
        "--show-unused-agents",
        type=int,
        default=10,
        help="Threshold N for the low-usage plugin agents section; lists agents with count <= N (default: 10)",
    )
    return parser.parse_args(argv)


def main() -> None:
    args = _parse_args()
    projects_dir = Path(os.path.expanduser(args.projects))
    plugins_dir = Path(os.path.expanduser(args.plugins))

    defined_agents = discover_plugin_agents(plugins_dir)
    files_scanned = _count_files(projects_dir)
    stats = tally(scan_transcripts(projects_dir), defined_agents, files_scanned)

    if args.json:
        sys.stdout.write(format_json(stats, args.top, args.show_unused_agents) + "\n")
    else:
        sys.stdout.write(format_human(stats, args.top, args.show_unused_agents))


if __name__ == "__main__":
    main()
