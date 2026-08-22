#!/usr/bin/env bun

import { existsSync, readFileSync, statSync } from "node:fs";

import { getCodePointWidth } from "./unicode-width.ts";

type TocRow = readonly [
  lineNumber: number,
  width: number,
  status: WidthStatus,
  preview: string,
];
type WidthStatus = "OK" | "OVER" | "TIGHT";

const HELP = `usage: toc_width.ts [-h] [--line TEXT] [files ...]

Measure display width of markdown TOC lines (110-char hard cap).

positional arguments:
  files        markdown files to scan, or \`-\` to read lines from stdin

options:
  -h, --help   show this help message and exit
  --line TEXT  measure a single literal line passed on the command line
`;

const LINK = /\[([^\]]*?)\]\(([^)]*?)\)/g;
const ANCHOR_LINK = /\[[^\]]+\]\(#[^)]+\)/g;
const NEGATIVE_NUMBER = /^-\p{Nd}+$|^-\p{Nd}*\.\p{Nd}+$/u;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function decodeUtf8(input: Uint8Array): string {
  return UTF8_DECODER.decode(input);
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

export function measure(line: string): number {
  const visible = line
    .replace(/\n+$/, "")
    .replace(LINK, "$1")
    .replaceAll("&emsp;", "\uE000\uE000")
    .replaceAll("&nbsp;", "\uE000")
    .replaceAll("&ensp;", "\uE000");

  return [...visible].reduce((width, character) => {
    const codePoint = character.codePointAt(0)!;
    return width + getCodePointWidth(codePoint);
  }, 0);
}

export function classify(width: number): WidthStatus {
  if (width > 110) return "OVER";
  if (width >= 101) return "TIGHT";
  return "OK";
}

function preview(line: string, length = 80): string {
  return [...line.replace(/\n+$/, "").replaceAll("\t", " ")]
    .slice(0, length)
    .join("");
}

function isTocLine(line: string): boolean {
  return (
    /^\s*•/.test(line) &&
    line.includes("&emsp;") &&
    (line.match(ANCHOR_LINK)?.length ?? 0) >= 2
  );
}

export function scanText(text: string): TocRow[] {
  const rows: TocRow[] = [];
  let inComment = false;
  for (const [index, line] of normalizeNewlines(text)
    .split(/(?<=\n)/)
    .entries()) {
    let cursor = 0;
    let visible = "";
    while (cursor < line.length) {
      if (inComment) {
        const end = line.indexOf("-->", cursor);
        if (end === -1) {
          cursor = line.length;
        } else {
          inComment = false;
          cursor = end + 3;
        }
      } else {
        const start = line.indexOf("<!--", cursor);
        if (start === -1) {
          visible += line.slice(cursor);
          cursor = line.length;
        } else {
          visible += line.slice(cursor, start);
          inComment = true;
          cursor = start + 4;
        }
      }
    }
    if (isTocLine(visible)) {
      const width = measure(visible);
      rows.push([index + 1, width, classify(width), preview(visible)]);
    }
  }
  return rows;
}

function reportLine(line: string): number {
  const width = measure(line);
  const status = classify(width);
  console.log(`${width}\t${status}\t${preview(line)}`);
  return status === "OVER" ? 1 : 0;
}

function reportFiles(paths: readonly string[]): number {
  let anyOver = false;
  for (const path of paths) {
    if (!existsSync(path) || !statSync(path).isFile()) {
      console.error(`skip (not a file): ${path}`);
      continue;
    }
    for (const [lineNumber, width, status, rowPreview] of scanText(
      decodeUtf8(readFileSync(path)),
    )) {
      console.log(`${path}:${lineNumber}\t${width}\t${status}\t${rowPreview}`);
      anyOver ||= status === "OVER";
    }
  }
  return anyOver ? 1 : 0;
}

function parseArguments(
  arguments_: readonly string[],
): { readonly files: readonly string[]; readonly literal?: string } | number {
  const files: string[] = [];
  const unknown: string[] = [];
  let literal: string | undefined;
  let optionsEnded = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    const [option, explicitValue] = argument.split(/=(.*)/s, 2);
    if (!optionsEnded && option === "--" && explicitValue !== undefined) {
      console.error("usage: toc_width.ts [-h] [--line TEXT] [files ...]");
      console.error(
        `toc_width.ts: error: ambiguous option: ${argument} could match --help, --line`,
      );
      return 2;
    }
    const longOption =
      !optionsEnded && option !== "--" && option?.startsWith("--")
        ? ["--help", "--line"].find((candidate) => candidate.startsWith(option))
        : undefined;
    if (
      !optionsEnded &&
      (argument === "-h" ||
        (longOption === "--help" && explicitValue === undefined))
    ) {
      process.stdout.write(HELP);
      return 0;
    }
    if (
      !optionsEnded &&
      longOption === "--help" &&
      explicitValue !== undefined
    ) {
      console.error("usage: toc_width.ts [-h] [--line TEXT] [files ...]");
      console.error(
        `toc_width.ts: error: argument -h/--help: ignored explicit argument '${explicitValue}'`,
      );
      return 2;
    }
    if (!optionsEnded && argument === "--") {
      optionsEnded = true;
      continue;
    }
    const isLineOption = !optionsEnded && longOption === "--line";
    if (isLineOption) {
      const candidate =
        explicitValue !== undefined ? explicitValue : arguments_[(index += 1)];
      if (
        candidate === undefined ||
        (explicitValue === undefined &&
          candidate !== "-" &&
          candidate.startsWith("-") &&
          !NEGATIVE_NUMBER.test(candidate))
      ) {
        console.error("usage: toc_width.ts [-h] [--line TEXT] [files ...]");
        console.error(
          "toc_width.ts: error: argument --line: expected one argument",
        );
        return 2;
      }
      literal = candidate;
    } else if (
      !optionsEnded &&
      argument.startsWith("-") &&
      argument !== "-" &&
      !NEGATIVE_NUMBER.test(argument)
    ) {
      unknown.push(argument);
    } else {
      files.push(argument);
    }
  }
  if (unknown.length > 0) {
    console.error("usage: toc_width.ts [-h] [--line TEXT] [files ...]");
    console.error(
      `toc_width.ts: error: unrecognized arguments: ${unknown.join(" ")}`,
    );
    return 2;
  }
  return { files, ...(literal === undefined ? {} : { literal }) };
}

export function run(arguments_: readonly string[]): number {
  const parsed = parseArguments(arguments_);
  if (typeof parsed === "number") return parsed;
  if (parsed.literal !== undefined) return reportLine(parsed.literal);
  if (parsed.files.length === 0) {
    process.stdout.write(HELP);
    return 2;
  }
  if (parsed.files.length === 1 && parsed.files[0] === "-") {
    return normalizeNewlines(decodeUtf8(readFileSync(0)))
      .split(/(?<=\n)/)
      .filter(Boolean)
      .reduce((exitCode, line) => Math.max(exitCode, reportLine(line)), 0);
  }
  return reportFiles(parsed.files);
}

if (import.meta.main) process.exit(run(process.argv.slice(2)));
