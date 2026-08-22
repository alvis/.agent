#!/usr/bin/env bun

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

const PACKAGE_LOCKFILES = new Set([
  "Cargo.lock",
  "Gemfile.lock",
  "Pipfile.lock",
  "bun.lock",
  "bun.lockb",
  "composer.lock",
  "go.sum",
  "npm-shrinkwrap.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "uv.lock",
  "yarn.lock",
]);

const RENAME_CANDIDATE_LIMIT = 1_000;
const GIT_ARGUMENT_BATCH_SIZE = 128;
const SIZE_THRESHOLDS = resolve(
  import.meta.dir,
  "../assets/size-thresholds.json",
);

interface ZoneLimit {
  name: string;
  maxFilesChanged: number;
  maxAuthoredNetLoc: number;
  requiredReviewers: number;
}

interface GitResult {
  stdout: Uint8Array;
  stderr: Uint8Array;
  exitCode: number;
}

class GitCommandError extends Error {
  constructor(readonly result: GitResult) {
    super(
      new TextDecoder().decode(result.stderr).trim() || "git command failed",
    );
  }
}

function runGit(
  repo: string,
  args: string[],
  options: {
    input?: Uint8Array;
    environment?: Record<string, string>;
    check?: boolean;
  } = {},
): GitResult {
  const result = Bun.spawnSync(["git", "-C", repo, ...args], {
    stdin: options.input,
    stdout: "pipe",
    stderr: "pipe",
    env: options.environment,
  });
  const normalized = {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
  if ((options.check ?? true) && result.exitCode !== 0)
    throw new GitCommandError(normalized);
  return normalized;
}

function text(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function splitBytes(bytes: Uint8Array, delimiter: number): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let start = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== delimiter) continue;
    parts.push(bytes.subarray(start, index));
    start = index + 1;
  }
  parts.push(bytes.subarray(start));
  return parts;
}

function surrogateDecode(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index]!;
    if (first < 0x80) {
      result += String.fromCodePoint(first);
      index += 1;
      continue;
    }
    const length =
      first >= 0xc2 && first <= 0xdf
        ? 2
        : first >= 0xe0 && first <= 0xef
          ? 3
          : first >= 0xf0 && first <= 0xf4
            ? 4
            : 0;
    const sequence = bytes.subarray(index, index + length);
    const validContinuation =
      sequence.length === length &&
      [...sequence.subarray(1)].every((byte) => byte >= 0x80 && byte <= 0xbf);
    const validBoundary =
      length !== 3 ||
      ((first !== 0xe0 || sequence[1]! >= 0xa0) &&
        (first !== 0xed || sequence[1]! <= 0x9f));
    const validFourByteBoundary =
      length !== 4 ||
      ((first !== 0xf0 || sequence[1]! >= 0x90) &&
        (first !== 0xf4 || sequence[1]! <= 0x8f));
    if (
      length > 0 &&
      validContinuation &&
      validBoundary &&
      validFourByteBoundary
    ) {
      result += new TextDecoder("utf-8", { fatal: true }).decode(sequence);
      index += length;
    } else {
      result += String.fromCharCode(0xdc00 + first);
      index += 1;
    }
  }
  return result;
}

function surrogateEncode(value: string): Uint8Array {
  const bytes: number[] = [];
  let ordinary = "";
  const flush = () => {
    if (!ordinary) return;
    bytes.push(...new TextEncoder().encode(ordinary));
    ordinary = "";
  };
  for (const character of value) {
    const codepoint = character.codePointAt(0)!;
    if (codepoint >= 0xdc80 && codepoint <= 0xdcff) {
      flush();
      bytes.push(codepoint - 0xdc00);
    } else ordinary += character;
  }
  flush();
  return Uint8Array.from(bytes);
}

function comparePythonStrings(left: string, right: string): number {
  const leftPoints = [...left].map((character) => character.codePointAt(0)!);
  const rightPoints = [...right].map((character) => character.codePointAt(0)!);
  for (
    let index = 0;
    index < Math.min(leftPoints.length, rightPoints.length);
    index += 1
  ) {
    if (leftPoints[index] !== rightPoints[index])
      return leftPoints[index]! - rightPoints[index]!;
  }
  return leftPoints.length - rightPoints.length;
}

function hermeticEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  const unsafeNames = new Set([
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_ATTR_NOSYSTEM",
    "GIT_COMMON_DIR",
    "GIT_CONFIG_COUNT",
    "GIT_CONFIG_GLOBAL",
    "GIT_CONFIG_NOSYSTEM",
    "GIT_CONFIG_PARAMETERS",
    "GIT_CONFIG_SYSTEM",
    "GIT_DEFAULT_HASH",
    "GIT_DIFF_OPTS",
    "GIT_DIR",
    "GIT_EXTERNAL_DIFF",
    "GIT_GLOB_PATHSPECS",
    "GIT_ICASE_PATHSPECS",
    "GIT_INDEX_FILE",
    "GIT_LITERAL_PATHSPECS",
    "GIT_NOGLOB_PATHSPECS",
    "GIT_OBJECT_DIRECTORY",
    "GIT_TEMPLATE_DIR",
    "GIT_WORK_TREE",
  ]);
  for (const name of Object.keys(environment)) {
    if (
      unsafeNames.has(name) ||
      name.startsWith("GIT_CONFIG_KEY_") ||
      name.startsWith("GIT_CONFIG_VALUE_")
    ) {
      delete environment[name];
    }
  }
  return {
    ...environment,
    GIT_ATTR_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    LC_ALL: "C",
  };
}

function resolveCommit(
  repo: string,
  revision: string,
  environment: Record<string, string>,
): string {
  return text(
    runGit(repo, ["rev-parse", "--verify", `${revision}^{commit}`], {
      environment,
    }).stdout,
  ).trim();
}

function resolveBase(
  repo: string,
  revision: string,
  environment: Record<string, string>,
): string {
  const objectId = text(
    runGit(repo, ["rev-parse", "--verify", `${revision}^{object}`], {
      environment,
    }).stdout,
  ).trim();
  const objectType = text(
    runGit(repo, ["cat-file", "-t", objectId], { environment }).stdout,
  ).trim();
  if (objectType === "commit") return objectId;
  const emptyTree = text(
    runGit(repo, ["hash-object", "-t", "tree", "--stdin"], {
      environment,
      input: new Uint8Array(),
    }).stdout,
  ).trim();
  if (objectType === "tree" && objectId === emptyTree) return objectId;
  return resolveCommit(repo, revision, environment);
}

function nulPaths(output: Uint8Array): string[] {
  return splitBytes(output, 0)
    .filter((part) => part.length > 0)
    .map(surrogateDecode);
}

function changedFiles(
  repo: string,
  base: string,
  head: string,
  environment: Record<string, string>,
): string[] {
  return nulPaths(
    runGit(
      repo,
      [
        "diff",
        "--name-only",
        "-z",
        "--no-ext-diff",
        "--no-textconv",
        "--diff-algorithm=myers",
        "--find-renames=50%",
        `-l${RENAME_CANDIDATE_LIMIT}`,
        "--ignore-submodules=none",
        base,
        head,
        "--",
      ],
      { environment },
    ).stdout,
  ).sort(comparePythonStrings);
}

function generatedAttributes(
  repo: string,
  revision: string,
  paths: Set<string>,
  environment: Record<string, string>,
): Set<string> {
  if (paths.size === 0) return new Set();
  const encodedPaths = [...paths]
    .sort(comparePythonStrings)
    .map(surrogateEncode);
  const pathInput = Uint8Array.from(
    encodedPaths.flatMap((path) => [...path, 0]),
  );
  const temporary = mkdtempSync(join(tmpdir(), "pr-size-index-"));
  try {
    const indexEnvironment = {
      ...environment,
      GIT_INDEX_FILE: join(temporary, "index"),
    };
    runGit(repo, ["read-tree", revision], { environment: indexEnvironment });
    const fields = splitBytes(
      runGit(
        repo,
        ["check-attr", "-z", "--cached", "--stdin", "linguist-generated"],
        { input: pathInput, environment: indexEnvironment },
      ).stdout,
      0,
    );
    const generated = new Set<string>();
    for (let index = 0; index < fields.length - 2; index += 3) {
      const value = text(fields[index + 2]!);
      if (value === "set" || value === "true")
        generated.add(surrogateDecode(fields[index]!));
    }
    return generated;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function generatedPaths(
  repo: string,
  base: string,
  head: string,
  paths: Set<string>,
  environment: Record<string, string>,
): Set<string> {
  const generated = new Set(
    [...paths].filter((path) => PACKAGE_LOCKFILES.has(basename(path))),
  );
  for (const path of generatedAttributes(repo, base, paths, environment))
    generated.add(path);
  for (const path of generatedAttributes(repo, head, paths, environment))
    generated.add(path);
  return generated;
}

function numstat(
  repo: string,
  base: string,
  head: string,
  environment: Record<string, string>,
): Array<[string, string, string]> {
  const output = runGit(
    repo,
    [
      "diff",
      "--numstat",
      "--no-renames",
      "-z",
      "--no-ext-diff",
      "--no-textconv",
      "--diff-algorithm=myers",
      "--ignore-submodules=none",
      base,
      head,
      "--",
    ],
    { environment },
  ).stdout;
  return splitBytes(output, 0)
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const firstTab = entry.indexOf(9);
      const secondTab = entry.indexOf(9, firstTab + 1);
      return [
        text(entry.subarray(0, firstTab)),
        text(entry.subarray(firstTab + 1, secondTab)),
        surrogateDecode(entry.subarray(secondTab + 1)),
      ];
    });
}

function diffObjects(
  repo: string,
  base: string,
  head: string,
  environment: Record<string, string>,
): [Set<string>, Set<string>] {
  const fields = splitBytes(
    runGit(
      repo,
      [
        "diff",
        "--raw",
        "-z",
        "--abbrev=64",
        "--full-index",
        "--no-renames",
        "--no-ext-diff",
        "--no-textconv",
        "--diff-algorithm=myers",
        "--ignore-submodules=none",
        base,
        head,
        "--",
      ],
      { environment },
    ).stdout,
    0,
  );
  const objectIds = new Set<string>();
  const paths = new Set<string>();
  for (let index = 0; index < fields.length - 1; index += 2) {
    const headerBytes = fields[index]!;
    if (headerBytes.length === 0) continue;
    const header = text(headerBytes);
    paths.add(surrogateDecode(fields[index + 1]!));
    const [oldMode, newMode, oldId, newId] = header.slice(1).split(" ", 5);
    for (const [mode, objectId] of [
      [oldMode, oldId],
      [newMode, newId],
    ]) {
      if (mode !== "160000" && objectId && /[^0]/.test(objectId))
        objectIds.add(objectId);
    }
  }
  return [paths, objectIds];
}

function attributePaths(paths: Set<string>): Set<string> {
  const attributes = new Set([".gitattributes"]);
  for (const path of paths) {
    let parent = dirname(path);
    while (parent !== ".") {
      attributes.add(`${parent}/.gitattributes`);
      parent = dirname(parent);
    }
  }
  return attributes;
}

function blobIdsAtPaths(
  repo: string,
  revision: string,
  paths: Set<string>,
  environment: Record<string, string>,
): Set<string> {
  const objectIds = new Set<string>();
  const orderedPaths = [...paths].sort(comparePythonStrings);
  const literalEnvironment = { ...environment, GIT_LITERAL_PATHSPECS: "1" };
  if (orderedPaths.some((path) => /[\udc80-\udcff]/.test(path))) {
    const output = runGit(
      repo,
      ["ls-tree", "-r", "-z", "--full-tree", revision],
      { environment: literalEnvironment },
    ).stdout;
    for (const entry of splitBytes(output, 0).filter(
      (part) => part.length > 0,
    )) {
      const separator = entry.indexOf(9);
      const path = surrogateDecode(entry.subarray(separator + 1));
      if (!paths.has(path)) continue;
      const [, objectType, objectId] = text(entry.subarray(0, separator)).split(
        " ",
        3,
      );
      if (objectType === "blob") objectIds.add(objectId!);
    }
    return objectIds;
  }
  for (
    let start = 0;
    start < orderedPaths.length;
    start += GIT_ARGUMENT_BATCH_SIZE
  ) {
    const output = runGit(
      repo,
      [
        "ls-tree",
        "-z",
        "--full-tree",
        revision,
        "--",
        ...orderedPaths.slice(start, start + GIT_ARGUMENT_BATCH_SIZE),
      ],
      { environment: literalEnvironment },
    ).stdout;
    for (const entry of splitBytes(output, 0).filter(
      (part) => part.length > 0,
    )) {
      const separator = entry.indexOf(9);
      const [, objectType, objectId] = text(entry.subarray(0, separator)).split(
        " ",
        3,
      );
      if (objectType === "blob") objectIds.add(objectId!);
    }
  }
  return objectIds;
}

function hydrateObjects(
  repo: string,
  objectIds: Set<string>,
  environment: Record<string, string>,
): void {
  if (objectIds.size === 0) return;
  const orderedIds = [...objectIds].sort();
  const result = runGit(repo, ["cat-file", "--batch-check"], {
    input: new TextEncoder().encode(`${orderedIds.join("\n")}\n`),
    environment: { ...environment, GIT_NO_LAZY_FETCH: "1" },
  });
  const missingIds = text(result.stdout)
    .split(/\r?\n/)
    .filter((line) => line.endsWith(" missing"))
    .map((line) => line.split(" ", 1)[0]!);
  if (missingIds.length === 0) return;
  const remoteResult = runGit(
    repo,
    ["config", "--local", "--get-regexp", String.raw`^remote\..*\.promisor$`],
    { environment },
  );
  const remotes: string[] = [];
  for (const line of text(remoteResult.stdout).split(/\r?\n/).filter(Boolean)) {
    const separator = line.lastIndexOf(" ");
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    const remote = key.replace(/^remote\./, "").replace(/\.promisor$/, "");
    if (
      value.toLowerCase() === "true" &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(remote)
    )
      remotes.push(remote);
  }
  if (remotes.length === 0)
    throw new Error("missing objects require a configured promisor remote");
  for (
    let start = 0;
    start < missingIds.length;
    start += GIT_ARGUMENT_BATCH_SIZE
  ) {
    const batch = missingIds.slice(start, start + GIT_ARGUMENT_BATCH_SIZE);
    const failures: string[] = [];
    let fetched = false;
    for (const remote of remotes) {
      const fetchResult = runGit(
        repo,
        [
          "fetch",
          "--quiet",
          "--no-tags",
          "--no-write-fetch-head",
          remote,
          ...batch,
        ],
        { environment, check: false },
      );
      if (fetchResult.exitCode === 0) {
        fetched = true;
        break;
      }
      const failure = text(fetchResult.stderr).trim();
      if (failure) failures.push(failure);
    }
    if (!fetched)
      throw new Error(
        failures.join("; ") ||
          "promisor remotes could not provide required objects",
      );
  }
}

function parseZoneLimit(data: unknown): ZoneLimit {
  const expected = [
    "max_authored_net_loc",
    "max_files_changed",
    "name",
    "required_reviewers",
  ];
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    Object.keys(data).sort().join() !== expected.join()
  ) {
    throw new Error(`invalid PR-size zone shape: ${SIZE_THRESHOLDS}`);
  }
  const zone = data as Record<string, unknown>;
  if (typeof zone.name !== "string")
    throw new TypeError(
      `PR-size zone name must be a string: ${SIZE_THRESHOLDS}`,
    );
  for (const field of ["max_files_changed", "max_authored_net_loc"] as const) {
    const value = zone[field];
    if (!Number.isInteger(value))
      throw new TypeError(
        `PR-size zone '${zone.name}' ${field} must be a positive integer: ${SIZE_THRESHOLDS}`,
      );
    if ((value as number) <= 0)
      throw new Error(
        `PR-size zone '${zone.name}' ${field} must be positive: ${SIZE_THRESHOLDS}`,
      );
  }
  if (!Number.isInteger(zone.required_reviewers))
    throw new TypeError(
      `PR-size zone '${zone.name}' required_reviewers must be an integer: ${SIZE_THRESHOLDS}`,
    );
  if ((zone.required_reviewers as number) < 0)
    throw new Error(
      `PR-size zone '${zone.name}' required_reviewers cannot be negative: ${SIZE_THRESHOLDS}`,
    );
  return {
    name: zone.name,
    maxFilesChanged: zone.max_files_changed as number,
    maxAuthoredNetLoc: zone.max_authored_net_loc as number,
    requiredReviewers: zone.required_reviewers as number,
  };
}

function loadZoneLimits(): ZoneLimit[] {
  const data: unknown = JSON.parse(readFileSync(SIZE_THRESHOLDS, "utf8"));
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new TypeError(
      `PR-size thresholds must be an object: ${SIZE_THRESHOLDS}`,
    );
  const source = data as Record<string, unknown>;
  if (!Number.isInteger(source.schema_version))
    throw new TypeError(
      `PR-size threshold schema version must be an integer: ${SIZE_THRESHOLDS}`,
    );
  if (source.schema_version !== 1)
    throw new Error(`invalid PR-size threshold schema: ${SIZE_THRESHOLDS}`);
  const metrics = source.metrics;
  if (
    !metrics ||
    typeof metrics !== "object" ||
    Array.isArray(metrics) ||
    Object.keys(metrics).sort().join() !==
      ["authored_net_loc", "files_changed", "required_reviewers"].join()
  ) {
    throw new Error(`invalid PR-size metrics: ${SIZE_THRESHOLDS}`);
  }
  for (const metric of Object.values(metrics)) {
    if (
      !metric ||
      typeof metric !== "object" ||
      Array.isArray(metric) ||
      Object.keys(metric).sort().join() !== "reason,unit" ||
      Object.values(metric).some((value) => typeof value !== "string" || !value)
    ) {
      throw new Error(`invalid PR-size metric metadata: ${SIZE_THRESHOLDS}`);
    }
  }
  if (!Array.isArray(source.zones))
    throw new TypeError(`invalid PR-size zones: ${SIZE_THRESHOLDS}`);
  const limits = source.zones.map(parseZoneLimit);
  if (limits.map((limit) => limit.name).join() !== "green,yellow,red")
    throw new Error(
      `PR-size zones must be ordered green, yellow, red: ${SIZE_THRESHOLDS}`,
    );
  for (let index = 1; index < limits.length; index += 1) {
    const earlier = limits[index - 1]!;
    const later = limits[index]!;
    if (
      earlier.maxFilesChanged >= later.maxFilesChanged ||
      earlier.maxAuthoredNetLoc >= later.maxAuthoredNetLoc ||
      earlier.requiredReviewers > later.requiredReviewers
    ) {
      throw new Error(
        `PR-size zone maxima must increase and required reviewers must not decrease (${earlier.name} -> ${later.name}): ${SIZE_THRESHOLDS}`,
      );
    }
  }
  return limits;
}

function zoneFor(
  filesChanged: number,
  netLoc: number,
  limits: ZoneLimit[],
): string {
  return (
    limits.find(
      (limit) =>
        filesChanged <= limit.maxFilesChanged &&
        netLoc <= limit.maxAuthoredNetLoc,
    )?.name ?? "black"
  );
}

function withIsolatedRepository<T>(
  repo: string,
  environment: Record<string, string>,
  action: (
    isolatedRepo: string,
    isolatedEnvironment: Record<string, string>,
  ) => T,
): T {
  let commonDirectory = text(
    runGit(repo, ["rev-parse", "--git-common-dir"], { environment }).stdout,
  ).trim();
  if (!isAbsolute(commonDirectory))
    commonDirectory = resolve(repo, commonDirectory);
  const objectFormat = text(
    runGit(repo, ["rev-parse", "--show-object-format"], { environment }).stdout,
  ).trim();
  const temporaryRoot = mkdtempSync(join(tmpdir(), "pr-size-"));
  const bareRepo = join(temporaryRoot, "repository.git");
  const isolatedEnvironment = {
    ...environment,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: join(commonDirectory, "objects"),
    XDG_CONFIG_HOME: join(temporaryRoot, "xdg"),
  };
  try {
    const result = Bun.spawnSync(
      [
        "git",
        "init",
        "--bare",
        "--quiet",
        `--object-format=${objectFormat}`,
        bareRepo,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
        env: isolatedEnvironment,
      },
    );
    if (result.exitCode !== 0)
      throw new GitCommandError({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      });
    return action(bareRepo, isolatedEnvironment);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

export function classify(
  repo: string,
  baseRevision: string,
  headRevision: string,
): Record<string, unknown> {
  const environment = hermeticEnvironment();
  const base = resolveBase(repo, baseRevision, environment);
  const head = resolveCommit(repo, headRevision, environment);
  const [sourcePaths, sourceObjectIds] = diffObjects(
    repo,
    base,
    head,
    environment,
  );
  const attributes = attributePaths(sourcePaths);
  const attributeObjectIds = blobIdsAtPaths(
    repo,
    base,
    attributes,
    environment,
  );
  for (const objectId of blobIdsAtPaths(repo, head, attributes, environment))
    attributeObjectIds.add(objectId);
  hydrateObjects(
    repo,
    new Set([...sourceObjectIds, ...attributeObjectIds]),
    environment,
  );
  generatedAttributes(repo, base, sourcePaths, environment);
  generatedAttributes(repo, head, sourcePaths, environment);

  const { files, stats, generatedFiles } = withIsolatedRepository(
    repo,
    environment,
    (isolatedRepo, isolatedEnvironment) => {
      const stats = numstat(isolatedRepo, base, head, isolatedEnvironment);
      return {
        files: changedFiles(isolatedRepo, base, head, isolatedEnvironment),
        stats,
        generatedFiles: generatedPaths(
          isolatedRepo,
          base,
          head,
          new Set(stats.map((entry) => entry[2])),
          isolatedEnvironment,
        ),
      };
    },
  );
  let additions = 0;
  let deletions = 0;
  const binaryFiles = new Set<string>();
  for (const [added, deleted, path] of stats) {
    if (generatedFiles.has(path)) continue;
    if (added === "-" || deleted === "-") binaryFiles.add(path);
    else {
      additions += Number.parseInt(added, 10);
      deletions += Number.parseInt(deleted, 10);
    }
  }
  const netLoc = Math.abs(additions - deletions);
  const limits = loadZoneLimits();
  const zone = zoneFor(files.length, netLoc, limits);
  const requiredReviewers =
    limits.find((limit) => limit.name === zone)?.requiredReviewers ??
    limits.at(-1)!.requiredReviewers;
  return {
    authored_additions: additions,
    authored_deletions: deletions,
    base_oid: base,
    binary_files: [...binaryFiles].sort(comparePythonStrings),
    files_changed: files.length,
    generated_files: [...generatedFiles].sort(comparePythonStrings),
    head_oid: head,
    net_loc: netLoc,
    required_reviewers: requiredReviewers,
    zone,
  };
}

function pythonJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(pythonJson).join(", ")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${pythonString(key)}: ${pythonJson(item)}`)
      .join(", ")}}`;
  return typeof value === "string"
    ? pythonString(value)
    : JSON.stringify(value);
}

function pythonString(value: string): string {
  return JSON.stringify(value).replace(
    /[^\x00-\x7f]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

const USAGE =
  "usage: classify-pr-size.ts [-h] [--repo REPO] --base BASE --head HEAD";
const CLASSIFIER_OPTIONS = ["--help", "--repo", "--base", "--head"];
const ARGPARSE_NEGATIVE_NUMBER = /^-\p{Nd}+$|^-\p{Nd}*\.\p{Nd}+$/u;

function isSeparatedArgumentValue(value: string): boolean {
  return (
    !value.startsWith("-") ||
    value === "-" ||
    ARGPARSE_NEGATIVE_NUMBER.test(value)
  );
}

function classifierArgumentError(message: string): null {
  process.stderr.write(`${USAGE}\nclassify-pr-size.ts: error: ${message}\n`);
  process.exitCode = 2;
  return null;
}

function resolveClassifierOption(rawArgument: string): string | null {
  const name = rawArgument.split("=", 1)[0]!;
  const candidates = CLASSIFIER_OPTIONS.filter((option) =>
    option.startsWith(name),
  );
  if (candidates.includes(name)) return name;
  if (candidates.length > 1) {
    classifierArgumentError(
      `ambiguous option: ${rawArgument} could match ${candidates.join(", ")}`,
    );
    return null;
  }
  return candidates[0] ?? rawArgument;
}

function parseArguments(
  argv: string[],
): { repo: string; base: string; head: string } | null {
  let repo = process.cwd();
  let base: string | undefined;
  let head: string | undefined;
  const unknown: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const rawArgument = argv[index]!;
    const equals = rawArgument.indexOf("=");
    if (rawArgument === "-h" || rawArgument.startsWith("-h=")) {
      if (rawArgument !== "-h")
        return classifierArgumentError(
          `argument -h/--help: ignored explicit argument '${rawArgument.slice(3)}'`,
        );
      process.stdout.write(
        `${USAGE}\n\nclassify a Git diff using fixed PR-size zones\n\noptions:\n  -h, --help   show this help message and exit\n  --repo REPO\n  --base BASE\n  --head HEAD\n`,
      );
      return null;
    }
    const argument = rawArgument.startsWith("--")
      ? resolveClassifierOption(rawArgument)
      : rawArgument;
    if (argument === null) return null;
    if (argument === "--help") {
      if (equals >= 0)
        return classifierArgumentError(
          `argument -h/--help: ignored explicit argument '${rawArgument.slice(equals + 1)}'`,
        );
      process.stdout.write(
        `${USAGE}\n\nclassify a Git diff using fixed PR-size zones\n\noptions:\n  -h, --help   show this help message and exit\n  --repo REPO\n  --base BASE\n  --head HEAD\n`,
      );
      return null;
    }
    if (["--repo", "--base", "--head"].includes(argument)) {
      const inlineValue =
        equals < 0 ? undefined : rawArgument.slice(equals + 1);
      const value = inlineValue ?? argv[index + 1];
      if (
        value === undefined ||
        (inlineValue === undefined && !isSeparatedArgumentValue(value))
      ) {
        return classifierArgumentError(
          `argument ${argument}: expected one argument`,
        );
      }
      if (argument === "--repo") repo = value;
      if (argument === "--base") base = value;
      if (argument === "--head") head = value;
      if (inlineValue === undefined) index += 1;
    } else unknown.push(rawArgument);
  }
  const missing = [
    ["--base", base],
    ["--head", head],
  ]
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);
  if (missing.length) {
    process.stderr.write(
      `${USAGE}\nclassify-pr-size.ts: error: the following arguments are required: ${missing.join(", ")}\n`,
    );
    process.exitCode = 2;
    return null;
  }
  if (unknown.length) {
    process.stderr.write(
      `${USAGE}\nclassify-pr-size.ts: error: unrecognized arguments: ${unknown.join(" ")}\n`,
    );
    process.exitCode = 2;
    return null;
  }
  return { repo, base: base!, head: head! };
}

export function main(argv = process.argv.slice(2)): number {
  const args = parseArguments(argv);
  if (!args) return process.exitCode ?? 0;
  try {
    process.stdout.write(
      `${pythonJson(classify(resolve(args.repo), args.base, args.head))}\n`,
    );
    return 0;
  } catch (error) {
    const caughtError = error as Error;
    process.stderr.write(`${caughtError.message}\n`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main();
