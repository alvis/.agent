import json
from pathlib import Path

from analyze_agent_usage import Invocation, discover_plugin_agents, tally


def test_unqualified_installed_agent_usage_maps_to_its_unique_owner() -> None:
    defined = {
        "web:frontend-implementer": {
            "plugin": "web",
            "agent": "frontend-implementer",
            "path": "frontmatter.json",
        }
    }
    invocation = Invocation(
        canonical_id="frontend-implementer",
        plugin="built-in",
        agent="frontend-implementer",
        timestamp=None,
        session_id="session",
        source_file="session.jsonl",
    )

    stats = tally([invocation], defined, files_scanned=1)

    assert stats.tallies["web:frontend-implementer"].count == 1
    assert "frontend-implementer" not in stats.tallies


def test_discovers_distributed_agent_metadata_by_owner(tmp_path: Path) -> None:
    plugins = tmp_path / "plugins"
    metadata = plugins / "web/agents/frontend-implementer/frontmatter/meta.json"
    metadata.parent.mkdir(parents=True)
    metadata.write_text(
        json.dumps({"name": "frontend-implementer"}),
        encoding="utf-8",
    )
    agents = discover_plugin_agents(plugins)

    assert set(agents) == {"web:frontend-implementer"}
    assert agents["web:frontend-implementer"]["path"] == str(metadata)


def test_ignores_malformed_or_nameless_frontmatter_and_missing_root(
    tmp_path: Path,
) -> None:
    plugins = tmp_path / "plugins"
    malformed = plugins / "web/agents/malformed/frontmatter/meta.json"
    nameless = plugins / "web/agents/nameless/frontmatter/meta.json"
    malformed.parent.mkdir(parents=True)
    nameless.parent.mkdir(parents=True)
    malformed.write_text("{", encoding="utf-8")
    nameless.write_text("{}", encoding="utf-8")

    assert discover_plugin_agents(plugins) == {}
    assert discover_plugin_agents(tmp_path / "missing") == {}
