"""Classify a Git diff under the canonical PR-size policy."""

import argparse
import json
import os
import re
import subprocess
import tempfile
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass
from itertools import pairwise
from pathlib import Path, PurePosixPath

# Package-manager lockfiles are generated dependency resolutions even when a
# repository has not annotated them for GitHub Linguist.
PACKAGE_LOCKFILES = frozenset(
    {
        "Cargo.lock",
        "Gemfile.lock",
        "Pipfile.lock",
        "bun.lock",
        "bun.lockb",
        "composer.lock",
        "go.sum",
        "npm-shrinkwrap.json",
        "package-lock.json",
        "pnpm-lock.yaml",
        "poetry.lock",
        "uv.lock",
        "yarn.lock",
    }
)

# Rename similarity is quadratic in the number of unmatched sources and
# destinations; 1,000 preserves ordinary rename detection without unbounded work.
RENAME_CANDIDATE_LIMIT = 1_000
# Git arguments are chunked to keep argv bounded on large diffs.
GIT_ARGUMENT_BATCH_SIZE = 128
SIZE_THRESHOLDS = Path(__file__).resolve().parents[1] / "assets/size-thresholds.json"


@dataclass(frozen=True, slots=True)
class ZoneLimit:
    name: str
    max_files_changed: int
    max_authored_net_loc: int
    required_reviewers: int


def run_git(
    repo: Path,
    *args: str,
    input_bytes: bytes | None = None,
    environment: Mapping[str, str] | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        input=input_bytes,
        check=check,
        capture_output=True,
        env=environment,
    )


def hermetic_environment() -> dict[str, str]:
    environment = dict(os.environ)
    unsafe_names = {
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_ATTR_NOSYSTEM",
        "GIT_COMMON_DIR",
        "GIT_CONFIG_COUNT",
        "GIT_CONFIG_GLOBAL",
        "GIT_CONFIG_NOSYSTEM",
        "GIT_CONFIG_PARAMETERS",
        "GIT_CONFIG_SYSTEM",
        "GIT_DEFAULT_HASH",
        "GIT_DIFF_OPTS",
        "GIT_DIR",
        "GIT_EXTERNAL_DIFF",
        "GIT_GLOB_PATHSPECS",
        "GIT_ICASE_PATHSPECS",
        "GIT_INDEX_FILE",
        "GIT_LITERAL_PATHSPECS",
        "GIT_NOGLOB_PATHSPECS",
        "GIT_OBJECT_DIRECTORY",
        "GIT_TEMPLATE_DIR",
        "GIT_WORK_TREE",
    }
    for name in list(environment):
        if name in unsafe_names or name.startswith(
            ("GIT_CONFIG_KEY_", "GIT_CONFIG_VALUE_")
        ):
            environment.pop(name)
    environment.update(
        {
            "GIT_ATTR_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_NO_REPLACE_OBJECTS": "1",
            "LC_ALL": "C",
        }
    )
    return environment


def resolve_commit(repo: Path, revision: str, environment: Mapping[str, str]) -> str:
    result = run_git(
        repo,
        "rev-parse",
        "--verify",
        f"{revision}^{{commit}}",
        environment=environment,
    )
    return result.stdout.decode().strip()


def resolve_base(repo: Path, revision: str, environment: Mapping[str, str]) -> str:
    result = run_git(
        repo,
        "rev-parse",
        "--verify",
        f"{revision}^{{object}}",
        environment=environment,
    )
    object_id = result.stdout.decode().strip()
    object_type = (
        run_git(repo, "cat-file", "-t", object_id, environment=environment)
        .stdout.decode()
        .strip()
    )
    if object_type == "commit":
        return object_id
    empty_tree = (
        run_git(
            repo,
            "hash-object",
            "-t",
            "tree",
            "--stdin",
            input_bytes=b"",
            environment=environment,
        )
        .stdout.decode()
        .strip()
    )
    if object_type == "tree" and object_id == empty_tree:
        return object_id
    return resolve_commit(repo, revision, environment)


@contextmanager
def isolated_repository(
    repo: Path, environment: dict[str, str]
) -> Iterator[tuple[Path, dict[str, str]]]:
    common_dir_result = run_git(
        repo, "rev-parse", "--git-common-dir", environment=environment
    )
    common_dir = Path(common_dir_result.stdout.decode().strip())
    if not common_dir.is_absolute():
        common_dir = (repo / common_dir).resolve()
    object_directory = common_dir / "objects"
    object_format_result = run_git(
        repo, "rev-parse", "--show-object-format", environment=environment
    )
    object_format = object_format_result.stdout.decode().strip()

    with tempfile.TemporaryDirectory(prefix="pr-size-") as temporary:
        temporary_root = Path(temporary)
        bare_repo = temporary_root / "repository.git"
        isolated_environment = environment | {
            "GIT_ALTERNATE_OBJECT_DIRECTORIES": str(object_directory),
            "XDG_CONFIG_HOME": str(temporary_root / "xdg"),
        }
        subprocess.run(
            [
                "git",
                "init",
                "--bare",
                "--quiet",
                f"--object-format={object_format}",
                str(bare_repo),
            ],
            check=True,
            capture_output=True,
            env=isolated_environment,
        )
        yield bare_repo, isolated_environment


def nul_paths(output: bytes) -> list[str]:
    return [
        part.decode("utf-8", "surrogateescape") for part in output.split(b"\0") if part
    ]


def changed_files(
    repo: Path, base: str, head: str, environment: Mapping[str, str]
) -> list[str]:
    result = run_git(
        repo,
        "diff",
        "--name-only",
        "-z",
        "--no-ext-diff",
        "--no-textconv",
        "--diff-algorithm=myers",
        "--find-renames=50%",
        f"-l{RENAME_CANDIDATE_LIMIT}",
        "--ignore-submodules=none",
        base,
        head,
        "--",
        environment=environment,
    )
    return sorted(nul_paths(result.stdout))


def generated_attributes(
    repo: Path,
    revision: str,
    paths: set[str],
    environment: Mapping[str, str],
) -> set[str]:
    if not paths:
        return set()
    path_input = (
        b"\0".join(path.encode("utf-8", "surrogateescape") for path in sorted(paths))
        + b"\0"
    )
    with tempfile.TemporaryDirectory(prefix="pr-size-index-") as temporary:
        index_environment = dict(environment) | {
            "GIT_INDEX_FILE": str(Path(temporary) / "index")
        }
        run_git(repo, "read-tree", revision, environment=index_environment)
        result = run_git(
            repo,
            "check-attr",
            "-z",
            "--cached",
            "--stdin",
            "linguist-generated",
            input_bytes=path_input,
            environment=index_environment,
        )
    fields = result.stdout.split(b"\0")
    generated = set()
    for index in range(0, len(fields) - 2, 3):
        path, _attribute, value = fields[index : index + 3]
        if value in {b"set", b"true"}:
            generated.add(path.decode("utf-8", "surrogateescape"))
    return generated


def generated_paths(
    repo: Path,
    base: str,
    head: str,
    paths: set[str],
    environment: Mapping[str, str],
) -> set[str]:
    lockfiles = {
        path for path in paths if PurePosixPath(path).name in PACKAGE_LOCKFILES
    }
    return (
        lockfiles
        | generated_attributes(repo, base, paths, environment)
        | generated_attributes(repo, head, paths, environment)
    )


def numstat(
    repo: Path, base: str, head: str, environment: Mapping[str, str]
) -> list[tuple[str, str, str]]:
    result = run_git(
        repo,
        "diff",
        "--numstat",
        "--no-renames",
        "-z",
        "--no-ext-diff",
        "--no-textconv",
        "--diff-algorithm=myers",
        "--ignore-submodules=none",
        base,
        head,
        "--",
        environment=environment,
    )
    records = []
    for entry in result.stdout.split(b"\0"):
        if not entry:
            continue
        additions, deletions, path = entry.split(b"\t", 2)
        records.append(
            (
                additions.decode(),
                deletions.decode(),
                path.decode("utf-8", "surrogateescape"),
            )
        )
    return records


def diff_objects(
    repo: Path, base: str, head: str, environment: Mapping[str, str]
) -> tuple[set[str], set[str]]:
    result = run_git(
        repo,
        "diff",
        "--raw",
        "-z",
        "--abbrev=64",
        "--full-index",
        "--no-renames",
        "--no-ext-diff",
        "--no-textconv",
        "--diff-algorithm=myers",
        "--ignore-submodules=none",
        base,
        head,
        "--",
        environment=environment,
    )
    fields = result.stdout.split(b"\0")
    object_ids: set[str] = set()
    paths: set[str] = set()
    for index in range(0, len(fields) - 1, 2):
        header = fields[index]
        if not header:
            continue
        paths.add(fields[index + 1].decode("utf-8", "surrogateescape"))
        old_mode, new_mode, old_id, new_id, _status = header[1:].split(b" ", 4)
        for mode, object_id in ((old_mode, old_id), (new_mode, new_id)):
            if mode != b"160000" and object_id.strip(b"0"):
                object_ids.add(object_id.decode())
    return paths, object_ids


def attribute_paths(paths: set[str]) -> set[str]:
    attributes = {".gitattributes"}
    for path in paths:
        for parent in PurePosixPath(path).parents:
            if parent == PurePosixPath("."):
                break
            attributes.add(str(parent / ".gitattributes"))
    return attributes


def blob_ids_at_paths(
    repo: Path,
    revision: str,
    paths: set[str],
    environment: Mapping[str, str],
) -> set[str]:
    object_ids: set[str] = set()
    ordered_paths = sorted(paths)
    literal_environment = dict(environment) | {"GIT_LITERAL_PATHSPECS": "1"}
    for start in range(0, len(ordered_paths), GIT_ARGUMENT_BATCH_SIZE):
        result = run_git(
            repo,
            "ls-tree",
            "-z",
            "--full-tree",
            revision,
            "--",
            *ordered_paths[start : start + GIT_ARGUMENT_BATCH_SIZE],
            environment=literal_environment,
        )
        for entry in result.stdout.split(b"\0"):
            if not entry:
                continue
            metadata, _path = entry.split(b"\t", 1)
            _mode, object_type, object_id = metadata.split(b" ", 2)
            if object_type == b"blob":
                object_ids.add(object_id.decode())
    return object_ids


def hydrate_objects(
    repo: Path, object_ids: set[str], environment: Mapping[str, str]
) -> None:
    if not object_ids:
        return
    ordered_ids = sorted(object_ids)
    inspection_environment = dict(environment) | {"GIT_NO_LAZY_FETCH": "1"}
    result = run_git(
        repo,
        "cat-file",
        "--batch-check",
        input_bytes="".join(f"{object_id}\n" for object_id in ordered_ids).encode(),
        environment=inspection_environment,
    )
    missing_ids = [
        line.split(b" ", 1)[0].decode()
        for line in result.stdout.splitlines()
        if line.endswith(b" missing")
    ]
    if not missing_ids:
        return
    remote_result = run_git(
        repo,
        "config",
        "--local",
        "--get-regexp",
        r"^remote\..*\.promisor$",
        environment=environment,
    )
    remotes = []
    for line in remote_result.stdout.decode().splitlines():
        key, value = line.rsplit(maxsplit=1)
        remote = key.removeprefix("remote.").removesuffix(".promisor")
        if value.lower() == "true" and re.fullmatch(
            r"[A-Za-z0-9][A-Za-z0-9._-]*", remote
        ):
            remotes.append(remote)
    if not remotes:
        raise ValueError("missing objects require a configured promisor remote")
    for start in range(0, len(missing_ids), GIT_ARGUMENT_BATCH_SIZE):
        batch = missing_ids[start : start + GIT_ARGUMENT_BATCH_SIZE]
        failures: list[str] = []
        for remote in remotes:
            fetch_result = run_git(
                repo,
                "fetch",
                "--quiet",
                "--no-tags",
                "--no-write-fetch-head",
                remote,
                *batch,
                environment=environment,
                check=False,
            )
            if fetch_result.returncode == 0:
                break
            failures.append(fetch_result.stderr.decode("utf-8", "replace").strip())
        else:
            details = "; ".join(failure for failure in failures if failure)
            raise ValueError(
                details or "promisor remotes could not provide required objects"
            )


def parse_zone_limit(data: object) -> ZoneLimit:
    if not isinstance(data, dict) or set(data) != {
        "name",
        "max_files_changed",
        "max_authored_net_loc",
        "required_reviewers",
    }:
        raise ValueError(f"invalid PR-size zone shape: {SIZE_THRESHOLDS}")
    name = data["name"]
    if not isinstance(name, str):
        raise TypeError(f"PR-size zone name must be a string: {SIZE_THRESHOLDS}")
    maxima: dict[str, int] = {}
    for field in ("max_files_changed", "max_authored_net_loc"):
        value = data[field]
        if isinstance(value, bool) or not isinstance(value, int):
            raise TypeError(
                f"PR-size zone {name!r} {field} must be a positive integer: "
                f"{SIZE_THRESHOLDS}"
            )
        if value <= 0:
            raise ValueError(
                f"PR-size zone {name!r} {field} must be positive: {SIZE_THRESHOLDS}"
            )
        maxima[field] = value
    required_reviewers = data["required_reviewers"]
    if isinstance(required_reviewers, bool) or not isinstance(required_reviewers, int):
        raise TypeError(
            f"PR-size zone {name!r} required_reviewers must be an integer: "
            f"{SIZE_THRESHOLDS}"
        )
    if required_reviewers < 0:
        raise ValueError(
            f"PR-size zone {name!r} required_reviewers cannot be negative: "
            f"{SIZE_THRESHOLDS}"
        )
    return ZoneLimit(
        name,
        maxima["max_files_changed"],
        maxima["max_authored_net_loc"],
        required_reviewers,
    )


def validate_zone_limits(limits: tuple[ZoneLimit, ...]) -> None:
    if [limit.name for limit in limits] != ["green", "yellow", "red"]:
        raise ValueError(
            f"PR-size zones must be ordered green, yellow, red: {SIZE_THRESHOLDS}"
        )
    for earlier, later in pairwise(limits):
        if (
            earlier.max_files_changed >= later.max_files_changed
            or earlier.max_authored_net_loc >= later.max_authored_net_loc
            or earlier.required_reviewers > later.required_reviewers
        ):
            raise ValueError(
                "PR-size zone maxima must increase and required reviewers must "
                f"not decrease ({earlier.name} -> {later.name}): {SIZE_THRESHOLDS}"
            )


def load_zone_limits() -> tuple[ZoneLimit, ...]:
    data: object = json.loads(SIZE_THRESHOLDS.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise TypeError(f"PR-size thresholds must be an object: {SIZE_THRESHOLDS}")
    schema_version = data.get("schema_version")
    if isinstance(schema_version, bool) or not isinstance(schema_version, int):
        raise TypeError(
            f"PR-size threshold schema version must be an integer: {SIZE_THRESHOLDS}"
        )
    if schema_version != 1:
        raise ValueError(f"invalid PR-size threshold schema: {SIZE_THRESHOLDS}")
    metrics = data.get("metrics")
    zones = data.get("zones")
    if not isinstance(metrics, dict) or set(metrics) != {
        "files_changed",
        "authored_net_loc",
        "required_reviewers",
    }:
        raise ValueError(f"invalid PR-size metrics: {SIZE_THRESHOLDS}")
    for metric in metrics.values():
        if (
            not isinstance(metric, dict)
            or set(metric) != {"unit", "reason"}
            or any(
                not isinstance(metric.get(field), str) or not metric[field]
                for field in ("unit", "reason")
            )
        ):
            raise ValueError(f"invalid PR-size metric metadata: {SIZE_THRESHOLDS}")
    if not isinstance(zones, list):
        raise TypeError(f"invalid PR-size zones: {SIZE_THRESHOLDS}")
    limits = tuple(parse_zone_limit(zone) for zone in zones)
    validate_zone_limits(limits)
    return limits


def zone_for(files_changed: int, net_loc: int, limits: tuple[ZoneLimit, ...]) -> str:
    for limit in limits:
        if (
            files_changed <= limit.max_files_changed
            and net_loc <= limit.max_authored_net_loc
        ):
            return limit.name
    return "black"


def classify(repo: Path, base_revision: str, head_revision: str) -> dict[str, object]:
    environment = hermetic_environment()
    base = resolve_base(repo, base_revision, environment)
    head = resolve_commit(repo, head_revision, environment)
    source_paths, source_object_ids = diff_objects(repo, base, head, environment)
    attributes = attribute_paths(source_paths)
    attribute_object_ids = blob_ids_at_paths(repo, base, attributes, environment)
    attribute_object_ids |= blob_ids_at_paths(repo, head, attributes, environment)
    hydrate_objects(repo, source_object_ids | attribute_object_ids, environment)
    generated_attributes(repo, base, set(source_paths), environment)
    generated_attributes(repo, head, set(source_paths), environment)
    with isolated_repository(repo, environment) as (
        isolated_repo,
        isolated_environment,
    ):
        files = changed_files(isolated_repo, base, head, isolated_environment)
        stats = numstat(isolated_repo, base, head, isolated_environment)
        generated_files = generated_paths(
            isolated_repo,
            base,
            head,
            {path for _, _, path in stats},
            isolated_environment,
        )
    additions = 0
    deletions = 0
    binary_files = set()

    for added, deleted, path in stats:
        if path in generated_files:
            continue
        if added == "-" or deleted == "-":
            binary_files.add(path)
            continue
        additions += int(added)
        deletions += int(deleted)

    net_loc = abs(additions - deletions)
    limits = load_zone_limits()
    zone = zone_for(len(files), net_loc, limits)
    required_reviewers = next(
        (
            limit.required_reviewers
            for limit in limits
            if limit.name == zone
        ),
        limits[-1].required_reviewers,
    )
    return {
        "authored_additions": additions,
        "authored_deletions": deletions,
        "base_oid": base,
        "binary_files": sorted(binary_files),
        "files_changed": len(files),
        "generated_files": sorted(generated_files),
        "head_oid": head,
        "net_loc": net_loc,
        "required_reviewers": required_reviewers,
        "zone": zone,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="classify a Git diff using fixed PR-size zones"
    )
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        result = classify(args.repo.resolve(), args.base, args.head)
    except (OSError, TypeError, ValueError, subprocess.CalledProcessError) as error:
        if not isinstance(error, subprocess.CalledProcessError):
            raise SystemExit(str(error)) from error
        message = error.stderr.decode("utf-8", "replace").strip()
        raise SystemExit(message or "git command failed") from error
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
