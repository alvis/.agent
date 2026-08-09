from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKETPLACE = ROOT / ".claude-plugin" / "marketplace.json"
DOMAIN_PLUGINS = {
    "backend",
    "client",
    "coding",
    "governance",
    "production",
    "react",
    "specification",
    "web",
}
INSTRUCTION_FILE = "WORKFLOW.md"
STANDARD_REFERENCE = re.compile(
    r"(?<![\w-])(?:(?P<plugin>[a-z][a-z0-9-]*):)?standards/"
)
PLUGINS = ROOT / "plugins"
# Frontmatter keys whose value is prompt text an installed agent actually reads.
PROMPT_JSON_FIELDS = ("initialPrompt", "description")
# A shipped prompt may cap what gets *published*, but never what gets *found*:
# a finding an agent talks itself out of making is one nothing downstream can
# recover. Each pattern pairs a hedging directive with a reporting verb, so
# "report only" in the sense of "report, don't edit" stays legal.
# Words that qualify a finding by how sure or how visible it is, rather than by
# what domain it belongs to. Shared by the adjective slot and the trailing
# clause so both readings of a sentence are covered by one list.
_CONFIDENCE = (
    r"(?:(?:definite|certain|provable|proven|unambiguous|indisputable"
    r"|unmistakable|obvious)\w*"
    r"|(?:clearly|plainly|readily|obviously) (?:visible|evident|identifiable"
    r"|apparent|verifiable))"
)
# What a suppressive directive suppresses. Named once so every pattern agrees
# on what counts as a finding instead of drifting noun by noun.
_FINDING = (
    r"(?:problems?|issues?|findings?|violations?|observations?"
    r"|concerns?|bugs?|defects?)"
)
# Doubt stated as a property of the finding. A negative imperative suppresses
# only when it names doubt: "do not report context usage" sets scope, while
# "do not report uncertain findings" discards evidence.
_UNCERTAIN = (
    r"(?:uncertain|unsure|unverified|unconfirmed|unproven|speculative"
    r"|suspected|tentative|doubtful|ambiguous|possible|potential"
    r"|low[- ]confidence)"
)
SUPPRESSED_REPORTING = (
    re.compile(
        # Caution about *how you work* is ordinary engineering advice; caution
        # about *what you report* is suppression. Only a findings noun separates
        # them, so "be conservative when reporting estimated token usage" stays
        # legal while "be conservative about reporting issues" does not.
        r"be conservative[^.!?;\n]*?\b(?:report|flag|raise|surface|mention)\w*"
        r"[^.!?;\n]*?" + _FINDING,
        re.IGNORECASE,
    ),
    re.compile(
        # Same split for caution: it must land on a finding to suppress one.
        # "Silence" and "not reporting" name the suppression outright and need
        # no noun.
        r"err on the side of (?:silence|not reporting|caution[^.!?;\n]*?"
        r"(?:\b(?:report|flag|raise|surface|mention|omit|skip)\w*"
        r"[^.!?;\n]*?" + _FINDING + r"|leave (?:it|them|the \w+) out))",
        re.IGNORECASE,
    ),
    re.compile(
        # Suppression stated outright rather than as a hedge: "do not report
        # uncertain findings" discards the same evidence without needing an
        # "only" or a "be conservative" to carry it. Doubt and the finding it
        # qualifies appear in either order, so both readings are matched.
        r"(?:(?:do ?n[o']t|never|avoid)\s+"
        r"(?:report|mention|flag|raise|surface|list|includ)\w*"
        r"|omit|suppress|withhold|exclude)"
        r"[^.!?;\n]*?"
        r"(?:" + _UNCERTAIN + r"[^.!?;\n]*?" + _FINDING
        + r"|" + _FINDING + r"[^.!?;\n]*?" + _UNCERTAIN + r")",
        re.IGNORECASE,
    ),
    re.compile(
        # Scope and confidence read alike but mean opposite things: "only
        # report accessibility issues" narrows an audit's domain, while "report
        # only issues you can prove" narrows what survives doubt. Only the
        # second is suppression, so a confidence word must appear next to the
        # noun — as its adjective, or in the clause qualifying it.
        # Scanning to the clause end, rather than a few words, closes the
        # padding bypass: "only report the most clearly visible definite
        # issues" separates the directive from its noun by more words than any
        # fixed cap would allow. `;` bounds the scan alongside sentence
        # punctuation so a following independent clause cannot supply the
        # confidence words.
        # Visibility is a confidence word too: "only report problems clearly
        # visible in the image" is the grounding prompt's original suppressive
        # clause, and it must fail on its own rather than only when a "be
        # conservative" lead-in happens to precede it.
        r"(?:only report|report only)[^.!?;\n]*?"
        r"(?:" + _CONFIDENCE + r" " + _FINDING
        + r"|" + _FINDING + r"[^.!?;\n]*? "
        r"(?:you can prove|you (?:are|'re) (?:certain|sure|confident)|"
        + _CONFIDENCE + r"))",
        re.IGNORECASE,
    ),
    re.compile(
        r"when in doubt,? (?:omit|skip|stay silent|do ?n[o']t report)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:report|flag|raise)[^.!?;\n]*?only (?:if|when) you (?:are|'re) "
        r"(?:certain|sure|confident)",
        re.IGNORECASE,
    ),
)

SEMVER = re.compile(
    r"""
    ^
    (?P<major>0|[1-9]\d*)\.
    (?P<minor>0|[1-9]\d*)\.
    (?P<patch>0|[1-9]\d*)
    (?:
        -
        (?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)
        (?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*
    )?
    (?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?
    $
    """,
    re.VERBOSE,
)


def load_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text())


def marketplace_plugins() -> dict[str, Path]:
    payload = load_json(MARKETPLACE)
    entries = payload["plugins"]
    assert isinstance(entries, list)
    return {
        entry["name"]: (ROOT / entry["source"]).resolve()
        for entry in entries
        if isinstance(entry, dict) and entry["name"] != "essential"
    }


def marketplace_names() -> set[str]:
    payload = load_json(MARKETPLACE)
    entries = payload["plugins"]
    assert isinstance(entries, list)
    return {
        entry["name"]
        for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("name"), str)
    }


def hook_commands(manifest: dict[str, object], event: str) -> list[str]:
    hooks = manifest.get("hooks")
    assert isinstance(hooks, dict)
    groups = hooks.get(event)
    assert isinstance(groups, list)
    return [
        hook["command"]
        for group in groups
        if isinstance(group, dict)
        for hook in group.get("hooks", [])
        if isinstance(hook, dict) and isinstance(hook.get("command"), str)
    ]


def mentioned_plugins(text: str, names: set[str]) -> set[str]:
    mentioned: set[str] = set()
    for name in names:
        label = name.capitalize()
        patterns = (
            rf"plugins/{re.escape(name)}/",
            rf"plugin:{re.escape(name)}:",
            rf"(?<![\w-]){re.escape(name)}:[a-z]",
            rf"\b{re.escape(label)} plugin\b",
        )
        if any(re.search(pattern, text) for pattern in patterns):
            mentioned.add(name)
    return mentioned


def instruction_text(plugin: Path) -> str:
    return (plugin / "hooks" / "ALLAGENT.md").read_text() + (
        plugin / "references" / INSTRUCTION_FILE
    ).read_text()


def test_marketplace_plugins_ship_action_instruction_contracts() -> None:
    plugins = marketplace_plugins()
    assert set(plugins) == DOMAIN_PLUGINS

    for name, plugin in plugins.items():
        domain = plugin / "references" / INSTRUCTION_FILE
        agents = plugin / "hooks" / "ALLAGENT.md"
        manifest = load_json(plugin / ".claude-plugin" / "plugin.json")
        hooks = load_json(plugin / "hooks" / "hooks.json")

        assert domain.is_file(), name
        assert agents.is_file(), name
        assert "hooks" not in manifest, name
        assert f"{{{{PLUGIN_DIR}}}}/references/{INSTRUCTION_FILE}" in agents.read_text()
        for event in ("SessionStart", "SubagentStart"):
            assert any(
                "/hooks/ALLAGENT.md" in command
                for command in hook_commands(hooks, event)
            )


def test_marketplace_and_plugin_versions_use_semver_from_one() -> None:
    marketplace = load_json(MARKETPLACE)
    versions = [marketplace["metadata"]["version"]]
    versions.extend(
        load_json((ROOT / entry["source"]) / ".claude-plugin" / "plugin.json")[
            "version"
        ]
        for entry in marketplace["plugins"]
    )

    for version in versions:
        match = SEMVER.fullmatch(version)
        assert match, version
        assert int(match.group("major")) >= 1, version


def test_semver_schema_rejects_invalid_identifiers() -> None:
    valid = ("1.0.0", "2.1.3-alpha.1", "10.20.30+build.7")
    invalid = ("1.0", "01.0.0", "1.0.0-01", "1.0.0-.", "1.0.0-alpha..beta")

    assert all(SEMVER.fullmatch(version) for version in valid)
    assert not any(SEMVER.fullmatch(version) for version in invalid)


def test_instruction_contracts_reference_declared_dependencies_only() -> None:
    plugins = marketplace_plugins()
    names = marketplace_names()

    for name, plugin in plugins.items():
        manifest = load_json(plugin / ".claude-plugin" / "plugin.json")
        dependencies = manifest.get("dependencies", [])
        assert isinstance(dependencies, list)
        allowed = {name, *dependencies}
        text = instruction_text(plugin)

        assert mentioned_plugins(text, names) <= allowed, name
        for reference in STANDARD_REFERENCE.finditer(text):
            prefix = reference.group("plugin")
            assert prefix is not None, f"{name}: unprefixed standard reference"
            assert prefix in allowed, f"{name}: undeclared standard prefix {prefix}"


def shipped_prompts() -> list[tuple[str, str]]:
    """Return one (label, text) pair per prompt this marketplace ships.

    Markdown carries most of them, but an agent's frontmatter JSON ships
    `initialPrompt` and `description` straight into the installed agent, so a
    directive placed there reaches a model without passing through any `*.md`.
    """
    prompts = [
        (str(path.relative_to(ROOT)), path.read_text())
        for path in sorted(PLUGINS.rglob("*.md"))
    ]
    prompts.extend(
        (f"{path.relative_to(ROOT)}:{field}", value)
        for path in sorted(PLUGINS.glob("*/agents/*/frontmatter/*.json"))
        for payload in (load_json(path),)
        for field in PROMPT_JSON_FIELDS
        for value in (payload.get(field),)
        if isinstance(value, str)
    )
    return prompts


def test_no_shipped_prompt_suppresses_reporting() -> None:
    offenders = [
        f"{label}:{text.count(chr(10), 0, match.start()) + 1}: {match.group(0)}"
        for label, text in shipped_prompts()
        for pattern in SUPPRESSED_REPORTING
        for match in pattern.finditer(text)
    ]

    assert offenders == [], "\n".join(offenders)


def test_shipped_prompts_cover_agent_frontmatter_json() -> None:
    labels = [label for label, _ in shipped_prompts()]

    assert any(label.endswith("frontmatter/claude.json:initialPrompt") for label in labels)
    assert any(label.endswith("frontmatter/meta.json:description") for label in labels)


def test_suppressed_reporting_patterns_catch_known_phrasings() -> None:
    suppressing = (
        "Be conservative: only report problems clearly visible in the image.",
        "Err on the side of caution and leave it out.",
        "When in doubt, omit the finding.",
        "Report a violation only if you are certain it is one.",
        "Report only issues you can prove.",
        "Only report problems you are certain about.",
        "Report only definite violations.",
        # Padding between the directive and its noun must not buy an escape.
        "Only report the most clearly visible definite issues.",
        "Report, after weighing all the available evidence, only if you are certain.",
        # The grounding prompt's original clause, standing on its own.
        "Only report problems clearly visible in the image.",
        "Only report clearly visible problems.",
        # Suppression needs no hedge to carry it.
        "Do not report uncertain findings.",
        "Don't mention low-confidence issues.",
        "Omit speculative problems from the report.",
        # Doubt may follow the noun it qualifies rather than precede it.
        "Never surface findings you are unsure about.",
    )
    legitimate = (
        "Do not use for: deleting or modifying code (report only).",
        "A claim survives into the report only when an independent source agrees.",
        "Report context usage only when the runtime measures it.",
        "Cap published nits at five; rank what you found.",
        "Be conservative with resource consumption and migration blast radius.",
        "Err on the side of caution with a destructive migration.",
        "Only report accessibility issues.",
        "Report only security violations.",
        "Only report findings that block release.",
        # A separate clause supplies the confidence words but not the meaning.
        "Report only security violations; you are certain to find some.",
        # Caution aimed at the work, not at the finding, stays legal even when
        # the sentence goes on to mention reporting.
        "Be conservative when reporting estimated token usage.",
        "Err on the side of caution when reporting a destructive migration.",
        # A scope rule phrased as a negative imperative names no doubt.
        "Do not report context usage the runtime does not measure.",
    )

    for text in suppressing:
        assert any(pattern.search(text) for pattern in SUPPRESSED_REPORTING), text
    for text in legitimate:
        assert not any(pattern.search(text) for pattern in SUPPRESSED_REPORTING), text


def test_instruction_contracts_list_every_owned_standard() -> None:
    for name, plugin in marketplace_plugins().items():
        standards = plugin / "standards"
        if not standards.is_dir():
            continue

        text = (plugin / "references" / INSTRUCTION_FILE).read_text()
        for standard in standards.iterdir():
            assert standard.is_dir(), (
                f"{name}: standard must use a directory: {standard.relative_to(plugin)}"
            )
            tiers = {path.name for path in standard.iterdir() if path.is_file()}
            assert tiers == {"meta.md", "scan.md", "write.md"}, (
                f"{name}: noncanonical standard tiers: {standard.relative_to(plugin)}"
            )
            rules = standard / "rules"
            assert not rules.is_dir() or any(rules.glob("*.md")), (
                f"{name}: empty rules directory: {rules.relative_to(plugin)}"
            )
            expected = f"{name}:standards/{standard.name}/"
            assert expected in text, f"{name}: missing {expected}"
