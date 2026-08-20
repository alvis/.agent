#!/usr/bin/env bun

import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BODY_LINES = 500;
const MIN_DESCRIPTION_WORDS = 25;
const MAX_DESCRIPTION_WORDS = 60;
const PLACEHOLDERS = [
  /\[(?:TODO|PLACEHOLDER|INSERT(?: [^\]]*)?)\]/i,
  /\[(?:skill-name|Skill Name|Description|Step Name)\]/,
];
const LOCAL_LINK = /\[[^\]]+\]\((?![a-z]+:|#)([^)]+)\)/gi;
const REFERENCE_DEFINITION = /^[ \t]{0,3}\[(?:\\.|[^\]\\])+\]:[ \t]*(<[^>\n]*>|[^\s<][^\s]*)/;
const EXTERNAL_DESTINATION = /^[a-z][a-z0-9+.-]*:/i;
const ILLUSTRATIVE_DESTINATION = /<[^>]+>|\[[^\]]+\]|\{\{[^}]+\}\}|\{[^{}]+\}/;
const LOCAL_DIRECTORIES = new Set(["agents", "assets", "evals", "hooks", "references", "scripts", "templates"]);
const YAML_MERGE_TAGS = new Set(["!!merge", "!<tag:yaml.org,2002:merge>"]);
const MODEL_SELECTION_FIELDS = new Set(["effort", "intelligence", "intelligencelevel", "model", "modelreasoningeffort", "reasoningeffort"]);
const CLAUDE_TIMEOUT_MILLISECONDS = 30_000;
const INTELLIGENCE_MAPPING = "essential/skills/install-agents/references/intelligence-levels.json";

export type PolicyIssue = { message: string; line?: number };
export type PolicyReport = { path: string; errors: PolicyIssue[]; warnings: PolicyIssue[] };
type MappingEntry = [string | null, number];
type NestedEntry = [string | null, string | null, number];

function splitLines(source: string): string[] {
  const lines = source.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function walkFiles(root: string, targetName?: string): string[] {
  const results: string[] = [];
  for (const entry of new Bun.Glob("**/*").scanSync({ cwd: root, absolute: true, onlyFiles: true, dot: true })) {
    if (targetName === undefined || basename(entry) === targetName) results.push(resolve(entry));
  }
  return results.sort();
}

export function discoverSkills(target: string): string[] {
  const absolute = resolve(target);
  if (existsSync(absolute) && statSync(absolute).isFile()) return basename(absolute) === "SKILL.md" ? [absolute] : [];
  const direct = resolve(absolute, "SKILL.md");
  if (existsSync(direct) && statSync(direct).isFile()) return [direct];
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) return [];
  return walkFiles(absolute, "SKILL.md").filter((path) => {
    const parts = relative(absolute, path).split(/[\\/]/);
    return !parts.slice(0, -1).includes("templates") && !parts.some((part) => part.startsWith("."));
  });
}

function issue(message: string, line?: number): PolicyIssue {
  return line === undefined ? { message } : { message, line };
}

function frontmatterAndBody(text: string): [string[], string[]] {
  const lines = splitLines(text);
  if (lines.length === 0 || lines[0].trim() !== "---") return [[], lines];
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) return [[], lines];
  return [lines.slice(1, end), lines.slice(end + 1)];
}

function scalarValue(frontmatter: string[], key: string): string | null {
  const prefix = `${key}:`;
  for (const line of frontmatter) {
    if (!line.startsWith(prefix)) continue;
    let value = line.slice(prefix.length).trim();
    if (value.length >= 2 && value[0] === value.at(-1) && ['"', "'"].includes(value[0])) value = value.slice(1, -1);
    return value;
  }
  return null;
}

function normalizeMarkdownDestination(destination: string): string {
  let normalized = destination.trim();
  if (normalized.length >= 2 && normalized[0] === "<" && normalized.at(-1) === ">") normalized = normalized.slice(1, -1).trim();
  return normalized.split("#", 1)[0].trim();
}

function withoutYamlComments(source: string): string {
  return splitLines(source).map((line) => {
    let quote: string | null = null;
    let escaped = false;
    let comment: number | null = null;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (quote === '"') {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = null;
        continue;
      }
      if (quote === "'") {
        if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'") quote = character;
      else if (character === "#" && (index === 0 || /\s/.test(line[index - 1]))) {
        comment = index;
        break;
      }
    }
    return comment === null ? line : `${line.slice(0, comment)}${" ".repeat(line.length - comment)}`;
  }).join("\n");
}

function mappingSeparator(source: string, flow = false): number | null {
  let quote: string | null = null;
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote === '"') {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
    } else if (quote === "'") {
      if (character === quote) {
        if (source[index + 1] === quote) index += 1;
        else quote = null;
      }
    } else if (character === '"' || character === "'") quote = character;
    else if (character === "[" || character === "{") depth += 1;
    else if (character === "]" || character === "}") depth = Math.max(0, depth - 1);
    else if (character === ":" && depth === 0) {
      const following = source.slice(index + 1, index + 2);
      const key = source.slice(0, index).trimStart();
      if (key.startsWith("'") || key.startsWith('"') || following === "" || /\s/.test(following) || (flow && /[,}]/.test(following))) return index;
    }
  }
  return null;
}

function decodeDoubleQuoted(source: string): string | null {
  try {
    const jsonCompatible = source
      .replace(/\\x([0-9a-fA-F]{2})/g, (_match, hex: string) => `\\u00${hex}`)
      .replace(/\\U([0-9a-fA-F]{8})/g, (_match, hex: string) => {
        const codePoint = Number.parseInt(hex, 16);
        if (codePoint <= 0xffff) return `\\u${codePoint.toString(16).padStart(4, "0")}`;
        const adjusted = codePoint - 0x10000;
        const high = 0xd800 + (adjusted >> 10);
        const low = 0xdc00 + (adjusted & 0x3ff);
        return `\\u${high.toString(16)}\\u${low.toString(16)}`;
      });
    const value = JSON.parse(jsonCompatible) as unknown;
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

function yamlScalar(source: string): string | null {
  const value = source.trim();
  if (value.startsWith("!") || value.startsWith("&")) {
    const separator = value.indexOf(" ");
    if (separator < 0) return null;
    return YAML_MERGE_TAGS.has(value.slice(0, separator)) ? "<<" : null;
  }
  if ((value.startsWith("'") || value.startsWith('"')) && value.includes("\n")) return null;
  if (value.startsWith("'")) return value.length >= 2 && value.endsWith("'") ? value.slice(1, -1).replaceAll("''", "'") : null;
  if (value.startsWith('"')) return value.length >= 2 && value.endsWith('"') ? decodeDoubleQuoted(value) : null;
  if (!value || ["*", "|", ">", "[", "{"].some((prefix) => value.startsWith(prefix))) return null;
  return value;
}

type FlowMapping = { spans: Array<[number, number]>; closing: number };

function rootFlowMapping(source: string): FlowMapping | null {
  const opening = [...source].findIndex((character) => !/\s/.test(character));
  if (opening < 0 || source[opening] !== "{") return null;
  const spans: Array<[number, number]> = [];
  let entryStart = opening + 1;
  let quote: string | null = null;
  let escaped = false;
  let depth = 0;
  for (let index = opening; index < source.length; index += 1) {
    const character = source[index];
    if (quote === '"') {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
    } else if (quote === "'") {
      if (character === quote) {
        if (source[index + 1] === quote) index += 1;
        else quote = null;
      }
    } else if (character === '"' || character === "'") quote = character;
    else if (character === "[" || character === "{") depth += 1;
    else if (character === "]" || character === "}") {
      if (character === "}" && depth === 1) {
        spans.push([entryStart, index]);
        return { spans, closing: index };
      }
      depth = Math.max(0, depth - 1);
    } else if (character === "," && depth === 1) {
      spans.push([entryStart, index]);
      entryStart = index + 1;
    }
  }
  return null;
}

function countNewlines(source: string, end: number): number {
  return (source.slice(0, end).match(/\n/g) ?? []).length;
}

function flowMappingKeys(source: string, spans: Array<[number, number]>): MappingEntry[] {
  const keys: MappingEntry[] = [];
  for (const [start, end] of spans) {
    const entry = source.slice(start, end);
    let keyOffset = entry.length - entry.trimStart().length;
    let candidate = entry.trimStart();
    if (!candidate) continue;
    if (candidate.startsWith("?")) {
      const after = candidate.slice(1);
      keyOffset += 1 + after.length - after.trimStart().length;
      candidate = after.trimStart();
    }
    const line = 2 + countNewlines(source, start + keyOffset);
    if (!candidate) {
      keys.push([null, line]);
      continue;
    }
    const separator = mappingSeparator(candidate, true);
    keys.push([yamlScalar(separator === null ? candidate : candidate.slice(0, separator)), line]);
  }
  return keys;
}

function frontmatterMappingKeys(frontmatter: string[]): MappingEntry[] {
  const source = withoutYamlComments(frontmatter.join("\n"));
  const mapping = rootFlowMapping(source);
  if (mapping) return flowMappingKeys(source, mapping.spans);
  const keys: MappingEntry[] = [];
  for (const [index, line] of splitLines(source).entries()) {
    if (!line || /^\s/.test(line)) continue;
    let candidate = line.trimEnd();
    if (candidate.startsWith(":")) continue;
    const explicit = candidate.startsWith("?");
    if (explicit) candidate = candidate.slice(1).trimStart();
    const separator = mappingSeparator(candidate);
    if (separator === null && !explicit) continue;
    keys.push([yamlScalar(separator === null ? candidate : candidate.slice(0, separator)), index + 2]);
  }
  return keys;
}

function unsupportedRootMappingLine(frontmatter: string[]): number | null {
  const source = withoutYamlComments(frontmatter.join("\n"));
  for (const [index, line] of splitLines(source).entries()) {
    if (!line.trim()) continue;
    if (/^\s/.test(line) || line.startsWith("!") || line.startsWith("&")) return index + 2;
    return null;
  }
  return null;
}

function normalizedSelectionField(key: string): string {
  return key.replaceAll("-", "").replaceAll("_", "").toLowerCase();
}

function flowMappingItems(source: string, line: number): [NestedEntry[], number | null] {
  const mapping = rootFlowMapping(source);
  if (!mapping) return [[], null];
  const entries: NestedEntry[] = [];
  for (const [start, end] of mapping.spans) {
    const entry = source.slice(start, end);
    const keyOffset = entry.length - entry.trimStart().length;
    const candidate = entry.trimStart();
    const entryLine = line + countNewlines(source, start + keyOffset);
    const separator = mappingSeparator(candidate, true);
    if (separator === null || candidate.startsWith("?")) entries.push([null, null, entryLine]);
    else entries.push([yamlScalar(candidate.slice(0, separator)), yamlScalar(candidate.slice(separator + 1)), entryLine]);
  }
  return [entries, countNewlines(source, mapping.closing)];
}

function nestedMappingItems(frontmatter: string[], parentKey: string): NestedEntry[] {
  const source = withoutYamlComments(frontmatter.join("\n"));
  const root = rootFlowMapping(source);
  if (root) {
    for (const [start, end] of root.spans) {
      const entry = source.slice(start, end);
      const keyOffset = entry.length - entry.trimStart().length;
      const candidate = entry.trimStart();
      const separator = mappingSeparator(candidate, true);
      if (separator === null || yamlScalar(candidate.slice(0, separator)) !== parentKey) continue;
      return flowMappingItems(candidate.slice(separator + 1), 2 + countNewlines(source, start + keyOffset))[0];
    }
    return [];
  }
  const lines = splitLines(source);
  const entries: NestedEntry[] = [];
  let parentLine: number | null = null;
  let childIndent: number | null = null;
  let flowConsumedThrough = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (index <= flowConsumedThrough) continue;
    const line = lines[index];
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    let candidate = line.trimStart();
    const separator = mappingSeparator(candidate);
    const key = separator === null ? null : yamlScalar(candidate.slice(0, separator));
    if (indent === 0) {
      parentLine = key === parentKey ? index : null;
      childIndent = null;
      if (parentLine !== null && separator !== null) {
        const [flowEntries, consumed] = flowMappingItems([candidate.slice(separator + 1), ...lines.slice(index + 1)].join("\n"), index + 2);
        entries.push(...flowEntries);
        if (consumed !== null) flowConsumedThrough = index + consumed;
      }
      continue;
    }
    if (parentLine === null || index <= parentLine) continue;
    childIndent ??= indent;
    if (indent === childIndent) {
      const [flowEntries, consumed] = flowMappingItems([candidate, ...lines.slice(index + 1)].join("\n"), index + 2);
      if (consumed !== null) {
        entries.push(...flowEntries);
        flowConsumedThrough = index + consumed;
        continue;
      }
      if (separator === null || candidate.startsWith("?") || candidate.startsWith(":")) entries.push([null, null, index + 2]);
      else entries.push([key, yamlScalar(candidate.slice(separator + 1)), index + 2]);
    }
  }
  return entries;
}

function nestedMappingEntries(frontmatter: string[], parentKey: string, childKey: string): MappingEntry[] {
  return nestedMappingItems(frontmatter, parentKey).filter(([key]) => key === childKey).map(([, value, line]) => [value, line]);
}

function unsupportedMappingValueReferences(frontmatter: string[], parentKeys: ReadonlySet<string>): Array<[string, number]> {
  const source = withoutYamlComments(frontmatter.join("\n"));
  const references: Array<[string, number]> = [];
  const root = rootFlowMapping(source);
  if (root) {
    for (const [start, end] of root.spans) {
      const candidate = source.slice(start, end).trim();
      const separator = mappingSeparator(candidate, true);
      if (separator === null) continue;
      const key = yamlScalar(candidate.slice(0, separator));
      const value = candidate.slice(separator + 1).trim();
      if (key && parentKeys.has(key) && /^[&!*]/.test(value)) references.push([key, 2 + countNewlines(source, start)]);
    }
    return references;
  }
  const lines = splitLines(source);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || /^\s/.test(line)) continue;
    const candidate = line.trimEnd();
    const separator = mappingSeparator(candidate);
    if (separator === null) continue;
    const key = yamlScalar(candidate.slice(0, separator));
    if (!key || !parentKeys.has(key)) continue;
    let value = candidate.slice(separator + 1).trim();
    let valueLine = index + 2;
    if (!value) {
      for (let nested = index + 1; nested < lines.length; nested += 1) {
        if (!lines[nested].trim()) continue;
        if (!/^\s/.test(lines[nested])) break;
        value = lines[nested].trimStart();
        valueLine = nested + 2;
        break;
      }
    }
    if (/^[&!*]/.test(value)) references.push([key, valueLine]);
  }
  return references;
}

function intelligenceLevels(): Set<string> {
  const script = resolve(fileURLToPath(new URL(".", import.meta.url)), "quick_validate.ts");
  const ancestors: string[] = [];
  let current = dirname(script);
  while (true) {
    ancestors.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const versions = new Set(ancestors.map((ancestor) => basename(ancestor)).filter((name) => /^\d+\.\d+\.\d+$/.test(name)));
  const candidates: string[] = [];
  for (const ancestor of ancestors) {
    const direct = resolve(ancestor, INTELLIGENCE_MAPPING);
    if (existsSync(direct)) candidates.push(direct);
    for (const version of versions) {
      const versioned = resolve(ancestor, "essential", version, "skills/install-agents/references/intelligence-levels.json");
      if (existsSync(versioned)) candidates.push(versioned);
    }
  }
  const unique = [...new Set(candidates)];
  if (unique.length !== 1) throw new Error(`Expected exactly one Essential intelligence mapping beside the installed marketplace; found ${unique.length}.`);
  const mapping = JSON.parse(readFileSync(unique[0], "utf8")) as Record<string, { rank?: unknown }>;
  return new Set(Object.entries(mapping).filter(([, entry]) => entry.rank !== null && entry.rank !== undefined).map(([name]) => name));
}

function isLocalFileDestination(destination: string): boolean {
  if (!destination || ["url", "...", "…"].includes(destination)) return false;
  if (EXTERNAL_DESTINATION.test(destination) || ILLUSTRATIVE_DESTINATION.test(destination)) return false;
  const first = destination.split(/[\\/]/)[0];
  return isAbsolute(destination) || destination.startsWith("./") || destination.startsWith("../") || LOCAL_DIRECTORIES.has(first) || extname(destination) !== "";
}

function markdownDestinations(line: string): string[] {
  const destinations: string[] = [];
  LOCAL_LINK.lastIndex = 0;
  for (const match of line.matchAll(LOCAL_LINK)) destinations.push(match[1]);
  const definition = REFERENCE_DEFINITION.exec(line);
  if (definition) destinations.push(definition[1]);
  return [...new Set(destinations)];
}

export function validatePolicy(skill: string, options: { portable?: boolean } = {}): PolicyReport {
  const absoluteSkill = resolve(skill);
  const text = readFileSync(absoluteSkill, "utf8");
  const [frontmatter, body] = frontmatterAndBody(text);
  const errors: PolicyIssue[] = [];
  const warnings: PolicyIssue[] = [];
  const mappingKeys = frontmatterMappingKeys(frontmatter);
  let unsupportedRootLine = unsupportedRootMappingLine(frontmatter) ?? mappingKeys.find(([key]) => key === "<<")?.[1] ?? null;
  if (unsupportedRootLine !== null) errors.push(issue("Shared skill frontmatter must use a plain, unwrapped root mapping without merge keys.", unsupportedRootLine));
  else {
    for (const [key, line] of mappingKeys) {
      if (key === null) errors.push(issue("Shared skill frontmatter uses an unsupported complex root mapping key; use a plain or quoted scalar key.", line));
      else if (key === "allowed-tools") errors.push(issue("Shared skills must not declare allowed-tools: Codex does not support this field; shared skills inherit runtime capabilities.", line));
      else if (MODEL_SELECTION_FIELDS.has(normalizedSelectionField(key))) errors.push(issue("Shared skills must not declare model or effort fields; use requirements.intelligence.", line));
    }
  }
  if (errors.length === 0) {
    for (const mapping of ["metadata", "requirements"]) {
      const lines = nestedMappingItems(frontmatter, mapping).filter(([key]) => key === null).map(([, , line]) => line);
      if (lines.length > 0) {
        errors.push(issue(`Shared skill ${mapping} must use direct scalar keys; aliases and complex keys are unsupported.`, lines[0]));
        break;
      }
    }
  }
  if (errors.length === 0) {
    for (const mapping of ["metadata", "requirements"]) {
      const merges = nestedMappingEntries(frontmatter, mapping, "<<");
      if (merges.length > 0) {
        errors.push(issue(`Shared skill ${mapping} must not use YAML merge keys; use a plain mapping.`, merges[0][1]));
        break;
      }
    }
  }
  if (errors.length === 0) {
    const references = unsupportedMappingValueReferences(frontmatter, new Set(["metadata", "requirements"]));
    if (references.length > 0) errors.push(issue(`Shared skill ${references[0][0]} must not use YAML node properties or aliases; use a plain mapping.`, references[0][1]));
  }
  if (errors.length === 0) {
    const legacy = nestedMappingEntries(frontmatter, "metadata", "intelligence");
    if (legacy.length > 0) errors.push(issue("Shared skills must not declare metadata.intelligence; use requirements.intelligence.", legacy[0][1]));
  }
  if (errors.length === 0) {
    const entries = nestedMappingEntries(frontmatter, "requirements", "intelligence");
    if (entries.length === 0) errors.push(issue("Shared skills must declare exactly one requirements.intelligence."));
    else if (entries.length > 1) errors.push(issue("Shared skills must declare exactly one requirements.intelligence.", entries[1][1]));
    else if (entries[0][0] === "inherit") errors.push(issue("Shared skills must declare a concrete requirements.intelligence; inherit is agent-only.", entries[0][1]));
    else if (entries[0][0] === null || !intelligenceLevels().has(entries[0][0])) errors.push(issue("Shared skill requirements.intelligence must name a concrete level from Essential's intelligence mapping.", entries[0][1]));
  }
  if (body.length > MAX_BODY_LINES) errors.push(issue(`Skill body exceeds ${MAX_BODY_LINES} lines (${body.length}).`));
  const description = scalarValue(frontmatter, "description");
  if (description) {
    const count = description.trim().split(/\s+/).length;
    if (count < MIN_DESCRIPTION_WORDS || count > MAX_DESCRIPTION_WORDS) warnings.push(issue(`Description has ${count} words; repository target is ${MIN_DESCRIPTION_WORDS}-${MAX_DESCRIPTION_WORDS}.`));
  }
  for (const [index, line] of splitLines(text).entries()) if (PLACEHOLDERS.some((pattern) => pattern.test(line))) errors.push(issue("Placeholder text remains in the skill.", index + 1));
  const markdownFiles = [absoluteSkill];
  const referencesRoot = resolve(dirname(absoluteSkill), "references");
  if (options.portable && existsSync(referencesRoot) && statSync(referencesRoot).isDirectory()) markdownFiles.push(...walkFiles(referencesRoot).filter((path) => extname(path) === ".md"));
  for (const markdownFile of markdownFiles) {
    const source = relative(dirname(absoluteSkill), markdownFile);
    for (const [index, line] of splitLines(readFileSync(markdownFile, "utf8")).entries()) {
      for (const rawDestination of markdownDestinations(line)) {
        const destination = normalizeMarkdownDestination(rawDestination);
        if (!isLocalFileDestination(destination)) continue;
        const reference = resolve(dirname(absoluteSkill), destination);
        if (options.portable && (relative(dirname(absoluteSkill), reference).startsWith("..") || isAbsolute(relative(dirname(absoluteSkill), reference)))) {
          errors.push(issue(`Reference escapes skill root in ${source}: ${rawDestination}`, index + 1));
          continue;
        }
        if (!existsSync(reference)) {
          const location = markdownFile === absoluteSkill ? "" : ` in ${source}`;
          errors.push(issue(`Unresolved local reference${location}: ${rawDestination}`, index + 1));
        }
      }
    }
  }
  return { path: absoluteSkill, errors, warnings };
}

export function claudeTargets(target: string): string[] {
  const absolute = resolve(target);
  if (existsSync(resolve(absolute, ".claude-plugin/plugin.json"))) return [absolute];
  if (existsSync(resolve(absolute, ".claude-plugin/marketplace.json"))) return [absolute];
  const plugins = existsSync(resolve(absolute, "plugins")) ? resolve(absolute, "plugins") : absolute;
  if (existsSync(plugins) && statSync(plugins).isDirectory()) {
    const matches = [...new Bun.Glob("*/.claude-plugin/plugin.json").scanSync({ cwd: plugins, absolute: true, onlyFiles: true })];
    const roots = matches.map((path) => dirname(dirname(path))).sort();
    if (roots.length > 0) return roots;
  }
  let parent = dirname(absolute);
  while (parent !== dirname(parent)) {
    if (existsSync(resolve(parent, ".claude-plugin/plugin.json"))) return [parent];
    parent = dirname(parent);
  }
  return [];
}

export function runClaudeValidation(targets: string[]): [number, Array<Record<string, unknown>>] {
  const results: Array<Record<string, unknown>> = [];
  let failed = false;
  for (const target of targets) {
    const command = ["claude", "plugin", "validate", "--strict", target];
    try {
      const completed = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe", timeout: CLAUDE_TIMEOUT_MILLISECONDS });
      const output = `${completed.stdout.toString()}${completed.stderr.toString()}`.trim();
      if (completed.exitCode === null) {
        failed = true;
        results.push({ path: target, status: "fail", output: `Claude validator timed out after 30 seconds: ${command.join(" ")}` });
      } else if (completed.exitCode !== 0) {
        failed = true;
        results.push({ path: target, status: "fail", output: output || `Unable to launch Claude validator: ${completed.stderr.toString().trim()}` });
      } else results.push({ path: target, status: "pass", output });
    } catch (error) {
      failed = true;
      results.push({ path: target, status: "fail", output: `Unable to launch Claude validator: ${(error as Error).message}` });
    }
  }
  return [failed ? 1 : 0, results];
}

function usageError(message: string): never {
  process.stderr.write(`usage: quick_validate.ts [-h] [--policy-only] [--portable] target\nquick_validate.ts: error: ${message}\n`);
  process.exit(2);
}

export function run(argv: string[] = process.argv.slice(2)): number {
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write("usage: quick_validate.ts [-h] [--policy-only] [--portable] target\n\nRun official Claude validation and repository skill-policy checks.\n");
    return 0;
  }
  const policyOnly = argv.includes("--policy-only");
  const portable = argv.includes("--portable");
  const positionals = argv.filter((argument) => !["--policy-only", "--portable"].includes(argument));
  if (positionals.length !== 1) usageError(positionals.length === 0 ? "the following arguments are required: target" : "unrecognized arguments");
  const target = resolve(positionals[0]);
  const skills = discoverSkills(target);
  if (skills.length === 0) usageError(`No SKILL.md files found under ${target}`);
  const [claudeStatus, claudeValidation] = policyOnly ? [0, []] as [number, Array<Record<string, unknown>>] : runClaudeValidation(claudeTargets(target));
  const policies = skills.map((skill) => validatePolicy(skill, { portable }));
  const policyErrors = policies.reduce((total, report) => total + report.errors.length, 0);
  const report = {
    status: claudeStatus || policyErrors ? "fail" : "pass",
    claude_validation: claudeValidation,
    policy_validation: policies,
    summary: {
      skills: skills.length,
      policy_errors: policyErrors,
      policy_warnings: policies.reduce((total, policy) => total + policy.warnings.length, 0),
    },
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return claudeStatus || policyErrors ? 1 : 0;
}

if (import.meta.main) process.exit(run());
