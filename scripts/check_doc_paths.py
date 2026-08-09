"""Verify that relative paths mentioned in shipped Markdown resolve to files.

Scans ``plugins/**/*.md``, ``AGENTS.md``, and ``README.md`` for markdown
links and backticked path tokens, resolves each against the containing
file's directory, every ancestor directory up to the repository root, and
the owning plugin root, and reports every mention that resolves to nothing.
This catches the real defect a prose assertion never can: a doc pointing at
a moved or deleted file.

Example code in standards and skill references names paths from invented
project trees (``services/user.ts``); those are recognized by an explicit
allowlist of example first segments, never by whether a directory happens
to exist — so a renamed or deleted real directory still fails the gate.
A line carrying ``doc-path-gate: ignore`` in an HTML comment is skipped;
it marks a deliberate mention of a path that must not exist.

Exit 0 when every mention resolves; exit 1 listing ``file:line → path``.
"""

import argparse
import re
import sys
from pathlib import Path

# markdown link target: ](path) — scheme-less relative targets only
LINK_PATTERN = re.compile(r"\]\(([^)\s]+)\)")
# backticked token that looks like a repo file path; the character class
# deliberately excludes spaces, globs, and shell metacharacters so prose
# and command examples do not register as path mentions
BACKTICK_PATTERN = re.compile(r"`([A-Za-z0-9_./{}-]+\.(?:md|py|sh|json|ts|tsx|ya?ml))`")
# link schemes and in-page anchors are not repo files
NON_FILE_LINK = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|#)")
# <placeholder>, {{variable}}, and single-brace {variable} segments mark
# illustrative paths; {{PLUGIN_DIR}} is the one variable with a known
# substitution
PLACEHOLDER = re.compile(
    r"<[^>]*>|\{\{(?!PLUGIN_DIR\}\})[^}]*\}\}|(?<!\{)\{(?!\{)[^{}]*\}"
)
# documents that are themselves templates or worked examples describe the
# layout of a *generated* tree, so their relative links never resolve here;
# the marker appears mid-name too (README.example.cli.md)
ILLUSTRATIVE_DOCUMENT = re.compile(r"\.(?:template|example)\.")
# runtime artifacts of a user checkout, never files this repository ships:
# docs/ and .state/ hold promoted and in-flight work state, .claude/ holds
# per-user agent memory and settings, and the bare segments are the
# documented work-directory and agent-memory layouts (state/journal.md,
# reviews/quality.md, archive/YYYY-MM.md, ...) that exist only at runtime
RUNTIME_ROOTS = (
    "docs/",
    ".state/",
    ".claude/",
    "state/",
    "reviews/",
    "archive/",
    "topics/",
    "rounds/",
    "changes/",
)
# a *target* repository's PR/issue templates, looked up at runtime by
# write-pr — deliberately narrow so this repo's own .github/ stays checked
TARGET_REPO_TEMPLATES = (
    ".github/PULL_REQUEST_TEMPLATE",
    ".github/pull_request_template",
    ".github/ISSUE_TEMPLATE",
)
# first segments of invented example trees used across standards and skill
# references (project-structure rules, naming examples, generated-package
# walkthroughs, agent-template convention snippets); an explicit list so a
# renamed real directory can never silently reclassify as an example
EXAMPLE_ROOTS = frozenset(
    (
        "app",
        "apps",
        "auth",
        "components",
        "composites",
        "domain",
        "features",
        "frontmatter",
        "myapp",
        "myproject",
        "operations",
        "packages",
        "repositories",
        "services",
        "source",
        "spec",
        "src",
        "store",
        "types",
        "utilities",
        "UserProfile",
    )
)
# a line-level opt-out for deliberate mentions of paths that must not exist
# (e.g. a catalog of forbidden fake standard citations)
IGNORE_MARKER = "doc-path-gate: ignore"


def iter_documents(root: Path) -> list[Path]:
    documents = sorted((root / "plugins").rglob("*.md"))
    for name in ("AGENTS.md", "README.md"):
        candidate = root / name
        if candidate.is_file():
            documents.append(candidate)
    return documents


def plugin_root(root: Path, document: Path) -> Path:
    """The owning plugin directory, or the repo root for top-level docs."""
    relative = document.relative_to(root)
    if relative.parts[0] == "plugins" and len(relative.parts) > 2:
        return root / relative.parts[0] / relative.parts[1]
    return root


def mentions(line: str) -> set[str]:
    found = set()
    for match in LINK_PATTERN.finditer(line):
        target = match.group(1)
        if not NON_FILE_LINK.match(target):
            # drop an in-page anchor suffix; the file is what must exist
            found.add(target.split("#", 1)[0])
    # a backticked label inside link text is display prose; the link target
    # above is the claim that gets checked
    without_links = re.sub(r"\[[^\]]*\]\([^)\s]*\)", " ", line)
    for match in BACKTICK_PATTERN.finditer(without_links):
        found.add(match.group(1))
    return {mention for mention in found if mention}


def is_skipped(mention: str) -> bool:
    if PLACEHOLDER.search(mention):
        return True
    if mention.startswith(RUNTIME_ROOTS) or any(
        f"/{runtime_root}" in mention for runtime_root in RUNTIME_ROOTS
    ):
        return True
    if mention.startswith(TARGET_REPO_TEMPLATES):
        return True
    # a bare filename carries no directory context — resolving it against
    # every directory would be guesswork and pure noise
    if "/" not in mention:
        return True
    # absolute paths point at a user's machine, not this repository
    return mention.startswith("/")


def resolution_bases(root: Path, document: Path) -> list[Path]:
    """The containing directory, its ancestors up to the repository root,
    and the owning plugin root — a doc may address any level of its own
    subtree (skill root, plugin root, repo root)."""
    bases = []
    directory = document.parent
    while True:
        bases.append(directory)
        if directory == root:
            break
        directory = directory.parent
    owner = plugin_root(root, document)
    if owner not in bases:
        bases.append(owner)
    # standards prose addresses paths relative to the owning plugin's
    # standards directory (`testing/write.md`)
    standards = owner / "standards"
    if standards.is_dir() and standards not in bases:
        bases.append(standards)
    return bases


def classify(bases: list[Path], mention: str, owner: Path) -> str:
    """Return ``resolved``, ``illustrative``, or ``unresolved``."""
    # the injection hook substitutes {{PLUGIN_DIR}} with the plugin root,
    # yielding an absolute path checked directly
    if "{{PLUGIN_DIR}}" in mention:
        substituted = mention.replace("{{PLUGIN_DIR}}", str(owner))
        return "resolved" if Path(substituted).exists() else "unresolved"

    # ../-relative mentions are anchored to the containing file alone
    if mention.startswith(("./", "../")):
        return "resolved" if (bases[0] / mention).resolve().exists() else "unresolved"

    if any((base / mention).exists() for base in bases):
        return "resolved"
    # only an allowlisted example segment may classify as illustrative; a
    # missing real directory must fail, not silently become an "example"
    if mention.split("/", 1)[0] in EXAMPLE_ROOTS:
        return "illustrative"
    return "unresolved"


def check(root: Path) -> list[str]:
    findings = []
    for document in iter_documents(root):
        if ILLUSTRATIVE_DOCUMENT.search(document.name):
            continue
        bases = resolution_bases(root, document)
        owner = plugin_root(root, document)
        in_fence = False
        for number, line in enumerate(
            document.read_text(encoding="utf-8").splitlines(), start=1
        ):
            # fenced code blocks hold examples and templates, not claims
            # about this repository's layout
            if line.lstrip().startswith("```"):
                in_fence = not in_fence
                continue
            if in_fence:
                continue
            if IGNORE_MARKER in line:
                continue
            for mention in sorted(mentions(line)):
                if is_skipped(mention):
                    continue
                if classify(bases, mention, owner) == "unresolved":
                    findings.append(
                        f"{document.relative_to(root)}:{number} → {mention}"
                    )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "root",
        nargs="?",
        default=Path(__file__).resolve().parents[1],
        type=Path,
        help="repository root to scan (defaults to this script's repository)",
    )
    arguments = parser.parse_args()
    findings = check(arguments.root.resolve())
    for finding in findings:
        print(finding)
    if findings:
        print(f"\n{len(findings)} unresolved path mention(s)", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
