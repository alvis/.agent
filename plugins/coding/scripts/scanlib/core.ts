import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { loadRules } from "./loader.ts";
import {
  isSpecFile,
  PY_SUFFIXES,
  RUST_SUFFIXES,
  SOURCE_SUFFIXES,
} from "./predicates.ts";
import { appliesTo } from "./rule.ts";

import type { Match, Rule } from "./rule.ts";

const SCANNED_SUFFIXES = new Set([
  ...SOURCE_SUFFIXES,
  ...PY_SUFFIXES,
  ...RUST_SUFFIXES,
]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "__pycache__",
  ".turbo",
  ".cache",
  "out",
]);

interface RunOptions {
  readonly rulesDirectory?: string;
  readonly stdout?: (text: string) => void;
  readonly stderr?: (text: string) => void;
}

interface ParsedArgs {
  readonly paths: readonly string[];
  readonly category: string;
  readonly before: number;
  readonly after: number;
  readonly noTests: boolean;
}

type ParseResult = ParsedArgs | { readonly error: string };

export function iterFiles(root: string): string[] {
  if (statSync(root).isFile()) return [root];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) => left.name.localeCompare(right.name),
    )) {
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (
        entry.isFile() &&
        SCANNED_SUFFIXES.has(extname(path).toLowerCase())
      )
        files.push(path);
    }
  };
  visit(root);
  return files;
}

export function render(
  label: string,
  matches: readonly Match[],
  linesByPath: ReadonlyMap<string, readonly string[]>,
  before: number,
  after: number,
): string {
  const output = [`=== ${label} ===`, ""];
  if (matches.length === 0) return [...output, "(no matches)", ""].join("\n");
  const byFile = new Map<string, Match[]>();
  for (const match of matches)
    byFile.set(match.path, [...(byFile.get(match.path) ?? []), match]);
  for (const [path, items] of byFile) {
    for (const [index, match] of items.entries()) {
      output.push(`${path}:${match.lineno}  ${match.line.trim()}`);
      const lines = linesByPath.get(path) ?? [];
      const start = Math.max(1, match.lineno - before);
      const end = Math.min(lines.length, match.lineno + after);
      for (let lineno = start; lineno <= end; lineno += 1)
        output.push(
          `  ${lineno === match.lineno ? ">" : " "} ${String(lineno).padStart(4)}: ${(lines[lineno - 1] ?? "").trimEnd()}`,
        );
      if (index + 1 < items.length) output.push("", "  --- next match ---", "");
    }
    output.push("");
  }
  return output.join("\n");
}

function parseArgs(argv: readonly string[]): ParseResult {
  const paths: string[] = [];
  let category = "all";
  let before = 5;
  let after = 10;
  let noTests = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    if (argument === "--category") category = argv[++index] ?? "";
    else if (argument.startsWith("--category="))
      category = argument.slice("--category=".length);
    else if (argument === "--before") before = Number(argv[++index]);
    else if (argument.startsWith("--before="))
      before = Number(argument.slice("--before=".length));
    else if (argument === "--after") after = Number(argv[++index]);
    else if (argument.startsWith("--after="))
      after = Number(argument.slice("--after=".length));
    else if (argument === "--no-tests") noTests = true;
    else if (argument.startsWith("--"))
      return { error: `unrecognized argument: ${argument}` };
    else paths.push(argument);
  }
  if (!Number.isInteger(before) || before < 0)
    return { error: "--before must be a non-negative integer" };
  if (!Number.isInteger(after) || after < 0)
    return { error: "--after must be a non-negative integer" };
  return {
    paths: paths.length === 0 ? ["."] : paths,
    category,
    before,
    after,
    noTests,
  };
}

export async function run(
  argv: readonly string[] = process.argv.slice(2),
  options: RunOptions = {},
): Promise<number> {
  const rules = await loadRules(options.rulesDirectory);
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const args = parseArgs(argv);
  if ("error" in args) {
    (options.stderr ?? ((text) => process.stderr.write(text)))(
      `error: ${args.error}\n`,
    );
    return 2;
  }
  const selected: readonly Rule[] =
    args.category === "all"
      ? rules
      : byId.has(args.category)
        ? [byId.get(args.category) as Rule]
        : [];
  if (selected.length === 0 && args.category !== "all") {
    (options.stderr ?? ((text) => process.stderr.write(text)))(
      `error: invalid category: ${args.category}\n`,
    );
    return 2;
  }
  const results = new Map(selected.map((rule) => [rule.id, [] as Match[]]));
  const linesByPath = new Map<string, readonly string[]>();
  for (const root of args.paths) {
    if (!existsSync(root)) {
      (options.stderr ?? ((text) => process.stderr.write(text)))(
        `warn: path not found: ${root}\n`,
      );
      continue;
    }
    for (const path of iterFiles(root)) {
      let lines: readonly string[] | undefined;
      for (const rule of selected) {
        if (
          !appliesTo(rule, path) ||
          (rule.honorNoTests && args.noTests && isSpecFile(path))
        )
          continue;
        if (lines === undefined) {
          try {
            lines = readFileSync(path, "utf8")
              .split(/\r?\n/)
              .filter(
                (_, index, source) =>
                  index < source.length - 1 || source[index] !== "",
              );
          } catch {
            lines = [];
          }
        }
        linesByPath.set(path, lines);
        rule.scan({ path, lines, matches: results.get(rule.id) as Match[] });
      }
    }
  }
  const chunks: string[] = [];
  const summary: string[] = [];
  for (const rule of selected) {
    const matches = results.get(rule.id) ?? [];
    chunks.push(
      render(rule.label, matches, linesByPath, args.before, args.after),
    );
    summary.push(
      `  ${rule.id}: ${matches.length} matches in ${new Set(matches.map((match) => match.path)).size} files`,
    );
  }
  (options.stdout ?? ((text) => process.stdout.write(text)))(
    `${chunks.join("\n")}\n=== Summary ===\n${summary.join("\n")}\n`,
  );
  return 0;
}
