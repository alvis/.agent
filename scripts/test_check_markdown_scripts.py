import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = ROOT / "scripts" / "check_markdown_scripts.py"
SPEC = importlib.util.spec_from_file_location("check_markdown_scripts", CHECKER_PATH)
assert SPEC and SPEC.loader
checker = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = checker
SPEC.loader.exec_module(checker)


def test_shell_fence_limit_counts_content_lines(tmp_path: Path) -> None:
    markdown = tmp_path / "guide.md"
    markdown.write_text("```bash\n" + "\n".join(["true"] * 11) + "\n```\n")

    assert checker.violations(markdown) == [
        checker.Violation(markdown, 1, "bash", 11)
    ]


def test_non_shell_examples_and_ten_line_shell_fences_pass(tmp_path: Path) -> None:
    markdown = tmp_path / "guide.md"
    markdown.write_text(
        "```bash\n" + "\n".join(["true"] * 10) + "\n```\n"
        "```python\n" + "\n".join(["pass"] * 11) + "\n```\n"
    )

    assert checker.violations(markdown) == []


def test_shorter_marker_does_not_close_a_longer_fence(tmp_path: Path) -> None:
    markdown = tmp_path / "guide.md"
    markdown.write_text(
        "````bash\n```\n" + "\n".join(["true"] * 10) + "\n````\n"
    )

    assert checker.violations(markdown) == [
        checker.Violation(markdown, 1, "bash", 11)
    ]


def test_closer_requires_only_fence_marker_and_whitespace(tmp_path: Path) -> None:
    markdown = tmp_path / "guide.md"
    markdown.write_text(
        "```bash\n" + "\n".join(["true"] * 10) + "\n```not-a-closer\n```\n"
    )

    assert checker.violations(markdown) == [
        checker.Violation(markdown, 1, "bash", 11)
    ]


def test_unterminated_shell_fence_is_checked_at_eof(tmp_path: Path) -> None:
    markdown = tmp_path / "guide.md"
    markdown.write_text("```bash\n" + "\n".join(["true"] * 11))

    assert checker.violations(markdown) == [
        checker.Violation(markdown, 1, "bash", 11)
    ]


def test_repository_markdown_keeps_scripts_out_of_docs() -> None:
    found = [
        item
        for path in checker.markdown_files([ROOT])
        for item in checker.violations(path)
    ]

    assert found == []
