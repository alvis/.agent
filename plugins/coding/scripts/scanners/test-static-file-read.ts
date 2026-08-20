import { extname } from "node:path";

import { isTestFile, RUST_SUFFIXES } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

const staticRead = /\b(?:readFile|readFileSync)\s*\(|\.read_text\s*\(/;
const rustStaticRead = /\b(?:std::)?fs::(?:read|read_to_string)\s*\(/;

function pythonCodeLines(lines: readonly string[]): string[] {
  const code: string[] = [];
  let quote: "'" | '"' | undefined;
  let triple = false;
  let escaped = false;
  for (const line of lines) {
    const masked = [...line];
    for (let index = 0; index < line.length; index += 1) {
      if (quote !== undefined) {
        masked[index] = " ";
        const delimiter = quote.repeat(3);
        if (triple && line.startsWith(delimiter, index)) {
          masked[index + 1] = " ";
          masked[index + 2] = " ";
          index += 2;
          quote = undefined;
          triple = false;
        } else if (!triple && !escaped && line[index] === quote)
          quote = undefined;
        escaped = !escaped && line[index] === "\\";
        if (line[index] !== "\\") escaped = false;
        continue;
      }
      if (line[index] === "#") {
        masked.fill(" ", index);
        break;
      }
      if (line[index] === "'" || line[index] === '"') {
        quote = line[index] as "'" | '"';
        triple = line.startsWith(quote.repeat(3), index);
        masked[index] = " ";
        if (triple) {
          masked[index + 1] = " ";
          masked[index + 2] = " ";
          index += 2;
        }
      }
    }
    if (quote !== undefined && !triple) quote = undefined;
    code.push(masked.join(""));
  }
  return code;
}

function rustCodeLines(lines: readonly string[]): string[] {
  const codeLines: string[] = [];
  let blockDepth = 0;
  let literalEnd: string | undefined;
  let rawLiteral = false;
  let escaped = false;
  for (const raw of lines) {
    const code = [...raw];
    for (let column = 0; column < raw.length; ) {
      if (blockDepth > 0) {
        code[column] = " ";
        if (raw.startsWith("/*", column)) {
          code[column + 1] = " ";
          blockDepth += 1;
          column += 2;
        } else if (raw.startsWith("*/", column)) {
          code[column + 1] = " ";
          blockDepth -= 1;
          column += 2;
        } else column += 1;
        continue;
      }
      if (literalEnd !== undefined) {
        if (rawLiteral && raw.startsWith(literalEnd, column)) {
          for (
            let index = column;
            index < column + literalEnd.length;
            index += 1
          )
            code[index] = " ";
          column += literalEnd.length;
          literalEnd = undefined;
          rawLiteral = false;
          continue;
        }
        const character = raw[column] ?? "";
        code[column] = " ";
        column += 1;
        if (escaped) escaped = false;
        else if (character === "\\" && !rawLiteral) escaped = true;
        else if (character === literalEnd && !rawLiteral)
          literalEnd = undefined;
        continue;
      }
      if (raw.startsWith("//", column)) {
        code.fill(" ", column);
        break;
      }
      if (raw.startsWith("/*", column)) {
        code[column] = " ";
        code[column + 1] = " ";
        blockDepth = 1;
        column += 2;
        continue;
      }
      const rawString = /^(?:br|r)(#{0,255})"/.exec(raw.slice(column));
      if (rawString !== null) {
        const length = rawString[0].length;
        code.fill(" ", column, column + length);
        literalEnd = `"${rawString[1] ?? ""}`;
        rawLiteral = true;
        column += length;
        continue;
      }
      const character = /^'(?:\\(?:u\{[\da-fA-F_]+\}|.)|[^\\'\n])'/.exec(
        raw.slice(column),
      );
      if (character !== null) {
        code.fill(" ", column, column + character[0].length);
        column += character[0].length;
        continue;
      }
      if (raw[column] === '"') {
        code[column] = " ";
        literalEnd = '"';
        rawLiteral = false;
        escaped = false;
      }
      column += 1;
    }
    codeLines.push(code.join(""));
  }
  return codeLines;
}

function isRustTestAttribute(body: string): boolean {
  const value = body.trim();
  if (value === "test") return true;
  const configured = /^cfg\s*\((.*)\)$/s.exec(value);
  if (configured === null) return false;
  const condition = (configured[1] ?? "").trim();
  if (condition === "test") return true;
  const conjunction = /^all\s*\((.*)\)$/s.exec(condition);
  return (
    conjunction !== null &&
    /(?:^|,)\s*test\s*(?=,|$)/.test(conjunction[1] ?? "")
  );
}

function rustTestAttributeEnds(lines: readonly string[]): Map<number, number> {
  const source = lines.join("\n");
  const ends = new Map<number, number>();
  for (const attribute of source.matchAll(/#\s*\[\s*([^\]]+?)\s*\]/gs)) {
    if (!isRustTestAttribute(attribute[1] ?? "")) continue;
    const offset = (attribute.index ?? 0) + attribute[0].length;
    const prefix = source.slice(0, offset);
    const line = prefix.split("\n").length - 1;
    const column = offset - (prefix.lastIndexOf("\n") + 1);
    ends.set(line, Math.max(ends.get(line) ?? 0, column));
  }
  return ends;
}

function rustTestCodeLines(path: string, lines: readonly string[]): string[] {
  if (path.split(/[\\/]/).includes("tests")) return [...lines];
  const result: string[] = [];
  let braceDepth = 0;
  let activeDepth: number | undefined;
  let pending = false;
  const attributeEnds = rustTestAttributeEnds(lines);
  for (const [lineno, raw] of lines.entries()) {
    const code = Array.from({ length: raw.length }, () => " ");
    const attributeEnd = attributeEnds.get(lineno);
    if (attributeEnd !== undefined && activeDepth === undefined) pending = true;
    for (const [column, character] of [...raw].entries()) {
      const afterAttribute =
        attributeEnd === undefined || column >= attributeEnd;
      if (activeDepth !== undefined || (pending && afterAttribute))
        code[column] = character;
      if (character === "{") {
        braceDepth += 1;
        if (pending && afterAttribute) {
          activeDepth = braceDepth;
          pending = false;
        }
      } else if (character === "}") {
        braceDepth -= 1;
        if (activeDepth !== undefined && braceDepth < activeDepth)
          activeDepth = undefined;
      } else if (character === ";" && pending && afterAttribute)
        pending = false;
    }
    result.push(code.join(""));
  }
  return result;
}

function candidateFiles(path: string): boolean {
  return RUST_SUFFIXES.has(extname(path).toLowerCase()) || isTestFile(path);
}

export const RULE: Rule = {
  id: "test-static-file-read",
  label: "Static file read in test — review candidate only (TST-CORE-10)",
  order: 100,
  appliesTo: candidateFiles,
  ruleRefs: ["TST-CORE-10"],
  scan: ({ path, lines, matches }) => {
    const suffix = extname(path).toLowerCase();
    const codeLines =
      suffix === ".rs"
        ? rustTestCodeLines(path, rustCodeLines(lines))
        : suffix === ".py"
          ? pythonCodeLines(lines)
          : lines;
    const pattern = suffix === ".rs" ? rustStaticRead : staticRead;
    for (const [index, raw] of lines.entries())
      if (
        pattern.test(
          suffix === ".py"
            ? (codeLines[index] ?? "")
            : (codeLines[index] ?? "").replace(/\/\/.*$/, ""),
        )
      )
        matches.push({ path, lineno: index + 1, line: raw });
  },
};
