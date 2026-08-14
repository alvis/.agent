"""TST-CORE-10 candidate: static file reads in test files."""

import io
import re
import tokenize
from pathlib import Path

from scanlib.core import Match
from scanlib.predicates import RUST_SUFFIXES, is_test_file
from scanlib.rule import Rule

STATIC_FILE_READ = re.compile(r"\b(?:readFile|readFileSync)\s*\(|\.read_text\s*\(")
RUST_STATIC_FILE_READ = re.compile(r"\b(?:std::)?fs::(?:read|read_to_string)\s*\(")
RUST_ATTRIBUTE = re.compile(r"#\s*\[\s*(?P<body>[^]]+?)\s*\]")
RUST_CFG = re.compile(r"cfg\s*\((?P<condition>.*)\)", re.DOTALL)
RUST_CFG_ALL = re.compile(r"all\s*\((?P<conditions>.*)\)", re.DOTALL)
RUST_BARE_TEST = re.compile(r"(?:^|,)\s*test\s*(?=,|$)")
SLASH_LINE_COMMENT = re.compile(r"//.*$")
RUST_RAW_STRING_START = re.compile(r'(?:br|r)(?P<hashes>#{0,255})"')
RUST_CHAR_LITERAL = re.compile(r"'(?:\\(?:u\{[\da-fA-F_]+\}|.)|[^\\'\n])'")


def python_code_lines(lines: list[str], /) -> list[str]:
    code = list(lines)
    try:
        tokens = tokenize.generate_tokens(io.StringIO("\n".join(lines)).readline)
        for token in tokens:
            if token.type == tokenize.COMMENT:
                lineno, column = token.start
                code[lineno - 1] = code[lineno - 1][:column]
            elif token.type == tokenize.STRING:
                start_line, start_column = token.start
                end_line, end_column = token.end
                for lineno in range(start_line, end_line + 1):
                    left = start_column if lineno == start_line else 0
                    right = end_column if lineno == end_line else len(code[lineno - 1])
                    raw = code[lineno - 1]
                    code[lineno - 1] = raw[:left] + " " * (right - left) + raw[right:]
    except (IndentationError, tokenize.TokenError):
        return code
    return code


def candidate_files(path: Path, /) -> bool:
    """Read named tests plus Rust sources that may contain inline test modules."""
    if path.suffix.lower() in RUST_SUFFIXES:
        return True
    return is_test_file(path)


def rust_code_lines(lines: list[str], /) -> list[str]:
    """Blank Rust comments and literals while preserving source positions."""
    code_lines: list[str] = []
    block_depth = 0
    literal_end: str | None = None
    raw_literal = False
    escaped = False

    for raw in lines:
        code = list(raw)
        column = 0
        while column < len(raw):
            if block_depth:
                code[column] = " "
                if raw.startswith("/*", column):
                    code[column + 1] = " "
                    block_depth += 1
                    column += 2
                elif raw.startswith("*/", column):
                    code[column + 1] = " "
                    block_depth -= 1
                    column += 2
                else:
                    column += 1
                continue

            if literal_end is not None:
                if raw_literal and raw.startswith(literal_end, column):
                    for index in range(column, column + len(literal_end)):
                        code[index] = " "
                    column += len(literal_end)
                    literal_end = None
                    raw_literal = False
                    continue

                current = raw[column]
                code[column] = " "
                column += 1
                if escaped:
                    escaped = False
                elif current == "\\" and not raw_literal:
                    escaped = True
                elif current == literal_end and not raw_literal:
                    literal_end = None
                continue

            if raw.startswith("//", column):
                code[column:] = " " * (len(raw) - column)
                break
            if raw.startswith("/*", column):
                code[column : column + 2] = "  "
                block_depth = 1
                column += 2
                continue

            raw_string = RUST_RAW_STRING_START.match(raw, column)
            if raw_string:
                code[column : raw_string.end()] = " " * (
                    raw_string.end() - column
                )
                literal_end = '"' + raw_string.group("hashes")
                raw_literal = True
                column = raw_string.end()
                continue

            char_literal = RUST_CHAR_LITERAL.match(raw, column)
            if char_literal:
                code[column : char_literal.end()] = " " * (
                    char_literal.end() - column
                )
                column = char_literal.end()
                continue

            if raw[column] == '"':
                code[column] = " "
                literal_end = '"'
                raw_literal = False
                escaped = False
            column += 1

        code_lines.append("".join(code))

    return code_lines


def is_rust_test_attribute(body: str, /) -> bool:
    """Recognize attributes whose item cannot compile outside a test build."""
    body = body.strip()
    if body == "test":
        return True

    configured = RUST_CFG.fullmatch(body)
    if not configured:
        return False
    condition = configured.group("condition").strip()
    if condition == "test":
        return True

    conjunction = RUST_CFG_ALL.fullmatch(condition)
    return bool(
        conjunction and RUST_BARE_TEST.search(conjunction.group("conditions"))
    )


def rust_test_attribute_ends(lines: list[str], /) -> dict[int, int]:
    """Map qualifying test-attribute end lines to their ending columns."""
    source = "\n".join(lines)
    ends: dict[int, int] = {}
    for attribute in RUST_ATTRIBUTE.finditer(source):
        if not is_rust_test_attribute(attribute.group("body")):
            continue
        offset = attribute.end()
        line = source.count("\n", 0, offset)
        previous_newline = source.rfind("\n", 0, offset)
        column = offset if previous_newline < 0 else offset - previous_newline - 1
        ends[line] = max(ends.get(line, 0), column)
    return ends


def rust_test_code_lines(path: Path, lines: list[str], /) -> list[str]:
    """Mask Rust code outside integration tests or attributed test items."""
    if "tests" in path.parts:
        return lines

    test_code: list[str] = []
    brace_depth = 0
    active_test_depth: int | None = None
    pending_test_item = False
    attribute_ends = rust_test_attribute_ends(lines)

    for lineno, raw in enumerate(lines):
        code = [" "] * len(raw)
        attribute_end = attribute_ends.get(lineno)
        if attribute_end is not None and active_test_depth is None:
            pending_test_item = True

        for column, character in enumerate(raw):
            after_attribute = attribute_end is None or column >= attribute_end
            in_test = active_test_depth is not None or (
                pending_test_item and after_attribute
            )
            if in_test:
                code[column] = character

            if character == "{":
                brace_depth += 1
                if pending_test_item and after_attribute:
                    active_test_depth = brace_depth
                    pending_test_item = False
            elif character == "}":
                brace_depth -= 1
                if (
                    active_test_depth is not None
                    and brace_depth < active_test_depth
                ):
                    active_test_depth = None
            elif character == ";" and pending_test_item and after_attribute:
                pending_test_item = False

        test_code.append("".join(code))

    return test_code


def scan(*, path: Path, lines: list[str], matches: list[Match]) -> None:
    if path.suffix.lower() in RUST_SUFFIXES:
        code_lines = rust_test_code_lines(path, rust_code_lines(lines))
        pattern = RUST_STATIC_FILE_READ
    else:
        pattern = STATIC_FILE_READ
        code_lines = python_code_lines(lines) if path.suffix == ".py" else lines
    for lineno, (raw, code) in enumerate(zip(lines, code_lines), start=1):
        if path.suffix != ".py":
            code = SLASH_LINE_COMMENT.sub("", code)
        if pattern.search(code):
            matches.append(Match(path, lineno, raw.rstrip("\n")))


RULE = Rule(
    id="test-static-file-read",
    label="Static file read in test — review candidate only (TST-CORE-10)",
    scan=scan,
    order=100,
    applies_to=candidate_files,
    rule_refs=("TST-CORE-10",),
)
