import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AgentTemplateError,
  leadAgentDirectionAlias,
  leadAgentDirectionPath,
  loadAgentSources,
  stitchAgentDefinition,
  stitchCodexAgentDefinition,
} from "./stitch_agent.ts";

type PluginRecord = Record<string, unknown>;
export interface AgentTemplate {
  readonly owner: string;
  readonly name: string;
  readonly path: string;
}
const cacheComponent = /^[A-Za-z0-9._-]+$/;
const cacheVersionComponent = /^[A-Za-z0-9._+-]+$/;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));

function inside(root: string, target: string): boolean {
  const path = relative(root, target);
  return (
    path === "" ||
    (path !== ".." && !path.startsWith(`..${sep}`) && !path.startsWith(sep))
  );
}
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
function resolveExistingAncestors(path: string): string {
  const missing: string[] = [];
  let existing = path;
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) return resolve(path);
    missing.unshift(basename(existing));
    existing = parent;
  }
  return resolve(realpathSync(existing), ...missing);
}
function display(value: unknown): string {
  if (typeof value === "string") return `'${value}'`;
  if (value === undefined) return "None";
  return String(value);
}
function pluginTemplates(owner: string, pluginRoot: string): AgentTemplate[] {
  const templatesRoot = resolve(pluginRoot, "agents");
  if (!isDirectory(templatesRoot)) return [];
  const resolvedRoot = realpathSync(pluginRoot);
  return readdirSync(templatesRoot, { withFileTypes: true })
    .filter((entry) => isDirectory(resolve(templatesRoot, entry.name)))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const path = resolve(templatesRoot, entry.name);
      if (!inside(resolvedRoot, realpathSync(path)))
        throw new AgentTemplateError(
          `template symlink or path escapes plugin root: ${path}`,
        );
      return { owner, name: entry.name, path };
    });
}

export function readPluginRecords(harness: "claude" | "codex"): PluginRecord[] {
  const command =
    harness === "claude"
      ? ["claude", "plugin", "list", "--json"]
      : ["codex", "plugin", "list", "--json"];
  let completed: ReturnType<typeof Bun.spawnSync>;
  try {
    completed = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" });
  } catch (error) {
    throw new AgentTemplateError(
      `cannot list installed ${harness === "claude" ? "" : "codex "}plugins: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (completed.exitCode !== 0) {
    const detail =
      completed.stderr.toString().trim() || completed.stdout.toString().trim();
    throw new AgentTemplateError(
      `cannot list installed ${harness === "claude" ? "" : "codex "}plugins: ${detail}`,
    );
  }
  let payload: unknown;
  try {
    payload = JSON.parse(completed.stdout.toString());
  } catch (error) {
    throw new AgentTemplateError(
      `invalid JSON from ${harness} plugin list: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (harness === "claude") {
    if (!Array.isArray(payload))
      throw new AgentTemplateError(
        "claude plugin list --json did not return a list",
      );
    return payload.filter(
      (record): record is PluginRecord =>
        record !== null && typeof record === "object" && !Array.isArray(record),
    );
  }
  const installed =
    payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as PluginRecord).installed
      : undefined;
  if (!Array.isArray(installed))
    throw new AgentTemplateError(
      "codex plugin list --json did not return an installed list",
    );
  return installed
    .filter(
      (record): record is PluginRecord =>
        record !== null && typeof record === "object" && !Array.isArray(record),
    )
    .map((record) => ({
      id: record.pluginId,
      enabled: record.enabled,
      version: record.version,
      lastUpdated: record.lastUpdated,
    }));
}

function lastUpdated(record: PluginRecord): string {
  return typeof record.lastUpdated === "string" ? record.lastUpdated : "";
}
export function codexCachePluginRoot(
  essentialRoot: string,
  record: PluginRecord,
): string {
  const pluginId = record.id;
  const version = record.version;
  if (typeof pluginId !== "string" || pluginId.split("@").length !== 2)
    throw new AgentTemplateError(
      `invalid installed Codex plugin id: ${display(pluginId)}`,
    );
  const [pluginName, marketplace] = pluginId.split("@") as [string, string];
  if (
    typeof version !== "string" ||
    [pluginName, marketplace, version].some((part) =>
      new Set([".", ".."]).has(part),
    ) ||
    !cacheComponent.test(pluginName) ||
    !cacheComponent.test(marketplace) ||
    !cacheVersionComponent.test(version)
  )
    throw new AgentTemplateError(
      `invalid installed Codex plugin cache coordinates: ${display(pluginId)} version ${display(version)}`,
    );
  const cacheRoot = resolve(essentialRoot, "../../..");
  const candidate = resolve(cacheRoot, marketplace, pluginName, version);
  if (!inside(realpathSync(cacheRoot), resolveExistingAncestors(candidate)))
    throw new AgentTemplateError(
      `installed Codex plugin cache path escapes cache root: ${candidate}`,
    );
  if (!isDirectory(candidate))
    throw new AgentTemplateError(
      `installed Codex plugin cache root is absent: ${candidate}`,
    );
  return candidate;
}

export function installedPluginRoots(
  essentialRoot: string,
  records: readonly PluginRecord[],
  harness: "claude" | "codex",
  includeMarketplaces: readonly string[] = [],
): Array<readonly [string, string]> {
  const resolvedEssential = realpathSync(essentialRoot);
  let essentialRecords: readonly PluginRecord[];
  if (harness === "codex") {
    if (
      basename(dirname(essentialRoot)) !== "essential" ||
      basename(resolve(essentialRoot, "../../..")) !== "cache"
    )
      throw new AgentTemplateError(
        `Codex skill is not loaded from an installed plugin cache: ${essentialRoot}`,
      );
    const marketplace = basename(resolve(essentialRoot, "../.."));
    essentialRecords = records.filter(
      (record) =>
        record.enabled === true &&
        typeof record.id === "string" &&
        record.id.split("@").length === 2 &&
        record.id.split("@")[0] === "essential" &&
        record.id.split("@")[1] === marketplace &&
        realpathSync(codexCachePluginRoot(essentialRoot, record)) ===
          resolvedEssential,
    );
  } else
    essentialRecords = records.filter(
      (record) =>
        typeof record.installPath === "string" &&
        realpathSync(record.installPath) === resolvedEssential &&
        typeof record.id === "string" &&
        record.id.split("@").length === 2 &&
        record.id.split("@")[0] === "essential",
    );
  if (essentialRecords.length === 0)
    throw new AgentTemplateError(
      `essential plugin is absent from ${harness} plugin list: ${essentialRoot}`,
    );
  if (essentialRecords.length !== 1)
    throw new AgentTemplateError(
      `multiple essential plugin records use install path: ${essentialRoot}`,
    );
  const essentialId = String(essentialRecords[0]!.id);
  const marketplace = essentialId.split("@").at(-1) ?? "";
  if (marketplace === "")
    throw new AgentTemplateError(
      `installed plugin id has no marketplace: ${essentialId}`,
    );
  const marketplaces = new Set([marketplace]);
  for (const included of includeMarketplaces) {
    if (new Set([".", ".."]).has(included) || !cacheComponent.test(included))
      throw new AgentTemplateError(
        `invalid included marketplace name: ${display(included)}`,
      );
    marketplaces.add(included);
  }
  const best = new Map<string, PluginRecord>();
  for (const record of records) {
    const id = record.id;
    if (
      record.enabled !== true ||
      typeof id !== "string" ||
      !id.includes("@") ||
      (harness !== "codex" && typeof record.installPath !== "string") ||
      !marketplaces.has(id.split("@").at(-1) ?? "")
    )
      continue;
    const current = best.get(id);
    if (current === undefined || lastUpdated(record) > lastUpdated(current))
      best.set(id, record);
  }
  return [...best]
    .map(
      ([id, record]) =>
        [
          id.split("@")[0]!,
          harness === "codex"
            ? codexCachePluginRoot(essentialRoot, record)
            : String(record.installPath),
        ] as const,
    )
    .sort(([left], [right]) => left.localeCompare(right));
}

export function discoverAgentTemplates(
  essentialRoot: string,
  options: {
    readonly pluginRecords?: readonly PluginRecord[];
    readonly harness?: "claude" | "codex";
    readonly includeMarketplaces?: readonly string[];
  } = {},
): AgentTemplate[] {
  const harness = options.harness ?? "claude";
  const parent = dirname(essentialRoot);
  const roots: Array<readonly [string, string]> =
    basename(parent) === "plugins"
      ? readdirSync(parent, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((entry) => [entry.name, resolve(parent, entry.name)] as const)
      : installedPluginRoots(
          essentialRoot,
          options.pluginRecords ?? readPluginRecords(harness),
          harness,
          options.includeMarketplaces,
        );
  return roots.flatMap(([owner, root]) => pluginTemplates(owner, root));
}

function preflight(
  templates: readonly AgentTemplate[],
  harness: "claude" | "codex",
  options: {
    readonly essentialRoot: string;
    readonly referenceRoot: string;
    readonly allowLegacy: boolean;
  },
): Array<readonly [string, string]> {
  if (templates.length === 0)
    throw new AgentTemplateError("no agent templates discovered");
  const seen = new Map<string, AgentTemplate>();
  return templates.map((template) => {
    const sources = loadAgentSources(template.path, {
      allowLegacy: options.allowLegacy,
    });
    const name = String(sources.metadata.name);
    const previous = seen.get(name);
    if (previous !== undefined)
      throw new AgentTemplateError(
        `duplicate agent name ${display(name)}: ${previous.path} and ${template.path}`,
      );
    seen.set(name, template);
    const stitchOptions = {
      essentialRoot: options.essentialRoot,
      referenceRoot: options.referenceRoot,
      allowLegacy: options.allowLegacy,
    };
    return [
      name,
      harness === "claude"
        ? stitchAgentDefinition(template.path, stitchOptions)
        : stitchCodexAgentDefinition(template.path, stitchOptions),
    ] as const;
  });
}

function replaceFile(source: string, target: string): void {
  mkdirSync(dirname(target), { recursive: true });
  const temporary = join(
    dirname(target),
    `.${basename(target)}.${randomUUID()}.tmp`,
  );
  try {
    copyFileSync(source, temporary);
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function installAgents(
  essentialRoot: string,
  destination: string,
  options: {
    readonly pluginRecords?: readonly PluginRecord[];
    readonly harness?: "claude" | "codex";
    readonly includeMarketplaces?: readonly string[];
    readonly stdout?: (text: string) => void;
  } = {},
): number {
  const root = realpathSync(essentialRoot);
  const harness = options.harness ?? "claude";
  const templates = discoverAgentTemplates(root, {
    pluginRecords: options.pluginRecords,
    harness,
    includeMarketplaces: options.includeMarketplaces,
  });
  const installsDirection = templates.some((template) =>
    readFileSync(resolve(template.path, "base.md"), "utf8").includes(
      leadAgentDirectionAlias,
    ),
  );
  const sourceDirection = resolve(root, leadAgentDirectionPath);
  if (installsDirection && !existsSync(sourceDirection))
    throw new AgentTemplateError(
      `missing Essential lead direction: ${sourceDirection}`,
    );
  const installedEssential = resolve(destination, ".essential");
  const staged = preflight(templates, harness, {
    essentialRoot: root,
    referenceRoot: installedEssential,
    allowLegacy: basename(dirname(root)) !== "plugins",
  });
  const suffix = harness === "claude" ? ".md" : ".toml";
  const stage = mkdtempSync(join(tmpdir(), `${harness}-agents-`));
  const write =
    options.stdout ?? ((text: string) => process.stdout.write(text));
  try {
    const stagedDirection = resolve(stage, leadAgentDirectionPath);
    if (installsDirection) {
      mkdirSync(dirname(stagedDirection), { recursive: true });
      copyFileSync(sourceDirection, stagedDirection);
    }
    for (const [name, content] of staged)
      writeFileSync(resolve(stage, `${name}${suffix}`), content, "utf8");
    mkdirSync(destination, { recursive: true });
    if (installsDirection) {
      const installedDirection = resolve(
        installedEssential,
        leadAgentDirectionPath,
      );
      replaceFile(stagedDirection, installedDirection);
      write(`installed: ${installedDirection}\n`);
    }
    for (const [name] of staged) {
      const target = resolve(destination, `${name}${suffix}`);
      replaceFile(resolve(stage, basename(target)), target);
      write(`installed: ${target}\n`);
    }
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  write(`done — installed ${staged.length} agent(s) into ${destination}\n`);
  return staged.length;
}

const program = basename(fileURLToPath(import.meta.url));
const usage = `usage: ${program} [-h] [--plugin-root PLUGIN_ROOT]\n${" ".repeat(program.length + 7)}[--harness {claude,codex}]\n${" ".repeat(program.length + 7)}[--destination DESTINATION]\n${" ".repeat(program.length + 7)}[--include-marketplace INCLUDE_MARKETPLACE]`;
const help = `${usage}\n\nDiscover, preflight, stitch, and install enabled plugin agent templates.\n\noptions:\n  -h, --help            show this help message and exit\n  --plugin-root PLUGIN_ROOT\n  --harness {claude,codex}\n  --destination DESTINATION\n  --include-marketplace INCLUDE_MARKETPLACE\n                        also discover enabled agent templates from this\n                        trusted marketplace\n`;
function cliError(message: string): never {
  process.stderr.write(`${usage}\n${program}: error: ${message}\n`);
  process.exit(2);
}
export function main(argv = process.argv.slice(2)): number {
  let pluginRoot = resolve(scriptDirectory, "../../..");
  let harness: "claude" | "codex" = "claude";
  let destination: string | undefined;
  const includeMarketplaces: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    const value = (): string => {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("-"))
        cliError(`argument ${argument}: expected one argument`);
      index += 1;
      return next;
    };
    if (argument === "-h" || argument === "--help") {
      process.stdout.write(help);
      return 0;
    }
    if (argument === "--plugin-root") pluginRoot = value();
    else if (argument.startsWith("--plugin-root="))
      pluginRoot = argument.slice("--plugin-root=".length);
    else if (argument === "--harness") {
      const selected = value();
      if (selected !== "claude" && selected !== "codex")
        cliError(
          `argument --harness: invalid choice: '${selected}' (choose from 'claude', 'codex')`,
        );
      harness = selected;
    } else if (argument.startsWith("--harness=")) {
      const selected = argument.slice("--harness=".length);
      if (selected !== "claude" && selected !== "codex")
        cliError(
          `argument --harness: invalid choice: '${selected}' (choose from 'claude', 'codex')`,
        );
      harness = selected;
    } else if (argument === "--destination") destination = value();
    else if (argument.startsWith("--destination="))
      destination = argument.slice("--destination=".length);
    else if (argument === "--include-marketplace")
      includeMarketplaces.push(value());
    else if (argument.startsWith("--include-marketplace="))
      includeMarketplaces.push(argument.slice("--include-marketplace=".length));
    else cliError(`unrecognized arguments: ${argument}`);
  }
  destination ??= resolve(
    harness === "codex"
      ? (process.env.CODEX_HOME ?? resolve(homedir(), ".codex"))
      : resolve(homedir(), ".claude"),
    "agents",
  );
  try {
    installAgents(pluginRoot, destination, { harness, includeMarketplaces });
    return 0;
  } catch (error) {
    if (error instanceof AgentTemplateError) cliError(error.message);
    throw error;
  }
}

if (import.meta.main) process.exit(main());
