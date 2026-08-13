import hashlib
import json
import subprocess
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
VALIDATOR = PLUGIN / "skills/commit/scripts/validate-scoped-save.sh"


class Harness:
    """A scratch git repo plus the validator invocation helpers."""

    def __init__(self, root: Path) -> None:
        self.repo = root / "target"
        self.repo.mkdir()
        self.repo = self.repo.resolve()
        self.git("init", "-q")
        self.git("config", "user.name", "Scoped Save Test")
        self.git("config", "user.email", "scoped-save@example.test")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "core.autocrlf", "false")
        self.git("config", "core.filemode", "true")

        files = {
            ".gitignore": ".state/\n",
            "src.txt": "source base\n",
            "tests.txt": "test base\n",
            "docs/specs/capability/README.md": "spec base\n",
            "docs/specs/capability/provenance.json": "{}\n",
            "developer.txt": "developer base\n",
        }
        for relative, content in files.items():
            path = self.repo / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "-q", "-m", "chore: initialize target")
        self.base_rev = self.git("rev-parse", "HEAD").stdout.strip()
        self.work_root = self.repo / ".state/works/scoped-save"
        self.work_root.mkdir(parents=True)

    def git(self, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", "-C", str(self.repo), *args],
            check=check,
            text=True,
            capture_output=True,
        )

    def git_bytes(
        self, *args: str, check: bool = True
    ) -> subprocess.CompletedProcess[bytes]:
        return subprocess.run(
            ["git", "-C", str(self.repo), *args],
            check=check,
            capture_output=True,
        )

    def helper(
        self, *args: str, check: bool = True
    ) -> tuple[subprocess.CompletedProcess[str], dict[str, object]]:
        result = subprocess.run(
            ["bash", str(VALIDATOR), *args],
            check=False,
            text=True,
            capture_output=True,
        )
        if check:
            assert not result.returncode, (
                f"validator failed ({result.returncode}): {result.stdout}\n{result.stderr}"
            )
        return result, json.loads(result.stdout)

    def scope(self, publication: list[tuple[str, str]], selected: list[str]) -> Path:
        scope = self.work_root / "artifacts/history/scope-request.json"
        scope.parent.mkdir(parents=True, exist_ok=True)
        child_manifest = self.work_root / "artifacts/children/coding.json"
        child_manifest.parent.mkdir(parents=True, exist_ok=True)
        generated_files = []
        for relative, _ in publication:
            path = self.repo / relative
            if path.is_symlink():
                state = "symlink"
                content_hash = hashlib.sha256(
                    path.readlink().as_posix().encode()
                ).hexdigest()
                mode = "120000"
            elif path.is_file():
                state = "file"
                content_hash = hashlib.sha256(path.read_bytes()).hexdigest()
                mode = "100755" if path.stat().st_mode & 0o111 else "100644"
            else:
                state = "deleted"
                content_hash = None
                mode = None
            generated_files.append(
                {"path": relative, "state": state, "sha256": content_hash, "mode": mode}
            )
        child_manifest.write_text(
            json.dumps(
                {
                    "schema": "state-generated-files/v1",
                    "producer": "coding:test-fixture",
                    "base_rev": self.base_rev,
                    "generated_files": generated_files,
                },
                sort_keys=True,
                separators=(",", ":"),
            )
            + "\n",
            encoding="utf-8",
        )
        scope.write_text(
            json.dumps(
                {
                    "schema": "state-scoped-save-request/v1",
                    "work_id": "scoped-save",
                    "scope_complete": True,
                    "publication_paths": [
                        {"path": path, "origin": origin} for path, origin in publication
                    ],
                    "selected_paths": selected,
                    "generated_file_manifests": [
                        ".state/works/scoped-save/artifacts/children/coding.json"
                    ],
                }
            ),
            encoding="utf-8",
        )
        return scope

    def build(self, scope: Path) -> dict[str, object]:
        _, output = self.helper(
            "build",
            "--repo",
            str(self.repo),
            "--work-root",
            str(self.work_root),
            "--base-rev",
            self.base_rev,
            "--scope",
            str(scope),
        )
        return output

    def preflight(self, manifest: dict[str, object]) -> dict[str, object]:
        _, output = self.helper(
            "preflight",
            "--repo",
            str(self.repo),
            "--manifest",
            str(manifest["manifest_path"]),
            "--manifest-sha256",
            str(manifest["manifest_sha256"]),
        )
        return output

    def commit_selected(self, preflight: dict[str, object], message: str) -> str:
        self.git(
            "commit",
            "--only",
            f"--pathspec-from-file={preflight['literal_pathspec_file']}",
            "--pathspec-file-nul",
            "-m",
            message,
        )
        return self.git("rev-parse", "HEAD").stdout.strip()

    def verify(
        self,
        manifest: dict[str, object],
        preflight: dict[str, object],
        saved_rev: str,
    ) -> dict[str, object]:
        _, output = self.helper(
            "verify",
            "--repo",
            str(self.repo),
            "--manifest",
            str(manifest["manifest_path"]),
            "--manifest-sha256",
            str(manifest["manifest_sha256"]),
            "--snapshot",
            str(preflight["snapshot_path"]),
            "--snapshot-sha256",
            str(preflight["snapshot_sha256"]),
            "--saved-rev",
            saved_rev,
        )
        return output


@pytest.fixture
def harness(tmp_path: Path) -> Harness:
    return Harness(tmp_path.resolve())


def test_real_path_limited_save_preserves_unrelated_index_and_worktree(
    harness: Harness,
) -> None:
    selected = [
        "src.txt",
        "tests.txt",
        "docs/specs/capability/README.md",
        "docs/specs/capability/provenance.json",
    ]
    for relative in selected:
        path = harness.repo / relative
        path.write_text(
            path.read_text(encoding="utf-8") + "lifecycle edit\n", encoding="utf-8"
        )
    (harness.repo / "src.txt").chmod(0o755)

    developer = harness.repo / "developer.txt"
    developer.write_text("developer staged\n", encoding="utf-8")
    harness.git("add", "developer.txt")
    staged_before = harness.git("show", ":developer.txt").stdout
    developer.write_text("developer unstaged after staged\n", encoding="utf-8")
    worktree_before = developer.read_bytes()

    scope = harness.scope(
        [(path, f"child-manifest:{path}") for path in selected], selected
    )
    manifest = harness.build(scope)
    manifest_json = json.loads(
        Path(str(manifest["manifest_path"])).read_text(encoding="utf-8")
    )
    assert manifest_json["schema"] == "state-scoped-save/v1"
    assert set(selected) == {
        entry["path"] for entry in manifest_json["publication_paths"]
    }
    assert (
        next(
            entry
            for entry in manifest_json["selected_paths"]
            if entry["path"] == "src.txt"
        )["mode"]
        == "100755"
    )
    assert {entry["path"] for entry in manifest_json["excluded_dirty_paths"]} == {
        "developer.txt"
    }

    preflight = harness.preflight(manifest)
    preflight_json = json.loads(
        Path(str(preflight["snapshot_path"])).read_text(encoding="utf-8")
    )
    assert preflight_json["schema"] == "state-scoped-save-preflight/v1"
    saved = harness.commit_selected(preflight, "feat: save lifecycle scope")

    assert staged_before == harness.git("show", ":developer.txt").stdout
    assert worktree_before == developer.read_bytes()
    result = harness.verify(manifest, preflight, saved)
    result_json = json.loads(
        Path(str(result["receipt_path"])).read_text(encoding="utf-8")
    )
    assert result_json["schema"] == "state-scoped-save-result/v1"
    assert result["non_selected_preserved"]
    assert result["status"] == "pass"
    assert (
        result["receipt_path"]
        == harness.verify(manifest, preflight, saved)["receipt_path"]
    )


def test_exact_scoped_rename_records_and_saves_source_and_destination(
    harness: Harness,
) -> None:
    harness.git("mv", "src.txt", "renamed-src.txt")
    publication = [
        ("src.txt", "child-manifest:rename-source"),
        ("renamed-src.txt", "child-manifest:rename-destination"),
    ]
    selected = ["src.txt", "renamed-src.txt"]
    manifest = harness.build(harness.scope(publication, selected))
    manifest_json = json.loads(
        Path(str(manifest["manifest_path"])).read_text(encoding="utf-8")
    )
    selected_entries = {
        entry["path"]: entry for entry in manifest_json["selected_paths"]
    }
    assert selected_entries["src.txt"]["state"] == "deleted"
    assert selected_entries["renamed-src.txt"]["state"] == "file"
    assert "role=source" in selected_entries["src.txt"]["status"]
    assert "role=destination" in selected_entries["renamed-src.txt"]["status"]

    preflight = harness.preflight(manifest)
    saved = harness.commit_selected(preflight, "refactor: rename source")
    result = harness.verify(manifest, preflight, saved)
    assert result["non_selected_preserved"]


def test_preflight_rejects_stale_selected_bytes(harness: Harness) -> None:
    (harness.repo / "src.txt").write_text("lifecycle edit\n", encoding="utf-8")
    manifest = harness.build(
        harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    )
    (harness.repo / "src.txt").write_text("changed after review\n", encoding="utf-8")
    result, output = harness.helper(
        "preflight",
        "--repo",
        str(harness.repo),
        "--manifest",
        str(manifest["manifest_path"]),
        "--manifest-sha256",
        str(manifest["manifest_sha256"]),
        check=False,
    )
    assert result.returncode == 2
    assert output["status"] == "blocked_scope"
    assert "stale" in str(output["error"])


def test_preflight_rejects_duplicate_keys_even_with_matching_filename_hash(
    harness: Harness,
) -> None:
    (harness.repo / "src.txt").write_text("lifecycle edit\n", encoding="utf-8")
    manifest = harness.build(
        harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    )
    original = Path(str(manifest["manifest_path"])).read_bytes()
    duplicate = original.replace(
        b'"base_rev":', b'"base_rev":"duplicate","base_rev":', 1
    )
    digest = hashlib.sha256(duplicate).hexdigest()
    duplicate_path = Path(str(manifest["manifest_path"])).parent / f"{digest}.json"
    duplicate_path.write_bytes(duplicate)

    result, output = harness.helper(
        "preflight",
        "--repo",
        str(harness.repo),
        "--manifest",
        str(duplicate_path),
        "--manifest-sha256",
        digest,
        check=False,
    )
    assert result.returncode == 2
    assert "duplicate JSON key" in str(output["error"])


def test_preflight_rejects_unknown_manifest_fields(harness: Harness) -> None:
    (harness.repo / "src.txt").write_text("lifecycle edit\n", encoding="utf-8")
    manifest = harness.build(
        harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    )
    value = json.loads(Path(str(manifest["manifest_path"])).read_text(encoding="utf-8"))
    value["unexpected"] = True
    raw = (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode()
    digest = hashlib.sha256(raw).hexdigest()
    unknown_path = Path(str(manifest["manifest_path"])).parent / f"{digest}.json"
    unknown_path.write_bytes(raw)
    result, output = harness.helper(
        "preflight",
        "--repo",
        str(harness.repo),
        "--manifest",
        str(unknown_path),
        "--manifest-sha256",
        digest,
        check=False,
    )
    assert result.returncode == 2
    assert "unknown=['unexpected']" in str(output["error"])


def test_verify_rejects_snapshot_mutation(harness: Harness) -> None:
    (harness.repo / "src.txt").write_text("lifecycle edit\n", encoding="utf-8")
    manifest = harness.build(
        harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    )
    preflight = harness.preflight(manifest)
    saved = harness.commit_selected(preflight, "feat: save source")
    snapshot = Path(str(preflight["snapshot_path"]))
    snapshot.chmod(0o644)
    snapshot.write_bytes(snapshot.read_bytes() + b" ")

    result, output = harness.helper(
        "verify",
        "--repo",
        str(harness.repo),
        "--manifest",
        str(manifest["manifest_path"]),
        "--manifest-sha256",
        str(manifest["manifest_sha256"]),
        "--snapshot",
        str(snapshot),
        "--snapshot-sha256",
        str(preflight["snapshot_sha256"]),
        "--saved-rev",
        saved,
        check=False,
    )
    assert result.returncode == 2
    assert "snapshot" in str(output["error"])


def test_verify_rejects_an_intervening_plain_git_commit(harness: Harness) -> None:
    (harness.repo / "src.txt").write_text("lifecycle edit\n", encoding="utf-8")
    manifest = harness.build(
        harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    )
    preflight = harness.preflight(manifest)
    saved = harness.commit_selected(preflight, "feat: save source")

    (harness.repo / "developer.txt").write_text("concurrent commit\n", encoding="utf-8")
    harness.git("add", "developer.txt")
    harness.git("commit", "-m", "chore: concurrent developer commit")
    result, output = harness.helper(
        "verify",
        "--repo",
        str(harness.repo),
        "--manifest",
        str(manifest["manifest_path"]),
        "--manifest-sha256",
        str(manifest["manifest_sha256"]),
        "--snapshot",
        str(preflight["snapshot_path"]),
        "--snapshot-sha256",
        str(preflight["snapshot_sha256"]),
        "--saved-rev",
        saved,
        check=False,
    )
    assert result.returncode == 2
    assert "current HEAD no longer equals" in str(output["error"])


def test_cli_artifacts_paths_reject_lexical_traversal_before_access(
    harness: Harness,
) -> None:
    (harness.repo / "src.txt").write_text("lifecycle edit\n", encoding="utf-8")
    scope = harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    escaped_scope = f"{scope.parent}/nested/../{scope.name}"
    result, output = harness.helper(
        "build",
        "--repo",
        str(harness.repo),
        "--work-root",
        str(harness.work_root),
        "--base-rev",
        harness.base_rev,
        "--scope",
        escaped_scope,
        check=False,
    )
    assert result.returncode == 2
    assert "--scope contains lexical traversal" in str(output["error"])

    manifest = harness.build(scope)
    manifest_path = Path(str(manifest["manifest_path"]))
    escaped_manifest = f"{manifest_path.parent}/nested/../{manifest_path.name}"
    result, output = harness.helper(
        "preflight",
        "--repo",
        str(harness.repo),
        "--manifest",
        escaped_manifest,
        "--manifest-sha256",
        str(manifest["manifest_sha256"]),
        check=False,
    )
    assert result.returncode == 2
    assert "--manifest contains lexical traversal" in str(output["error"])

    preflight = harness.preflight(manifest)
    saved = harness.commit_selected(preflight, "feat: save source")
    snapshot_path = Path(str(preflight["snapshot_path"]))
    escaped_snapshot = f"{snapshot_path.parent}/nested/../{snapshot_path.name}"
    result, output = harness.helper(
        "verify",
        "--repo",
        str(harness.repo),
        "--manifest",
        str(manifest_path),
        "--manifest-sha256",
        str(manifest["manifest_sha256"]),
        "--snapshot",
        escaped_snapshot,
        "--snapshot-sha256",
        str(preflight["snapshot_sha256"]),
        "--saved-rev",
        saved,
        check=False,
    )
    assert result.returncode == 2
    assert "--snapshot contains lexical traversal" in str(output["error"])


def test_generated_artifacts_pointer_rejects_lexical_traversal(
    harness: Harness,
) -> None:
    (harness.repo / "src.txt").write_text("lifecycle edit\n", encoding="utf-8")
    scope = harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    request = json.loads(scope.read_text(encoding="utf-8"))
    request["generated_file_manifests"] = ["artifacts/children/nested/../coding.json"]
    scope.write_text(json.dumps(request), encoding="utf-8")
    result, output = harness.helper(
        "build",
        "--repo",
        str(harness.repo),
        "--work-root",
        str(harness.work_root),
        "--base-rev",
        harness.base_rev,
        "--scope",
        str(scope),
        check=False,
    )
    assert result.returncode == 2
    assert "not lexically normalized" in str(output["error"])


@pytest.mark.parametrize(
    ("flag", "clear_flag"),
    (
        ("--assume-unchanged", "--no-assume-unchanged"),
        ("--skip-worktree", "--no-skip-worktree"),
    ),
)
def test_build_rejects_assume_unchanged_and_skip_worktree_flags(
    harness: Harness, flag: str, clear_flag: str
) -> None:
    (harness.repo / "src.txt").write_text(
        f"lifecycle edit hidden by {flag}\n", encoding="utf-8"
    )
    harness.git("update-index", flag, "src.txt")
    scope = harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    result, output = harness.helper(
        "build",
        "--repo",
        str(harness.repo),
        "--work-root",
        str(harness.work_root),
        "--base-rev",
        harness.base_rev,
        "--scope",
        str(scope),
        check=False,
    )
    assert result.returncode == 2
    assert "index flag makes scoped proof ambiguous" in str(output["error"])
    harness.git("update-index", clear_flag, "src.txt")
    (harness.repo / "src.txt").write_text("source base\n", encoding="utf-8")


def test_build_rejects_mode_hidden_by_core_filemode_false(harness: Harness) -> None:
    (harness.repo / "src.txt").chmod(0o755)
    harness.git("config", "core.filemode", "false")
    scope = harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    result, output = harness.helper(
        "build",
        "--repo",
        str(harness.repo),
        "--work-root",
        str(harness.work_root),
        "--base-rev",
        harness.base_rev,
        "--scope",
        str(scope),
        check=False,
    )
    assert result.returncode == 2
    assert "core.filemode=false" in str(output["error"])
    assert "preservation ambiguous" in str(output["error"])


def test_preflight_rejects_history_change_after_manifest_seal(harness: Harness) -> None:
    (harness.repo / "src.txt").write_text("lifecycle edit\n", encoding="utf-8")
    manifest = harness.build(
        harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    )
    (harness.repo / "developer.txt").write_text("history writer\n", encoding="utf-8")
    harness.git("add", "developer.txt")
    harness.git("commit", "-q", "-m", "chore: concurrent history writer")

    result, output = harness.helper(
        "preflight",
        "--repo",
        str(harness.repo),
        "--manifest",
        str(manifest["manifest_path"]),
        "--manifest-sha256",
        str(manifest["manifest_sha256"]),
        check=False,
    )
    assert result.returncode == 2
    assert "HEAD changed after scoped manifest sealing" in str(output["error"])


def test_preflight_rejects_mutated_producer_receipt(harness: Harness) -> None:
    (harness.repo / "src.txt").write_text("lifecycle edit\n", encoding="utf-8")
    manifest = harness.build(
        harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    )
    receipt_path = harness.work_root / "artifacts/children/coding.json"
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    receipt["producer"] = "coding:mutated-after-seal"
    receipt_path.write_text(
        json.dumps(receipt, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )

    result, output = harness.helper(
        "preflight",
        "--repo",
        str(harness.repo),
        "--manifest",
        str(manifest["manifest_path"]),
        "--manifest-sha256",
        str(manifest["manifest_sha256"]),
        check=False,
    )
    assert result.returncode == 2
    assert "bindings changed after sealing" in str(output["error"])


def test_build_rejects_producer_omission_from_publication_scope(
    harness: Harness,
) -> None:
    for relative in ("src.txt", "tests.txt"):
        (harness.repo / relative).write_text("lifecycle edit\n", encoding="utf-8")
    scope = harness.scope(
        [
            ("src.txt", "child-manifest:source"),
            ("tests.txt", "child-manifest:tests"),
        ],
        ["src.txt", "tests.txt"],
    )
    receipt_path = harness.work_root / "artifacts/children/coding.json"
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    receipt["generated_files"] = [
        entry for entry in receipt["generated_files"] if entry["path"] == "src.txt"
    ]
    receipt_path.write_text(
        json.dumps(receipt, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )

    result, output = harness.helper(
        "build",
        "--repo",
        str(harness.repo),
        "--work-root",
        str(harness.work_root),
        "--base-rev",
        harness.base_rev,
        "--scope",
        str(scope),
        check=False,
    )
    assert result.returncode == 2
    assert "generated_files must equal publication scope exactly" in str(
        output["error"]
    )
    assert "tests.txt" in str(output["error"])


def test_recover_restores_exact_preflight_head_and_index(harness: Harness) -> None:
    (harness.repo / "src.txt").write_text("lifecycle edit\n", encoding="utf-8")
    developer = harness.repo / "developer.txt"
    developer.write_text("developer staged\n", encoding="utf-8")
    harness.git("add", "developer.txt")
    developer.write_text("developer unstaged\n", encoding="utf-8")

    manifest = harness.build(
        harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    )
    preflight = harness.preflight(manifest)
    index_path = Path(harness.git("rev-parse", "--git-path", "index").stdout.strip())
    if not index_path.is_absolute():
        index_path = harness.repo / index_path
    index_before = index_path.read_bytes()
    status_before = harness.git_bytes(
        "status",
        "--porcelain=v2",
        "-z",
        "--untracked-files=all",
        "--ignore-submodules=none",
    ).stdout
    src_before = (harness.repo / "src.txt").read_bytes()
    developer_before = developer.read_bytes()
    old_head = harness.git("rev-parse", "HEAD").stdout.strip()
    harness.git("commit", "-q", "-a", "-m", "feat: faulty save captures extra path")
    saved = harness.git("rev-parse", "HEAD").stdout.strip()

    failed_verify, failed_output = harness.helper(
        "verify",
        "--repo",
        str(harness.repo),
        "--manifest",
        str(manifest["manifest_path"]),
        "--manifest-sha256",
        str(manifest["manifest_sha256"]),
        "--snapshot",
        str(preflight["snapshot_path"]),
        "--snapshot-sha256",
        str(preflight["snapshot_sha256"]),
        "--saved-rev",
        saved,
        check=False,
    )
    assert failed_verify.returncode == 2
    assert "dirty path set changed" in str(failed_output["error"])

    _, recovery = harness.helper(
        "recover",
        "--repo",
        str(harness.repo),
        "--manifest",
        str(manifest["manifest_path"]),
        "--manifest-sha256",
        str(manifest["manifest_sha256"]),
        "--snapshot",
        str(preflight["snapshot_path"]),
        "--snapshot-sha256",
        str(preflight["snapshot_sha256"]),
        "--failed-head",
        saved,
    )
    recovery_json = json.loads(
        Path(str(recovery["receipt_path"])).read_text(encoding="utf-8")
    )
    assert recovery_json["schema"] == "state-scoped-save-recovery/v1"
    assert recovery["status"] == "recovered"
    assert harness.git("rev-parse", "HEAD").stdout.strip() == old_head
    assert index_path.read_bytes() == index_before
    assert (harness.repo / "src.txt").read_bytes() == src_before
    assert developer.read_bytes() == developer_before
    assert (
        harness.git_bytes(
            "status",
            "--porcelain=v2",
            "-z",
            "--untracked-files=all",
            "--ignore-submodules=none",
        ).stdout
        == status_before
    )


def test_preflight_blocks_selected_clean_filter_before_history_mutation(
    harness: Harness,
) -> None:
    harness.git("config", "filter.upper.clean", "tr '[:lower:]' '[:upper:]'")
    harness.git("config", "filter.upper.smudge", "cat")
    (harness.repo / ".gitattributes").write_text(
        "src.txt filter=upper\n", encoding="utf-8"
    )
    harness.git("add", ".gitattributes")
    harness.git("commit", "-q", "-m", "chore: configure clean filter")
    harness.base_rev = harness.git("rev-parse", "HEAD").stdout.strip()
    (harness.repo / "src.txt").write_text("lifecycle edit\n", encoding="utf-8")
    manifest = harness.build(
        harness.scope([("src.txt", "child-manifest:source")], ["src.txt"])
    )
    head_before = harness.git("rev-parse", "HEAD").stdout.strip()

    result, output = harness.helper(
        "preflight",
        "--repo",
        str(harness.repo),
        "--manifest",
        str(manifest["manifest_path"]),
        "--manifest-sha256",
        str(manifest["manifest_sha256"]),
        check=False,
    )
    assert result.returncode == 2
    assert "Git clean transform" in str(output["error"])
    assert harness.git("rev-parse", "HEAD").stdout.strip() == head_before
