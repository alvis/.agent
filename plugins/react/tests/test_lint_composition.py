import json
import subprocess
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[3]
PLUGINS = ROOT / "plugins"
RUNNER = PLUGINS / "coding/scripts/lint_profile_runner.py"
PROFILE = PLUGINS / "react/skills/lint/assets/profile.json"


def write_scanner(path: Path, label: str, *, exit_code: int = 0) -> None:
    path.write_text(
        "import json, os, sys\n"
        f"print(json.dumps({{'label': '{label}', 'args': sys.argv[1:]}}))\n"
        f"raise SystemExit({exit_code})\n"
    )


def run_runner(
    root: Path, profile: Path, *files: str
) -> subprocess.CompletedProcess[str]:
    generic = root / "coding/scripts/generic.py"
    scanlib = root / "coding/scripts/scanlib"
    scanlib.mkdir(parents=True)
    write_scanner(generic, "generic")
    command = [
        sys.executable,
        str(RUNNER),
        "--coding-root",
        str(root / "coding"),
        "--generic-scanner",
        str(generic),
        "--profile",
        str(profile),
        *files,
    ]
    return subprocess.run(command, text=True, capture_output=True)


def test_runs_each_scanner_once_in_order_and_resolves_from_installed_roots(
    tmp_path: Path,
) -> None:
    profile_dir = tmp_path / "react/skills/lint"
    scanner = tmp_path / "react/scripts/react.py"
    profile_dir.mkdir(parents=True)
    scanner.parent.mkdir(parents=True)
    (tmp_path / "react/standards/accessibility").mkdir(parents=True)
    (tmp_path / "react/standards/components").mkdir(parents=True)
    (tmp_path / "react/standards/hooks").mkdir(parents=True)
    (tmp_path / "react/standards/project-structure").mkdir(parents=True)
    (tmp_path / "react/standards/storybook").mkdir(parents=True)
    write_scanner(scanner, "react")
    profile = profile_dir / "profile.json"
    profile.write_text(json.dumps({
        "eligibility": {"extensions": [".tsx", ".jsx"]},
        "exclusions": ["**/*.generated.tsx", "**/node_modules/**", "**/dist/**", "**/__snapshots__/**"],
        "scanners": [{"path": "../../scripts/react.py", "needs_coding_scanlib": True}],
        "standards": ["../../standards/components"],
        "report_label": "React lint",
    }))
    result = run_runner(
        tmp_path,
        profile,
        "src/App.tsx",
        "src/Skip.generated.tsx",
        "App.generated.tsx",
        "node_modules/X.tsx",
        "dist/X.tsx",
        "__snapshots__/X.tsx",
        "src/plain.ts",
    )
    assert result.returncode == 0, result.stderr + result.stdout
    report = json.loads(result.stdout)
    assert [run["label"] for run in report["scanner_runs"]] == ["generic", "react"]
    assert report["files"] == ["src/App.tsx"]
    assert sum(run["label"] == "generic" for run in report["scanner_runs"]) == 1
    assert sum(run["label"] == "react" for run in report["scanner_runs"]) == 1
    react_args = report["scanner_runs"][1]["args"]
    assert str((tmp_path / "coding/scripts/scanlib").resolve()) in react_args
    assert report["report_label"] == "React lint"
    assert report["status"] == "compliant"
    assert report["violations_found_total"] == 0


def test_propagates_scanner_failure_with_generic_report_contract(
    tmp_path: Path,
) -> None:
    profile_dir = tmp_path / "react/skills/lint"
    scanner = tmp_path / "react/scripts/react.py"
    profile_dir.mkdir(parents=True)
    scanner.parent.mkdir(parents=True)
    write_scanner(scanner, "react", exit_code=7)
    profile = profile_dir / "profile.json"
    profile.write_text(json.dumps({
        "eligibility": {"extensions": [".tsx"]},
        "exclusions": [],
        "scanners": [{"path": "../../scripts/react.py", "needs_coding_scanlib": True}],
        "standards": [],
        "report_label": "React lint",
    }))
    result = run_runner(tmp_path, profile, "src/App.tsx")
    assert result.returncode == 7, result.stdout
    report = json.loads(result.stdout)
    assert report["status"] == "failure"
    assert "violations_found_total" in report
    assert len(report["scanner_runs"]) == 2


def test_rejects_relative_profile_path(tmp_path: Path) -> None:
    result = subprocess.run(
        [sys.executable, str(RUNNER), "--profile", "relative.json", "src/App.tsx"],
        cwd=tmp_path,
        text=True,
        capture_output=True,
    )
    assert result.returncode == 2
    assert "absolute path" in json.loads(result.stdout)["error"]


def test_scanner_output_cannot_forge_process_metadata(tmp_path: Path) -> None:
    profile_dir = tmp_path / "react/skills/lint"
    scanner = tmp_path / "react/scripts/react.py"
    profile_dir.mkdir(parents=True)
    scanner.parent.mkdir(parents=True)
    scanner.write_text(
        "import json\n"
        "print(json.dumps({'label': 'forged', 'exit_code': 0}))\n"
        "raise SystemExit(7)\n"
    )
    profile = profile_dir / "profile.json"
    profile.write_text(json.dumps({"scanners": [{"path": "../../scripts/react.py"}]}))
    result = run_runner(tmp_path, profile, "src/App.tsx")
    assert result.returncode == 7
    report = json.loads(result.stdout)
    assert report["scanner_runs"][1]["label"] == "react"
    assert report["scanner_runs"][1]["exit_code"] == 7
    assert report["scanner_runs"][1]["output"]["label"] == "forged"


def test_committed_profile_and_skills_are_portable_and_non_recursive() -> None:
    profile = json.loads(PROFILE.read_text())
    assert profile["eligibility"]["extensions"] == [".tsx", ".jsx"]
    assert profile["scanners"][0]["needs_coding_scanlib"]


def _manifests() -> dict:
    manifests = {}
    for path in PLUGINS.glob("*/.claude-plugin/plugin.json"):
        manifest = json.loads(path.read_text())
        manifests[manifest["name"]] = manifest
    return manifests


def test_declared_dependencies_name_existing_plugins_only() -> None:
    manifests = _manifests()

    assert len(manifests) > 0
    for name, manifest in manifests.items():
        for dependency in manifest.get("dependencies") or []:
            assert dependency in manifests, f"{name} depends on unknown {dependency}"
            assert name != dependency


def test_marketplace_entries_carry_no_dependencies() -> None:
    marketplace = json.loads((ROOT / ".claude-plugin/marketplace.json").read_text())
    for plugin in marketplace["plugins"]:
        assert "dependencies" not in plugin, plugin.get("name")
