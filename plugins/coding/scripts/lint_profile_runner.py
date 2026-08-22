#!/usr/bin/env python3
"""Run the generic lint scanner and optional profile scanners portably."""

import argparse
import fnmatch
import json
import os
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    script_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", type=Path)
    parser.add_argument("--coding-root", type=Path, default=script_dir.parent)
    parser.add_argument(
        "--generic-scanner",
        type=Path,
        default=script_dir / "scan_potential_violations.py",
    )
    parser.add_argument("files", nargs="+")
    return parser.parse_args()


def eligible_files(files: list[str], profile: dict) -> list[str]:
    extensions = tuple(profile.get("eligibility", {}).get("extensions", []))
    exclusions = profile.get("exclusions", [])

    def excluded(file: str) -> bool:
        return any(
            fnmatch.fnmatch(file, pattern)
            or (pattern.startswith("**/") and fnmatch.fnmatch(file, pattern[3:]))
            for pattern in exclusions
        )

    return [
        file
        for file in files
        if (not extensions or file.endswith(extensions)) and not excluded(file)
    ]


def scanner_result(
    command: list[str],
    label: str,
    *,
    env: dict[str, str] | None = None,
) -> tuple[dict, int]:
    result = subprocess.run(
        command, text=True, capture_output=True, env=env, check=False
    )
    run = {"label": label, "args": command[2:], "exit_code": result.returncode}
    lines = result.stdout.splitlines()
    if lines:
        try:
            emitted = json.loads(lines[-1])
            if isinstance(emitted, dict):
                run["output"] = emitted
        except json.JSONDecodeError:
            run["stdout"] = result.stdout
    if result.stderr:
        run["stderr"] = result.stderr
    return run, result.returncode


def failure(message: str) -> int:
    print(
        json.dumps(
            {
                "violations_found_total": 0,
                "status": "failure",
                "report_label": "Coding lint",
                "files": [],
                "standards": [],
                "scanner_runs": [],
                "error": message,
            }
        )
    )
    return 2


def validate_profile(profile_path: Path | None, profile: dict) -> str | None:
    if profile_path is None:
        return None
    if not profile_path.is_absolute():
        return "--profile must be an absolute path"
    if not isinstance(profile, dict):
        return "profile must contain a JSON object"
    eligibility = profile.get("eligibility", {})
    if not isinstance(eligibility, dict) or not isinstance(
        eligibility.get("extensions", []), list
    ):
        return "profile eligibility.extensions must be a list"
    if not isinstance(profile.get("exclusions", []), list):
        return "profile exclusions must be a list"
    if not isinstance(profile.get("standards", []), list):
        return "profile standards must be a list"
    if not isinstance(profile.get("scanners", []), list):
        return "profile scanners must be a list"
    skills_root = next(
        (parent for parent in profile_path.parents if parent.name == "skills"),
        None,
    )
    root = (skills_root.parent if skills_root else profile_path.parents[2]).resolve()
    resource_base = profile_path.parent.resolve()
    for item in profile.get("standards", []):
        if not isinstance(item, str):
            return "profile standards entries must be strings"
        resolved = (resource_base / item).resolve()
        if not resolved.exists() or not resolved.is_dir():
            return f"profile standard does not exist: {item}"
        if root not in resolved.parents and resolved != root:
            return f"profile standard escapes profile root: {item}"
    for item in profile.get("scanners", []):
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            return "profile scanners entries must contain a path"
        resolved = (resource_base / item["path"]).resolve()
        if not resolved.is_file():
            return f"profile scanner does not exist: {item['path']}"
        if root not in resolved.parents and resolved != root:
            return f"profile scanner escapes profile root: {item['path']}"
    return None


def main() -> int:
    args = parse_args()
    profile_path = args.profile.resolve() if args.profile else None
    if args.profile and not args.profile.is_absolute():
        return failure("--profile must be an absolute path")
    if profile_path:
        try:
            profile = json.loads(profile_path.read_text())
        except (OSError, json.JSONDecodeError) as error:
            return failure(f"unable to read profile: {error}")
    else:
        profile = {}
    validation_error = validate_profile(profile_path, profile)
    if validation_error:
        return failure(validation_error)
    files = eligible_files(args.files, profile)
    standards = (
        [
            str((profile_path.parent / item).resolve())
            for item in profile.get("standards", [])
        ]
        if profile_path
        else []
    )
    report = {
        "violations_found_total": 0,
        "status": "compliant",
        "report_label": profile.get("report_label", "Coding lint"),
        "files": files,
        "standards": standards,
        "scanner_runs": [],
    }
    if not files:
        print(json.dumps(report))
        return 0

    common = [*files, "--category", "all", "--before", "5", "--after", "10"]
    command = [sys.executable, str(args.generic_scanner.resolve()), *common]
    scanner_env = os.environ.copy()
    scanner_env["CODING_LINT_STANDARD_ROOTS"] = os.pathsep.join(standards)
    run, exit_code = scanner_result(command, "generic", env=scanner_env)
    report["scanner_runs"].append(run)
    if exit_code:
        report["status"] = "failure"
        print(json.dumps(report))
        return exit_code

    scanner_base = profile_path.parent if profile_path else None
    for scanner in profile.get("scanners", []):
        if scanner_base is None:
            return failure("profile scanner requires --profile")
        scanner_path = (scanner_base / scanner["path"]).resolve()
        command = [sys.executable, str(scanner_path)]
        if scanner.get("needs_coding_scanlib"):
            command.extend(
                ["--scanlib", str(args.coding_root.resolve() / "scripts/scanlib")]
            )
        command.extend(common)
        run, exit_code = scanner_result(command, scanner_path.stem, env=scanner_env)
        report["scanner_runs"].append(run)
        if exit_code:
            report["status"] = "failure"
            print(json.dumps(report))
            return exit_code

    print(json.dumps(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
