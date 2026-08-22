#!/usr/bin/env python3
"""Project this marketplace into an OpenCode V1 config directory."""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from collections.abc import Iterable, Sequence
from functools import cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKETPLACE_PATH = ROOT / ".claude-plugin" / "marketplace.json"
ADAPTER_PATH = ROOT / "scripts" / "opencode_adapter.js"
CONTRACT_PATH = ROOT / "scripts" / "opencode_contract.json"
MANIFEST_RELATIVE_PATH = Path("alvis/manifest.json")
SKILL_LINK_PATTERN = re.compile(r"(?P<prefix>\]\()(?P<target>[^)\s]+)(?P<suffix>\))")
JSON_RELATIVE_PATH_PATTERN = re.compile(r'"(?P<target>\.\.?/[^"\\]+)"')
SKILL_DIRECTORY_PATH_PATTERN = re.compile(
    r"(?P<variable>\$(?:\{)?(?:[A-Z][A-Z0-9_]*_)?SKILL_DIR(?:\})?)/\.\./\.\."
)
PROJECTED_TEXT_SUFFIXES = {".js", ".json", ".md", ".py", ".sh", ".toml", ".ts"}
OPEN_CODE_COLOR_BY_CLAUDE_COLOR = {
    "blue": "info",
    "cyan": "info",
    "green": "success",
    "magenta": "accent",
    "orange": "warning",
    "purple": "accent",
    "red": "error",
    "yellow": "warning",
}
READ_ONLY_AGENT_POLICIES = {
    "aesthetic-evaluator": {
        "hook_sha256": "414bbacc6a15d74542fd7517d4ae8015189ee5e36b75df19775e99456310d399",
        "edit_patterns": (".claude/agent-memory/aesthetic-evaluator/*",),
    },
    "code-quality-critic": {
        "hook_sha256": "8507c30596582bd84059f1b80a7cc60a537cc1ef914fab0e4ed02c8712e270c8",
        "edit_patterns": (
            ".claude/agent-memory/code-quality-critic/*",
            ".state/works/*/reviews/correctness.md",
            ".state/works/*/reviews/quality.md",
        ),
    },
}


class ProjectionError(RuntimeError):
    """Raised when the projection cannot be completed safely."""


def read_json(path: Path) -> dict[str, object]:
    """Read one JSON object or fail with its path."""
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ProjectionError(f"cannot read JSON object {path}: {error}") from error
    if not isinstance(value, dict):
        raise ProjectionError(f"expected JSON object in {path}")
    return value


@cache
def projection_contract() -> dict[str, object]:
    """Read and validate the shared OpenCode projection protocol."""
    contract = read_json(CONTRACT_PATH)
    manager = contract.get("manager")
    schema_version = contract.get("schema_version")
    separator = contract.get("skill_separator")
    if not isinstance(manager, str) or not manager:
        raise ProjectionError(f"invalid manager in {CONTRACT_PATH}")
    if not isinstance(schema_version, int) or schema_version < 1:
        raise ProjectionError(f"invalid schema version in {CONTRACT_PATH}")
    if separator != "-":
        raise ProjectionError(f"unsupported skill separator in {CONTRACT_PATH}")
    return contract


def contract_string(key: str) -> str:
    """Return one required string from the projection protocol."""
    value = projection_contract().get(key)
    if not isinstance(value, str) or not value:
        raise ProjectionError(f"invalid {key} in {CONTRACT_PATH}")
    return value


def contract_schema_version() -> int:
    """Return the supported receipt schema version."""
    value = projection_contract()["schema_version"]
    if not isinstance(value, int):
        raise ProjectionError(f"invalid schema version in {CONTRACT_PATH}")
    return value


def state_directory(target: Path) -> Path:
    """Return target-bound installer state outside the managed projection."""
    state_home = Path(
        os.environ.get("XDG_STATE_HOME", Path.home() / ".local" / "state")
    )
    target_key = hashlib.sha256(str(target).encode()).hexdigest()
    return state_home.expanduser().resolve() / "alvis-opencode-v1" / target_key


def ownership_path(target: Path) -> Path:
    """Return the external ownership receipt for one projection target."""
    return state_directory(target) / "ownership.json"


def transaction_path(target: Path) -> Path:
    """Return the durable transaction journal for one projection target."""
    return state_directory(target) / "transaction.json"


def ensure_private_state_directory(target: Path) -> Path:
    """Create and validate the target-bound private state directory."""
    directory = state_directory(target)
    if directory.is_symlink():
        raise ProjectionError(
            f"installer state directory must not be a symlink: {directory}"
        )
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not directory.is_dir():
        raise ProjectionError(f"installer state path is not a directory: {directory}")
    directory.chmod(0o700)
    return directory


def fsync_directory(directory: Path) -> None:
    """Persist a directory entry update where the platform supports it."""
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
    descriptor = os.open(directory, flags)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def write_durable_json(path: Path, value: dict[str, object]) -> None:
    """Atomically write and fsync one private installer-state object."""
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        with temporary.open("x", encoding="utf-8") as stream:
            json.dump(value, stream, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        temporary.chmod(0o600)
        os.replace(temporary, path)
        fsync_directory(path.parent)
    finally:
        if temporary.exists():
            temporary.unlink()


def remove_durable_file(path: Path) -> None:
    """Remove one installer-state file and persist the directory update."""
    if path.exists():
        path.unlink()
        fsync_directory(path.parent)


def ownership_record(target: Path, manifest_path: Path) -> dict[str, object]:
    """Build the external proof that this installer owns the target receipt."""
    return {
        "manager": contract_string("manager"),
        "schema_version": contract_schema_version(),
        "target": str(target),
        "manifest_sha256": file_digest(manifest_path),
    }


def read_valid_ownership(target: Path, manifest_path: Path) -> dict[str, object]:
    """Authenticate a target manifest against its external ownership record."""
    record_path = ownership_path(target)
    if not record_path.is_file() or record_path.is_symlink():
        raise ProjectionError(
            f"managed manifest has no authenticated ownership record: {manifest_path}"
        )
    record = read_json(record_path)
    expected = ownership_record(target, manifest_path)
    if record != expected:
        raise ProjectionError(
            f"managed manifest ownership does not match {record_path}"
        )
    return record


def marketplace_plugins() -> dict[str, Path]:
    """Return plugin source paths from the authoritative Claude catalog."""
    marketplace = read_json(MARKETPLACE_PATH)
    entries = marketplace.get("plugins")
    if not isinstance(entries, list):
        raise ProjectionError(f"missing plugins array in {MARKETPLACE_PATH}")
    plugins_by_name: dict[str, Path] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise ProjectionError("marketplace plugin entries must be objects")
        name = entry.get("name")
        source = entry.get("source")
        if not isinstance(name, str) or not isinstance(source, str):
            raise ProjectionError("marketplace plugins require string name and source")
        plugin_root = (ROOT / source).resolve()
        if not plugin_root.is_relative_to(ROOT) or not plugin_root.is_dir():
            raise ProjectionError(f"invalid plugin source for {name}: {source}")
        if name in plugins_by_name:
            raise ProjectionError(f"duplicate marketplace plugin {name}")
        plugins_by_name[name] = plugin_root
    return plugins_by_name


def plugin_dependencies(plugin_root: Path, expected_name: str) -> tuple[str, ...]:
    """Read direct dependencies from one Claude plugin manifest."""
    manifest_path = plugin_root / ".claude-plugin" / "plugin.json"
    manifest = read_json(manifest_path)
    if manifest.get("name") != expected_name:
        raise ProjectionError(f"plugin name mismatch in {manifest_path}")
    dependencies = manifest.get("dependencies", [])
    if not isinstance(dependencies, list) or not all(
        isinstance(dependency, str) for dependency in dependencies
    ):
        raise ProjectionError(f"dependencies must be strings in {manifest_path}")
    return tuple(dependencies)


def resolve_plugins(
    selected_plugins: Sequence[str], plugins_by_name: dict[str, Path]
) -> tuple[str, ...]:
    """Resolve selected plugins and dependencies in dependency-first order."""
    resolved: list[str] = []
    visiting: list[str] = []

    def visit(name: str) -> None:
        if name in resolved:
            return
        if name in visiting:
            cycle = " -> ".join([*visiting, name])
            raise ProjectionError(f"plugin dependency cycle: {cycle}")
        plugin_root = plugins_by_name.get(name)
        if plugin_root is None:
            raise ProjectionError(f"unknown plugin {name}")
        visiting.append(name)
        for dependency in plugin_dependencies(plugin_root, name):
            visit(dependency)
        visiting.pop()
        resolved.append(name)

    for selected_plugin in selected_plugins:
        visit(selected_plugin)
    return tuple(resolved)


def project_target(scope: str, project_root: Path | None) -> Path:
    """Resolve the OpenCode V1 config directory for one scope."""
    if scope == "user":
        if project_root is not None:
            raise ProjectionError("--project-root is valid only with --scope project")
        config_home = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
        return config_home.expanduser().resolve() / "opencode"
    if project_root is None:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=Path.cwd(),
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise ProjectionError(
                "project scope requires a Git worktree or --project-root"
            )
        project_root = Path(result.stdout.strip())
    resolved_root = project_root.expanduser().resolve()
    if not resolved_root.is_dir():
        raise ProjectionError(f"project root is not a directory: {resolved_root}")
    return resolved_root / ".opencode"


def copy_plugin_bundle(plugin_root: Path, destination: Path) -> None:
    """Copy a plugin source tree without local interpreter caches."""
    shutil.copytree(
        plugin_root,
        destination,
        copy_function=shutil.copy2,
        ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache", ".DS_Store"),
    )


def rewrite_skill_name(
    text: str,
    projected_name: str,
    *,
    source: Path,
) -> str:
    """Rewrite only the name in a skill frontmatter block."""
    if len(projected_name) > 64:
        raise ProjectionError(
            f"OpenCode skill name exceeds 64 characters: {projected_name}"
        )
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        raise ProjectionError(f"skill has no YAML frontmatter: {source}")
    closing_index = next(
        (
            index
            for index, line in enumerate(lines[1:], start=1)
            if line.strip() == "---"
        ),
        None,
    )
    if closing_index is None:
        raise ProjectionError(f"skill frontmatter is not closed: {source}")
    name_indexes = [
        index
        for index, line in enumerate(lines[1:closing_index], start=1)
        if re.match(r"^name\s*:", line)
    ]
    if len(name_indexes) != 1:
        raise ProjectionError(f"skill requires exactly one frontmatter name: {source}")
    newline = "\r\n" if lines[name_indexes[0]].endswith("\r\n") else "\n"
    lines[name_indexes[0]] = f"name: {projected_name}{newline}"
    return "".join(lines)


def rewrite_markdown_links(
    text: str,
    source_file: Path,
    *,
    destination_file: Path,
    staged_root: Path,
    source_skill_root: Path,
) -> str:
    """Retarget links that leave a projected skill to its bundled source tree."""

    def replace(match: re.Match[str]) -> str:
        target = match.group("target")
        if target.startswith(("#", "/", "{", "$")) or "://" in target:
            return match.group(0)
        path_text, separator, fragment = target.partition("#")
        source_target = (source_file.parent / path_text).resolve()
        if not source_target.exists() or not source_target.is_relative_to(
            ROOT / "plugins"
        ):
            return match.group(0)
        if source_target.is_relative_to(source_skill_root):
            return match.group(0)
        relative_source = source_target.relative_to(ROOT / "plugins")
        destination_target = staged_root / "alvis" / "plugins" / relative_source
        relative_target = os.path.relpath(destination_target, destination_file.parent)
        projected_target = Path(relative_target).as_posix()
        if separator:
            projected_target = f"{projected_target}#{fragment}"
        return f"{match.group('prefix')}{projected_target}{match.group('suffix')}"

    return SKILL_LINK_PATTERN.sub(replace, text)


def rewrite_json_resource_paths(
    text: str,
    source_file: Path,
    *,
    destination_file: Path,
    staged_root: Path,
    source_skill_root: Path,
) -> str:
    """Retarget relative JSON resources that leave a projected skill."""

    def replace(match: re.Match[str]) -> str:
        source_target = (source_file.parent / match.group("target")).resolve()
        if (
            not source_target.exists()
            or not source_target.is_relative_to(ROOT / "plugins")
            or source_target.is_relative_to(source_skill_root)
        ):
            return match.group(0)
        relative_source = source_target.relative_to(ROOT / "plugins")
        destination_target = staged_root / "alvis" / "plugins" / relative_source
        relative_target = os.path.relpath(destination_target, destination_file.parent)
        return json.dumps(Path(relative_target).as_posix())

    return JSON_RELATIVE_PATH_PATTERN.sub(replace, text)


def rewrite_skill_runtime_paths(
    text: str,
    plugin_name: str,
    *,
    is_skill_entrypoint: bool,
) -> str:
    """Retarget plugin-root paths derived from a projected skill directory."""
    bundle_path = f"../../alvis/plugins/{plugin_name}"
    rewritten = SKILL_DIRECTORY_PATH_PATTERN.sub(
        lambda match: f"{match.group('variable')}/{bundle_path}",
        text,
    )
    if is_skill_entrypoint:
        rewritten = rewritten.replace("`../..`", f"`{bundle_path}`")
    return rewritten


def project_skill(
    plugin_name: str,
    source_skill_root: Path,
    *,
    staged_root: Path,
) -> str:
    """Project one skill and return its OpenCode identifier."""
    projected_name = contract_string("skill_separator").join(
        (plugin_name, source_skill_root.name)
    )
    destination_root = staged_root / "skills" / projected_name
    shutil.copytree(source_skill_root, destination_root, copy_function=shutil.copy2)
    for source_file in source_skill_root.rglob("*"):
        if (
            not source_file.is_file()
            or source_file.suffix not in PROJECTED_TEXT_SUFFIXES
        ):
            continue
        relative_path = source_file.relative_to(source_skill_root)
        destination_file = destination_root / relative_path
        text = source_file.read_text(encoding="utf-8")
        if relative_path == Path("SKILL.md"):
            text = rewrite_skill_name(text, projected_name, source=source_file)
        if source_file.suffix == ".md":
            text = rewrite_markdown_links(
                text,
                source_file,
                destination_file=destination_file,
                staged_root=staged_root,
                source_skill_root=source_skill_root,
            )
        if source_file.suffix == ".json":
            text = rewrite_json_resource_paths(
                text,
                source_file,
                destination_file=destination_file,
                staged_root=staged_root,
                source_skill_root=source_skill_root,
            )
        text = rewrite_skill_runtime_paths(
            text,
            plugin_name,
            is_skill_entrypoint=relative_path == Path("SKILL.md"),
        )
        destination_file.write_text(text, encoding="utf-8")
    return projected_name


def skill_description(skill_path: Path) -> str:
    """Read the single-line description used by a command wrapper."""
    text = skill_path.read_text(encoding="utf-8")
    match = re.search(r"^description:\s*(.+)$", text, flags=re.MULTILINE)
    if not match:
        raise ProjectionError(f"skill description missing: {skill_path}")
    value = match.group(1).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1]
    return " ".join(value.split())


def write_command(
    destination: Path,
    projected_name: str,
    *,
    description: str,
) -> None:
    """Write one OpenCode command wrapper for a projected skill."""
    rendered_description = json.dumps(f"Load and run {projected_name}: {description}")
    destination.write_text(
        "\n".join(
            (
                "---",
                f"description: {rendered_description}",
                "---",
                "",
                f"Load the `{projected_name}` skill with the native skill tool, follow it exactly, and apply it to:",
                "",
                "$ARGUMENTS",
                "",
            )
        ),
        encoding="utf-8",
    )


def agent_permissions(name: str, claude: dict[str, object]) -> tuple[str, ...]:
    """Translate recognized write fences and reject unknown agent hooks."""
    hooks = claude.get("hooks")
    if hooks is None:
        return ()
    policy = READ_ONLY_AGENT_POLICIES.get(name)
    if policy is None or not isinstance(hooks, dict):
        raise ProjectionError(f"unsupported security-sensitive hooks for agent {name}")
    serialized = json.dumps(hooks, sort_keys=True, separators=(",", ":")).encode()
    if hashlib.sha256(serialized).hexdigest() != policy["hook_sha256"]:
        raise ProjectionError(f"changed security-sensitive hooks for agent {name}")
    patterns = policy["edit_patterns"]
    if not isinstance(patterns, tuple):
        raise ProjectionError(f"invalid OpenCode write policy for agent {name}")
    return patterns


def write_agent(
    agent_root: Path,
    destination: Path,
) -> str:
    """Project one split agent template into OpenCode Markdown."""
    meta = read_json(agent_root / "frontmatter" / "meta.json")
    claude = read_json(agent_root / "frontmatter" / "claude.json")
    name = meta.get("name")
    description = meta.get("description")
    if (
        not isinstance(name, str)
        or name != agent_root.name
        or not isinstance(description, str)
    ):
        raise ProjectionError(f"invalid canonical metadata for agent {agent_root.name}")
    steps = claude.get("maxTurns")
    if not isinstance(steps, int) or steps < 1:
        raise ProjectionError(f"agent {name} requires a positive maxTurns")
    initial_prompt = claude.get("initialPrompt")
    if not isinstance(initial_prompt, str) or not initial_prompt.strip():
        raise ProjectionError(f"agent {name} requires initialPrompt")
    color = claude.get("color")
    projected_color = (
        OPEN_CODE_COLOR_BY_CLAUDE_COLOR.get(color) if isinstance(color, str) else None
    )
    permissions = agent_permissions(name, claude)

    frontmatter = [
        "---",
        f"description: {json.dumps(description)}",
        "mode: subagent",
        f"steps: {steps}",
    ]
    if projected_color:
        frontmatter.append(f"color: {projected_color}")
    if permissions:
        frontmatter.extend(("permission:", "  edit:", '    "*": deny'))
        frontmatter.extend(
            f"    {json.dumps(pattern)}: allow" for pattern in permissions
        )
        frontmatter.extend(("  bash: deny", "  external_directory: deny"))
    frontmatter.extend(("---", ""))
    body = (agent_root / "base.md").read_text(encoding="utf-8").strip()
    destination.write_text(
        "\n".join((*frontmatter, initial_prompt.strip(), "", body, "")),
        encoding="utf-8",
    )
    return name


def file_digest(path: Path) -> str:
    """Return the SHA-256 digest of one regular file."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_revision() -> str:
    """Return the checkout revision without requiring a clean worktree."""
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else "unknown"


def staged_files(staged_root: Path) -> tuple[Path, ...]:
    """List regular staged files in deterministic relative-path order."""
    return tuple(
        sorted(
            path.relative_to(staged_root)
            for path in staged_root.rglob("*")
            if path.is_file()
        )
    )


def write_manifest(
    staged_root: Path,
    scope: str,
    *,
    selected_plugins: Sequence[str],
    resolved_plugins: Sequence[str],
) -> dict[str, object]:
    """Write the managed projection receipt and return it."""
    files_before_manifest = staged_files(staged_root)
    digests = {
        path.as_posix(): file_digest(staged_root / path)
        for path in files_before_manifest
    }
    aggregate = hashlib.sha256()
    for path, digest in digests.items():
        aggregate.update(f"{path}\0{digest}\n".encode())
    manifest: dict[str, object] = {
        "schema_version": contract_schema_version(),
        "manager": contract_string("manager"),
        "scope": scope,
        "selected_plugins": list(selected_plugins),
        "resolved_plugins": list(resolved_plugins),
        "plugins": [
            {"name": name, "bundle_path": f"alvis/plugins/{name}"}
            for name in resolved_plugins
        ],
        "source": {
            "revision": source_revision(),
            "marketplace_sha256": file_digest(MARKETPLACE_PATH),
            "projection_sha256": aggregate.hexdigest(),
        },
        "file_digests": digests,
        "managed_paths": [
            *digests.keys(),
            MANIFEST_RELATIVE_PATH.as_posix(),
        ],
    }
    manifest_path = staged_root / MANIFEST_RELATIVE_PATH
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def build_projection(
    staged_root: Path,
    scope: str,
    *,
    selected_plugins: Sequence[str],
    resolved_plugins: Sequence[str],
    plugins_by_name: dict[str, Path],
) -> dict[str, object]:
    """Build a complete OpenCode projection in a staging directory."""
    (staged_root / "plugins").mkdir(parents=True)
    (staged_root / "skills").mkdir()
    (staged_root / "commands").mkdir()
    (staged_root / "agents").mkdir()
    (staged_root / "alvis").mkdir()
    shutil.copy2(ADAPTER_PATH, staged_root / "plugins" / "alvis-marketplace.js")
    shutil.copy2(CONTRACT_PATH, staged_root / "alvis" / "contract.json")

    skill_names: set[str] = set()
    agent_names: set[str] = set()
    for plugin_name in resolved_plugins:
        plugin_root = plugins_by_name[plugin_name]
        copy_plugin_bundle(
            plugin_root,
            staged_root / "alvis" / "plugins" / plugin_name,
        )
        skills_root = plugin_root / "skills"
        if skills_root.is_dir():
            for skill_root in sorted(
                path for path in skills_root.iterdir() if path.is_dir()
            ):
                skill_path = skill_root / "SKILL.md"
                if not skill_path.is_file():
                    continue
                projected_name = project_skill(
                    plugin_name,
                    skill_root,
                    staged_root=staged_root,
                )
                if projected_name in skill_names:
                    raise ProjectionError(
                        f"projected skill collision: {projected_name}"
                    )
                skill_names.add(projected_name)
                write_command(
                    staged_root / "commands" / f"{projected_name}.md",
                    projected_name,
                    description=skill_description(skill_path),
                )

        agents_root = plugin_root / "agents"
        if agents_root.is_dir():
            for agent_root in sorted(
                path for path in agents_root.iterdir() if path.is_dir()
            ):
                if not (agent_root / "base.md").is_file():
                    continue
                if agent_root.name in agent_names:
                    raise ProjectionError(
                        f"cross-plugin agent collision: {agent_root.name}"
                    )
                agent_names.add(agent_root.name)
                write_agent(
                    agent_root,
                    staged_root / "agents" / f"{agent_root.name}.md",
                )
    return write_manifest(
        staged_root,
        scope,
        selected_plugins=selected_plugins,
        resolved_plugins=resolved_plugins,
    )


def is_identifier(value: str) -> bool:
    """Return whether a projected identifier is canonical kebab case."""
    return re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value) is not None


def is_canonical_managed_path(path: Path, plugin_names: set[str]) -> bool:
    """Return whether a receipt path belongs to this projector's layout."""
    parts = path.parts
    if path in {
        MANIFEST_RELATIVE_PATH,
        Path("alvis/contract.json"),
        Path("plugins/alvis-marketplace.js"),
    }:
        return True
    if len(parts) >= 3 and parts[0] == "skills" and is_identifier(parts[1]):
        return True
    if (
        len(parts) == 2
        and parts[0] in {"agents", "commands"}
        and Path(parts[1]).suffix == ".md"
        and is_identifier(Path(parts[1]).stem)
    ):
        return True
    return (
        len(parts) >= 4
        and parts[:2] == ("alvis", "plugins")
        and parts[2] in plugin_names
    )


def validate_managed_path_state(
    target: Path, relative_path: Path, expected_digest: str
) -> None:
    """Reject modified managed files and symlinked path components."""
    destination = target / relative_path
    parent = destination.parent
    while parent != target and parent.is_relative_to(target):
        if parent.is_symlink():
            raise ProjectionError(f"symlink blocks managed path: {parent}")
        parent = parent.parent
    if not path_exists(destination):
        return
    if destination.is_symlink() or not destination.is_file():
        raise ProjectionError(f"managed path is not a regular file: {destination}")
    if file_digest(destination) != expected_digest:
        raise ProjectionError(f"managed path was modified: {destination}")


def load_previous_managed_paths(target: Path) -> set[Path]:
    """Load and verify paths owned by an earlier compatible projection."""
    manifest_path = target / MANIFEST_RELATIVE_PATH
    if not manifest_path.exists():
        return set()
    if manifest_path.is_symlink():
        raise ProjectionError(
            f"managed manifest must not be a symlink: {manifest_path}"
        )
    manifest = read_json(manifest_path)
    read_valid_ownership(target, manifest_path)
    if (
        manifest.get("manager") != contract_string("manager")
        or manifest.get("schema_version") != contract_schema_version()
    ):
        raise ProjectionError(f"unmanaged or incompatible manifest: {manifest_path}")
    paths = manifest.get("managed_paths")
    if not isinstance(paths, list) or not all(isinstance(path, str) for path in paths):
        raise ProjectionError(f"invalid managed_paths in {manifest_path}")
    digests = manifest.get("file_digests")
    if not isinstance(digests, dict) or not all(
        isinstance(path, str)
        and isinstance(digest, str)
        and re.fullmatch(r"[0-9a-f]{64}", digest)
        for path, digest in digests.items()
    ):
        raise ProjectionError(f"invalid file_digests in {manifest_path}")
    plugins = manifest.get("plugins")
    if not isinstance(plugins, list):
        raise ProjectionError(f"invalid plugins in {manifest_path}")
    plugin_names: set[str] = set()
    for plugin in plugins:
        if not isinstance(plugin, dict):
            raise ProjectionError(f"invalid plugin receipt in {manifest_path}")
        name = plugin.get("name")
        bundle_path = plugin.get("bundle_path")
        if (
            not isinstance(name, str)
            or not is_identifier(name)
            or bundle_path != f"alvis/plugins/{name}"
            or name in plugin_names
        ):
            raise ProjectionError(f"invalid plugin receipt in {manifest_path}")
        plugin_names.add(name)
    managed_paths: set[Path] = set()
    for path_text in paths:
        path = Path(path_text)
        if (
            path.is_absolute()
            or not path.parts
            or "." in path.parts
            or ".." in path.parts
            or not is_canonical_managed_path(path, plugin_names)
        ):
            raise ProjectionError(
                f"unsafe managed path in {manifest_path}: {path_text}"
            )
        managed_paths.add(path)
    expected_digest_paths = managed_paths - {MANIFEST_RELATIVE_PATH}
    if set(digests) != {path.as_posix() for path in expected_digest_paths}:
        raise ProjectionError(f"managed paths and digests differ in {manifest_path}")
    ordered_paths = sorted(managed_paths)
    for index, path in enumerate(ordered_paths):
        if any(other.is_relative_to(path) for other in ordered_paths[index + 1 :]):
            raise ProjectionError(
                f"overlapping managed paths in {manifest_path}: {path}"
            )
    for path in expected_digest_paths:
        digest = digests[path.as_posix()]
        if not isinstance(digest, str):
            raise ProjectionError(f"invalid digest for {path} in {manifest_path}")
        validate_managed_path_state(target, path, digest)
    return managed_paths


def path_exists(path: Path) -> bool:
    """Return whether a path or broken symlink occupies a location."""
    return path.exists() or path.is_symlink()


def journal_paths(journal: dict[str, object], key: str) -> set[Path]:
    """Read one safe relative-path set from a transaction journal."""
    values = journal.get(key)
    if not isinstance(values, list) or not all(
        isinstance(value, str) for value in values
    ):
        raise ProjectionError(f"invalid {key} in transaction journal")
    paths = {Path(value) for value in values}
    if len(paths) != len(values) or any(
        path.is_absolute() or not path.parts or "." in path.parts or ".." in path.parts
        for path in paths
    ):
        raise ProjectionError(f"unsafe {key} in transaction journal")
    return paths


def journal_digests(journal: dict[str, object], key: str) -> dict[Path, str]:
    """Read one path-to-SHA-256 map from a transaction journal."""
    values = journal.get(key)
    if not isinstance(values, dict) or not all(
        isinstance(path, str)
        and isinstance(digest, str)
        and re.fullmatch(r"[0-9a-f]{64}", digest)
        for path, digest in values.items()
    ):
        raise ProjectionError(f"invalid {key} in transaction journal")
    return {Path(path): digest for path, digest in values.items()}


def validate_recovery_file(path: Path, expected_digest: str) -> None:
    """Require an untampered regular file before recovery moves or deletes it."""
    if path.is_symlink() or not path.is_file():
        raise ProjectionError(f"transaction recovery path is not a file: {path}")
    if file_digest(path) != expected_digest:
        raise ProjectionError(f"transaction recovery path was modified: {path}")


def cleanup_transaction(target: Path) -> None:
    """Remove the durable backup and journal after commit or rollback."""
    directory = state_directory(target)
    backup_root = directory / "backup"
    if backup_root.exists():
        shutil.rmtree(backup_root)
        fsync_directory(directory)
    remove_durable_file(transaction_path(target))


def restore_prepared_transaction(target: Path, journal: dict[str, object]) -> None:
    """Restore the exact pre-install target and external ownership receipt."""
    previous_paths = journal_paths(journal, "previous_paths")
    desired_paths = journal_paths(journal, "desired_paths")
    previous_digests = journal_digests(journal, "previous_file_digests")
    desired_digests = journal_digests(journal, "desired_file_digests")
    if set(previous_digests) != previous_paths or set(desired_digests) != desired_paths:
        raise ProjectionError("transaction journal path and digest sets differ")
    backup_root = state_directory(target) / "backup"

    for relative_path in sorted(previous_paths):
        destination = target / relative_path
        backup = backup_root / relative_path
        if path_exists(backup):
            validate_recovery_file(backup, previous_digests[relative_path])
            if path_exists(destination):
                if relative_path not in desired_paths:
                    raise ProjectionError(
                        f"unexpected recovery collision: {destination}"
                    )
                validate_recovery_file(destination, desired_digests[relative_path])
                destination.unlink()
            destination.parent.mkdir(parents=True, exist_ok=True)
            os.replace(backup, destination)
        else:
            validate_recovery_file(destination, previous_digests[relative_path])

    for relative_path in sorted(desired_paths - previous_paths, reverse=True):
        destination = target / relative_path
        if path_exists(destination):
            validate_recovery_file(destination, desired_digests[relative_path])
            destination.unlink()
            remove_empty_parents(destination, target)

    previous_ownership = journal.get("previous_ownership")
    record_path = ownership_path(target)
    if previous_ownership is None:
        remove_durable_file(record_path)
    elif isinstance(previous_ownership, dict):
        write_durable_json(record_path, previous_ownership)
    else:
        raise ProjectionError("invalid previous_ownership in transaction journal")
    cleanup_transaction(target)


def recover_interrupted_transaction(target: Path) -> None:
    """Complete cleanup or rollback from a durable interrupted transaction."""
    journal_path = transaction_path(target)
    if not journal_path.exists():
        return
    if journal_path.is_symlink():
        raise ProjectionError(
            f"transaction journal must not be a symlink: {journal_path}"
        )
    journal = read_json(journal_path)
    if (
        journal.get("manager") != contract_string("manager")
        or journal.get("schema_version") != contract_schema_version()
        or journal.get("target") != str(target)
    ):
        raise ProjectionError(f"invalid transaction journal: {journal_path}")
    status = journal.get("status")
    if status == "prepared":
        restore_prepared_transaction(target, journal)
        return
    if status == "committed":
        manifest_path = target / MANIFEST_RELATIVE_PATH
        read_valid_ownership(target, manifest_path)
        cleanup_transaction(target)
        return
    raise ProjectionError(f"invalid transaction status in {journal_path}")


def validate_collisions(
    target: Path,
    desired_paths: Iterable[Path],
    *,
    previous_managed_paths: set[Path],
) -> None:
    """Reject desired paths already occupied by unmanaged content."""
    if path_exists(target) and (target.is_symlink() or not target.is_dir()):
        raise ProjectionError(f"OpenCode config target must be a directory: {target}")
    for relative_path in desired_paths:
        destination = target / relative_path
        if path_exists(destination) and relative_path not in previous_managed_paths:
            raise ProjectionError(f"unmanaged path collision: {destination}")
        parent = destination.parent
        while parent != target and parent.is_relative_to(target):
            if path_exists(parent):
                if parent.is_symlink():
                    raise ProjectionError(f"symlink blocks projection: {parent}")
                if not parent.is_dir():
                    raise ProjectionError(f"non-directory blocks projection: {parent}")
            parent = parent.parent


def remove_empty_parents(path: Path, target: Path) -> None:
    """Remove empty managed parent directories without crossing target."""
    parent = path.parent
    while parent != target and parent.is_relative_to(target):
        try:
            parent.rmdir()
        except OSError:
            return
        parent = parent.parent


def install_staged_projection(staged_root: Path, target: Path) -> None:
    """Install staged files transactionally and restore prior files on failure."""
    desired_paths = set(staged_files(staged_root))
    previous_paths = load_previous_managed_paths(target)
    validate_collisions(
        target,
        desired_paths,
        previous_managed_paths=previous_paths,
    )
    affected_paths = sorted(previous_paths | desired_paths)

    target.parent.mkdir(parents=True, exist_ok=True)
    target.mkdir(parents=True, exist_ok=True)
    directory = ensure_private_state_directory(target)
    journal_path = transaction_path(target)
    backup_root = directory / "backup"
    if journal_path.exists() or backup_root.exists():
        raise ProjectionError(
            f"installer transaction state already exists for {target}; rerun to recover"
        )
    existing_previous_paths = {
        path for path in previous_paths if path_exists(target / path)
    }
    previous_ownership_path = ownership_path(target)
    previous_ownership = (
        read_json(previous_ownership_path)
        if previous_ownership_path.is_file()
        and not previous_ownership_path.is_symlink()
        else None
    )
    journal: dict[str, object] = {
        "manager": contract_string("manager"),
        "schema_version": contract_schema_version(),
        "target": str(target),
        "status": "prepared",
        "previous_paths": [path.as_posix() for path in sorted(existing_previous_paths)],
        "desired_paths": [path.as_posix() for path in sorted(desired_paths)],
        "previous_file_digests": {
            path.as_posix(): file_digest(target / path)
            for path in sorted(existing_previous_paths)
        },
        "desired_file_digests": {
            path.as_posix(): file_digest(staged_root / path)
            for path in sorted(desired_paths)
        },
        "previous_ownership": previous_ownership,
    }
    write_durable_json(journal_path, journal)
    backup_root.mkdir(mode=0o700)
    fsync_directory(directory)
    try:
        for relative_path in affected_paths:
            destination = target / relative_path
            if not path_exists(destination):
                continue
            backup = backup_root / relative_path
            backup.parent.mkdir(parents=True, exist_ok=True)
            os.replace(destination, backup)

        install_order = sorted(
            desired_paths,
            key=lambda path: path == MANIFEST_RELATIVE_PATH,
        )
        for relative_path in install_order:
            source = staged_root / relative_path
            destination = target / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            os.replace(source, destination)
        write_durable_json(
            ownership_path(target),
            ownership_record(target, target / MANIFEST_RELATIVE_PATH),
        )
        journal["status"] = "committed"
        write_durable_json(journal_path, journal)
    except BaseException as install_error:
        try:
            restore_prepared_transaction(target, journal)
        # Preserve the backup even when cancellation interrupts rollback.
        except BaseException as rollback_error:  # noqa: BLE001
            raise ProjectionError(
                f"rollback failed; recover managed files from {backup_root}: {rollback_error}"
            ) from install_error
        raise

    cleanup_transaction(target)
    for relative_path in sorted(previous_paths - desired_paths, reverse=True):
        remove_empty_parents(target / relative_path, target)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """Parse the public installer command line."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=("user", "project"), required=True)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--plugin", action="append", dest="plugins", metavar="NAME")
    selection.add_argument("--all", action="store_true", dest="install_all")
    parser.add_argument("--project-root", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    """Build and optionally install an OpenCode V1 projection."""
    args = parse_args(argv)
    try:
        plugins_by_name = marketplace_plugins()
        selected_plugins = (
            tuple(plugins_by_name)
            if args.install_all
            else tuple(dict.fromkeys(args.plugins))
        )
        resolved_plugins = resolve_plugins(selected_plugins, plugins_by_name)
        target = project_target(args.scope, args.project_root)
        if args.dry_run:
            if transaction_path(target).exists():
                raise ProjectionError(
                    "an interrupted transaction requires a non-dry-run recovery"
                )
        else:
            recover_interrupted_transaction(target)
        temporary_parent = None if args.dry_run else target.parent
        if temporary_parent is not None:
            temporary_parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(
            prefix="alvis-opencode-stage-",
            dir=temporary_parent,
        ) as staged_text:
            staged_root = Path(staged_text)
            manifest = build_projection(
                staged_root,
                args.scope,
                selected_plugins=selected_plugins,
                resolved_plugins=resolved_plugins,
                plugins_by_name=plugins_by_name,
            )
            if args.dry_run:
                validate_collisions(
                    target,
                    staged_files(staged_root),
                    previous_managed_paths=load_previous_managed_paths(target),
                )
            else:
                install_staged_projection(staged_root, target)
        managed_paths = manifest.get("managed_paths")
        if not isinstance(managed_paths, list):
            raise ProjectionError("generated manifest has no managed paths")
        print(
            json.dumps(
                {
                    "status": "dry-run" if args.dry_run else "installed",
                    "target": str(target),
                    "selected_plugins": selected_plugins,
                    "resolved_plugins": resolved_plugins,
                    "managed_file_count": len(managed_paths),
                },
                indent=2,
            )
        )
        return 0
    except ProjectionError as error:
        raise SystemExit(f"install_opencode.py: error: {error}") from error


if __name__ == "__main__":
    raise SystemExit(main())
