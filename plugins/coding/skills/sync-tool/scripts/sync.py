#!/usr/bin/env python3
"""sync-tool CLI entry.

Iterates over a registry of coding CLI tools and runs each one's installer
script in order, honoring --only / --check / --dry-run / --force.

Per-tool result is emitted as one line:
    {tool}: {status} ({action})
where status ∈ {installed, updated, already_current, skipped, failed}.

A trailing summary line is always printed:
    summary: N tools — X installed, Y updated, Z already_current, W skipped, V failed

Exit code:
- Default mode: 0 iff every selected tool ended in non-failed status.
- --check mode: 0 iff every selected tool is present and at minimum version
  (or simply present for rolling latest entries).
"""

import argparse
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

# Ensure local imports work whether invoked as a script or module.
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from lib import (  # noqa: E402  (sys.path mutated above)
    OS_DARWIN,
    OS_UNKNOWN,
    detect_os,
    get_version,
    has_executable,
    run,
    status_line,
    version_at_least,
)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ToolEntry:
    """One registered tool: how to find it, install it, and check it."""

    name: str
    installer: str  # filename in scripts/installers/
    min_version: str | None  # minimum acceptable version, or None for rolling latest
    version_args: tuple[str, ...] = ('--version',)
    macos_only: bool = False  # True for brew (mac-only bootstrap)
    executable: str | None = None  # override when the PATH binary differs from name
    # Rolling package targets must reach the package manager so it can resolve latest.
    always_run_installer: bool = False


REGISTRY: tuple[ToolEntry, ...] = (
    ToolEntry(name='brew', installer='brew.sh', min_version='4.0.0', macos_only=True),
    ToolEntry(name='jj', installer='jj.sh', min_version='0.44.0'),
    ToolEntry(name='gh', installer='gh.sh', min_version='2.0.0'),
    ToolEntry(name='fallow', installer='fallow.sh', min_version='2.0.0'),
    ToolEntry(
        name='python',
        installer='python.sh',
        min_version=None,
        executable='python3',
        always_run_installer=True,
    ),
)

REGISTRY_BY_NAME: dict[str, ToolEntry] = {entry.name: entry for entry in REGISTRY}


# ---------------------------------------------------------------------------
# Status accounting
# ---------------------------------------------------------------------------

STATUS_INSTALLED = 'installed'
STATUS_UPDATED = 'updated'
STATUS_ALREADY_CURRENT = 'already_current'
STATUS_SKIPPED = 'skipped'
STATUS_FAILED = 'failed'

_NON_FAILED = {
    STATUS_INSTALLED,
    STATUS_UPDATED,
    STATUS_ALREADY_CURRENT,
    STATUS_SKIPPED,
}


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """Parse CLI flags."""

    parser = argparse.ArgumentParser(
        prog='sync.py',
        description='Install or update registered coding CLI tools.',
    )
    parser.add_argument(
        '--only',
        default=None,
        help='CSV of registered tool names to sync (default: all).',
    )
    parser.add_argument(
        '--check',
        action='store_true',
        help='Status-only mode; non-zero exit if anything is missing or outdated.',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Print planned commands without executing.',
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Reinstall/upgrade even if at minimum version.',
    )
    return parser.parse_args(argv)


def resolve_tool_list(only_csv: str | None) -> list[ToolEntry]:
    """Translate --only CSV (or None) into a list of ToolEntry preserving registry order."""

    if not only_csv:
        return list(REGISTRY)
    requested = {name.strip() for name in only_csv.split(',') if name.strip()}
    unknown = requested - REGISTRY_BY_NAME.keys()
    if unknown:
        raise SystemExit(
            f'sync-tool: unknown tool name(s): {", ".join(sorted(unknown))}. '
            f'Registered: {", ".join(REGISTRY_BY_NAME.keys())}'
        )
    return [entry for entry in REGISTRY if entry.name in requested]


# ---------------------------------------------------------------------------
# Per-tool processing
# ---------------------------------------------------------------------------


def _installer_path(entry: ToolEntry) -> Path:
    return SCRIPT_DIR / 'installers' / entry.installer


def _executable_name(entry: ToolEntry) -> str:
    return entry.executable or entry.name


def check_tool(entry: ToolEntry) -> tuple[str, str]:
    """Return (status, action) for `--check` mode without running the installer."""

    if entry.macos_only and detect_os() != OS_DARWIN:
        return STATUS_SKIPPED, f'{entry.name} not applicable on this OS'

    executable = _executable_name(entry)
    if not has_executable(executable):
        return STATUS_FAILED, f'{executable} missing'

    version_text = get_version(executable, args=entry.version_args)
    if entry.min_version is None:
        return STATUS_ALREADY_CURRENT, f'{executable} present'
    if version_text and version_at_least(version_text, entry.min_version):
        return STATUS_ALREADY_CURRENT, f'version >= {entry.min_version}'
    return (
        STATUS_FAILED,
        f'{executable} below {entry.min_version} (got {version_text or "unknown"})',
    )


def run_installer(entry: ToolEntry, *, dry_run: bool, force: bool) -> tuple[str, str]:
    """Invoke the installer shell script and translate its exit code into a status."""

    if entry.macos_only and detect_os() != OS_DARWIN:
        return STATUS_SKIPPED, f'{entry.name} not applicable on this OS'

    installer = _installer_path(entry)
    if not installer.exists():
        return STATUS_FAILED, f'installer not found: {installer}'

    # Capture pre-state so we can distinguish installed vs updated vs already_current.
    executable = _executable_name(entry)
    had_before = has_executable(executable)
    version_before = (
        get_version(executable, args=entry.version_args) if had_before else None
    )
    if entry.min_version is None:
        at_minimum_before = had_before
    else:
        at_minimum_before = version_before is not None and version_at_least(
            version_before, entry.min_version
        )

    if (
        had_before
        and at_minimum_before
        and not force
        and not entry.always_run_installer
    ):
        return STATUS_ALREADY_CURRENT, 'noop'

    env = {}
    if dry_run:
        env['DRY_RUN'] = '1'
    if force:
        env['FORCE'] = '1'

    result = run(['bash', str(installer)], env=env, capture=False)
    if not result.ok:
        return STATUS_FAILED, f'{entry.installer} exited {result.returncode}'

    if dry_run:
        # Nothing actually happened on disk; report a synthetic action.
        return STATUS_SKIPPED, 'dry-run'

    # Post-state check.
    if not has_executable(executable):
        return STATUS_FAILED, f'{executable} still missing after installer'

    version_after = get_version(executable, args=entry.version_args)
    if (
        entry.min_version is not None
        and version_after
        and not version_at_least(version_after, entry.min_version)
    ):
        return STATUS_FAILED, f'version {version_after} below {entry.min_version}'

    if not had_before:
        return STATUS_INSTALLED, entry.installer
    return STATUS_UPDATED, entry.installer


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def emit_summary(results: list[tuple[str, str, str]]) -> None:
    """Print the trailing `summary: …` line."""

    counts = {
        STATUS_INSTALLED: 0,
        STATUS_UPDATED: 0,
        STATUS_ALREADY_CURRENT: 0,
        STATUS_SKIPPED: 0,
        STATUS_FAILED: 0,
    }
    for _, status, _ in results:
        counts[status] = counts.get(status, 0) + 1
    parts = [f'{count} {label}' for label, count in counts.items() if count]
    body = ', '.join(parts) if parts else '0 processed'
    print(f'summary: {len(results)} tools — {body}')


def main(argv: Sequence[str] | None = None) -> int:
    """Entry point. Returns process exit code."""

    args = parse_args(argv)
    current_os = detect_os()
    if current_os == OS_UNKNOWN:
        print(
            f"sync-tool: unrecognized OS '{os.uname().sysname if hasattr(os, 'uname') else ''}'",
            file=sys.stderr,
        )
        return 2

    try:
        tools = resolve_tool_list(args.only)
    except SystemExit as exc:  # already a usage error
        print(str(exc), file=sys.stderr)
        return 2

    results: list[tuple[str, str, str]] = []  # (tool, status, action)

    for entry in tools:
        if args.check:
            status, action = check_tool(entry)
        else:
            status, action = run_installer(
                entry, dry_run=args.dry_run, force=args.force
            )
        print(status_line(entry.name, status, action), flush=True)
        results.append((entry.name, status, action))

    emit_summary(results)

    if args.check:
        # In check mode, anything not at-minimum (or not skipped) is a failure.
        check_failed = any(
            status not in {STATUS_ALREADY_CURRENT, STATUS_SKIPPED}
            for _, status, _ in results
        )
        return 1 if check_failed else 0

    any_failed = any(status == STATUS_FAILED for _, status, _ in results)
    return 1 if any_failed else 0


if __name__ == '__main__':
    sys.exit(main())
