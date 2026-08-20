#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BUILTIN_PLUGIN = "built-in";
export interface Invocation { canonicalId: string; plugin: string; agent: string; timestamp?: Date | null; sessionId: string; sourceFile: string }
export interface AgentTally { canonicalId: string; plugin: string; count: number; earliest: Date | null; latest: Date | null; sessions: Set<string> }
export interface AgentDefinition { plugin: string; agent: string; path: string }
export interface Stats { filesScanned: number; sessions: Set<string>; totalInvocations: number; rangeFrom: Date | null; rangeTo: Date | null; tallies: Map<string, AgentTally>; definedAgents: Map<string, AgentDefinition> }

function walkFiles(root: string, suffix: string): string[] {
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];
  const found: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) found.push(...walkFiles(path, suffix));
    else if (extname(path) === suffix) found.push(path);
  }
  return found;
}

export function discoverPluginAgents(pluginsDirectory: string): Map<string, AgentDefinition> {
  const definitions = new Map<string, AgentDefinition>();
  for (const path of walkFiles(pluginsDirectory, ".json").filter((path) => path.endsWith("/frontmatter/meta.json")).sort()) {
    try {
      const metadata = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      if (typeof metadata.name !== "string" || metadata.name.length === 0) continue;
      const plugin = path.slice(pluginsDirectory.length + 1).split("/")[0] ?? "";
      definitions.set(`${plugin}:${metadata.name}`, { plugin, agent: metadata.name, path });
    } catch {}
  }
  return definitions;
}

export function parseTimestamp(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const timestamp = new Date(raw);
  return Number.isNaN(timestamp.valueOf()) ? null : timestamp;
}

export function splitCanonical(canonicalId: string): [string, string] {
  const separator = canonicalId.indexOf(":");
  return separator < 0 ? [BUILTIN_PLUGIN, canonicalId] : [canonicalId.slice(0, separator), canonicalId.slice(separator + 1)];
}

export function scanTranscripts(projectsDirectory: string): Invocation[] {
  const invocations: Invocation[] = [];
  for (const path of walkFiles(projectsDirectory, ".jsonl")) {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line) as Record<string, unknown>;
        const message = record.message;
        if (typeof message !== "object" || message === null) continue;
        const messageRecord = message as Record<string, unknown>;
        if (!Array.isArray(messageRecord.content)) continue;
        const timestamp = parseTimestamp(record.timestamp) ?? parseTimestamp(messageRecord.timestamp);
        for (const entry of messageRecord.content) {
          if (typeof entry !== "object" || entry === null) continue;
          const tool = entry as Record<string, unknown>;
          if (tool.type !== "tool_use" || (tool.name !== "Agent" && tool.name !== "Task")) continue;
          if (typeof tool.input !== "object" || tool.input === null) continue;
          const subagent = (tool.input as Record<string, unknown>).subagent_type;
          if (typeof subagent !== "string" || subagent.length === 0) continue;
          const [plugin, agent] = splitCanonical(subagent);
          invocations.push({ canonicalId: subagent, plugin, agent, timestamp, sessionId: basename(path, ".jsonl"), sourceFile: path });
        }
      } catch {}
    }
  }
  return invocations;
}

export function tally(invocations: Iterable<Invocation>, definedAgents: Map<string, AgentDefinition>, filesScanned: number): Stats {
  const idsByName = new Map<string, string[]>();
  for (const [canonicalId, definition] of definedAgents) idsByName.set(definition.agent, [...(idsByName.get(definition.agent) ?? []), canonicalId]);
  const uniqueIdsByName = new Map([...idsByName].filter(([, ids]) => ids.length === 1).map(([name, ids]) => [name, ids[0]!]));
  const tallies = new Map<string, AgentTally>();
  const sessions = new Set<string>();
  let totalInvocations = 0;
  let rangeFrom: Date | null = null;
  let rangeTo: Date | null = null;
  for (const invocation of invocations) {
    let canonicalId = invocation.canonicalId;
    let plugin = invocation.plugin;
    if (plugin === BUILTIN_PLUGIN && uniqueIdsByName.has(invocation.agent)) {
      canonicalId = uniqueIdsByName.get(invocation.agent)!;
      plugin = definedAgents.get(canonicalId)!.plugin;
    }
    totalInvocations += 1;
    sessions.add(invocation.sessionId);
    const bucket = tallies.get(canonicalId) ?? { canonicalId, plugin, count: 0, earliest: null, latest: null, sessions: new Set<string>() };
    bucket.count += 1;
    bucket.sessions.add(invocation.sessionId);
    if (invocation.timestamp) {
      if (!bucket.earliest || invocation.timestamp < bucket.earliest) bucket.earliest = invocation.timestamp;
      if (!bucket.latest || invocation.timestamp > bucket.latest) bucket.latest = invocation.timestamp;
      if (!rangeFrom || invocation.timestamp < rangeFrom) rangeFrom = invocation.timestamp;
      if (!rangeTo || invocation.timestamp > rangeTo) rangeTo = invocation.timestamp;
    }
    tallies.set(canonicalId, bucket);
  }
  return { filesScanned, sessions, totalInvocations, rangeFrom, rangeTo, tallies, definedAgents };
}

export function sortedTop(tallies: Map<string, AgentTally>, topCount: number): AgentTally[] {
  return [...tallies.values()].sort((left, right) => right.count - left.count || left.canonicalId.localeCompare(right.canonicalId)).slice(0, topCount);
}
export function perPlugin(tallies: Map<string, AgentTally>, total: number): Array<[string, number, number]> {
  const counts = new Map<string, number>();
  for (const bucket of tallies.values()) counts.set(bucket.plugin, (counts.get(bucket.plugin) ?? 0) + bucket.count);
  return [...counts].map(([plugin, count]): [string, number, number] => [plugin, count, total ? count / total : 0]).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}
export function lowUsagePluginAgents(stats: Stats, threshold: number): Array<[string, number]> {
  return [...stats.definedAgents.keys()].map((id): [string, number] => [id, stats.tallies.get(id)?.count ?? 0]).filter(([, count]) => count <= threshold).sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]));
}
export function builtinTable(tallies: Map<string, AgentTally>): AgentTally[] { return [...tallies.values()].filter((bucket) => bucket.plugin === BUILTIN_PLUGIN).sort((left, right) => right.count - left.count || left.canonicalId.localeCompare(right.canonicalId)); }
export function formatDate(timestamp: Date | null): string { return timestamp ? timestamp.toISOString().slice(0, 10) : "-"; }
export function formatIso(timestamp: Date | null): string { return timestamp ? timestamp.toISOString().replace("Z", "+00:00") : "-"; }
function pad(value: string | number, width: number, side: "left" | "right" = "left"): string { const text = String(value); return side === "left" ? text.padStart(width) : text.padEnd(width); }

export function formatHuman(stats: Stats, topCount: number, lowUsageThreshold: number): string {
  const lines = ["Agent usage analysis", "=".repeat(60), `Files scanned:      ${stats.filesScanned}`, `Unique sessions:    ${stats.sessions.size}`, `Total invocations:  ${stats.totalInvocations}`, `Date range:         ${formatIso(stats.rangeFrom)} -> ${formatIso(stats.rangeTo)}`, "", `Top ${topCount} agents (by invocation count)`, "-".repeat(60), `${pad("#", 3)}  ${pad("agent", 48, "right")} ${pad("count", 6)}  ${pad("share", 7)}  ${pad("last used", 10, "right")}`];
  sortedTop(stats.tallies, topCount).forEach((bucket, index) => lines.push(`${pad(index + 1, 3)}  ${pad(bucket.canonicalId, 48, "right")} ${pad(bucket.count, 6)}  ${pad(`${(stats.totalInvocations ? bucket.count / stats.totalInvocations * 100 : 0).toFixed(2)}%`, 7)}  ${pad(formatDate(bucket.latest), 10, "right")}`));
  lines.push("", "Per-plugin totals", "-".repeat(60), `${pad("plugin", 24, "right")} ${pad("count", 8)}  ${pad("share", 7)}`);
  for (const [plugin, count, share] of perPlugin(stats.tallies, stats.totalInvocations)) lines.push(`${pad(plugin, 24, "right")} ${pad(count, 8)}  ${pad(`${(share * 100).toFixed(2)}%`, 7)}`);
  const lowUsage = lowUsagePluginAgents(stats, lowUsageThreshold);
  lines.push("", `Low-usage plugin agents (count <= ${lowUsageThreshold}) (${lowUsage.length})`, "-".repeat(60));
  if (lowUsage.length) { lines.push(`${pad("agent", 48, "right")} ${pad("count", 6)}  ${pad("share", 7)}`); for (const [id, count] of lowUsage) lines.push(`${pad(id, 48, "right")} ${pad(count, 6)}  ${pad(`${(stats.totalInvocations ? count / stats.totalInvocations * 100 : 0).toFixed(2)}%`, 7)}`); } else lines.push("  (none)");
  const builtins = builtinTable(stats.tallies);
  lines.push("", `Built-in (non-plugin) agents (${builtins.length})`, "-".repeat(60), `${pad("agent", 32, "right")} ${pad("count", 8)}`);
  for (const bucket of builtins) lines.push(`${pad(bucket.canonicalId, 32, "right")} ${pad(bucket.count, 8)}`);
  return `${lines.join("\n")}\n`;
}

export function formatJson(stats: Stats, topCount: number, lowUsageThreshold: number): string {
  const total = stats.totalInvocations;
  return JSON.stringify({ scanned: { files: stats.filesScanned, sessions: stats.sessions.size, invocations: total, from: stats.rangeFrom ? formatIso(stats.rangeFrom) : null, to: stats.rangeTo ? formatIso(stats.rangeTo) : null, low_usage_threshold: lowUsageThreshold }, top: sortedTop(stats.tallies, topCount).map((bucket, index) => ({ rank: index + 1, id: bucket.canonicalId, count: bucket.count, share: Number((total ? bucket.count / total : 0).toFixed(6)), last_used: bucket.latest ? formatDate(bucket.latest) : null })), per_plugin: perPlugin(stats.tallies, total).map(([plugin, count, share]) => ({ plugin, count, share: Number(share.toFixed(6)) })), low_usage: lowUsagePluginAgents(stats, lowUsageThreshold).map(([id, count]) => ({ id, count, share: Number((total ? count / total : 0).toFixed(6)) })), builtin: builtinTable(stats.tallies).map((bucket) => ({ id: bucket.canonicalId, count: bucket.count })) }, null, 2);
}

function expandHome(path: string): string { return path === "~" || path.startsWith("~/") ? join(process.env.HOME ?? "", path.slice(2)) : path; }
export function main(args = Bun.argv.slice(2)): number {
  let topCount = 15; let projectsDirectory = "~/.claude/projects"; let pluginsDirectory = join(dirname(dirname(fileURLToPath(import.meta.url))), "plugins"); let isJson = false; let threshold = 10;
  const valueOptions = ["--top", "--projects", "--plugins", "--show-unused-agents"]; const invalidValue = (option: string, value: string): number => { process.stderr.write(`analyze_agent_usage.ts: error: argument ${option}: invalid value: '${value}'\n`); return 2; };
  for (let index = 0; index < args.length; index += 1) { const arg = args[index]!; const separator = arg.indexOf("="); const name = separator === -1 ? arg : arg.slice(0, separator); if (separator === -1 && arg === "--json") { isJson = true; continue; } if (!valueOptions.includes(name)) { process.stderr.write(`analyze_agent_usage.ts: error: unrecognized arguments: ${arg}\n`); return 2; } const raw = separator === -1 ? args[index + 1] : arg.slice(separator + 1); if (raw === undefined || raw === "") { process.stderr.write(`analyze_agent_usage.ts: error: argument ${name}: expected one value\n`); return 2; } if ((name === "--top" || name === "--show-unused-agents") && !Number.isInteger(Number(raw))) return invalidValue(name, raw); index += separator === -1 ? 1 : 0; if (name === "--top") topCount = Number(raw); else if (name === "--projects") projectsDirectory = raw; else if (name === "--plugins") pluginsDirectory = raw; else threshold = Number(raw); }
  projectsDirectory = resolve(expandHome(projectsDirectory)); pluginsDirectory = resolve(expandHome(pluginsDirectory));
  const invocations = scanTranscripts(projectsDirectory); const stats = tally(invocations, discoverPluginAgents(pluginsDirectory), walkFiles(projectsDirectory, ".jsonl").length);
  process.stdout.write(isJson ? `${formatJson(stats, topCount, threshold)}\n` : formatHuman(stats, topCount, threshold)); return 0;
}
if (import.meta.main) process.exit(main());
