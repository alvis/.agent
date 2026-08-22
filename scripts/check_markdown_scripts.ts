#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

export const SHELL_LANGUAGES = new Set(["bash", "sh", "shell", "zsh"]);
export const MAX_SCRIPT_LINES = 10;

export interface Violation {
  readonly path: string;
  readonly line: number;
  readonly language: string;
  readonly lines: number;
}

export function violations(path: string): Violation[] {
  const found: Violation[] = [];
  let fenceMarker = "";
  let fenceLength = 0;
  let language = "";
  let start = 0;
  let count = 0;
  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r\n|\r|\n/);
  if (/\r\n$|[\r\n]$/.test(content)) lines.pop();
  for (const [lineIndex, line] of lines.entries()) {
    const stripped = line.replace(/^ +/, "");
    const indentation = line.length - stripped.length;
    const marker = stripped.slice(0, 1);
    let markerLength = 0;
    while (marker && stripped[markerLength] === marker) markerLength += 1;
    if (!fenceMarker && indentation <= 3 && (marker === "`" || marker === "~") && markerLength >= 3) {
      fenceMarker = marker;
      fenceLength = markerLength;
      language = stripped.slice(markerLength).trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
      start = lineIndex + 1;
      count = 0;
    } else if (fenceMarker && indentation <= 3 && marker === fenceMarker && markerLength >= fenceLength && stripped.slice(markerLength).trim() === "") {
      if (SHELL_LANGUAGES.has(language) && count > MAX_SCRIPT_LINES) found.push({ path, line: start, language, lines: count });
      fenceMarker = "";
    } else if (fenceMarker) {
      count += 1;
    }
  }
  if (fenceMarker && SHELL_LANGUAGES.has(language) && count > MAX_SCRIPT_LINES) found.push({ path, line: start, language, lines: count });
  return found;
}

export function markdownFiles(paths: readonly string[]): string[] {
  const files = new Set<string>();
  const visit = (path: string): void => {
    const status = statSync(path);
    if (status.isDirectory()) {
      for (const name of readdirSync(path)) visit(join(path, name));
    } else if (extname(path) === ".md") files.add(path);
  };
  for (const path of paths) visit(path);
  return [...files].sort();
}

export function main(args = Bun.argv.slice(2)): number {
  if (args.length === 0) {
    process.stderr.write("usage: check_markdown_scripts.ts paths [paths ...]\n");
    return 2;
  }
  const found = markdownFiles(args).flatMap(violations);
  for (const item of found) process.stdout.write(`${item.path}:${item.line}: ${item.language} fence has ${item.lines} lines\n`);
  return found.length > 0 ? 1 : 0;
}

if (import.meta.main) process.exit(main());
