import re
from pathlib import Path


PLUGIN = Path(__file__).resolve().parents[1]
ESTABLISH = PLUGIN / "references/directions/establish-work-stream.md"
CODING_WORKFLOW = PLUGIN.parent / "coding/references/WORKFLOW.md"
ESTABLISH_DIRECTION = "directions/establish-work-stream.md"


def section(document: str, heading: str) -> str:
    level = len(heading) - len(heading.lstrip("#"))
    match = re.search(
        rf"^{re.escape(heading)}\n(?P<body>.*?)(?=^#{{1,{level}}} |\Z)",
        document,
        flags=re.MULTILINE | re.DOTALL,
    )
    assert match is not None
    return match.group("body")


def test_every_first_use_bootstrap_authority_requires_the_confirmation_gate() -> None:
    authorities: list[tuple[Path, str]] = []
    for path in (PLUGIN / "references").rglob("*.md"):
        document = path.read_text(encoding="utf-8")
        heading = re.search(
            r"^#+ First-use work-memory bootstrap$", document, re.MULTILINE
        )
        if heading:
            authorities.append((path, heading.group()))

    assert {path.name for path, _ in authorities} == {"state.md", "lease.md"}
    for path, heading in authorities:
        bootstrap = section(path.read_text(encoding="utf-8"), heading)
        assert ESTABLISH_DIRECTION in bootstrap, path


def test_coding_substantial_work_routes_through_the_confirmation_gate() -> None:
    location = section(
        CODING_WORKFLOW.read_text(encoding="utf-8"),
        "### Decide where the work will live",
    )

    assert f"essential:references/{ESTABLISH_DIRECTION}" in location
