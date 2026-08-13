import re
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[1]
SKILLS = PLUGIN / "skills"
FIXED_NOTION_ID = re.compile(r"(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])")


def test_screen_design_contracts_require_external_configuration() -> None:
    contracts = (
        SKILLS / "create-screen-design/SKILL.md",
        SKILLS / "update-screen-design/SKILL.md",
    )
    required_arguments = (
        "--body-author=<plugin:skill>",
        "--template-ref=<ref>",
        "--parent-ref=<ref>",
        "--collection-ref=<ref>",
    )

    for contract in contracts:
        text = contract.read_text(encoding="utf-8")
        for argument in required_arguments:
            assert argument in text, f"{contract}: missing {argument}"
        assert FIXED_NOTION_ID.search(text) is None, contract
        assert "defaults" in text

    create = contracts[0].read_text(encoding="utf-8")
    assert "Accept the canonical ref only from the validated create" in create
    assert "Never expect an external executable" in create


def test_client_plugin_ships_no_body_grammar() -> None:
    text = "\n".join(
        path.read_text(encoding="utf-8") for path in sorted(PLUGIN.rglob("*.md"))
    )
    assert "closing marker" not in text.lower()
    assert "annotation bodies" not in text.lower()
