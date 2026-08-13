import json
import os
import runpy
import shlex
import shutil
import subprocess
from pathlib import Path
from typing import TypedDict

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
CLASSIFIER = PLUGIN / "skills" / "pr" / "scripts" / "classify-pr-size.py"


class SizeResult(TypedDict):
    authored_additions: int
    authored_deletions: int
    base_oid: str
    binary_files: list[str]
    files_changed: int
    generated_files: list[str]
    head_oid: str
    net_loc: int
    required_reviewers: int
    zone: str


def git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def commit(repo: Path, message: str) -> str:
    git(repo, "add", ".")
    git(repo, "commit", "--quiet", "--no-gpg-sign", "-m", message)
    return git(repo, "rev-parse", "HEAD")


@pytest.fixture
def repository(tmp_path: Path) -> tuple[Path, str]:
    git(tmp_path, "init", "--quiet", "--initial-branch=main")
    git(tmp_path, "config", "user.email", "test@example.com")
    git(tmp_path, "config", "user.name", "Test")
    (tmp_path / "README.md").write_text("base\n")
    return tmp_path, commit(tmp_path, "base")


def classify(
    repo: Path, base: str, head: str, *, environment: dict[str, str] | None = None
) -> SizeResult:
    completed = subprocess.run(
        [
            "uv",
            "run",
            "--python",
            "3.13",
            str(CLASSIFIER),
            "--repo",
            str(repo),
            "--base",
            base,
            "--head",
            head,
        ],
        check=True,
        capture_output=True,
        text=True,
        env=os.environ | (environment or {}),
    )
    return json.loads(completed.stdout)


def lines(count: int, value: str = "line") -> str:
    return "".join(f"{value}-{number}\n" for number in range(count))


def git_compatibility_environment(
    tmp_path: Path, *, reject_check_attr_source: bool = False
) -> tuple[dict[str, str], Path]:
    real_git = shutil.which("git")
    assert real_git is not None
    commands = tmp_path / "git-commands"
    inputs = tmp_path / "git-inputs"
    shim_directory = tmp_path / "bin"
    shim_directory.mkdir()
    shim = shim_directory / "git"
    rejection = (
        """\
for argument in "$@"; do
  if [ "$argument" = check-attr ]; then
    is_check_attr=1
  elif [ "${is_check_attr:-}" = 1 ] && [ "${argument#--source=}" != "$argument" ]; then
    printf '%s\\n' 'error: unknown option source' >&2
    exit 129
  fi
done
"""
        if reject_check_attr_source
        else ""
    )
    shim.write_text(
        "#!/bin/sh\n"
        f"printf '%s\\0' __COMMAND__ >> {shlex.quote(str(commands))}\n"
        f"printf '%s\\0' \"$@\" >> {shlex.quote(str(commands))}\n"
        f"{rejection}"
        "is_cat_file=\n"
        "is_batch_check=\n"
        'for argument in "$@"; do\n'
        '  [ "$argument" = cat-file ] && is_cat_file=1\n'
        '  [ "$argument" = --batch-check ] && is_batch_check=1\n'
        "done\n"
        'if [ "${is_cat_file:-}" = 1 ] && [ "${is_batch_check:-}" = 1 ]; then\n'
        f'  tee -a {shlex.quote(str(inputs))} | {shlex.quote(real_git)} "$@"\n'
        "  exit $?\n"
        "fi\n"
        f'exec {shlex.quote(real_git)} "$@"\n'
    )
    shim.chmod(0o755)
    return {"PATH": f"{shim_directory}{os.pathsep}{os.environ['PATH']}"}, commands


def classify_in_process(repo: Path, base: str, head: str) -> SizeResult:
    namespace = runpy.run_path(str(CLASSIFIER), run_name="pr_size_classifier")
    return namespace["classify"](repo, base, head)


@pytest.mark.parametrize(
    "lockfile",
    [
        "pnpm-lock.yaml",
        "package-lock.json",
        "yarn.lock",
        "uv.lock",
        "Cargo.lock",
    ],
)
def test_package_lockfile_loc_is_excluded_but_file_is_counted(
    repository: tuple[Path, str], lockfile: str
) -> None:
    repo, base = repository
    (repo / "src.py").write_text(lines(12))
    (repo / lockfile).write_text(lines(2_500, "generated"))
    head = commit(repo, "add authored source and lockfile")

    result = classify(repo, base, head)

    assert result["files_changed"] == 2
    assert result["authored_additions"] == 12
    assert result["authored_deletions"] == 0
    assert result["net_loc"] == 12
    assert result["zone"] == "green"
    assert result["generated_files"] == [lockfile]


def test_linguist_generated_paths_do_not_contribute_loc(
    repository: tuple[Path, str],
) -> None:
    repo, base = repository
    (repo / ".gitattributes").write_text("generated/** linguist-generated=true\n")
    generated = repo / "generated"
    generated.mkdir()
    (generated / "client.ts").write_text(lines(2_500, "generated"))
    (repo / "app.ts").write_text(lines(600, "authored"))
    head = commit(repo, "add generated client and authored app")

    result = classify(repo, base, head)

    assert result["files_changed"] == 3
    assert result["authored_additions"] == 601
    assert result["net_loc"] == 601
    assert result["zone"] == "yellow"
    assert result["generated_files"] == ["generated/client.ts"]


def test_generated_deletions_are_excluded_before_net_loc_is_calculated(
    repository: tuple[Path, str],
) -> None:
    repo, initial = repository
    (repo / "pnpm-lock.yaml").write_text(lines(2_500, "generated"))
    (repo / "app.py").write_text(lines(610, "old"))
    base = commit(repo, "add baseline files")
    assert initial != base

    (repo / "pnpm-lock.yaml").unlink()
    (repo / "app.py").write_text(lines(10, "new"))
    head = commit(repo, "shrink authored source and remove lockfile")

    result = classify(repo, base, head)

    assert result["files_changed"] == 2
    assert result["authored_additions"] == 10
    assert result["authored_deletions"] == 610
    assert result["net_loc"] == 600
    assert result["zone"] == "yellow"
    assert result["generated_files"] == ["pnpm-lock.yaml"]


def test_deleted_generated_attribute_is_resolved_from_the_base_revision(
    repository: tuple[Path, str],
) -> None:
    repo, _initial = repository
    (repo / ".gitattributes").write_text("generated/** linguist-generated=true\n")
    generated = repo / "generated"
    generated.mkdir()
    (generated / "client.ts").write_text(lines(2_500, "generated"))
    base = commit(repo, "add generated client")

    (generated / "client.ts").unlink()
    generated.rmdir()
    (repo / ".gitattributes").unlink()
    head = commit(repo, "remove generated client")

    result = classify(repo, base, head)

    assert result["files_changed"] == 2
    assert result["authored_deletions"] == 1
    assert result["net_loc"] == 1
    assert result["generated_files"] == ["generated/client.ts"]


def test_check_attr_without_source_option_still_resolves_revision_attributes(
    repository: tuple[Path, str], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo, _initial = repository
    (repo / ".gitattributes").write_text("generated/** linguist-generated=true\n")
    generated = repo / "generated"
    generated.mkdir()
    (generated / "client.ts").write_text(lines(2_500, "generated"))
    base = commit(repo, "add generated client")
    (generated / "client.ts").unlink()
    generated.rmdir()
    (repo / ".gitattributes").unlink()
    head = commit(repo, "remove generated client")
    environment, _commands = git_compatibility_environment(
        tmp_path, reject_check_attr_source=True
    )
    monkeypatch.setenv("PATH", environment["PATH"])

    result = classify_in_process(repo, base, head)

    assert result["files_changed"] == 2
    assert result["authored_deletions"] == 1
    assert result["net_loc"] == 1
    assert result["generated_files"] == ["generated/client.ts"]


def test_explicit_non_generated_attribute_keeps_authored_loc(
    repository: tuple[Path, str],
) -> None:
    repo, base = repository
    (repo / ".gitattributes").write_text("authored/** linguist-generated=false\n")
    authored = repo / "authored"
    authored.mkdir()
    (authored / "source.ts").write_text(lines(501, "authored"))
    head = commit(repo, "add attributed authored source")

    result = classify(repo, base, head)

    assert result["authored_additions"] == 502
    assert result["net_loc"] == 502
    assert result["zone"] == "yellow"
    assert result["generated_files"] == []


def test_generated_files_still_drive_the_file_count_zone(
    repository: tuple[Path, str],
) -> None:
    repo, base = repository
    (repo / ".gitattributes").write_text("generated/** linguist-generated=true\n")
    generated = repo / "generated"
    generated.mkdir()
    for number in range(61):
        (generated / f"artifact-{number}.txt").write_text(lines(100))
    head = commit(repo, "add generated artifacts")

    result = classify(repo, base, head)

    assert result["files_changed"] == 62
    assert result["net_loc"] == 1
    assert result["zone"] == "black"
    assert len(result["generated_files"]) == 61


def test_authored_source_loc_remains_counted(
    repository: tuple[Path, str],
) -> None:
    repo, base = repository
    (repo / "app.py").write_text(lines(2_001, "authored"))
    head = commit(repo, "add large authored source")

    result = classify(repo, base, head)

    assert result["files_changed"] == 1
    assert result["net_loc"] == 2_001
    assert result["zone"] == "black"
    assert result["generated_files"] == []


def test_repository_info_attributes_and_diff_config_cannot_change_classification(
    repository: tuple[Path, str],
) -> None:
    repo, base = repository
    (repo / "app.py").write_text(lines(2_001, "authored"))
    head = commit(repo, "add large authored source")
    expected = classify(repo, base, head)

    git_dir = (repo / git(repo, "rev-parse", "--git-dir")).resolve()
    (git_dir / "info" / "attributes").write_text("* linguist-generated\n")
    git(repo, "config", "diff.algorithm", "histogram")
    git(repo, "config", "diff.renames", "false")

    assert classify(repo, base, head) == expected


def test_global_attributes_and_external_diff_cannot_change_classification(
    repository: tuple[Path, str], tmp_path: Path
) -> None:
    repo, base = repository
    (repo / "app.py").write_text(lines(2_001, "authored"))
    head = commit(repo, "add large authored source")
    expected = classify(repo, base, head)

    attributes = tmp_path / "global-attributes"
    attributes.write_text("* linguist-generated\n")
    config = tmp_path / "global-gitconfig"
    config.write_text(f"[core]\n\tattributesFile = {attributes}\n")
    external_diff = tmp_path / "external-diff"
    external_diff.write_text("#!/bin/sh\nexit 91\n")
    external_diff.chmod(0o755)

    actual = classify(
        repo,
        base,
        head,
        environment={
            "GIT_CONFIG_GLOBAL": str(config),
            "GIT_CONFIG_PARAMETERS": f"'core.attributesFile'='{attributes}'",
            "GIT_DEFAULT_HASH": "sha256",
            "GIT_EXTERNAL_DIFF": str(external_diff),
        },
    )

    assert actual == expected


def test_nondefault_object_format_is_preserved(tmp_path: Path) -> None:
    repo = tmp_path / "sha256-repo"
    initialized = subprocess.run(
        [
            "git",
            "init",
            "--quiet",
            "--initial-branch=main",
            "--object-format=sha256",
            str(repo),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if initialized.returncode != 0:
        pytest.skip("installed Git does not support SHA-256 repositories")
    git(repo, "config", "user.email", "test@example.com")
    git(repo, "config", "user.name", "Test")
    (repo / "README.md").write_text("base\n")
    base = commit(repo, "base")
    (repo / "app.py").write_text(lines(2_001, "authored"))
    head = commit(repo, "add large authored source")

    result = classify(repo, base, head)

    assert result["base_oid"] == base
    assert result["head_oid"] == head
    assert result["net_loc"] == 2_001
    assert result["zone"] == "black"


def test_empty_tree_base_classifies_an_initial_head_commit(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    git(repo.parent, "init", "--quiet", "--initial-branch=main", str(repo))
    git(repo, "config", "user.email", "test@example.com")
    git(repo, "config", "user.name", "Test")
    (repo / "app.py").write_text(lines(501, "authored"))
    head = commit(repo, "initial commit")
    empty_tree = subprocess.run(
        ["git", "-C", str(repo), "hash-object", "-t", "tree", "/dev/null"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()

    result = classify(repo, empty_tree, head)

    assert result["base_oid"] == empty_tree
    assert result["head_oid"] == head
    assert result["files_changed"] == 1
    assert result["authored_additions"] == 501
    assert result["zone"] == "yellow"


def test_promisor_clone_hydrates_a_missing_base_attribute_blob(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "source"
    git(tmp_path, "init", "--quiet", "--initial-branch=main", str(source))
    git(source, "config", "user.email", "test@example.com")
    git(source, "config", "user.name", "Test")
    git(source, "config", "uploadpack.allowFilter", "true")
    (source / ".gitattributes").write_text("generated/** linguist-generated=true\n")
    generated = source / "generated"
    generated.mkdir()
    (generated / "client.ts").write_text(lines(2_500, "generated"))
    (source / "unrelated.txt").write_text("must remain lazy\n")
    base = commit(source, "add generated client")
    (generated / "client.ts").unlink()
    generated.rmdir()
    (source / ".gitattributes").unlink()
    head = commit(source, "remove generated client")
    clone = tmp_path / "clone"
    subprocess.run(
        [
            "git",
            "clone",
            "--quiet",
            "--filter=blob:none",
            "--no-checkout",
            source.as_uri(),
            str(clone),
        ],
        check=True,
    )
    missing_objects = git(clone, "rev-list", "--objects", "--missing=print", base)
    attribute_blob = git(source, "rev-parse", f"{base}:.gitattributes")
    generated_blob = git(source, "rev-parse", f"{base}:generated/client.ts")
    unrelated_blob = git(source, "rev-parse", f"{base}:unrelated.txt")
    assert f"?{attribute_blob}" in missing_objects.splitlines()
    assert f"?{generated_blob}" in missing_objects.splitlines()
    assert f"?{unrelated_blob}" in missing_objects.splitlines()
    environment, commands_path = git_compatibility_environment(tmp_path)
    monkeypatch.setenv("PATH", environment["PATH"])
    result = classify_in_process(clone, base, head)

    assert commands_path.is_file()
    requested_object_ids = set((tmp_path / "git-inputs").read_text().splitlines())

    assert result["files_changed"] == 2
    assert result["authored_deletions"] == 1
    assert result["net_loc"] == 1
    assert result["generated_files"] == ["generated/client.ts"]
    assert requested_object_ids == {attribute_blob, generated_blob}
    remaining_missing = git(
        clone, "rev-list", "--objects", "--missing=print", base
    ).splitlines()
    assert f"?{unrelated_blob}" in remaining_missing


def test_rename_detection_is_bounded_and_preserves_rename_file_semantics(
    repository: tuple[Path, str], tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo, _initial = repository
    original = repo / "original.py"
    original.write_text(lines(20, "authored"))
    base = commit(repo, "add source")
    original.rename(repo / "renamed.py")
    head = commit(repo, "rename source")
    environment, commands_path = git_compatibility_environment(tmp_path)
    monkeypatch.setenv("PATH", environment["PATH"])

    result = classify_in_process(repo, base, head)

    commands = commands_path.read_bytes().split(b"\0")
    rename_limits = [
        argument.decode()
        for argument in commands
        if argument.startswith(b"-l") and argument[2:].isdigit()
    ]
    assert result["files_changed"] == 1
    assert result["authored_additions"] == 20
    assert result["authored_deletions"] == 20
    assert result["net_loc"] == 0
    assert rename_limits == ["-l1000"]


def test_rename_detection_stops_similarity_matching_beyond_the_cap(
    repository: tuple[Path, str],
) -> None:
    repo, _initial = repository
    for number in range(1_001):
        (repo / f"original-{number:04}.txt").write_text(f"shared\nidentity-{number}\n")
    base = commit(repo, "add rename candidates")
    for number in range(1_001):
        (repo / f"original-{number:04}.txt").rename(repo / f"renamed-{number:04}.txt")
        (repo / f"renamed-{number:04}.txt").write_text(f"changed\nidentity-{number}\n")
    staging = subprocess.run(
        ["git", "-C", str(repo), "add", "."],
        check=False,
        capture_output=True,
        text=True,
    )
    assert staging.returncode == 0, staging.stderr
    git(repo, "commit", "--quiet", "--no-gpg-sign", "-m", "rename beyond cap")
    head = git(repo, "rev-parse", "HEAD")

    result = classify(repo, base, head)

    assert result["files_changed"] == 2_002
    assert result["zone"] == "black"


def test_authoring_stacking_and_review_share_the_canonical_classifier() -> None:
    references = PLUGIN / "skills" / "pr" / "references"
    workflows = [
        references / "create-update.md",
        references / "review-workflow.md",
        references / "stacked-prs.md",
    ]
    classifier = "scripts/classify-pr-size.py"

    for workflow in workflows:
        content = workflow.read_text()
        assert content.count(classifier) == 1
        assert "generated" in content
        assert "file count" in content

    standard = PLUGIN / "standards" / "git"
    policy = "\n".join(
        path.read_text()
        for path in [
            standard / "meta.md",
            standard / "scan.md",
            standard / "write.md",
            *(standard / "rules").glob("GIT-PR-SIZE-*.md"),
        ]
    )
    normalized_policy = " ".join(policy.split()).lower()
    assert "authored net loc" in normalized_policy
    assert "exclude additions and deletions" in normalized_policy
    assert "remain in the file count" in normalized_policy
