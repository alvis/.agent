#!/usr/bin/env python3
"""Generate the source-derived harness compatibility matrix."""

import argparse
import json
import re
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "COMPATIBILITY.md"
CONTRACT_PATH = ROOT / "scripts" / "opencode_contract.json"
REVIEWED_DATE = "2026-08-21"
FULL = "✅ Native"
ADAPTED = "🟡 Adapted"
EXTERNAL = "🔌 Integration"
EXPERIMENTAL = "🧪 Experimental"
UNAVAILABLE = "❌ Unavailable"
INTEGRATION_CAVEAT_BY_SKILL = {
    "client:create-screen-design": "Requires the documented Notion transport and credentials.",
    "client:update-screen-design": "Requires the documented Notion transport and credentials.",
    "coding:pr": "Requires authenticated GitHub tooling.",
    "specification:sync-notion": "Requires the documented Notion transport and credentials.",
    "specification:sync-spec": "Requires the documented Notion transport and credentials.",
    "web:audit": "Requires a compatible browser integration.",
    "web:imagine": "Requires an image-generation provider or tool.",
    "web:next": "Requires a compatible browser integration.",
    "web:storybook": "Requires a compatible browser integration.",
}
OPENCODE_UNAVAILABLE_SKILLS = {
    "essential:install-agents": "The projector already installs OpenCode agents; this skill's installer supports only Claude Code and Codex.",
}


def projection_contract() -> dict[str, object]:
    """Read the shared OpenCode naming protocol."""
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    if not isinstance(contract, dict) or contract.get("skill_separator") != "-":
        raise ValueError(f"invalid OpenCode projection contract: {CONTRACT_PATH}")
    return contract


def projected_skill_name(plugin_name: str, skill_name: str) -> str:
    """Project one canonical skill name through the shared protocol."""
    separator = projection_contract()["skill_separator"]
    if not isinstance(separator, str):
        raise TypeError(f"invalid skill separator: {CONTRACT_PATH}")
    return separator.join((plugin_name, skill_name))


@dataclass(frozen=True, slots=True)
class Feature:
    """One rendered compatibility row."""

    name: str
    claude: str
    codex: str
    grok: str
    opencode: str
    caveat: str


CROSS_CUTTING_FEATURES = (
    Feature(
        "Plugin installation",
        FULL,
        FULL,
        ADAPTED,
        ADAPTED,
        "Grok reads Claude-compatible plugins; OpenCode uses `scripts/install_opencode.py`.",
    ),
    Feature(
        "Marketplace catalog",
        FULL,
        FULL,
        ADAPTED,
        UNAVAILABLE,
        "OpenCode V1 documents local files and npm plugins, not this marketplace format.",
    ),
    Feature(
        "Skills",
        FULL,
        FULL,
        ADAPTED,
        ADAPTED,
        "OpenCode projects `plugin:skill` to the collision-safe name `plugin-skill`.",
    ),
    Feature(
        "Slash commands",
        FULL,
        ADAPTED,
        ADAPTED,
        ADAPTED,
        "OpenCode generates `/<plugin>-<skill>` wrappers with `$ARGUMENTS`.",
    ),
    Feature(
        "Skill resources and references",
        FULL,
        FULL,
        ADAPTED,
        ADAPTED,
        "OpenCode bundles complete plugin trees and retargets projected Markdown links.",
    ),
    Feature(
        "Standards and scanners",
        FULL,
        FULL,
        ADAPTED,
        ADAPTED,
        "Runtime prerequisites still apply to scripts invoked by a skill.",
    ),
    Feature(
        "Bundled scripts",
        FULL,
        FULL,
        ADAPTED,
        ADAPTED,
        "OpenCode copies plugin executables and retargets projected skill-root paths to the bundle.",
    ),
    Feature(
        "Session context payloads",
        FULL,
        FULL,
        ADAPTED,
        EXPERIMENTAL,
        "OpenCode uses `experimental.chat.system.transform`; unresolved session audience receives no root/child payload.",
    ),
    Feature(
        "Skill-scoped hooks",
        FULL,
        FULL,
        ADAPTED,
        UNAVAILABLE,
        "OpenCode V1 ignores unrecognized skill frontmatter; only adapter-level guards run.",
    ),
    Feature(
        "Question guard",
        FULL,
        FULL,
        ADAPTED,
        ADAPTED,
        "The adapter validates OpenCode `question` arguments with the Essential validator.",
    ),
    Feature(
        "Subagent dispatch guard",
        FULL,
        FULL,
        ADAPTED,
        ADAPTED,
        "OpenCode validates task prompts but has no persistent teammate-name field.",
    ),
    Feature(
        "Plan-exit guard",
        FULL,
        FULL,
        ADAPTED,
        UNAVAILABLE,
        "OpenCode V1 exposes no equivalent plan-exit tool event.",
    ),
    Feature(
        "MCP servers",
        FULL,
        FULL,
        ADAPTED,
        ADAPTED,
        "The adapter maps HTTP to remote and command definitions to local MCP servers.",
    ),
    Feature(
        "Specialist agents",
        FULL,
        FULL,
        ADAPTED,
        ADAPTED,
        "OpenCode Markdown agents inherit the active provider and model.",
    ),
    Feature(
        "Child subagent sessions",
        FULL,
        FULL,
        ADAPTED,
        ADAPTED,
        "OpenCode task sessions work; persistent teammate IDs and direct peer messaging do not.",
    ),
    Feature(
        "Project agent memory",
        FULL,
        ADAPTED,
        ADAPTED,
        ADAPTED,
        "OpenCode receives memory instructions but has no equivalent first-class Claude memory store.",
    ),
    Feature(
        "Agent write fences",
        FULL,
        ADAPTED,
        ADAPTED,
        ADAPTED,
        "Recognized critic fences allow only rooted memory and canonical review-state paths; shell and external-directory access are denied.",
    ),
    Feature(
        "Browser automation",
        EXTERNAL,
        EXTERNAL,
        EXTERNAL,
        EXTERNAL,
        "Requires a compatible browser tool or MCP server in every harness.",
    ),
    Feature(
        "Notion synchronization",
        EXTERNAL,
        EXTERNAL,
        EXTERNAL,
        EXTERNAL,
        "Requires the documented Notion transport profile and credentials.",
    ),
    Feature(
        "Image generation",
        EXTERNAL,
        EXTERNAL,
        EXTERNAL,
        EXTERNAL,
        "Requires a supported image provider or tool.",
    ),
    Feature(
        "Claude output styles",
        FULL,
        UNAVAILABLE,
        UNAVAILABLE,
        UNAVAILABLE,
        "The repository intentionally scopes output-style installation to Claude Code.",
    ),
    Feature(
        "Claude statusline",
        FULL,
        UNAVAILABLE,
        UNAVAILABLE,
        UNAVAILABLE,
        "The repository intentionally scopes statusline installation to Claude Code.",
    ),
)


def frontmatter_value(path: Path, key: str) -> str:
    """Read a required single-line scalar from Markdown frontmatter."""
    text = path.read_text(encoding="utf-8")
    match = re.search(rf"^{re.escape(key)}:\s*(.+)$", text, flags=re.MULTILINE)
    if not match:
        raise ValueError(f"missing {key} in {path}")
    value = match.group(1).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1]
    return " ".join(value.split())


def source_link(path: Path) -> str:
    """Render a repository-relative source link."""
    relative_path = path.relative_to(ROOT).as_posix()
    return f"[{relative_path}]({relative_path})"


def skill_feature(path: Path) -> Feature:
    """Classify one source skill."""
    plugin_name = path.relative_to(ROOT / "plugins").parts[0]
    skill_name = frontmatter_value(path, "name")
    identity = f"`{plugin_name}:{skill_name}` skill"
    source_identity = f"{plugin_name}:{skill_name}"

    if skill_name in {"install-output-styles", "install-statusline"}:
        return Feature(
            identity,
            FULL,
            UNAVAILABLE,
            UNAVAILABLE,
            UNAVAILABLE,
            f"Claude-only by contract. Source: {source_link(path)}.",
        )

    unavailable_caveat = OPENCODE_UNAVAILABLE_SKILLS.get(source_identity)
    if unavailable_caveat:
        return Feature(
            identity,
            FULL,
            FULL,
            ADAPTED,
            UNAVAILABLE,
            f"{unavailable_caveat} Source: {source_link(path)}.",
        )

    integration_caveat = INTEGRATION_CAVEAT_BY_SKILL.get(source_identity)
    if integration_caveat:
        return Feature(
            identity,
            EXTERNAL,
            EXTERNAL,
            EXTERNAL,
            EXTERNAL,
            f"{integration_caveat} Source: {source_link(path)}.",
        )
    opencode_caveat = ""
    if source_identity == "coding:commit":
        opencode_caveat = " Skill-scoped backup and post-rewrite hooks are unavailable."
    return Feature(
        identity,
        FULL,
        FULL,
        ADAPTED,
        ADAPTED,
        f"OpenCode name: `{projected_skill_name(plugin_name, skill_name)}`.{opencode_caveat} Source: {source_link(path)}.",
    )


def agent_feature(path: Path) -> Feature:
    """Classify one canonical source agent."""
    plugin_name = path.relative_to(ROOT / "plugins").parts[0]
    agent_name = path.parent.name
    caveat = "OpenCode projects Markdown, inherits the active model, and lacks first-class project memory."
    if agent_name in {"aesthetic-evaluator", "code-quality-critic"}:
        caveat += " Its recognized write fence allows only rooted memory and canonical review-state paths; shell and external-directory access are denied."
    return Feature(
        f"`{agent_name}` agent",
        FULL,
        FULL,
        ADAPTED,
        ADAPTED,
        f"{caveat} Owner: `{plugin_name}`. Source: {source_link(path)}.",
    )


def render_table(features: Sequence[Feature]) -> str:
    """Render one Markdown compatibility table."""
    lines = [
        "| Feature | Claude Code | Codex | Grok Build | OpenCode V1 | Caveat / source |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    lines.extend(
        f"| {feature.name} | {feature.claude} | {feature.codex} | {feature.grok} | {feature.opencode} | {feature.caveat} |"
        for feature in features
    )
    return "\n".join(lines)


def render() -> str:
    """Render the complete compatibility document from repository sources."""
    skill_paths = sorted(ROOT.glob("plugins/*/skills/*/SKILL.md"))
    agent_paths = sorted(ROOT.glob("plugins/*/agents/*/base.md"))
    skill_features = tuple(skill_feature(path) for path in skill_paths)
    agent_features = tuple(agent_feature(path) for path in agent_paths)
    return f"""# Harness compatibility

This matrix covers the {len(skill_features)} skills and {len(agent_features)} agents currently shipped by this repository. It is generated by `scripts/generate_harness_compatibility.py`; edit the generator or source artifacts, then regenerate this file.

Claude Code and Codex are native targets. Grok Build consumes the Claude-compatible projection documented by xAI. OpenCode support targets stable V1 through `scripts/install_opencode.py`; OpenCode V2 and `opencode2` are unsupported.

Reviewed against current harness documentation on {REVIEWED_DATE}.

## Legend

- ✅ Native/full support
- 🟡 Adapter or compatibility-layer support with a caveat
- 🔌 External integration, credential, or tool required
- 🧪 Experimental harness API
- ❌ Unavailable

## Harness-wide features

{render_table(CROSS_CUTTING_FEATURES)}

## Skills

{render_table(skill_features)}

## Agents

{render_table(agent_features)}

## Documentation sources

- OpenCode V1: [plugins](https://opencode.ai/docs/plugins/), [skills](https://opencode.ai/docs/skills/), [agents](https://opencode.ai/docs/agents/), [commands](https://opencode.ai/docs/commands/), [tools](https://opencode.ai/docs/tools/), [permissions](https://opencode.ai/docs/permissions/), [MCP servers](https://opencode.ai/docs/mcp-servers/), and [rules](https://opencode.ai/docs/rules/).
- Grok Build: [xAI skills, plugins, and marketplaces](https://docs.x.ai/build/features/skills-plugins-marketplaces).
"""


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """Parse generator options."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail when the committed compatibility matrix is stale.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    """Write or verify the generated matrix."""
    args = parse_args(argv)
    rendered = render()
    if args.check:
        if not TARGET.is_file() or TARGET.read_text(encoding="utf-8") != rendered:
            raise SystemExit(
                "COMPATIBILITY.md is stale; rerun scripts/generate_harness_compatibility.py"
            )
        return 0
    TARGET.write_text(rendered, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
