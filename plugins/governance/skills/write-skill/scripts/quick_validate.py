"""Repository policy checks for Agent Skills.

Claude Code owns manifest and frontmatter schema validation. This script runs
``claude plugin validate --strict`` first, then checks only local authoring
policies that the official validator does not cover.
"""

import argparse
import ast
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import TypedDict

MAX_BODY_LINES = 500
MIN_DESCRIPTION_WORDS = 25
MAX_DESCRIPTION_WORDS = 60
PLACEHOLDERS = (
    re.compile(r"\[(?:TODO|PLACEHOLDER|INSERT(?: [^]]*)?)\]", re.IGNORECASE),
    re.compile(r"\[(?:skill-name|Skill Name|Description|Step Name)\]"),
)
LOCAL_LINK = re.compile(r"\[[^]]+\]\((?![a-z]+:|#)([^)]+)\)", re.IGNORECASE)
REFERENCE_DEFINITION = re.compile(
    r"^[ \t]{0,3}\[(?:\\.|[^\]\\])+\]:[ \t]*(<[^>\n]*>|[^\s<][^\s]*)"
)
EXTERNAL_DESTINATION = re.compile(r"^[a-z][a-z0-9+.-]*:", re.IGNORECASE)
ILLUSTRATIVE_DESTINATION = re.compile(
    r"<[^>]+>|\[[^]]+\]|\{\{[^}]+\}\}|\{[^{}]+\}"
)
LOCAL_DIRECTORIES = {"agents", "assets", "evals", "hooks", "references", "scripts", "templates"}
YAML_MERGE_TAGS = {"!!merge", "!<tag:yaml.org,2002:merge>"}
MODEL_SELECTION_FIELDS = {
    "effort",
    "intelligence",
    "intelligencelevel",
    "model",
    "modelreasoningeffort",
    "reasoningeffort",
}
CLAUDE_TIMEOUT_SECONDS = 30
INTELLIGENCE_MAPPING = Path(
    "essential/skills/install-agents/references/intelligence-levels.json"
)


class PolicyReport(TypedDict):
    """JSON-ready repository policy result for one skill."""

    path: str
    errors: list[dict[str, object]]
    warnings: list[dict[str, object]]


def discover_skills(target: Path) -> list[Path]:
    """Return all SKILL.md files represented by a file, skill, or tree.

    Files under a ``templates`` directory are seeds that legitimately contain
    placeholder text, so they are excluded from discovery. So is anything under
    a dotted directory: a git worktree, dependency cache, or installed plugin
    cache holds a second copy of skills this tree already owns, and reporting
    those duplicates lets a stale checkout fail a clean tree.
    """
    target = target.resolve()
    if target.is_file():
        return [target] if target.name == "SKILL.md" else []
    if (target / "SKILL.md").is_file():
        return [target / "SKILL.md"]
    if not target.is_dir():
        return []
    return sorted(
        path
        for path in target.glob("**/SKILL.md")
        if "templates" not in path.parent.parts
        and not any(part.startswith(".") for part in path.relative_to(target).parts)
    )


def issue(message: str, *, line: int | None = None) -> dict[str, object]:
    result: dict[str, object] = {"message": message}
    if line is not None:
        result["line"] = line
    return result


def frontmatter_and_body(text: str) -> tuple[list[str], list[str]]:
    """Split frontmatter without attempting to interpret Claude's schema."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return [], lines
    try:
        end = next(index for index, line in enumerate(lines[1:], 1) if line.strip() == "---")
    except StopIteration:
        return [], lines
    return lines[1:end], lines[end + 1 :]


def scalar_value(frontmatter: list[str], key: str) -> str | None:
    """Read one plain or quoted scalar for policy metrics, not schema checks."""
    prefix = f"{key}:"
    for line in frontmatter:
        if line.startswith(prefix):
            value = line[len(prefix) :].strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            return value
    return None


def normalize_markdown_destination(destination: str) -> str:
    """Return a destination without Markdown angle wrapping or an anchor."""
    destination = destination.strip()
    if len(destination) >= 2 and destination[0] == "<" and destination[-1] == ">":
        destination = destination[1:-1].strip()
    return destination.split("#", 1)[0].strip()


def without_yaml_comments(source: str) -> str:
    """Mask YAML comments while retaining offsets used for diagnostics."""
    masked_lines = []
    for line in source.splitlines():
        quote = None
        escaped = False
        comment = None
        for index, character in enumerate(line):
            if quote == '"':
                if escaped:
                    escaped = False
                elif character == "\\":
                    escaped = True
                elif character == quote:
                    quote = None
                continue
            if quote == "'":
                if character == quote:
                    quote = None
                continue
            if character in "\"'":
                quote = character
            elif character == "#" and (
                index == 0 or line[index - 1].isspace()
            ):
                comment = index
                break
        if comment is None:
            masked_lines.append(line)
        else:
            masked_lines.append(line[:comment] + " " * (len(line) - comment))
    return "\n".join(masked_lines)


def mapping_separator(source: str, *, flow: bool = False) -> int | None:
    """Locate a mapping colon outside quoted scalars and nested flows."""
    quote = None
    escaped = False
    depth = 0
    index = 0
    while index < len(source):
        character = source[index]
        if quote == '"':
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
        elif quote == "'":
            if character == quote:
                if index + 1 < len(source) and source[index + 1] == quote:
                    index += 1
                else:
                    quote = None
        elif character in "\"'":
            quote = character
        elif character in "[{":
            depth += 1
        elif character in "]}":
            depth = max(0, depth - 1)
        elif character == ":" and depth == 0:
            following = source[index + 1 : index + 2]
            key = source[:index].lstrip()
            quoted_key = key.startswith(("'", '"'))
            separated = not following or following.isspace()
            flow_delimiter = flow and following in ",]}"
            if quoted_key or separated or flow_delimiter:
                return index
        index += 1
    return None


def yaml_scalar(source: str) -> str | None:
    """Decode a scalar mapping key far enough to compare its semantic value."""
    source = source.strip()
    if source.startswith(("!", "&")):
        property_name, separator, _ = source.partition(" ")
        if not separator:
            return None
        if property_name in YAML_MERGE_TAGS:
            return "<<"
        return None
    if source.startswith(("'", '"')) and "\n" in source:
        return None
    if source.startswith("'"):
        if len(source) < 2 or not source.endswith("'"):
            return None
        return source[1:-1].replace("''", "'")
    if source.startswith('"'):
        if len(source) < 2 or not source.endswith('"'):
            return None
        try:
            value = ast.literal_eval(source)
        except (SyntaxError, ValueError):
            return None
        return value if isinstance(value, str) else None
    if not source or source.startswith(("*", "|", ">", "[", "{")):
        return None
    return source


def root_flow_mapping(
    source: str,
) -> tuple[list[tuple[int, int]], int] | None:
    """Return entry spans and closing offset for one complete flow mapping."""
    opening = next(
        (index for index, character in enumerate(source) if not character.isspace()),
        None,
    )
    if opening is None or source[opening] != "{":
        return None

    entries = []
    entry_start = opening + 1
    quote = None
    escaped = False
    depth = 0
    index = opening
    while index < len(source):
        character = source[index]
        if quote == '"':
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
        elif quote == "'":
            if character == quote:
                if index + 1 < len(source) and source[index + 1] == quote:
                    index += 1
                else:
                    quote = None
        elif character in "\"'":
            quote = character
        elif character in "[{":
            depth += 1
        elif character in "]}":
            if character == "}" and depth == 1:
                entries.append((entry_start, index))
                return entries, index
            depth = max(0, depth - 1)
        elif character == "," and depth == 1:
            entries.append((entry_start, index))
            entry_start = index + 1
        index += 1
    return None


def root_flow_entries(source: str) -> list[tuple[int, int]] | None:
    """Return entry spans when the frontmatter root is a flow mapping."""
    mapping = root_flow_mapping(source)
    return None if mapping is None else mapping[0]


def flow_mapping_keys(
    source: str,
    entries: list[tuple[int, int]],
) -> list[tuple[str | None, int]]:
    keys = []
    for start, end in entries:
        entry = source[start:end]
        key_offset = len(entry) - len(entry.lstrip())
        candidate = entry.lstrip()
        if not candidate:
            continue
        if candidate.startswith("?"):
            after_indicator = candidate[1:]
            key_offset += 1 + len(after_indicator) - len(after_indicator.lstrip())
            candidate = after_indicator.lstrip()
        line = 2 + source.count("\n", 0, start + key_offset)
        if not candidate:
            keys.append((None, line))
            continue
        separator = mapping_separator(candidate, flow=True)
        key_source = candidate if separator is None else candidate[:separator]
        key = yaml_scalar(key_source)
        keys.append((key, line))
    return keys


def frontmatter_mapping_keys(
    frontmatter: list[str],
) -> list[tuple[str | None, int]]:
    """Read semantic string keys from the root frontmatter mapping."""
    source = without_yaml_comments("\n".join(frontmatter))
    flow_entries = root_flow_entries(source)
    if flow_entries is not None:
        return flow_mapping_keys(source, flow_entries)

    keys = []
    for number, line in enumerate(source.splitlines(), 2):
        if not line or line[0].isspace():
            continue
        candidate = line.rstrip()
        if candidate.startswith(":"):
            continue
        explicit = candidate.startswith("?")
        if explicit:
            candidate = candidate[1:].lstrip()
        separator = mapping_separator(candidate)
        if separator is None and not explicit:
            continue
        if separator is not None:
            candidate = candidate[:separator]
        key = yaml_scalar(candidate)
        keys.append((key, number))
    return keys


def unsupported_root_mapping_line(frontmatter: list[str]) -> int | None:
    """Locate root indentation or node properties outside the authoring contract."""
    source = without_yaml_comments("\n".join(frontmatter))
    for number, line in enumerate(source.splitlines(), 2):
        if not line.strip():
            continue
        if line[0].isspace() or line.startswith(("!", "&")):
            return number
        return None
    return None


def normalized_selection_field(key: str) -> str:
    """Normalize supported field spellings for portable policy checks."""
    return key.replace("-", "").replace("_", "").lower()


def flow_mapping_items(
    source: str, line: int,
) -> tuple[list[tuple[str | None, str | None, int]], int | None]:
    """Read direct simple-key items from one flow-style mapping."""
    mapping = root_flow_mapping(source)
    if mapping is None:
        return [], None
    spans, closing = mapping
    entries = []
    for start, end in spans:
        entry = source[start:end]
        key_offset = len(entry) - len(entry.lstrip())
        candidate = entry.lstrip()
        entry_line = line + source.count("\n", 0, start + key_offset)
        separator = mapping_separator(candidate, flow=True)
        if separator is None or candidate.startswith("?"):
            entries.append((None, None, entry_line))
            continue
        entries.append(
            (
                yaml_scalar(candidate[:separator]),
                yaml_scalar(candidate[separator + 1 :]),
                entry_line,
            )
        )
    return entries, source.count("\n", 0, closing)


def nested_mapping_items(
    frontmatter: list[str], parent_key: str,
) -> list[tuple[str | None, str | None, int]]:
    """Read direct simple-key items from one block- or flow-style mapping."""
    source = without_yaml_comments("\n".join(frontmatter))
    root_mapping = root_flow_mapping(source)
    if root_mapping is not None:
        root_spans, _ = root_mapping
        for start, end in root_spans:
            entry = source[start:end]
            key_offset = len(entry) - len(entry.lstrip())
            candidate = entry.lstrip()
            separator = mapping_separator(candidate, flow=True)
            if separator is None or yaml_scalar(candidate[:separator]) != parent_key:
                continue
            line = 2 + source.count("\n", 0, start + key_offset)
            items, _ = flow_mapping_items(candidate[separator + 1 :], line)
            return items
        return []
    lines = source.splitlines()
    entries: list[tuple[str | None, str | None, int]] = []
    parent_line: int | None = None
    child_indent: int | None = None
    flow_consumed_through = -1
    for index, line in enumerate(lines):
        if index <= flow_consumed_through:
            continue
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip())
        candidate = line.lstrip()
        separator = mapping_separator(candidate)
        key = (
            yaml_scalar(candidate[:separator])
            if separator is not None
            else None
        )
        if indent == 0:
            parent_line = index if key == parent_key else None
            child_indent = None
            if parent_line is not None and separator is not None:
                flow_source = "\n".join(
                    [candidate[separator + 1 :], *lines[index + 1 :]]
                )
                flow_entries, consumed_lines = flow_mapping_items(flow_source, index + 2)
                entries.extend(flow_entries)
                if consumed_lines is not None:
                    flow_consumed_through = index + consumed_lines
            continue
        if parent_line is None or index <= parent_line:
            continue
        if child_indent is None:
            child_indent = indent
        if indent == child_indent:
            flow_source = "\n".join([candidate, *lines[index + 1 :]])
            flow_entries, consumed_lines = flow_mapping_items(flow_source, index + 2)
            if consumed_lines is not None:
                entries.extend(flow_entries)
                flow_consumed_through = index + consumed_lines
                continue
        if indent == child_indent:
            if separator is None or candidate.startswith(("?", ":")):
                entries.append((None, None, index + 2))
                continue
            entries.append(
                (key, yaml_scalar(candidate[separator + 1 :]), index + 2)
            )
    return entries


def nested_mapping_entries(
    frontmatter: list[str], parent_key: str, child_key: str,
) -> list[tuple[str | None, int]]:
    """Read matching scalar entries through the shared nested-key parser."""
    return [
        (value, line)
        for key, value, line in nested_mapping_items(frontmatter, parent_key)
        if key == child_key
    ]


def unsupported_mapping_value_references(
    frontmatter: list[str], parent_keys: set[str],
) -> list[tuple[str, int]]:
    """Locate mapping values wrapped in unsupported YAML properties or aliases."""
    source = without_yaml_comments("\n".join(frontmatter))
    references = []
    root_mapping = root_flow_mapping(source)
    if root_mapping is not None:
        root_spans, _ = root_mapping
        for start, end in root_spans:
            candidate = source[start:end].strip()
            separator = mapping_separator(candidate, flow=True)
            if separator is None:
                continue
            key = yaml_scalar(candidate[:separator])
            value = candidate[separator + 1 :].strip()
            if key in parent_keys and value.startswith(("&", "!", "*")):
                references.append((key, 2 + source.count("\n", 0, start)))
        return references

    lines = source.splitlines()
    for index, line in enumerate(lines):
        if not line or line[0].isspace():
            continue
        candidate = line.rstrip()
        separator = mapping_separator(candidate)
        if separator is None:
            continue
        key = yaml_scalar(candidate[:separator])
        if key not in parent_keys:
            continue
        value = candidate[separator + 1 :].strip()
        value_line = index + 2
        if not value:
            for nested_index in range(index + 1, len(lines)):
                nested = lines[nested_index]
                if not nested.strip():
                    continue
                if not nested[0].isspace():
                    break
                value = nested.lstrip()
                value_line = nested_index + 2
                break
        if value.startswith(("&", "!", "*")):
            references.append((key, value_line))
    return references


def requirements_intelligence_entries(
    frontmatter: list[str],
) -> list[tuple[str | None, int]]:
    """Read block-style requirements.intelligence entries."""
    return nested_mapping_entries(frontmatter, "requirements", "intelligence")


def metadata_intelligence_entries(
    frontmatter: list[str],
) -> list[tuple[str | None, int]]:
    """Read deprecated block-style metadata.intelligence entries."""
    return nested_mapping_entries(frontmatter, "metadata", "intelligence")


def mapping_merge_entries(
    frontmatter: list[str], parent_key: str,
) -> list[tuple[str | None, int]]:
    """Read YAML merge entries through the shared nested-mapping parser."""
    return nested_mapping_entries(frontmatter, parent_key, "<<")


def unsupported_nested_key_lines(
    frontmatter: list[str], parent_key: str,
) -> list[int]:
    """Return lines whose raw nested keys are not direct scalar keys."""
    return [
        line
        for key, _, line in nested_mapping_items(frontmatter, parent_key)
        if key is None
    ]


def intelligence_levels() -> set[str]:
    """Load concrete skill levels from Essential's authoritative mapping."""
    script = Path(__file__).resolve()
    versions = {
        parent.name
        for parent in script.parents
        if re.fullmatch(r"\d+\.\d+\.\d+", parent.name)
    }
    candidates: list[Path] = []
    for ancestor in script.parents:
        direct = ancestor / INTELLIGENCE_MAPPING
        if direct.is_file():
            candidates.append(direct)
        for version in versions:
            versioned = (
                ancestor
                / "essential"
                / version
                / INTELLIGENCE_MAPPING.relative_to("essential")
            )
            if versioned.is_file():
                candidates.append(versioned)
    unique = list(dict.fromkeys(candidates))
    if len(unique) != 1:
        raise RuntimeError(
            "Expected exactly one Essential intelligence mapping beside the "
            f"installed marketplace; found {len(unique)}."
        )
    mapping = json.loads(unique[0].read_text(encoding="utf-8"))
    return {
        name
        for name, entry in mapping.items()
        if entry.get("rank") is not None
    }


def is_local_file_destination(destination: str) -> bool:
    """Return whether a normalized destination clearly denotes a local file."""
    if not destination or destination in {"url", "...", "…"}:
        return False
    if EXTERNAL_DESTINATION.match(destination) or ILLUSTRATIVE_DESTINATION.search(
        destination
    ):
        return False
    path = Path(destination)
    return (
        path.is_absolute()
        or destination.startswith(("./", "../"))
        or bool(path.parts and path.parts[0] in LOCAL_DIRECTORIES)
        or bool(path.suffix)
    )


def validate_policy(skill: Path, *, portable: bool = False) -> PolicyReport:
    """Validate repository-specific content policies for one skill."""
    text = skill.read_text(encoding="utf-8")
    frontmatter, body = frontmatter_and_body(text)
    errors: list[dict[str, object]] = []
    warnings: list[dict[str, object]] = []

    mapping_keys = frontmatter_mapping_keys(frontmatter)
    unsupported_root_line = unsupported_root_mapping_line(frontmatter)
    if unsupported_root_line is None:
        unsupported_root_line = next(
            (number for key, number in mapping_keys if key == "<<"),
            None,
        )
    if unsupported_root_line is not None:
        errors.append(
            issue(
                "Shared skill frontmatter must use a plain, unwrapped root mapping "
                "without merge keys.",
                line=unsupported_root_line,
            )
        )
    else:
        for key, number in mapping_keys:
            if key is None:
                errors.append(
                    issue(
                        "Shared skill frontmatter uses an unsupported complex root "
                        "mapping key; use a plain or quoted scalar key.",
                        line=number,
                    )
                )
            elif key == "allowed-tools":
                errors.append(
                    issue(
                        "Shared skills must not declare allowed-tools: Codex does not "
                        "support this field; shared skills inherit runtime capabilities.",
                        line=number,
                    )
                )
            elif normalized_selection_field(key) in MODEL_SELECTION_FIELDS:
                errors.append(
                    issue(
                        "Shared skills must not declare model or effort fields; "
                        "use requirements.intelligence.",
                        line=number,
                    )
                )

    if not errors:
        for mapping in ("metadata", "requirements"):
            unsupported_key_lines = unsupported_nested_key_lines(frontmatter, mapping)
            if unsupported_key_lines:
                errors.append(
                    issue(
                        f"Shared skill {mapping} must use direct scalar keys; "
                        "aliases and complex keys are unsupported.",
                        line=unsupported_key_lines[0],
                    )
                )
                break

    if not errors:
        for mapping in ("metadata", "requirements"):
            merge_entries = mapping_merge_entries(frontmatter, mapping)
            if merge_entries:
                errors.append(
                    issue(
                        f"Shared skill {mapping} must not use YAML merge keys; "
                        "use a plain mapping.",
                        line=merge_entries[0][1],
                    )
                )
                break

    if not errors and (
        unsupported_references := unsupported_mapping_value_references(
            frontmatter, {"metadata", "requirements"}
        )
    ):
        mapping, number = unsupported_references[0]
        errors.append(
            issue(
                f"Shared skill {mapping} must not use YAML node properties or "
                "aliases; use a plain mapping.",
                line=number,
            )
        )

    if not errors and (
        legacy_entries := metadata_intelligence_entries(frontmatter)
    ):
        errors.append(
            issue(
                "Shared skills must not declare metadata.intelligence; "
                "use requirements.intelligence.",
                line=legacy_entries[0][1],
            )
        )

    if not errors:
        intelligence_entries = requirements_intelligence_entries(frontmatter)
        if not intelligence_entries:
            errors.append(
                issue("Shared skills must declare exactly one requirements.intelligence.")
            )
        elif len(intelligence_entries) > 1:
            errors.append(
                issue(
                    "Shared skills must declare exactly one requirements.intelligence.",
                    line=intelligence_entries[1][1],
                )
            )
        else:
            intelligence, number = intelligence_entries[0]
            if intelligence == "inherit":
                errors.append(
                    issue(
                        "Shared skills must declare a concrete requirements.intelligence; "
                        "inherit is agent-only.",
                        line=number,
                    )
                )
            elif intelligence not in intelligence_levels():
                errors.append(
                    issue(
                        "Shared skill requirements.intelligence must name a concrete level "
                        "from Essential's intelligence mapping.",
                        line=number,
                    )
                )

    if len(body) > MAX_BODY_LINES:
        errors.append(issue(f"Skill body exceeds {MAX_BODY_LINES} lines ({len(body)})."))

    description = scalar_value(frontmatter, "description")
    if description:
        count = len(description.split())
        if not MIN_DESCRIPTION_WORDS <= count <= MAX_DESCRIPTION_WORDS:
            warnings.append(
                issue(
                    f"Description has {count} words; repository target is "
                    f"{MIN_DESCRIPTION_WORDS}-{MAX_DESCRIPTION_WORDS}."
                )
            )

    for number, line in enumerate(text.splitlines(), 1):
        if any(pattern.search(line) for pattern in PLACEHOLDERS):
            errors.append(issue("Placeholder text remains in the skill.", line=number))

    markdown_files = [skill]
    references = skill.parent / "references"
    if portable and references.is_dir():
        markdown_files.extend(sorted(references.glob("**/*.md")))

    for markdown_file in markdown_files:
        source = markdown_file.relative_to(skill.parent)
        for number, line in enumerate(markdown_file.read_text(encoding="utf-8").splitlines(), 1):
            destinations = LOCAL_LINK.findall(line)
            if definition := REFERENCE_DEFINITION.match(line):
                destinations.append(definition.group(1))
            for raw_destination in dict.fromkeys(destinations):
                destination = normalize_markdown_destination(raw_destination)
                if not is_local_file_destination(destination):
                    continue
                reference = (skill.parent / destination).resolve()
                if portable:
                    try:
                        reference.relative_to(skill.parent.resolve())
                    except ValueError:
                        errors.append(
                            issue(
                                f"Reference escapes skill root in {source}: {raw_destination}",
                                line=number,
                            )
                        )
                        continue
                if not reference.exists():
                    location = "" if markdown_file == skill else f" in {source}"
                    errors.append(
                        issue(
                            f"Unresolved local reference{location}: {raw_destination}",
                            line=number,
                        )
                    )

    return {"path": str(skill), "errors": errors, "warnings": warnings}


def claude_targets(target: Path) -> list[Path]:
    """Find marketplace and plugin roots for official Claude validation."""
    target = target.resolve()
    if (target / ".claude-plugin" / "plugin.json").is_file():
        return [target]
    if (target / ".claude-plugin" / "marketplace.json").is_file():
        # Marketplace validation already traverses every declared plugin. Running
        # strict validation again at each plugin root changes Claude's context
        # assumptions and can turn intentional marketplace-root context files into
        # duplicate false-positive warnings.
        return [target]
    if (target / "plugins").is_dir():
        plugins = target / "plugins"
    else:
        plugins = target
    if plugins.is_dir():
        roots = sorted(
            path.parent.parent
            for path in plugins.glob("*/.claude-plugin/plugin.json")
        )
        if roots:
            return roots
    for parent in target.parents:
        if (parent / ".claude-plugin" / "plugin.json").is_file():
            return [parent]
    return []


def run_claude_validation(targets: list[Path]) -> tuple[int, list[dict[str, object]]]:
    """Run Claude's validator; do not reproduce or reinterpret its schema."""
    results: list[dict[str, object]] = []
    failed = False
    for target in targets:
        command = ["claude", "plugin", "validate", "--strict", str(target)]
        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
                timeout=CLAUDE_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            failed = True
            results.append(
                {
                    "path": str(target),
                    "status": "fail",
                    "output": (
                        "Claude validator timed out after "
                        f"{CLAUDE_TIMEOUT_SECONDS} seconds: {' '.join(command)}"
                    ),
                }
            )
            continue
        except OSError as error:
            failed = True
            results.append(
                {
                    "path": str(target),
                    "status": "fail",
                    "output": f"Unable to launch Claude validator: {error}",
                }
            )
            continue
        failed = failed or completed.returncode != 0
        results.append(
            {
                "path": str(target),
                "status": "pass" if completed.returncode == 0 else "fail",
                "output": (completed.stdout + completed.stderr).strip(),
            }
        )
    return (1 if failed else 0), results


def run(argv: list[str] | None = None) -> int:
    """Execute the CLI and return a process-compatible status code."""
    parser = argparse.ArgumentParser(
        description="Run official Claude validation and repository skill-policy checks."
    )
    parser.add_argument("target", type=Path, help="SKILL.md, skill, plugin, marketplace, or plugins directory")
    parser.add_argument(
        "--policy-only",
        action="store_true",
        help="Skip the official validator (intended for unit tests and focused policy checks).",
    )
    parser.add_argument(
        "--portable",
        action="store_true",
        help="Require skill-root-contained links and check Markdown under references/.",
    )
    args = parser.parse_args(argv)

    skills = discover_skills(args.target)
    if not skills:
        parser.error(f"No SKILL.md files found under {args.target}")

    claude_status, claude_results = (0, [])
    if not args.policy_only:
        claude_status, claude_results = run_claude_validation(claude_targets(args.target))

    policies = [validate_policy(skill, portable=args.portable) for skill in skills]
    policy_errors = sum(len(report["errors"]) for report in policies)
    report = {
        "status": "fail" if claude_status or policy_errors else "pass",
        "claude_validation": claude_results,
        "policy_validation": policies,
        "summary": {
            "skills": len(skills),
            "policy_errors": policy_errors,
            "policy_warnings": sum(len(report["warnings"]) for report in policies),
        },
    }
    print(json.dumps(report, indent=2))
    return 1 if claude_status or policy_errors else 0


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
