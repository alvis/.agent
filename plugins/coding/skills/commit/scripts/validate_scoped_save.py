#!/usr/bin/env python3
"""Build and verify checksum-bound, exact-path lifecycle save manifests."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
from typing import Any


SCHEMA = "state-scoped-save/v1"
REQUEST_SCHEMA = "state-scoped-save-request/v1"
PRODUCER_SCHEMA = "state-generated-files/v1"
WORK_ID_RE = re.compile(r"^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$")
PREFLIGHT_FIELDS = {
    "schema",
    "manifest_path",
    "manifest_sha256",
    "old_head",
    "index_sha256",
    "index_existed",
    "index_file_mode",
    "index_backup_path",
    "index_backup_sha256",
    "selected_paths",
    "excluded_inventory_sha256",
    "excluded_dirty_paths",
    "literal_pathspec_sha256",
    "jj_preflight_state",
}


class ContractError(RuntimeError):
    pass


def run_git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(
        ["git", "-C", os.fspath(repo), *args],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and result.returncode:
        detail = result.stderr.decode("utf-8", "replace").strip()
        raise ContractError(f"git {' '.join(args)} failed: {detail}")
    return result


def run_jj(
    repo: Path,
    *args: str,
    ignore_working_copy: bool = False,
    at_operation: str | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[bytes]:
    if not shutil_which("jj"):
        raise ContractError("manifest declares jj-colocated but jj is unavailable")
    command = [
        "jj",
        "-R",
        os.fspath(repo),
        "--no-pager",
        "--color=never",
    ]
    if ignore_working_copy:
        command.append("--ignore-working-copy")
    if at_operation is not None:
        command.extend(["--at-operation", at_operation])
    command.extend(args)
    result = subprocess.run(
        command,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and result.returncode:
        detail = result.stderr.decode("utf-8", "replace").strip()
        raise ContractError(f"jj {' '.join(args)} failed: {detail}")
    return result


def decode_path(raw: bytes) -> str:
    try:
        value = raw.decode("utf-8", "strict")
    except UnicodeDecodeError as exc:
        raise ContractError("non-UTF-8 repository paths are unsupported") from exc
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ContractError(f"control character in path: {value!r}")
    return value


def decoded_lines(raw: bytes) -> list[str]:
    return [decode_path(line) for line in raw.splitlines() if line]


def absolute_cli_path(value: Any, label: str) -> Path:
    """Reject traversal/non-normalized syntax before touching a CLI path."""
    if not isinstance(value, str) or not value or not value.startswith("/"):
        raise ContractError(f"{label} must be an absolute path")
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ContractError(f"control character in {label}")
    components = value.split("/")[1:]
    if not components or any(component in ("", ".", "..") for component in components):
        raise ContractError(f"{label} contains lexical traversal or non-normalized components")
    path = Path(value)
    if os.fspath(path) != value or os.path.normpath(value) != value:
        raise ContractError(f"{label} is not lexically normalized")
    return path


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_json(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")


def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ContractError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> tuple[dict[str, Any], bytes]:
    try:
        raw = path.read_bytes()
        value = json.loads(raw, object_pairs_hook=unique_object)
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError(f"cannot read JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ContractError(f"JSON root must be an object: {path}")
    return value, raw


def require_exact_keys(value: dict[str, Any], expected: set[str], label: str) -> None:
    actual = set(value)
    if actual != expected:
        raise ContractError(
            f"{label} fields differ: missing={sorted(expected - actual)!r} "
            f"unknown={sorted(actual - expected)!r}"
        )


def check_ignored(repo: Path, path: str) -> bool:
    result = run_git(repo, "check-ignore", "-q", "--no-index", "--", path, check=False)
    if result.returncode not in (0, 1):
        detail = result.stderr.decode("utf-8", "replace").strip()
        raise ContractError(f"git check-ignore failed for {path}: {detail}")
    return result.returncode == 0


def repo_identity(repo_arg: str) -> tuple[Path, dict[str, str]]:
    candidate = Path(repo_arg).resolve(strict=True)
    root = Path(
        decode_path(run_git(candidate, "rev-parse", "--show-toplevel").stdout.strip())
    ).resolve(strict=True)
    common_raw = decode_path(
        run_git(root, "rev-parse", "--path-format=absolute", "--git-common-dir").stdout.strip()
    )
    common = Path(common_raw)
    if not common.is_absolute():
        common = root / common
    common = common.resolve(strict=True)
    git_dir_raw = decode_path(
        run_git(root, "rev-parse", "--path-format=absolute", "--git-dir").stdout.strip()
    )
    git_dir = Path(git_dir_raw)
    if not git_dir.is_absolute():
        git_dir = root / git_dir
    git_dir = git_dir.resolve(strict=True)

    vcs = "git"
    if shutil_which("jj"):
        jj_root_result = run_jj(
            root,
            "root",
            ignore_working_copy=True,
            check=False,
        )
        if jj_root_result.returncode != 0 and (root / ".jj").exists():
            detail = jj_root_result.stderr.decode("utf-8", "replace").strip()
            raise ContractError(
                "jj workspace detected, but the installed jj cannot perform the required "
                f"non-snapshotting root capability probe: {detail}"
            )
        if jj_root_result.returncode == 0:
            jj_root = Path(decode_path(jj_root_result.stdout.strip())).resolve(strict=True)
            if jj_root != root:
                raise ContractError(
                    "jj workspace root differs from the canonical Git worktree root"
                )
            jj_git_result = run_jj(
                root,
                "git",
                "root",
                ignore_working_copy=True,
                check=False,
            )
            if jj_git_result.returncode:
                raise ContractError(
                    "jj workspace is present but has no structurally provable colocated Git root"
                )
            jj_git_dir = Path(decode_path(jj_git_result.stdout.strip())).resolve(strict=True)
            bare = decode_path(
                run_git(root, "rev-parse", "--is-bare-repository").stdout.strip()
            )
            if bare != "false":
                raise ContractError("jj scoped save requires a non-bare colocated Git repository")
            if git_dir != common:
                raise ContractError(
                    "jj scoped save does not support a linked Git worktree; use a jj workspace"
                )
            if jj_git_dir != git_dir or jj_git_dir != common:
                raise ContractError(
                    "jj Git root differs from Git --git-dir/--git-common-dir; colocation is not proven"
                )
            colocation = run_jj(
                root,
                "git",
                "colocation",
                "status",
                ignore_working_copy=True,
                check=False,
            )
            if colocation.returncode:
                raise ContractError("jj cannot confirm Git colocation status")
            vcs = "jj-colocated"

    return root, {
        "canonical_root": os.fspath(root),
        "vcs": vcs,
        "git_common_dir": os.fspath(common),
    }


def current_head(repo: Path) -> str:
    return decode_path(run_git(repo, "rev-parse", "--verify", "HEAD^{commit}").stdout.strip())


def require_jj_scoped_save_capabilities(repo: Path, selected: list[str]) -> None:
    """Dynamically prove every jj syntax feature used by this helper."""
    operation_probe = run_jj(
        repo,
        "op",
        "log",
        "-n",
        "1",
        "--no-graph",
        "-T",
        "self.id() ++ \"\\n\"",
        ignore_working_copy=True,
        check=False,
    )
    if operation_probe.returncode:
        detail = operation_probe.stderr.decode("utf-8", "replace").strip()
        raise ContractError(
            "installed jj lacks the scoped-save operation/template capability: " + detail
        )
    operation_id = decode_path(operation_probe.stdout.strip())
    if not operation_id:
        raise ContractError("installed jj returned no operation id during capability probing")

    probes: list[tuple[str, tuple[str, ...]]] = [
        (
            "commit/change identity template",
            (
                "log",
                "-r",
                "@",
                "--no-graph",
                "-T",
                "commit_id ++ change_id ++ \"\\n\"",
            ),
        ),
        (
            "conflicts revset",
            ("log", "-r", "@ & conflicts()", "--no-graph", "-T", "commit_id ++ \"\\n\""),
        ),
        (
            "mutable revset",
            ("log", "-r", "@ & mutable()", "--no-graph", "-T", "commit_id ++ \"\\n\""),
        ),
        (
            "divergent revset",
            ("log", "-r", "@ & divergent()", "--no-graph", "-T", "commit_id ++ \"\\n\""),
        ),
        (
            "working-copy parents revset",
            ("log", "-r", "parents(@)", "--no-graph", "-T", "commit_id ++ \"\\n\""),
        ),
        ("Git-format selected diff", ("diff", "-r", "@", "--git", "--", *selected)),
    ]
    for label, command in probes:
        result = run_jj(
            repo,
            *command,
            ignore_working_copy=True,
            at_operation=operation_id,
            check=False,
        )
        if result.returncode:
            detail = result.stderr.decode("utf-8", "replace").strip()
            raise ContractError(
                f"installed jj lacks required scoped-save capability ({label}): {detail}"
            )


def jj_workspace_state(repo: Path, selected: list[str]) -> dict[str, Any]:
    staged = run_git(repo, "diff-index", "--cached", "--quiet", "HEAD", "--", check=False)
    if staged.returncode == 1:
        raise ContractError("jj scoped save blocks ambient staged Git index entries")
    if staged.returncode != 0:
        detail = staged.stderr.decode("utf-8", "replace").strip()
        raise ContractError(f"cannot prove a clean ambient Git index for jj: {detail}")
    require_jj_scoped_save_capabilities(repo, selected)

    # This is the one intentional working-copy snapshot. All identity reads after
    # it ignore the working copy and are pinned to the resulting operation.
    run_jj(repo, "status")
    operation_id = decode_path(
        run_jj(
            repo,
            "op",
            "log",
            "-n",
            "1",
            "--no-graph",
            "-T",
            "self.id() ++ \"\\n\"",
            ignore_working_copy=True,
        ).stdout.strip()
    )
    if not operation_id:
        raise ContractError("cannot capture the jj operation after working-copy snapshot")

    conflicts = decoded_lines(
        run_jj(
            repo,
            "log",
            "-r",
            "@ & conflicts()",
            "--no-graph",
            "-T",
            "commit_id ++ \"\\n\"",
            ignore_working_copy=True,
            at_operation=operation_id,
        ).stdout
    )
    if conflicts:
        raise ContractError("jj working-copy change has unresolved conflicts")
    mutable = decoded_lines(
        run_jj(
            repo,
            "log",
            "-r",
            "@ & mutable()",
            "--no-graph",
            "-T",
            "commit_id ++ \"\\n\"",
            ignore_working_copy=True,
            at_operation=operation_id,
        ).stdout
    )
    if len(mutable) != 1:
        raise ContractError("jj working-copy change is not uniquely mutable")
    divergent = decoded_lines(
        run_jj(
            repo,
            "log",
            "-r",
            "@ & divergent()",
            "--no-graph",
            "-T",
            "commit_id ++ \"\\n\"",
            ignore_working_copy=True,
            at_operation=operation_id,
        ).stdout
    )
    if divergent:
        raise ContractError("jj working-copy change id is divergent")
    commit_id = decode_path(
        run_jj(
            repo,
            "log",
            "-r",
            "@",
            "--no-graph",
            "-T",
            "commit_id ++ \"\\n\"",
            ignore_working_copy=True,
            at_operation=operation_id,
        ).stdout.strip()
    )
    change_id = decode_path(
        run_jj(
            repo,
            "log",
            "-r",
            "@",
            "--no-graph",
            "-T",
            "change_id ++ \"\\n\"",
            ignore_working_copy=True,
            at_operation=operation_id,
        ).stdout.strip()
    )
    parents = decoded_lines(
        run_jj(
            repo,
            "log",
            "-r",
            "parents(@)",
            "--no-graph",
            "-T",
            "commit_id ++ \"\\n\"",
            ignore_working_copy=True,
            at_operation=operation_id,
        ).stdout
    )
    if not commit_id or not change_id or len(parents) != 1:
        raise ContractError("cannot capture complete jj working-copy identity")
    git_head = current_head(repo)
    if parents != [git_head]:
        raise ContractError(
            "jj working-copy change must have Git HEAD as its exact sole parent"
        )
    if run_git(repo, "cat-file", "-e", f"{commit_id}^{{commit}}", check=False).returncode:
        raise ContractError("jj working-copy commit is not present in the colocated Git object store")
    diff = run_jj(
        repo,
        "diff",
        "-r",
        "@",
        "--git",
        "--",
        *selected,
        ignore_working_copy=True,
        at_operation=operation_id,
    ).stdout
    current_operation = decode_path(
        run_jj(
            repo,
            "op",
            "log",
            "-n",
            "1",
            "--no-graph",
            "-T",
            "self.id() ++ \"\\n\"",
            ignore_working_copy=True,
        ).stdout.strip()
    )
    if current_operation != operation_id:
        raise ContractError("jj operation changed while capturing scoped-save identity")
    return {
        "operation_id": operation_id,
        "working_copy_commit_id": commit_id,
        "working_copy_change_id": change_id,
        "parent_commit_ids": parents,
        "git_head": git_head,
        "mutable": True,
        "conflicts": False,
        "divergent": False,
        "selected_diff_sha256": sha256_bytes(diff),
    }


def capture_build_state(
    repo: Path, identity: dict[str, str], selected: list[str]
) -> dict[str, Any]:
    if identity["vcs"] == "jj-colocated":
        jj_state = jj_workspace_state(repo, selected)
        return {"head_commit": jj_state["git_head"], "jj": jj_state}
    return {
        "head_commit": current_head(repo),
        "jj": None,
    }


def validate_build_state_shape(manifest: dict[str, Any]) -> dict[str, Any]:
    state = manifest.get("build_state")
    if not isinstance(state, dict):
        raise ContractError("manifest build_state must be an object")
    require_exact_keys(state, {"head_commit", "jj"}, "manifest build_state")
    if not isinstance(state.get("head_commit"), str) or not state["head_commit"]:
        raise ContractError("manifest build_state head_commit is invalid")
    jj_state = state.get("jj")
    if manifest["repository"]["vcs"] == "jj-colocated":
        if not isinstance(jj_state, dict):
            raise ContractError("manifest lacks sealed jj build identity")
        require_exact_keys(
            jj_state,
            {
                "operation_id",
                "working_copy_commit_id",
                "working_copy_change_id",
                "parent_commit_ids",
                "git_head",
                "mutable",
                "conflicts",
                "divergent",
                "selected_diff_sha256",
            },
            "manifest jj build state",
        )
        if (
            jj_state.get("mutable") is not True
            or jj_state.get("conflicts") is not False
            or jj_state.get("divergent") is not False
        ):
            raise ContractError("manifest jj build state is not mutable/conflict-free/non-divergent")
        if jj_state.get("git_head") != state["head_commit"]:
            raise ContractError("manifest jj build state is not bound to its Git HEAD")
        parents = jj_state.get("parent_commit_ids")
        if parents != [state["head_commit"]]:
            raise ContractError("manifest jj build state lacks the exact Git HEAD parent")
    elif jj_state is not None:
        raise ContractError("plain Git manifest cannot contain jj build state")
    return state


def require_unchanged_build_state(
    repo: Path, manifest: dict[str, Any], selected: list[str]
) -> dict[str, Any]:
    state = validate_build_state_shape(manifest)
    if state.get("head_commit") != current_head(repo):
        raise ContractError("repository HEAD changed after scoped manifest sealing")
    if manifest["repository"]["vcs"] == "jj-colocated":
        expected_jj = state.get("jj")
        if not isinstance(expected_jj, dict):
            raise ContractError("manifest lacks sealed jj build identity")
        current = jj_workspace_state(repo, selected)
        if current != expected_jj:
            raise ContractError("jj operation/working-copy identity changed after manifest sealing")
    return state


def shutil_which(command: str) -> str | None:
    paths = os.environ.get("PATH", os.defpath).split(os.pathsep)
    for directory in paths:
        candidate = Path(directory) / command
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return os.fspath(candidate)
    return None


def ensure_no_symlink_chain(path: Path, stop: Path) -> None:
    stop = stop.resolve(strict=True)
    try:
        relative = path.absolute().relative_to(stop)
    except ValueError as exc:
        raise ContractError(f"path escapes repository: {path}") from exc
    cursor = stop
    for component in relative.parts:
        cursor = cursor / component
        try:
            mode = cursor.lstat().st_mode
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(mode):
            raise ContractError(f"symlink traversal is not allowed: {cursor}")


def safe_mkdirs(base: Path, *components: str) -> Path:
    """Create descendants through directory fds so symlinks cannot redirect writes."""
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(base, flags)
    cursor = base
    try:
        for component in components:
            if component in ("", ".", "..") or "/" in component:
                raise ContractError(f"unsafe artifacts directory component: {component!r}")
            try:
                os.mkdir(component, 0o700, dir_fd=descriptor)
            except FileExistsError:
                pass
            next_descriptor = os.open(component, flags, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = next_descriptor
            cursor = cursor / component
    except OSError as exc:
        raise ContractError(f"cannot create safe artifacts directory under {base}: {exc}") from exc
    finally:
        os.close(descriptor)
    return cursor


def validate_relative_path(repo: Path, value: Any, *, leaf_symlink: bool = True) -> str:
    if not isinstance(value, str) or not value:
        raise ContractError("path must be a non-empty UTF-8 string")
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ContractError(f"control character in path: {value!r}")
    if value.startswith(":"):
        raise ContractError(f"Git pathspec magic is forbidden: {value}")
    pure = PurePosixPath(value)
    if pure.is_absolute() or value != pure.as_posix() or any(
        component in ("", ".", "..") for component in pure.parts
    ):
        raise ContractError(f"path is not normalized repo-relative POSIX syntax: {value}")

    cursor = repo
    for index, component in enumerate(pure.parts):
        cursor = cursor / component
        try:
            mode = cursor.lstat().st_mode
        except FileNotFoundError:
            continue
        is_leaf = index == len(pure.parts) - 1
        if stat.S_ISLNK(mode) and not (is_leaf and leaf_symlink):
            raise ContractError(f"symlink parent/path ambiguity: {value}")
        if not is_leaf and not stat.S_ISDIR(mode):
            raise ContractError(f"non-directory path parent: {value}")
    return value


def physical_state(repo: Path, relative: str) -> tuple[str, str | None, str | None]:
    path = repo / relative
    try:
        mode = path.lstat().st_mode
    except FileNotFoundError:
        return "deleted", None, None
    if stat.S_ISLNK(mode):
        return "symlink", sha256_bytes(os.fsencode(os.readlink(path))), "120000"
    if stat.S_ISREG(mode):
        object_mode = "100755" if mode & 0o111 else "100644"
        return "file", sha256_bytes(path.read_bytes()), object_mode
    raise ContractError(f"selected/publication path is not a file, symlink, or deletion: {relative}")


def reject_ambiguous_index_flags(repo: Path) -> None:
    filemode = run_git(repo, "config", "--bool", "core.filemode", check=False)
    if filemode.returncode not in (0, 1):
        raise ContractError("cannot determine core.filemode for exact scoped proof")
    if filemode.stdout.decode("utf-8", "replace").strip().lower() == "false":
        raise ContractError(
            "core.filemode=false makes repository-wide executable-mode preservation ambiguous"
        )
    raw = run_git(repo, "ls-files", "-v", "-z").stdout
    for record in raw.split(b"\0"):
        if not record:
            continue
        if len(record) < 3 or record[1:2] != b" ":
            raise ContractError("malformed git ls-files -v record")
        tag = chr(record[0])
        path = validate_relative_path(repo, decode_path(record[2:]))
        if tag == "S" or tag.islower():
            raise ContractError(
                f"skip-worktree/assume-unchanged index flag makes scoped proof ambiguous: {path}"
            )


def index_entry(repo: Path, path: str) -> tuple[str, str | None, str | None]:
    raw = run_git(repo, "ls-files", "--stage", "-z", "--", f":(literal){path}").stdout
    records = [record for record in raw.split(b"\0") if record]
    if not records:
        return "deleted", None, None
    if len(records) != 1:
        raise ContractError(f"unmerged/multiple index stages cannot be isolated: {path}")
    header, separator, returned = records[0].partition(b"\t")
    if not separator or decode_path(returned) != path:
        raise ContractError(f"malformed index entry for {path}")
    fields = header.decode("ascii").split(" ")
    if len(fields) != 3:
        raise ContractError(f"malformed index metadata for {path}")
    mode, oid, stage = fields
    if stage != "0":
        raise ContractError(f"unmerged index stage cannot be isolated: {path}")
    if set(oid) == {"0"}:
        return "deleted", None, None
    if mode not in ("100644", "100755", "120000"):
        raise ContractError(f"unsupported index object mode for {path}: {mode}")
    content = run_git(repo, "cat-file", "blob", oid).stdout
    return ("symlink" if mode == "120000" else "file"), sha256_bytes(content), mode


def direct_publication_dirty(
    repo: Path, publication: dict[str, dict[str, Any]]
) -> set[str]:
    dirty: set[str] = set()
    core_filemode = decode_path(
        run_git(repo, "config", "--bool", "core.filemode", check=False).stdout.strip()
    )
    for path in publication:
        worktree = physical_state(repo, path)
        indexed = index_entry(repo, path)
        headed = tree_entry(repo, "HEAD", path)
        if (
            core_filemode == "false"
            and worktree[0] == "file"
            and indexed[0] == "file"
            and worktree[2] != indexed[2]
        ):
            raise ContractError(
                f"core.filemode=false hides a publication mode mismatch that cannot be saved safely: {path}"
            )
        if worktree != indexed or indexed != headed:
            dirty.add(path)
    return dirty


def reject_selected_clean_filters(repo: Path, selected: list[str]) -> None:
    attributes = ("filter", "text", "eol", "working-tree-encoding", "ident")
    autocrlf_result = run_git(repo, "config", "--get", "core.autocrlf", check=False)
    if autocrlf_result.returncode not in (0, 1):
        raise ContractError("cannot determine core.autocrlf before scoped save")
    autocrlf = autocrlf_result.stdout.decode("utf-8", "replace").strip().lower()
    for path in selected:
        raw = run_git(repo, "check-attr", "-z", *attributes, "--", path).stdout.split(b"\0")
        values = [item for item in raw if item]
        if len(values) != len(attributes) * 3:
            raise ContractError(f"cannot determine clean-transform state for selected path: {path}")
        for offset, attribute in enumerate(attributes):
            returned_path, returned_attr, raw_value = values[offset * 3 : offset * 3 + 3]
            if decode_path(returned_path) != path or decode_path(returned_attr) != attribute:
                raise ContractError(f"malformed clean-transform attributes for selected path: {path}")
            value = decode_path(raw_value)
            if value not in ("unspecified", "unset"):
                raise ContractError(
                    f"selected path has a Git clean transform and is blocked before mutation: "
                    f"{path} ({attribute}={value})"
                )
        if autocrlf not in ("", "false") and physical_state(repo, path)[0] == "file":
            raise ContractError(
                f"core.autocrlf={autocrlf} may clean-transform selected path; blocked before mutation: {path}"
            )


def status_inventory(repo: Path) -> dict[str, dict[str, Any]]:
    reject_ambiguous_index_flags(repo)
    raw = run_git(
        repo,
        "status",
        "--porcelain=v2",
        "-z",
        "--untracked-files=all",
        "--ignore-submodules=none",
    ).stdout
    chunks = raw.split(b"\0")
    result: dict[str, dict[str, Any]] = {}
    index = 0
    while index < len(chunks):
        record = chunks[index]
        index += 1
        if not record:
            continue
        kind = record[:1]
        records: list[tuple[str, str]] = []
        if kind == b"1":
            fields = record.split(b" ", 8)
            if len(fields) != 9:
                raise ContractError("malformed porcelain-v2 ordinary record")
            prefix, raw_path = b" ".join(fields[:8]), fields[8]
            records.append((decode_path(raw_path), prefix.decode("ascii", "strict")))
        elif kind == b"2":
            fields = record.split(b" ", 9)
            if len(fields) != 10 or index >= len(chunks):
                raise ContractError("malformed porcelain-v2 rename/copy record")
            prefix, raw_path = b" ".join(fields[:9]), fields[9]
            destination = decode_path(raw_path)
            original = decode_path(chunks[index])
            index += 1
            prefix_text = prefix.decode("ascii", "strict")
            records.append(
                (
                    destination,
                    f"{prefix_text} role=destination original={json.dumps(original, ensure_ascii=False)}",
                )
            )
            if fields[8].startswith(b"R"):
                records.append(
                    (
                        original,
                        f"{prefix_text} role=source destination={json.dumps(destination, ensure_ascii=False)}",
                    )
                )
        elif kind == b"u":
            raise ContractError("unmerged index entries cannot be isolated safely")
        elif kind in (b"?", b"!"):
            prefix, raw_path = kind, record[2:]
            records.append((decode_path(raw_path), prefix.decode("ascii", "strict")))
        else:
            raise ContractError(f"unknown porcelain-v2 record: {record[:20]!r}")

        for raw_value, status in records:
            path = validate_relative_path(repo, raw_value)
            if path in result:
                raise ContractError(f"duplicate dirty status path: {path}")
            state, digest, object_mode = physical_state(repo, path)
            result[path] = {
                "path": path,
                "state": state,
                "sha256": digest,
                "mode": object_mode,
                "status": status,
            }
    return result


def normalize_publication_request(
    repo: Path, request: dict[str, Any]
) -> tuple[list[dict[str, Any]], list[str]]:
    require_exact_keys(
        request,
        {
            "schema",
            "work_id",
            "scope_complete",
            "publication_paths",
            "selected_paths",
            "generated_file_manifests",
        },
        "scope request",
    )
    if request.get("schema") != REQUEST_SCHEMA:
        raise ContractError(f"scope request schema must be {REQUEST_SCHEMA}")
    raw_publication = request.get("publication_paths")
    raw_selected = request.get("selected_paths")
    if not isinstance(raw_publication, list) or not isinstance(raw_selected, list):
        raise ContractError("publication_paths and selected_paths must be arrays")

    publication: list[dict[str, Any]] = []
    seen: set[str] = set()
    folded: set[str] = set()
    for entry in raw_publication:
        if not isinstance(entry, dict):
            raise ContractError("publication path entry must be an object")
        require_exact_keys(entry, {"path", "origin"}, "scope publication entry")
        path = validate_relative_path(repo, entry.get("path"))
        origin = entry.get("origin")
        if not isinstance(origin, str) or not origin.strip():
            raise ContractError(f"publication path lacks lifecycle origin: {path}")
        if path in seen or path.casefold() in folded:
            raise ContractError(f"duplicate/case-colliding publication path: {path}")
        if path == ".state/working.md" or path.startswith(".state/works/"):
            raise ContractError(f"ignored local state cannot be published: {path}")
        if check_ignored(repo, path):
            raise ContractError(f"publishable lifecycle path is ignored: {path}")
        seen.add(path)
        folded.add(path.casefold())
        state, digest, object_mode = physical_state(repo, path)
        publication.append(
            {
                "path": path,
                "state": state,
                "sha256": digest,
                "mode": object_mode,
                "origin": origin,
            }
        )

    selected: list[str] = []
    for raw_path in raw_selected:
        path = validate_relative_path(repo, raw_path)
        if path not in seen:
            raise ContractError(f"selected path is outside publication_paths: {path}")
        if path in selected:
            raise ContractError(f"duplicate selected path: {path}")
        selected.append(path)
    return sorted(publication, key=lambda entry: entry["path"]), sorted(selected)


def validate_work_artifacts(repo: Path, work_root_arg: str, work_id: str, child: Path) -> Path:
    work_root = absolute_cli_path(work_root_arg, "--work-root")
    expected = repo / ".state" / "works" / work_id
    if work_root != expected:
        raise ContractError(f"work root must be {expected}")
    ensure_no_symlink_chain(work_root, repo)
    if not work_root.is_dir():
        raise ContractError(f"work root does not exist: {work_root}")
    child_abs = absolute_cli_path(os.fspath(child), "artifacts path")
    try:
        relative = child_abs.relative_to(work_root / "artifacts")
    except ValueError as exc:
        raise ContractError(f"artifacts path is outside work artifacts: {child_abs}") from exc
    if not relative.parts:
        raise ContractError("artifacts path must name a file")
    ensure_no_symlink_chain(child_abs, repo)
    if not child_abs.is_file():
        raise ContractError(f"artifacts path is not a regular file: {child_abs}")
    repo_relative = child_abs.relative_to(repo).as_posix()
    if not check_ignored(repo, repo_relative):
        raise ContractError(f"work artifacts must be ignored: {child_abs}")
    return work_root


def validate_artifacts_pointer(repo: Path, work_root: Path, value: Any) -> tuple[Path, str]:
    if not isinstance(value, str) or not value:
        raise ContractError("generated-file artifacts pointer must be a non-empty path")
    if value.startswith("/"):
        candidate = absolute_cli_path(value, "generated-file artifacts pointer")
    else:
        pure = PurePosixPath(value)
        if (
            pure.is_absolute()
            or value != pure.as_posix()
            or any(component in ("", ".", "..") for component in pure.parts)
        ):
            raise ContractError("generated-file artifacts pointer is not lexically normalized")
        if pure.parts and pure.parts[0] == "artifacts":
            candidate = work_root.joinpath(*pure.parts)
        elif tuple(pure.parts[:4]) == (
            ".state",
            "works",
            work_root.name,
            "artifacts",
        ):
            candidate = repo.joinpath(*pure.parts)
        else:
            raise ContractError(
                "generated-file artifacts pointer must be absolute, work-root-relative artifacts/, "
                "or repo-relative .state/works/<id>/artifacts/"
            )
    try:
        relative = candidate.relative_to(work_root / "artifacts")
    except ValueError as exc:
        raise ContractError("generated-file artifacts pointer escapes work artifacts") from exc
    if not relative.parts:
        raise ContractError("generated-file artifacts pointer must name a file")
    ensure_no_symlink_chain(candidate, repo)
    if not candidate.is_file():
        raise ContractError(f"generated-file artifacts pointer is not a regular file: {candidate}")
    if not check_ignored(repo, candidate.relative_to(repo).as_posix()):
        raise ContractError(f"generated-file artifacts pointer must be ignored: {candidate}")
    return candidate, candidate.relative_to(repo).as_posix()


def load_producer_receipt(
    repo: Path,
    work_root: Path,
    value: Any,
    expected_base_rev: str,
) -> tuple[dict[str, str], dict[str, dict[str, Any]]]:
    candidate, relative = validate_artifacts_pointer(repo, work_root, value)
    receipt, raw = load_json(candidate)
    if raw != canonical_json(receipt):
        raise ContractError(f"generated-files receipt is not canonical JSON: {relative}")
    require_exact_keys(
        receipt,
        {"schema", "producer", "base_rev", "generated_files"},
        "generated-files receipt",
    )
    if receipt.get("schema") != PRODUCER_SCHEMA:
        raise ContractError(f"generated-files receipt schema must be {PRODUCER_SCHEMA}: {relative}")
    producer = receipt.get("producer")
    if not isinstance(producer, str) or not producer.strip():
        raise ContractError(f"generated-files receipt producer is missing: {relative}")
    if receipt.get("base_rev") != expected_base_rev:
        raise ContractError(f"generated-files receipt base_rev differs: {relative}")
    generated = receipt.get("generated_files")
    if not isinstance(generated, list) or not generated:
        raise ContractError(f"generated-files receipt must declare generated_files: {relative}")

    entries: dict[str, dict[str, Any]] = {}
    folded: set[str] = set()
    for entry in generated:
        if not isinstance(entry, dict):
            raise ContractError(f"generated-files entry must be an object: {relative}")
        require_exact_keys(entry, {"path", "state", "sha256", "mode"}, "generated-files entry")
        path = validate_relative_path(repo, entry.get("path"))
        if path in entries or path.casefold() in folded:
            raise ContractError(f"duplicate/case-colliding generated path: {path}")
        if path == ".state/working.md" or path.startswith(".state/works/"):
            raise ContractError(f"ignored work state cannot be producer-generated: {path}")
        if check_ignored(repo, path):
            raise ContractError(f"producer-generated publication path is ignored: {path}")
        state, digest, object_mode = physical_state(repo, path)
        if (
            entry.get("state") != state
            or entry.get("sha256") != digest
            or entry.get("mode") != object_mode
        ):
            raise ContractError(f"generated-files receipt content/state/mode is stale: {path}")
        entries[path] = entry
        folded.add(path.casefold())
    return {"path": relative, "sha256": sha256_bytes(raw)}, entries


def reconcile_producer_receipts(
    repo: Path,
    work_root: Path,
    sources: list[Any],
    base_rev: str,
    publication: dict[str, dict[str, Any]],
) -> list[dict[str, str]]:
    bindings: list[dict[str, str]] = []
    declared: dict[str, dict[str, Any]] = {}
    for source in sources:
        binding, entries = load_producer_receipt(repo, work_root, source, base_rev)
        if any(existing["path"] == binding["path"] for existing in bindings):
            raise ContractError(f"duplicate generated-files receipt: {binding['path']}")
        bindings.append(binding)
        for path, entry in entries.items():
            if path in declared:
                raise ContractError(f"multiple producer receipts claim publication path: {path}")
            declared[path] = entry
    if set(declared) != set(publication):
        raise ContractError(
            "producer generated_files must equal publication scope exactly: "
            f"missing={sorted(set(publication) - set(declared))!r} "
            f"extra={sorted(set(declared) - set(publication))!r}"
        )
    for path, entry in declared.items():
        published = publication[path]
        for key in ("state", "sha256", "mode"):
            if entry.get(key) != published.get(key):
                raise ContractError(f"producer/publication {key} differs for {path}")
    return sorted(bindings, key=lambda item: item["path"])


def write_exclusive(path: Path, raw: bytes, mode: int = 0o444) -> None:
    directory_flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    parent_fd = os.open(path.parent, directory_flags)
    try:
        fd = os.open(
            path.name,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
            mode,
            dir_fd=parent_fd,
        )
    finally:
        os.close(parent_fd)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
    except BaseException:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        raise


def write_or_verify_immutable(path: Path, raw: bytes, mode: int = 0o444) -> None:
    if path.exists():
        if path.is_symlink() or path.read_bytes() != raw:
            raise ContractError(f"immutable artifacts collision: {path}")
        return
    write_exclusive(path, raw, mode)


def cmd_build(args: argparse.Namespace) -> dict[str, Any]:
    repo, identity = repo_identity(args.repo)
    request_path = absolute_cli_path(args.scope, "--scope")
    request, _ = load_json(request_path)
    work_id = request.get("work_id")
    if not isinstance(work_id, str) or not WORK_ID_RE.fullmatch(work_id):
        raise ContractError("scope request work_id must match the resolver lowercase-kebab grammar")
    work_root = validate_work_artifacts(repo, args.work_root, work_id, request_path)
    base_rev = decode_path(
        run_git(repo, "rev-parse", "--verify", f"{args.base_rev}^{{commit}}").stdout.strip()
    )

    publication, selected = normalize_publication_request(repo, request)
    publication_by_path = {entry["path"]: entry for entry in publication}
    dirty = status_inventory(repo)
    dirty_publication = sorted(direct_publication_dirty(repo, publication_by_path))
    if selected != dirty_publication:
        raise ContractError(
            "selected_paths must equal the exact dirty publication subset: "
            f"declared={selected!r} actual={dirty_publication!r}"
        )
    if not selected:
        raise ContractError("scoped-save manifest requires at least one dirty selected path")

    if not set(selected).issubset(dirty):
        raise ContractError(
            f"direct publication comparison found dirty paths absent from Git status: {sorted(set(selected) - set(dirty))!r}"
        )
    selected_entries = []
    for path in selected:
        entry = dict(publication_by_path[path])
        entry["status"] = dirty[path]["status"]
        selected_entries.append(entry)
    excluded = [dirty[path] for path in sorted(set(dirty) - set(selected))]
    sources = request.get("generated_file_manifests", [])
    if not isinstance(sources, list) or not all(isinstance(item, str) and item for item in sources):
        raise ContractError("generated_file_manifests must be an array of non-empty strings")
    source_bindings = reconcile_producer_receipts(
        repo,
        work_root,
        sources,
        base_rev,
        publication_by_path,
    )
    if request.get("scope_complete") is not True:
        raise ContractError("scope_complete must be true after lifecycle reconciliation")
    build_state = capture_build_state(repo, identity, selected)

    manifest = {
        "schema": SCHEMA,
        "work_id": work_id,
        "repository": identity,
        "base_rev": base_rev,
        "build_state": build_state,
        "publication_paths": publication,
        "selected_paths": selected_entries,
        "excluded_dirty_paths": excluded,
        "scope_attestation": {
            "complete": True,
            "generated_file_manifests": source_bindings,
            "excluded_owner": "user",
        },
    }
    raw = canonical_json(manifest)
    digest = sha256_bytes(raw)
    directory = safe_mkdirs(work_root, "artifacts", "history", "save-manifests")
    ensure_no_symlink_chain(directory, repo)
    output = directory / f"{digest}.json"
    write_or_verify_immutable(output, raw)
    return {
        "status": "sealed",
        "manifest_path": os.fspath(output),
        "manifest_sha256": digest,
        "selected_paths": selected,
        "invocation": f"/coding:commit --paths-from={output} --manifest-sha256={digest}",
    }


def validate_manifest(repo: Path, manifest_path: Path, expected_sha: str) -> tuple[dict[str, Any], str]:
    manifest_path = absolute_cli_path(os.fspath(manifest_path), "--manifest")
    if len(expected_sha) != 64 or any(char not in "0123456789abcdef" for char in expected_sha):
        raise ContractError("manifest SHA-256 must be 64 lowercase hexadecimal characters")
    manifest, raw = load_json(manifest_path)
    if raw != canonical_json(manifest):
        raise ContractError("manifest bytes are not canonical JSON")
    actual_sha = sha256_bytes(raw)
    if actual_sha != expected_sha:
        raise ContractError(f"manifest checksum mismatch: expected {expected_sha}, got {actual_sha}")
    if manifest_path.name != f"{expected_sha}.json":
        raise ContractError("manifest filename is not bound to its SHA-256")
    if manifest.get("schema") != SCHEMA:
        raise ContractError(f"manifest schema must be {SCHEMA}")
    require_exact_keys(
        manifest,
        {
            "schema",
            "work_id",
            "repository",
            "base_rev",
            "build_state",
            "publication_paths",
            "selected_paths",
            "excluded_dirty_paths",
            "scope_attestation",
        },
        "manifest",
    )
    work_id = manifest.get("work_id")
    if not isinstance(work_id, str) or not WORK_ID_RE.fullmatch(work_id):
        raise ContractError("manifest work_id must match the resolver lowercase-kebab grammar")
    work_root = validate_work_artifacts(
        repo,
        os.fspath(repo / ".state" / "works" / work_id),
        work_id,
        manifest_path,
    )
    _, identity = repo_identity(os.fspath(repo))
    repository = manifest.get("repository")
    if not isinstance(repository, dict):
        raise ContractError("manifest repository must be an object")
    require_exact_keys(
        repository,
        {"canonical_root", "vcs", "git_common_dir"},
        "manifest repository",
    )
    if manifest.get("repository") != identity:
        raise ContractError("manifest repository identity does not match the current repository")
    validate_build_state_shape(manifest)
    base_rev = manifest.get("base_rev")
    if not isinstance(base_rev, str):
        raise ContractError("manifest base_rev is missing")
    run_git(repo, "rev-parse", "--verify", f"{base_rev}^{{commit}}")
    attestation = manifest.get("scope_attestation")
    if not isinstance(attestation, dict):
        raise ContractError("manifest scope_attestation must be an object")
    sources = attestation.get("generated_file_manifests")
    if not isinstance(sources, list):
        raise ContractError("manifest generated_file_manifests must be an array")
    source_paths: list[str] = []
    for source in sources:
        if not isinstance(source, dict):
            raise ContractError("manifest generated-file binding must be an object")
        require_exact_keys(source, {"path", "sha256"}, "generated-file binding")
        if not isinstance(source.get("path"), str) or not isinstance(source.get("sha256"), str):
            raise ContractError("generated-file binding path/hash is invalid")
        source_paths.append(source["path"])
    publication_values = manifest.get("publication_paths")
    if not isinstance(publication_values, list):
        raise ContractError("manifest publication_paths must be an array")
    publication_map: dict[str, dict[str, Any]] = {}
    for entry in publication_values:
        if not isinstance(entry, dict):
            raise ContractError("manifest publication entry must be an object")
        path = validate_relative_path(repo, entry.get("path"))
        if path in publication_map:
            raise ContractError(f"duplicate manifest publication path: {path}")
        publication_map[path] = entry
    actual_bindings = reconcile_producer_receipts(
        repo,
        work_root,
        source_paths,
        base_rev,
        publication_map,
    )
    if actual_bindings != sources:
        raise ContractError("generated-files receipt path/hash bindings changed after sealing")
    return manifest, actual_sha


def validate_manifest_state(
    repo: Path,
    manifest: dict[str, Any],
    *,
    after_save: bool,
    recovery_inspection: bool = False,
) -> dict[str, Any]:
    publication = manifest.get("publication_paths")
    selected = manifest.get("selected_paths")
    excluded = manifest.get("excluded_dirty_paths")
    attestation = manifest.get("scope_attestation")
    if not all(isinstance(value, list) for value in (publication, selected, excluded)):
        raise ContractError("manifest path collections must be arrays")
    if not isinstance(attestation, dict) or attestation.get("complete") is not True:
        raise ContractError("manifest scope attestation is incomplete")

    def entries(values: list[Any], label: str, require_status: bool) -> dict[str, dict[str, Any]]:
        result: dict[str, dict[str, Any]] = {}
        folded: set[str] = set()
        for value in values:
            if not isinstance(value, dict):
                raise ContractError(f"{label} entry must be an object")
            expected_fields = {"path", "state", "sha256", "mode"}
            if label in ("publication", "selected"):
                expected_fields.add("origin")
            if require_status:
                expected_fields.add("status")
            require_exact_keys(value, expected_fields, f"{label} entry")
            path = validate_relative_path(repo, value.get("path"))
            if label == "publication":
                if path == ".state/working.md" or path.startswith(".state/works/"):
                    raise ContractError(f"ignored local state cannot be published: {path}")
                if check_ignored(repo, path):
                    raise ContractError(f"publishable lifecycle path is ignored: {path}")
            if path in result or path.casefold() in folded:
                raise ContractError(f"duplicate/case-colliding {label} path: {path}")
            if require_status and not isinstance(value.get("status"), str):
                raise ContractError(f"{label} entry lacks canonical status: {path}")
            if value.get("state") not in ("file", "symlink", "deleted"):
                raise ContractError(f"invalid {label} state: {path}")
            if value.get("state") == "deleted":
                if value.get("sha256") is not None or value.get("mode") is not None:
                    raise ContractError(f"deleted {label} path must have null hash/mode: {path}")
            elif not (
                isinstance(value.get("sha256"), str)
                and len(value["sha256"]) == 64
                and all(char in "0123456789abcdef" for char in value["sha256"])
            ):
                raise ContractError(f"invalid SHA-256 for {label} path: {path}")
            if value.get("state") != "deleted" and value.get("mode") not in (
                "100644",
                "100755",
                "120000",
            ):
                raise ContractError(f"invalid Git object mode for {label} path: {path}")
            if value.get("state") == "symlink" and value.get("mode") != "120000":
                raise ContractError(f"symlink mode must be 120000: {path}")
            if value.get("state") == "file" and value.get("mode") == "120000":
                raise ContractError(f"regular file cannot use symlink mode: {path}")
            if label in ("publication", "selected") and not (
                isinstance(value.get("origin"), str) and value["origin"].strip()
            ):
                raise ContractError(f"{label} path lacks lifecycle origin: {path}")
            current_state, current_hash, current_mode = physical_state(repo, path)
            if (
                value.get("state") != current_state
                or value.get("sha256") != current_hash
                or value.get("mode") != current_mode
            ):
                raise ContractError(f"current bytes/deletion/mode differs for {label} path: {path}")
            result[path] = value
            folded.add(path.casefold())
        return result

    publication_map = entries(publication, "publication", False)
    selected_map = entries(selected, "selected", True)
    excluded_map = entries(excluded, "excluded", True)
    if not selected_map or not set(selected_map).issubset(publication_map):
        raise ContractError("selected_paths must be a non-empty publication subset")
    for path, selected_entry in selected_map.items():
        publication_entry = publication_map[path]
        for key in ("state", "sha256", "mode", "origin"):
            if selected_entry.get(key) != publication_entry.get(key):
                raise ContractError(f"selected/publication {key} differs for {path}")
    if set(selected_map).intersection(excluded_map):
        raise ContractError("selected and excluded dirty paths overlap")
    selected_folded = {path.casefold() for path in selected_map}
    excluded_folded = {path.casefold() for path in excluded_map}
    if selected_folded.intersection(excluded_folded):
        raise ContractError("selected and excluded paths case-collide")

    require_exact_keys(
        attestation,
        {"complete", "generated_file_manifests", "excluded_owner"},
        "scope attestation",
    )
    sources = attestation.get("generated_file_manifests")
    if not isinstance(sources, list) or not all(
        isinstance(item, dict)
        and set(item) == {"path", "sha256"}
        and isinstance(item["path"], str)
        and isinstance(item["sha256"], str)
        for item in sources
    ):
        raise ContractError("scope attestation generated_file_manifests is invalid")
    if attestation.get("excluded_owner") != "user":
        raise ContractError("scope attestation must assign exclusions to the user")

    if recovery_inspection:
        return {"selected": selected_map, "excluded": excluded_map, "dirty": {}}

    direct_dirty = direct_publication_dirty(repo, publication_map)
    if after_save:
        if direct_dirty:
            raise ContractError(
                f"publication paths remain dirty by direct worktree/index/HEAD comparison: {sorted(direct_dirty)!r}"
            )
    elif direct_dirty != set(selected_map):
        raise ContractError(
            "selected paths differ from direct worktree/index/HEAD comparison: "
            f"expected={sorted(selected_map)!r} actual={sorted(direct_dirty)!r}"
        )

    dirty = status_inventory(repo)
    if after_save:
        selected_still_dirty = sorted(set(selected_map).intersection(dirty))
        if selected_still_dirty:
            raise ContractError(f"selected paths remain dirty after save: {selected_still_dirty!r}")
        expected_dirty = excluded_map
    else:
        expected_dirty = {**selected_map, **excluded_map}
    if set(dirty) != set(expected_dirty):
        raise ContractError(
            f"dirty path set changed: expected={sorted(expected_dirty)!r} actual={sorted(dirty)!r}"
        )
    for path, expected in expected_dirty.items():
        actual = dirty[path]
        for key in ("state", "sha256", "mode", "status"):
            if expected.get(key) != actual.get(key):
                raise ContractError(f"dirty {key} changed for {path}")
    return {"selected": selected_map, "excluded": excluded_map, "dirty": dirty}


def cmd_preflight(args: argparse.Namespace) -> dict[str, Any]:
    repo, _ = repo_identity(args.repo)
    manifest_path = absolute_cli_path(args.manifest, "--manifest")
    manifest, digest = validate_manifest(repo, manifest_path, args.manifest_sha256)
    build_state = require_unchanged_build_state(
        repo, manifest, [entry["path"] for entry in manifest["selected_paths"]]
    )
    state = validate_manifest_state(repo, manifest, after_save=False)
    reject_selected_clean_filters(repo, sorted(state["selected"]))
    if run_git(repo, "rev-parse", "-q", "--verify", "MERGE_HEAD", check=False).returncode == 0:
        raise ContractError("a merge in progress cannot be isolated safely")

    excluded_raw = canonical_json(state["excluded"])
    old_head = decode_path(run_git(repo, "rev-parse", "--verify", "HEAD^{commit}").stdout.strip())
    index_path_raw = decode_path(run_git(repo, "rev-parse", "--path-format=absolute", "--git-path", "index").stdout.strip())
    index_path = Path(index_path_raw)
    if not index_path.is_absolute():
        index_path = repo / index_path
    index_existed = index_path.exists()
    index_bytes = index_path.read_bytes() if index_existed else b""
    index_digest = sha256_bytes(index_bytes)
    index_file_mode = stat.S_IMODE(index_path.stat().st_mode) if index_existed else None
    directory = manifest_path.parent
    pathspec_raw = b"".join(
        f":(literal){path}".encode("utf-8") + b"\0"
        for path in sorted(state["selected"])
    )
    pathspec_sha = sha256_bytes(pathspec_raw)
    pathspec_path = directory / f"{digest}.paths.{pathspec_sha}.nul"
    write_or_verify_immutable(pathspec_path, pathspec_raw, 0o400)
    index_backup_path = directory / f"{digest}.index.{index_digest}.bin"
    write_or_verify_immutable(index_backup_path, index_bytes, 0o400)

    snapshot = {
        "schema": "state-scoped-save-preflight/v1",
        "manifest_path": os.fspath(manifest_path),
        "manifest_sha256": digest,
        "old_head": old_head,
        "index_sha256": index_digest,
        "index_existed": index_existed,
        "index_file_mode": index_file_mode,
        "index_backup_path": os.fspath(index_backup_path),
        "index_backup_sha256": index_digest,
        "selected_paths": sorted(state["selected"]),
        "excluded_inventory_sha256": sha256_bytes(excluded_raw),
        "excluded_dirty_paths": list(state["excluded"].values()),
        "literal_pathspec_sha256": pathspec_sha,
        "jj_preflight_state": build_state["jj"],
    }
    snapshot_raw = canonical_json(snapshot)
    snapshot_sha = sha256_bytes(snapshot_raw)
    snapshot_path = directory / f"{digest}.preflight.{snapshot_sha}.json"
    write_or_verify_immutable(snapshot_path, snapshot_raw)
    return {
        "status": "validated",
        "manifest_path": os.fspath(manifest_path),
        "manifest_sha256": digest,
        "selected_paths": snapshot["selected_paths"],
        "snapshot_path": os.fspath(snapshot_path),
        "snapshot_sha256": snapshot_sha,
        "literal_pathspec_file": os.fspath(pathspec_path),
        "literal_pathspec_sha256": pathspec_sha,
        "old_head": old_head,
    }


def tree_entry(repo: Path, revision: str, path: str) -> tuple[str, str | None, str | None]:
    raw = run_git(repo, "ls-tree", "-z", revision, "--", f":(literal){path}").stdout
    if not raw:
        return "deleted", None, None
    record = raw.rstrip(b"\0")
    header, _, returned_path = record.partition(b"\t")
    if decode_path(returned_path) != path:
        raise ContractError(f"saved tree returned unexpected path for {path}")
    mode, object_type, oid = header.decode("ascii").split(" ")
    if object_type != "blob" or mode not in ("100644", "100755", "120000"):
        raise ContractError(f"unsupported saved object for {path}: {mode} {object_type}")
    content = run_git(repo, "cat-file", "blob", oid).stdout
    return ("symlink" if mode == "120000" else "file"), sha256_bytes(content), mode


def load_bound_snapshot(
    repo: Path,
    manifest_path: Path,
    manifest_sha256: str,
    snapshot_arg: str,
    snapshot_sha256: str,
) -> tuple[Path, dict[str, Any], str]:
    snapshot_path = absolute_cli_path(snapshot_arg, "--snapshot")
    ensure_no_symlink_chain(snapshot_path, repo)
    try:
        snapshot_path.relative_to(manifest_path.parent)
    except ValueError as exc:
        raise ContractError("preflight snapshot is outside the manifest artifacts directory") from exc
    snapshot, snapshot_raw = load_json(snapshot_path)
    if snapshot_raw != canonical_json(snapshot):
        raise ContractError("preflight snapshot bytes are not canonical JSON")
    actual_sha = sha256_bytes(snapshot_raw)
    if actual_sha != snapshot_sha256:
        raise ContractError(
            f"preflight snapshot checksum mismatch: expected {snapshot_sha256}, got {actual_sha}"
        )
    if snapshot_path.name != f"{manifest_sha256}.preflight.{actual_sha}.json":
        raise ContractError("preflight snapshot filename is not checksum-bound")
    require_exact_keys(snapshot, PREFLIGHT_FIELDS, "preflight snapshot")
    if snapshot.get("schema") != "state-scoped-save-preflight/v1":
        raise ContractError("unknown preflight snapshot schema")
    if (
        snapshot.get("manifest_sha256") != manifest_sha256
        or snapshot.get("manifest_path") != os.fspath(manifest_path)
    ):
        raise ContractError("preflight snapshot does not belong to this manifest")
    return snapshot_path, snapshot, actual_sha


def cmd_verify(args: argparse.Namespace) -> dict[str, Any]:
    repo, _ = repo_identity(args.repo)
    manifest_path = absolute_cli_path(args.manifest, "--manifest")
    manifest, digest = validate_manifest(repo, manifest_path, args.manifest_sha256)
    snapshot_path, snapshot, snapshot_sha = load_bound_snapshot(
        repo,
        manifest_path,
        digest,
        args.snapshot,
        args.snapshot_sha256,
    )
    state = validate_manifest_state(repo, manifest, after_save=True)
    expected_excluded = list(state["excluded"].values())
    if snapshot.get("excluded_dirty_paths") != expected_excluded:
        raise ContractError("preflight snapshot exclusion inventory differs from the manifest")
    if snapshot.get("selected_paths") != sorted(state["selected"]):
        raise ContractError("preflight snapshot selected paths differ from the manifest")
    index_backup_path = absolute_cli_path(snapshot.get("index_backup_path"), "index backup path")
    try:
        index_backup_path.relative_to(manifest_path.parent)
    except ValueError as exc:
        raise ContractError("index backup is outside the manifest artifacts directory") from exc
    ensure_no_symlink_chain(index_backup_path, repo)
    if not index_backup_path.is_file() or index_backup_path.is_symlink():
        raise ContractError("preflight index backup is missing or unsafe")
    index_backup_hash = sha256_bytes(index_backup_path.read_bytes())
    if (
        index_backup_hash != snapshot.get("index_backup_sha256")
        or index_backup_hash != snapshot.get("index_sha256")
    ):
        raise ContractError("preflight index backup checksum mismatch")
    pathspec_sha = snapshot.get("literal_pathspec_sha256")
    if not isinstance(pathspec_sha, str) or len(pathspec_sha) != 64:
        raise ContractError("preflight snapshot pathspec checksum is invalid")
    pathspec_path = manifest_path.parent / f"{digest}.paths.{pathspec_sha}.nul"
    if not pathspec_path.is_file() or pathspec_path.is_symlink():
        raise ContractError("preflight literal pathspec file is missing or unsafe")
    if sha256_bytes(pathspec_path.read_bytes()) != pathspec_sha:
        raise ContractError("preflight literal pathspec file checksum mismatch")
    saved = decode_path(run_git(repo, "rev-parse", "--verify", f"{args.saved_rev}^{{commit}}").stdout.strip())
    parent = run_git(repo, "rev-parse", "--verify", f"{saved}^", check=False)
    vcs_current_proof: dict[str, Any]
    if manifest["repository"]["vcs"] == "git":
        if parent.returncode != 0:
            raise ContractError("plain Git scoped save must have the preflight HEAD as its parent")
        saved_parent = decode_path(parent.stdout.strip())
        if saved_parent != snapshot.get("old_head"):
            raise ContractError(
                "plain Git saved commit parent differs from the preflight old_head"
            )
        current_head = decode_path(
            run_git(repo, "rev-parse", "--verify", "HEAD^{commit}").stdout.strip()
        )
        if current_head != saved:
            raise ContractError(
                "plain Git current HEAD no longer equals the exact scoped saved commit"
            )
        vcs_current_proof = {"vcs": "git", "current_head": current_head}
    else:
        preflight_state = snapshot.get("jj_preflight_state")
        if not isinstance(preflight_state, dict):
            raise ContractError("jj preflight state is missing")
        require_exact_keys(
            preflight_state,
            {
                "operation_id",
                "working_copy_commit_id",
                "working_copy_change_id",
                "parent_commit_ids",
                "git_head",
                "mutable",
                "conflicts",
                "divergent",
                "selected_diff_sha256",
            },
            "jj preflight state",
        )
        preflight_operation = preflight_state.get("operation_id")
        if not isinstance(preflight_operation, str) or not preflight_operation:
            raise ContractError("jj preflight operation id is missing")
        current_state = jj_workspace_state(repo, sorted(state["selected"]))
        current_operation = current_state["operation_id"]
        operation_history = set(
            decoded_lines(
                run_jj(
                    repo,
                    "op",
                    "log",
                    "--no-graph",
                    "-T",
                    "self.id() ++ \"\\n\"",
                    ignore_working_copy=True,
                    at_operation=current_operation,
                ).stdout
            )
        )
        if preflight_operation not in operation_history:
            raise ContractError("current jj operation does not descend from the preflight operation")
        saved_line = decode_path(
            run_git(repo, "rev-list", "--parents", "-n", "1", saved).stdout.strip()
        ).split()
        saved_parents = saved_line[1:]
        if saved_parents != preflight_state.get("parent_commit_ids"):
            raise ContractError("jj saved change parents differ from the preflight working-copy parents")
        current_parents = current_state["parent_commit_ids"]
        if current_parents != [saved]:
            raise ContractError(
                "jj current working-copy change is not directly based on the exact scoped saved commit"
            )
        saved_commit_id = decode_path(
            run_jj(
                repo,
                "log",
                "-r",
                saved,
                "--no-graph",
                "-T",
                "commit_id ++ \"\\n\"",
                ignore_working_copy=True,
                at_operation=current_operation,
            ).stdout.strip()
        )
        if saved_commit_id != saved:
            raise ContractError("jj current operation does not contain the exact saved commit")
        saved_change_id = decode_path(
            run_jj(
                repo,
                "log",
                "-r",
                saved,
                "--no-graph",
                "-T",
                "change_id ++ \"\\n\"",
                ignore_working_copy=True,
                at_operation=current_operation,
            ).stdout.strip()
        )
        if not saved_change_id:
            raise ContractError("jj saved change identity is missing from the current operation")
        vcs_current_proof = {
            "vcs": "jj-colocated",
            "current_operation_id": current_operation,
            "preflight_operation_id": preflight_operation,
            "preflight_working_copy_commit_id": preflight_state.get("working_copy_commit_id"),
            "preflight_working_copy_change_id": preflight_state.get("working_copy_change_id"),
            "saved_commit_id": saved_commit_id,
            "saved_change_id": saved_change_id,
            "saved_parent_commit_ids": saved_parents,
            "current_working_copy_commit_id": current_state["working_copy_commit_id"],
            "current_working_copy_change_id": current_state["working_copy_change_id"],
            "working_copy_parents": current_parents,
        }
    diff_args = ["diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-r", "-z"]
    if parent.returncode == 0:
        diff_args.extend([decode_path(parent.stdout.strip()), saved])
    else:
        diff_args.extend(["--root", saved])
    changed = {
        validate_relative_path(repo, decode_path(path))
        for path in run_git(repo, *diff_args).stdout.split(b"\0")
        if path
    }
    selected = set(state["selected"])
    if changed != selected:
        raise ContractError(f"saved diff is not the selected closed set: expected={sorted(selected)!r} actual={sorted(changed)!r}")
    for path, entry in state["selected"].items():
        saved_state, saved_hash, saved_mode = tree_entry(repo, saved, path)
        if (
            saved_state != entry["state"]
            or saved_hash != entry["sha256"]
            or saved_mode != entry["mode"]
        ):
            raise ContractError(f"saved tree content/mode differs from manifest: {path}")

    excluded_digest = sha256_bytes(canonical_json(state["excluded"]))
    if excluded_digest != snapshot.get("excluded_inventory_sha256"):
        raise ContractError("non-selected dirty inventory changed after save")
    receipt = {
        "schema": "state-scoped-save-result/v1",
        "status": "pass",
        "manifest_path": os.fspath(manifest_path),
        "manifest_sha256": digest,
        "preflight_snapshot_sha256": snapshot_sha,
        "old_head": snapshot.get("old_head"),
        "rollback_handle": (
            snapshot.get("old_head")
            if manifest["repository"]["vcs"] == "git"
            else snapshot.get("jj_preflight_state", {}).get("operation_id")
        ),
        "saved_revision": saved,
        "vcs_current_proof": vcs_current_proof,
        "selected_paths": sorted(selected),
        "saved_tree_hashes": {
            path: {
                "state": entry["state"],
                "sha256": entry["sha256"],
                "mode": entry["mode"],
            }
            for path, entry in sorted(state["selected"].items())
        },
        "excluded_inventory_before": snapshot.get("excluded_inventory_sha256"),
        "excluded_inventory_after": excluded_digest,
        "non_selected_preserved": True,
    }
    raw = canonical_json(receipt)
    receipt_sha = sha256_bytes(raw)
    output = manifest_path.parent / f"{digest}.result.{receipt_sha}.json"
    write_or_verify_immutable(output, raw)
    return {
        "status": "pass",
        "receipt_path": os.fspath(output),
        "receipt_sha256": receipt_sha,
        "saved_revision": saved,
        "non_selected_preserved": True,
    }


def restore_index_from_backup(repo: Path, snapshot: dict[str, Any]) -> str:
    backup_path = absolute_cli_path(snapshot.get("index_backup_path"), "index backup path")
    backup = backup_path.read_bytes()
    digest = sha256_bytes(backup)
    if digest != snapshot.get("index_backup_sha256") or digest != snapshot.get("index_sha256"):
        raise ContractError("cannot recover: index backup checksum mismatch")
    index_path_raw = decode_path(
        run_git(repo, "rev-parse", "--path-format=absolute", "--git-path", "index").stdout.strip()
    )
    index_path = Path(index_path_raw)
    if not index_path.is_absolute():
        index_path = repo / index_path
    lock_path = index_path.with_name(index_path.name + ".lock")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(lock_path, flags, 0o600)
    except FileExistsError as exc:
        raise ContractError(f"cannot recover while Git index lock exists: {lock_path}") from exc
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(backup)
            stream.flush()
            os.fsync(stream.fileno())
        if snapshot.get("index_existed") is True:
            mode = snapshot.get("index_file_mode")
            if not isinstance(mode, int):
                raise ContractError("cannot recover: original index mode is missing")
            os.chmod(lock_path, mode)
            os.replace(lock_path, index_path)
        elif snapshot.get("index_existed") is False:
            if index_path.exists():
                index_path.unlink()
            lock_path.unlink()
        else:
            raise ContractError("cannot recover: original index existence is ambiguous")
    except BaseException:
        try:
            lock_path.unlink()
        except FileNotFoundError:
            pass
        raise
    restored = sha256_bytes(index_path.read_bytes()) if index_path.exists() else sha256_bytes(b"")
    if restored != digest:
        raise ContractError("index recovery checksum proof failed")
    return restored


def cmd_recover(args: argparse.Namespace) -> dict[str, Any]:
    repo, _ = repo_identity(args.repo)
    manifest_path = absolute_cli_path(args.manifest, "--manifest")
    manifest, digest = validate_manifest(repo, manifest_path, args.manifest_sha256)
    if manifest["repository"]["vcs"] != "git":
        raise ContractError("recover currently supports only the plain Git scoped-save route")
    _, snapshot, snapshot_sha = load_bound_snapshot(
        repo,
        manifest_path,
        digest,
        args.snapshot,
        args.snapshot_sha256,
    )
    state = validate_manifest_state(
        repo,
        manifest,
        after_save=True,
        recovery_inspection=True,
    )
    reject_ambiguous_index_flags(repo)
    failed_head = decode_path(
        run_git(repo, "rev-parse", "--verify", f"{args.failed_head}^{{commit}}").stdout.strip()
    )
    if current_head(repo) != failed_head:
        raise ContractError("recovery refused: current HEAD differs from --failed-head")
    parent = decode_path(
        run_git(repo, "rev-parse", "--verify", f"{failed_head}^").stdout.strip()
    )
    old_head = snapshot.get("old_head")
    if parent != old_head:
        raise ContractError("recovery refused: failed commit is not directly based on preflight old_head")

    physical_before = {
        path: physical_state(repo, path)
        for path in sorted(set(state["selected"]) | set(state["excluded"]))
    }
    update = run_git(repo, "update-ref", "HEAD", str(old_head), failed_head, check=False)
    if update.returncode:
        detail = update.stderr.decode("utf-8", "replace").strip()
        raise ContractError(f"atomic HEAD recovery failed: {detail}")
    restored_index = restore_index_from_backup(repo, snapshot)
    physical_after = {
        path: physical_state(repo, path)
        for path in sorted(set(state["selected"]) | set(state["excluded"]))
    }
    if physical_after != physical_before:
        raise ContractError("working-tree bytes changed during recovery")
    validate_manifest_state(repo, manifest, after_save=False)

    receipt = {
        "schema": "state-scoped-save-recovery/v1",
        "status": "recovered",
        "manifest_sha256": digest,
        "preflight_snapshot_sha256": snapshot_sha,
        "failed_head": failed_head,
        "restored_head": old_head,
        "restored_index_sha256": restored_index,
        "working_tree_preserved": True,
    }
    raw = canonical_json(receipt)
    receipt_sha = sha256_bytes(raw)
    output = manifest_path.parent / f"{digest}.recovery.{receipt_sha}.json"
    write_or_verify_immutable(output, raw)
    return {
        "status": "recovered",
        "receipt_path": os.fspath(output),
        "receipt_sha256": receipt_sha,
        "restored_head": old_head,
        "restored_index_sha256": restored_index,
        "working_tree_preserved": True,
    }


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    subparsers = result.add_subparsers(dest="command", required=True)
    build = subparsers.add_parser("build")
    build.add_argument("--repo", required=True)
    build.add_argument("--work-root", required=True)
    build.add_argument("--base-rev", required=True)
    build.add_argument("--scope", required=True)
    build.set_defaults(handler=cmd_build)

    preflight = subparsers.add_parser("preflight")
    preflight.add_argument("--repo", required=True)
    preflight.add_argument("--manifest", required=True)
    preflight.add_argument("--manifest-sha256", required=True)
    preflight.set_defaults(handler=cmd_preflight)

    verify = subparsers.add_parser("verify")
    verify.add_argument("--repo", required=True)
    verify.add_argument("--manifest", required=True)
    verify.add_argument("--manifest-sha256", required=True)
    verify.add_argument("--snapshot", required=True)
    verify.add_argument("--snapshot-sha256", required=True)
    verify.add_argument("--saved-rev", required=True)
    verify.set_defaults(handler=cmd_verify)

    recover = subparsers.add_parser("recover")
    recover.add_argument("--repo", required=True)
    recover.add_argument("--manifest", required=True)
    recover.add_argument("--manifest-sha256", required=True)
    recover.add_argument("--snapshot", required=True)
    recover.add_argument("--snapshot-sha256", required=True)
    recover.add_argument("--failed-head", required=True)
    recover.set_defaults(handler=cmd_recover)
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        output = args.handler(args)
    except ContractError as exc:
        print(json.dumps({"status": "blocked_scope", "error": str(exc)}, sort_keys=True))
        return 2
    print(json.dumps(output, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
