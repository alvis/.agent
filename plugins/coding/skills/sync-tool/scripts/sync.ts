#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  OS_DARWIN,
  OS_UNKNOWN,
  detectOs,
  getVersion,
  hasExecutable,
  run as runCommand,
  statusLine,
  versionAtLeast,
} from "./lib.ts";

interface Options {
  readonly check: boolean;
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly only?: string;
}
export interface ToolEntry {
  readonly alwaysRunInstaller?: boolean;
  readonly executable?: string;
  readonly installer: string;
  readonly macosOnly?: boolean;
  readonly minVersion?: string;
  readonly name: string;
  readonly versionArguments?: readonly string[];
}
type ToolResult = readonly [tool: string, status: Status, action: string];
type Status =
  "already_current" | "failed" | "installed" | "skipped" | "updated";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const REGISTRY: readonly ToolEntry[] = [
  { name: "brew", installer: "brew.sh", minVersion: "4.0.0", macosOnly: true },
  { name: "jj", installer: "jj.sh", minVersion: "0.44.0" },
  { name: "gh", installer: "gh.sh", minVersion: "2.0.0" },
  { name: "fallow", installer: "fallow.sh", minVersion: "2.0.0" },
  {
    name: "python",
    installer: "python.sh",
    executable: "python3",
    alwaysRunInstaller: true,
  },
];

const HELP = `usage: sync.ts [-h] [--only ONLY] [--check] [--dry-run] [--force]

Install or update registered coding CLI tools.

options:
  -h, --help   show this help message and exit
  --only ONLY  CSV of registered tool names to sync (default: all).
  --check      Status-only mode; non-zero exit if anything is missing or
               outdated.
  --dry-run    Print planned commands without executing.
  --force      Reinstall/upgrade even if at minimum version.
`;

const NEGATIVE_NUMBER = /^-\p{Nd}+$|^-\p{Nd}*\.\p{Nd}+$/u;

function parseArguments(arguments_: readonly string[]): Options | number {
  let only: string | undefined;
  let check = false;
  let dryRun = false;
  let force = false;
  const unknown: string[] = [];
  let optionsEnded = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (!optionsEnded && argument === "--") {
      optionsEnded = true;
      unknown.push(argument);
      continue;
    }
    const [option, explicitValue] = argument.split(/=(.*)/s, 2);
    if (!optionsEnded && option === "--" && explicitValue !== undefined) {
      console.error(
        "usage: sync.ts [-h] [--only ONLY] [--check] [--dry-run] [--force]",
      );
      console.error(
        `sync.ts: error: ambiguous option: ${argument} could match --help, --only, --check, --dry-run, --force`,
      );
      return 2;
    }
    const longOption =
      !optionsEnded && option !== "--" && option?.startsWith("--")
        ? ["--help", "--only", "--check", "--dry-run", "--force"].find(
            (candidate) => candidate.startsWith(option),
          )
        : undefined;
    if (
      (!optionsEnded && argument === "-h") ||
      (longOption === "--help" && explicitValue === undefined)
    ) {
      process.stdout.write(HELP);
      return 0;
    }
    if (longOption === "--help" && explicitValue !== undefined) {
      console.error(
        "usage: sync.ts [-h] [--only ONLY] [--check] [--dry-run] [--force]",
      );
      console.error(
        `sync.ts: error: argument -h/--help: ignored explicit argument '${explicitValue}'`,
      );
      return 2;
    }
    if (
      explicitValue !== undefined &&
      (longOption === "--check" ||
        longOption === "--dry-run" ||
        longOption === "--force")
    ) {
      console.error(
        "usage: sync.ts [-h] [--only ONLY] [--check] [--dry-run] [--force]",
      );
      console.error(
        `sync.ts: error: argument ${longOption}: ignored explicit argument '${explicitValue}'`,
      );
      return 2;
    }
    if (longOption === "--check" && explicitValue === undefined) check = true;
    else if (longOption === "--dry-run" && explicitValue === undefined)
      dryRun = true;
    else if (longOption === "--force" && explicitValue === undefined)
      force = true;
    else if (longOption === "--only") {
      only =
        explicitValue === undefined ? arguments_[(index += 1)] : explicitValue;
      if (
        only === undefined ||
        (explicitValue === undefined &&
          only.startsWith("-") &&
          !NEGATIVE_NUMBER.test(only))
      ) {
        console.error(
          "usage: sync.ts [-h] [--only ONLY] [--check] [--dry-run] [--force]",
        );
        console.error("sync.ts: error: argument --only: expected one argument");
        return 2;
      }
    } else {
      unknown.push(argument);
    }
  }
  if (unknown.length > 0) {
    console.error(
      "usage: sync.ts [-h] [--only ONLY] [--check] [--dry-run] [--force]",
    );
    console.error(
      `sync.ts: error: unrecognized arguments: ${unknown.join(" ")}`,
    );
    return 2;
  }
  return { check, dryRun, force, ...(only === undefined ? {} : { only }) };
}

export function resolveToolList(onlyCsv?: string): readonly ToolEntry[] {
  if (!onlyCsv) return REGISTRY;
  const requested = new Set(
    onlyCsv
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );
  const registered = new Set(REGISTRY.map(({ name }) => name));
  const unknown = [...requested].filter((name) => !registered.has(name)).sort();
  if (unknown.length > 0)
    throw new Error(
      `sync-tool: unknown tool name(s): ${unknown.join(", ")}. Registered: ${[...registered].join(", ")}`,
    );
  return REGISTRY.filter(({ name }) => requested.has(name));
}

function executableName(entry: ToolEntry): string {
  return entry.executable ?? entry.name;
}

export function checkTool(entry: ToolEntry): readonly [Status, string] {
  if (entry.macosOnly && detectOs() !== OS_DARWIN)
    return ["skipped", `${entry.name} not applicable on this OS`];
  const executable = executableName(entry);
  if (!hasExecutable(executable)) return ["failed", `${executable} missing`];
  const version = getVersion(executable, entry.versionArguments);
  if (entry.minVersion === undefined)
    return ["already_current", `${executable} present`];
  if (version !== undefined && versionAtLeast(version, entry.minVersion))
    return ["already_current", `version >= ${entry.minVersion}`];
  return [
    "failed",
    `${executable} below ${entry.minVersion} (got ${version ?? "unknown"})`,
  ];
}

export function runInstaller(
  entry: ToolEntry,
  options: Pick<Options, "dryRun" | "force">,
): readonly [Status, string] {
  if (entry.macosOnly && detectOs() !== OS_DARWIN)
    return ["skipped", `${entry.name} not applicable on this OS`];
  const installer = join(SCRIPT_DIRECTORY, "installers", entry.installer);
  if (!existsSync(installer))
    return ["failed", `installer not found: ${installer}`];
  const executable = executableName(entry);
  const hadBefore = hasExecutable(executable);
  const versionBefore = hadBefore
    ? getVersion(executable, entry.versionArguments)
    : undefined;
  const atMinimumBefore =
    entry.minVersion === undefined
      ? hadBefore
      : versionBefore !== undefined &&
        versionAtLeast(versionBefore, entry.minVersion);
  if (
    hadBefore &&
    atMinimumBefore &&
    !options.force &&
    !entry.alwaysRunInstaller
  )
    return ["already_current", "noop"];
  const environment = {
    ...(options.dryRun ? { DRY_RUN: "1" } : {}),
    ...(options.force ? { FORCE: "1" } : {}),
  };
  const result = runCommand(["bash", installer], {
    capture: false,
    env: environment,
  });
  if (!result.ok)
    return ["failed", `${entry.installer} exited ${result.returnCode}`];
  if (options.dryRun) return ["skipped", "dry-run"];
  if (!hasExecutable(executable))
    return ["failed", `${executable} still missing after installer`];
  const versionAfter = getVersion(executable, entry.versionArguments);
  if (
    entry.minVersion !== undefined &&
    versionAfter !== undefined &&
    !versionAtLeast(versionAfter, entry.minVersion)
  )
    return ["failed", `version ${versionAfter} below ${entry.minVersion}`];
  return hadBefore
    ? ["updated", entry.installer]
    : ["installed", entry.installer];
}

function emitSummary(results: readonly ToolResult[]): void {
  const statuses: readonly Status[] = [
    "installed",
    "updated",
    "already_current",
    "skipped",
    "failed",
  ];
  const parts = statuses
    .map(
      (status) =>
        [
          results.filter(([, result]) => result === status).length,
          status,
        ] as const,
    )
    .filter(([count]) => count > 0)
    .map(([count, status]) => `${count} ${status}`);
  console.log(
    `summary: ${results.length} tools — ${parts.join(", ") || "0 processed"}`,
  );
}

export function run(arguments_: readonly string[]): number {
  const options = parseArguments(arguments_);
  if (typeof options === "number") return options;
  if (detectOs() === OS_UNKNOWN) {
    const uname = spawnSync("uname", ["-s"], {
      encoding: "utf8",
    }).stdout.trim();
    console.error(`sync-tool: unrecognized OS '${uname}'`);
    return 2;
  }
  let tools: readonly ToolEntry[];
  try {
    tools = resolveToolList(options.only);
  } catch (error) {
    console.error((error as Error).message);
    return 2;
  }
  const results: ToolResult[] = tools.map((entry) => {
    const [status, action] = options.check
      ? checkTool(entry)
      : runInstaller(entry, options);
    console.log(statusLine(entry.name, status, action));
    return [entry.name, status, action];
  });
  emitSummary(results);
  return results.some(([, status]) =>
    options.check
      ? !["already_current", "skipped"].includes(status)
      : status === "failed",
  )
    ? 1
    : 0;
}

if (import.meta.main) process.exit(run(process.argv.slice(2)));
