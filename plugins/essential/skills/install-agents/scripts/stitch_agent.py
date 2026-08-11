#!/usr/bin/env python3
"""Validate and stitch a split agent template into a Claude agent file."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

AGENT_NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PREFERRED_NAMES = re.compile(
    r"(?:^| )Preferably named ([A-Z][a-z]{1,15}), ([A-Z][a-z]{1,15}), "
    r"or ([A-Z][a-z]{1,15}) when the main agent spawns this role\.$"
)
FIXED_ROUTING_LANGUAGE = re.compile(
    r"\b(?:only|always)\s+(?:spawn|delegate|route)\b"
    r"|\bAgent` tool for one purpose\b"
    r"|\bI am the only agent who forms\b",
    re.IGNORECASE,
)
SHARED_POLICY_LANGUAGE = (
    "current `Agent` roster",
    "When I need a Dynamic Workflow",
    "For changed code, I inspect",
    "REVIEWED: source=",
    "I hold the `Agent` tool",
    "I hold `Agent`",
    "spawn target",
    "spawned by",
)
# NOTE: Claude Code caps an agent description at 1024 characters.
DESCRIPTION_LIMIT = 1024
INTELLIGENCE_LEVELS_PATH = (
    Path(__file__).resolve().parent.parent / "references/intelligence-levels.json"
)
# NOTE: Kept deliberately permissive — these reject typos, not unfamiliar modes.
# Claude Code owns this set and may extend it; a mode it accepts but we omit
# would fail the whole roster here for no reason.
VALID_PERMISSION_MODES = (
    "default",
    "acceptEdits",
    "auto",
    "dontAsk",
    "bypassPermissions",
    "plan",
    "manual",
)
MEMORY_SECTION = re.compile(r"^## Memory\n(?P<body>.*?)(?=^## |\Z)", re.MULTILINE | re.DOTALL)
MEMORY_CONTRACT_MARKERS = (
    "durable",
    "evidence",
    "last-verified",
    "archive",
    "150 lines",
    "20kb",
    "essential:templates/memory.md",
    "topics/<stable-area>/<specific-subject>.md",
)
LEAD_AGENT_DIRECTION_ALIAS = (
    "@essential:references/directions/lead-agent.md"
)
LEAD_AGENT_DIRECTION_PATH = Path("references/directions/lead-agent.md")


class AgentTemplateError(ValueError):
    """Raised when an agent source set cannot produce a valid definition."""


def _reject_nonstandard_number(value: str) -> None:
    raise ValueError(f"non-standard JSON number: {value}")


def _load_intelligence_levels() -> dict[str, dict[str, dict[str, str]]]:
    """Load the authoritative harness projection matrix."""
    try:
        matrix = json.loads(
            INTELLIGENCE_LEVELS_PATH.read_text(encoding="utf-8"),
            parse_constant=_reject_nonstandard_number,
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise AgentTemplateError(
            f"invalid intelligence-level matrix {INTELLIGENCE_LEVELS_PATH}: {error}"
        ) from error
    if not isinstance(matrix, dict) or not matrix:
        raise AgentTemplateError("intelligence-level matrix must be a non-empty object")
    allowed_fields = {
        "claude": {"model", "effort"},
        "codex": {"model", "model_reasoning_effort"},
    }
    for level, projection in matrix.items():
        if not isinstance(level, str) or not isinstance(projection, dict):
            raise AgentTemplateError("invalid intelligence-level matrix entry")
        if set(projection) != set(allowed_fields):
            raise AgentTemplateError(
                f"intelligence level {level!r} must define claude and codex projections"
            )
        for harness, fields in projection.items():
            if not isinstance(fields, dict) or not set(fields) <= allowed_fields[harness]:
                raise AgentTemplateError(
                    f"invalid {harness} projection for intelligence level {level!r}"
                )
            if not all(isinstance(value, str) for value in fields.values()):
                raise AgentTemplateError(
                    f"{harness} projection values must be strings for {level!r}"
                )
    return matrix


INTELLIGENCE_LEVELS = _load_intelligence_levels()
VALID_INTELLIGENCE_LEVELS = tuple(INTELLIGENCE_LEVELS)
METADATA_FIELDS = {"name", "description", "intelligence"}
CLAUDE_DERIVED_FIELDS = {
    "name",
    "description",
    "intelligence",
    "intelligenceLevel",
    "model",
    "effort",
}
CODEX_DERIVED_FIELDS = {
    "name",
    "description",
    "nickname_candidates",
    "intelligence",
    "intelligenceLevel",
    "model",
    "model_reasoning_effort",
    "developer_instructions",
}
TOML_BARE_KEY = re.compile(r"^[A-Za-z0-9_-]+$")
WORKTREE_SENTENCE = re.compile(
    r"(?m)^[^\n.!?]*\bworktree\b[^\n.!?]*[.!?][ \t]*"
)


@dataclass(frozen=True)
class AgentSources:
    metadata: dict[str, Any]
    claude: dict[str, Any]
    codex: dict[str, Any]


def _preferred_name_candidates(description: Any) -> tuple[str, str, str]:
    preferred_names = (
        PREFERRED_NAMES.search(description) if isinstance(description, str) else None
    )
    if preferred_names is None or len(set(preferred_names.groups())) != 3:
        raise AgentTemplateError(
            "description must end with exactly three distinct preferred short names"
        )
    first, second, third = preferred_names.groups()
    return first, second, third


def _load_json_object(path: Path) -> dict[str, Any]:
    try:
        document = json.loads(
            path.read_text(encoding="utf-8"),
            parse_constant=_reject_nonstandard_number,
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise AgentTemplateError(f"invalid JSON in {path}: {error}") from error
    if not isinstance(document, dict):
        raise AgentTemplateError(f"agent source must be a JSON object: {path}")
    return document


def _legacy_agent_sources(frontmatter_path: Path) -> AgentSources:
    legacy = _load_json_object(frontmatter_path)
    name = legacy.pop("name", None)
    description = legacy.pop("description", None)
    intelligence = legacy.pop("intelligence", None)
    previous_intelligence = legacy.pop("intelligenceLevel", None)
    if intelligence is not None and previous_intelligence is not None:
        raise AgentTemplateError(
            "legacy frontmatter must not define both intelligence keys"
        )
    intelligence = intelligence if intelligence is not None else previous_intelligence
    if intelligence is None:
        legacy_projection = {
            field: legacy.pop(field)
            for field in ("model", "effort")
            if field in legacy
        }
        intelligence = next(
            (
                level
                for level, projections in INTELLIGENCE_LEVELS.items()
                if projections["claude"] == legacy_projection
            ),
            None,
        )
        if intelligence is None:
            raise AgentTemplateError(
                "legacy model/effort pair is not represented by the intelligence matrix"
            )
    return AgentSources(
        metadata={
            "name": name,
            "description": description,
            "intelligence": intelligence,
        },
        claude=legacy,
        codex={},
    )


def load_agent_sources(
    template_directory: Path, *, allow_legacy: bool = False
) -> AgentSources:
    frontmatter_directory = template_directory / "frontmatter"
    source_paths = {
        name: frontmatter_directory / name
        for name in ("meta.json", "claude.json", "codex.json")
    }
    base_path = template_directory / "base.md"
    if not base_path.is_file():
        raise AgentTemplateError(f"missing base.md in {template_directory}")
    split_sources_exist = {
        name: path.is_file() for name, path in source_paths.items()
    }
    legacy_source = (
        allow_legacy
        and split_sources_exist["claude.json"]
        and not split_sources_exist["meta.json"]
        and not split_sources_exist["codex.json"]
    )
    if not all(split_sources_exist.values()) and not legacy_source:
        missing = next(
            name for name, exists in split_sources_exist.items() if not exists
        )
        raise AgentTemplateError(
            f"missing frontmatter/{missing} in {template_directory}"
        )
    resolved_template = template_directory.resolve()
    checked_sources = (
        (source_paths["claude.json"],)
        if legacy_source
        else tuple(source_paths.values())
    )
    for source_path in (*checked_sources, base_path):
        try:
            source_path.resolve().relative_to(resolved_template)
        except ValueError as error:
            raise AgentTemplateError(
                f"template symlink or path escapes agent directory: {source_path}"
            ) from error
    if legacy_source:
        sources = _legacy_agent_sources(source_paths["claude.json"])
        metadata, claude, codex = (
            sources.metadata,
            sources.claude,
            sources.codex,
        )
    else:
        metadata = _load_json_object(source_paths["meta.json"])
        claude = _load_json_object(source_paths["claude.json"])
        codex = _load_json_object(source_paths["codex.json"])
    if set(metadata) != METADATA_FIELDS:
        raise AgentTemplateError(
            "frontmatter/meta.json must contain exactly name, description, and intelligence"
        )
    for harness, overlay, reserved in (
        ("claude", claude, CLAUDE_DERIVED_FIELDS),
        ("codex", codex, CODEX_DERIVED_FIELDS),
    ):
        collision = next((field for field in overlay if field in reserved), None)
        if collision:
            raise AgentTemplateError(
                f"frontmatter/{harness}.json must not define derived field "
                f"{collision!r}"
            )
    invalid_codex_field = next(
        (
            field
            for field, value in codex.items()
            if not TOML_BARE_KEY.fullmatch(field)
            or not isinstance(value, (str, bool, int, float))
        ),
        None,
    )
    if invalid_codex_field:
        raise AgentTemplateError(
            "frontmatter/codex.json values must be TOML scalar fields: "
            f"{invalid_codex_field!r}"
        )
    name = metadata.get("name")
    if not isinstance(name, str) or not AGENT_NAME.fullmatch(name):
        raise AgentTemplateError(
            f"invalid agent name in {source_paths['meta.json']}: {name!r}"
        )
    if name != template_directory.name:
        raise AgentTemplateError(
            f"metadata name {name!r} does not match directory {template_directory.name!r}"
        )
    description = metadata.get("description")
    _preferred_name_candidates(description)
    return AgentSources(metadata=metadata, claude=claude, codex=codex)


def validate_agent_contract(sources: AgentSources, body: str) -> None:
    """Reject agent definitions whose fields are invalid or whose prose
    disagrees with their capabilities."""
    metadata = sources.metadata
    claude = sources.claude
    description = metadata.get("description", "")
    if len(description) > DESCRIPTION_LIMIT:
        raise AgentTemplateError(
            f"description exceeds {DESCRIPTION_LIMIT} characters: {len(description)}"
        )

    for field, allowed in (("permissionMode", VALID_PERMISSION_MODES),):
        value = claude.get(field)
        if value is not None and value not in allowed:
            raise AgentTemplateError(
                f"invalid {field} {value!r}: expected one of {', '.join(allowed)}"
            )

    intelligence = metadata.get("intelligence")
    if not isinstance(intelligence, str) or intelligence not in INTELLIGENCE_LEVELS:
        raise AgentTemplateError(
            f"invalid intelligence {intelligence!r}: expected one of "
            f"{', '.join(VALID_INTELLIGENCE_LEVELS)}"
        )
    if "tools" in claude or "tools" in sources.codex:
        raise AgentTemplateError(
            "agent definitions must omit tools to inherit runtime capabilities"
        )

    routing_text = "\n".join(
        value
        for value in (
            body,
            metadata.get("description"),
            claude.get("initialPrompt"),
        )
        if isinstance(value, str)
    )
    if FIXED_ROUTING_LANGUAGE.search(routing_text):
        raise AgentTemplateError(
            "fixed routing language conflicts with runtime discovery"
        )

    duplicated_policy = next(
        (phrase for phrase in SHARED_POLICY_LANGUAGE if phrase in body), None
    )
    if duplicated_policy:
        raise AgentTemplateError(
            f"agent body repeats shared delegation policy: {duplicated_policy}"
        )

    name = metadata.get("name")
    if claude.get("memory") != "project":
        raise AgentTemplateError("agent memory must be project-scoped")
    memory_sections = list(MEMORY_SECTION.finditer(body))
    if len(memory_sections) != 1:
        raise AgentTemplateError("agent body must contain exactly one ## Memory section")
    expected_memory_path = f".claude/agent-memory/{name}/MEMORY.md"
    memory_body = memory_sections[0].group("body")
    if expected_memory_path not in memory_body:
        raise AgentTemplateError(
            f"Memory section must name exact path {expected_memory_path}"
        )
    normalized_body = memory_body.lower()
    missing_memory_marker = next(
        (marker for marker in MEMORY_CONTRACT_MARKERS if marker not in normalized_body),
        None,
    )
    if missing_memory_marker:
        raise AgentTemplateError(
            f"Memory section is missing maintenance marker: {missing_memory_marker}"
        )


def _derive_essential_root(template_directory: Path) -> Path | None:
    resolved_template = template_directory.resolve()
    for parent in resolved_template.parents:
        if parent.name != "plugins":
            continue
        candidate = parent / "essential"
        if (candidate / LEAD_AGENT_DIRECTION_PATH).is_file():
            return candidate.resolve()
    if len(resolved_template.parents) > 1:
        plugin_root = resolved_template.parents[1]
        cache_candidate = plugin_root.parent.parent / "essential" / plugin_root.name
        if (cache_candidate / LEAD_AGENT_DIRECTION_PATH).is_file():
            return cache_candidate.resolve()
    return None


def _resolve_essential_references(
    body: str,
    template_directory: Path,
    essential_root: Path | None,
    reference_root: Path | None,
) -> str:
    if LEAD_AGENT_DIRECTION_ALIAS not in body:
        return body
    resolved_root = (
        Path(essential_root).resolve()
        if essential_root is not None
        else _derive_essential_root(template_directory)
    )
    if resolved_root is None:
        raise AgentTemplateError(
            "agent template uses @essential references; pass --essential-root "
            "or place the template in an unambiguous source checkout"
        )
    direction = resolved_root / LEAD_AGENT_DIRECTION_PATH
    if not direction.is_file():
        raise AgentTemplateError(f"missing Essential lead direction: {direction}")
    rendered_root = (
        Path(reference_root).resolve()
        if reference_root is not None
        else resolved_root
    )
    return body.replace(
        LEAD_AGENT_DIRECTION_ALIAS,
        f"@{rendered_root / LEAD_AGENT_DIRECTION_PATH}",
    )


def stitch_agent_definition(
    template_directory: Path,
    *,
    essential_root: Path | None = None,
    reference_root: Path | None = None,
    allow_legacy: bool = False,
) -> str:
    """Return one installable Markdown agent definition from split sources."""
    template_directory = Path(template_directory)
    sources = load_agent_sources(template_directory, allow_legacy=allow_legacy)
    body = (template_directory / "base.md").read_text(encoding="utf-8").lstrip("\n")
    validate_agent_contract(sources, body)
    body = _resolve_essential_references(
        body,
        template_directory,
        essential_root,
        reference_root,
    )
    projected = {
        field: sources.metadata[field]
        for field in ("name", "description")
    }
    if "color" in sources.claude:
        projected["color"] = sources.claude["color"]
    projected.update(
        INTELLIGENCE_LEVELS[sources.metadata["intelligence"]]["claude"]
    )
    projected.update(
        {
            field: value
            for field, value in sources.claude.items()
            if field != "color"
        }
    )
    yaml = json.dumps(projected, ensure_ascii=False, indent=2, allow_nan=False)
    return f"---\n{yaml}\n---\n\n{body}"


def _remove_markdown_section(body: str, heading: str) -> str:
    section = re.compile(
        rf"^## {re.escape(heading)}\n.*?(?=^## |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    match = section.search(body)
    if match is None:
        return body
    before = body[: match.start()].rstrip()
    after = body[match.end() :].lstrip("\n")
    if before and after:
        return f"{before}\n\n{after}"
    return before or after


def _codex_harness_neutral_text(text: str) -> str:
    projected = text.replace(
        "run it inside my isolated worktree",
        "run it within the active harness boundaries",
    )
    projected = re.sub(r",? and Workflow launches", "", projected)
    return WORKTREE_SENTENCE.sub("", projected)


def _codex_developer_instructions(body: str) -> str:
    """Project shared instructions onto behavior available in Codex."""
    projected = _remove_markdown_section(body, "Memory")
    delegation = re.compile(
        r"^## Delegation Modes\n(?P<body>.*?)(?=^## |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    match = delegation.search(projected)
    if match is not None and "Dynamic Workflow" in match.group("body"):
        direct = re.search(
            r"^- \*\*Direct persistent delegation\*\*.*?"
            r"(?=^- \*\*Dynamic Workflow delegation\*\*)",
            match.group("body"),
            re.MULTILINE | re.DOTALL,
        )
        if direct is None:
            raise AgentTemplateError(
                "Delegation Modes must contain direct delegation before Dynamic Workflow"
            )
        replacement = f"## Delegation Modes\n\n{direct.group().rstrip()}\n"
        projected = (
            projected[: match.start()]
            + replacement
            + projected[match.end() :]
        )
    projected = _codex_harness_neutral_text(projected)
    projected = projected.rstrip() + "\n"
    unsupported = next(
        (
            marker
            for marker in (
                ".claude/agent-memory/",
                "Dynamic Workflow",
                "Workflow launches",
                "worktree",
            )
            if marker in projected
        ),
        None,
    )
    if unsupported:
        raise AgentTemplateError(
            f"Codex developer instructions retain Claude-only behavior: {unsupported}"
        )
    return projected


def stitch_codex_agent_definition(
    template_directory: Path,
    *,
    essential_root: Path | None = None,
    reference_root: Path | None = None,
    allow_legacy: bool = False,
) -> str:
    """Return one installable Codex custom-agent TOML definition."""
    template_directory = Path(template_directory)
    sources = load_agent_sources(template_directory, allow_legacy=allow_legacy)
    body = (template_directory / "base.md").read_text(encoding="utf-8").lstrip("\n")
    validate_agent_contract(sources, body)
    fields = [
        ("name", sources.metadata["name"]),
        (
            "description",
            _codex_harness_neutral_text(sources.metadata["description"]),
        ),
        (
            "nickname_candidates",
            list(_preferred_name_candidates(sources.metadata["description"])),
        ),
    ]
    fields.extend(
        INTELLIGENCE_LEVELS[sources.metadata["intelligence"]]["codex"].items()
    )
    fields.extend(sources.codex.items())
    fields.append(
        (
            "developer_instructions",
            _resolve_essential_references(
                _codex_developer_instructions(body),
                template_directory,
                essential_root,
                reference_root,
            ),
        )
    )
    return "".join(
        f"{name} = {json.dumps(value, ensure_ascii=False)}\n"
        for name, value in fields
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("template", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--harness",
        choices=("claude", "codex"),
        default="claude",
    )
    parser.add_argument(
        "--essential-root",
        type=Path,
        help=(
            "Essential plugin root used to resolve @essential references; "
            "inferred from normal source-checkout and installed-cache layouts"
        ),
    )
    args = parser.parse_args()
    essential_root = args.essential_root
    if essential_root is None:
        candidate = Path(__file__).resolve().parents[3]
        if (candidate / LEAD_AGENT_DIRECTION_PATH).is_file():
            essential_root = candidate
    try:
        stitched = (
            stitch_agent_definition(
                args.template,
                essential_root=essential_root,
            )
            if args.harness == "claude"
            else stitch_codex_agent_definition(
                args.template,
                essential_root=essential_root,
            )
        )
    except AgentTemplateError as error:
        parser.error(str(error))
    if args.output:
        args.output.write_text(stitched, encoding="utf-8")
    else:
        print(stitched, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
