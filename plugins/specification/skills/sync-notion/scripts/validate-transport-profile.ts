#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { accessSync, constants, lstatSync, readFileSync } from "node:fs";
import { isAbsolute, normalize, parse, resolve, sep } from "node:path";

const HEX64 = /^[0-9a-f]{64}$/;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const FLAG = /^--?[A-Za-z0-9][A-Za-z0-9._-]*$/;
const VERSION = /^[0-9A-Za-z][0-9A-Za-z._+-]*$/;
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const CAPABILITY_NAMES = [
  "recursive_pull",
  "search",
  "create",
  "push",
  "conditional_update",
  "conditional_create",
] as const;
type CapabilityName = (typeof CAPABILITY_NAMES)[number];

const OUTPUT_CONTRACTS: Readonly<Record<CapabilityName, string>> = {
  recursive_pull: "notion-page-tree-json-v1",
  search: "notion-search-json-v1",
  create: "notion-created-page-json-v1",
  push: "notion-page-write-json-v1",
  conditional_update: "notion-page-write-json-v1",
  conditional_create: "notion-created-page-json-v1",
};
const SECRET_TEXT = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~-]+|(?:secret|token|password|api[_-]?key|cookie|authorization)\s*[:=])/i;
const PLACEHOLDER_TEXT = /(?:\breplace[-_ ]with(?:[-_ ]|\b)|\bplaceholder\b|<[^>]+>)/i;

const HELP_TEXT = `Validate a destination-owned notion-sync transport profile without executing it.

Usage:
  validate-transport-profile.ts <absolute-profile-file>
  validate-transport-profile.ts --print-template
  validate-transport-profile.ts --help

The positional form preserves the original validation interface and emits one
compact JSON report. --print-template emits a secret-free, deliberately
unverified starter profile; it does not authorize any remote operation.
`;

type JsonObject = Record<string, unknown>;

export class ProfileError extends Error {
  override readonly name = "ProfileError";
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableStringify(value: unknown, pretty = false): string {
  const normalizeValue = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalizeValue);
    if (!isObject(input)) return input;
    return Object.fromEntries(
      Object.keys(input)
        .sort()
        .map((key) => [key, normalizeValue(input[key])]),
    );
  };
  return JSON.stringify(normalizeValue(value), null, pretty ? 2 : undefined);
}

function sha256(content: Uint8Array | string): string {
  return createHash("sha256").update(content).digest("hex");
}

function detectDuplicateJsonKeys(source: string): void {
  const stack: Array<Set<string> | null> = [];
  let expectingKey = false;
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "{") {
      stack.push(new Set());
      expectingKey = true;
      index += 1;
      continue;
    }
    if (character === "[") {
      stack.push(null);
      expectingKey = false;
      index += 1;
      continue;
    }
    if (character === "}" || character === "]") {
      stack.pop();
      expectingKey = false;
      index += 1;
      continue;
    }
    if (character === ",") {
      expectingKey = stack.at(-1) instanceof Set;
      index += 1;
      continue;
    }
    if (character === ":") {
      expectingKey = false;
      index += 1;
      continue;
    }
    if (character === '"') {
      const start = index;
      index += 1;
      let escaped = false;
      while (index < source.length) {
        const current = source[index];
        if (escaped) escaped = false;
        else if (current === "\\") escaped = true;
        else if (current === '"') break;
        index += 1;
      }
      if (index >= source.length) return;
      const token = source.slice(start, index + 1);
      if (expectingKey) {
        const key = JSON.parse(token) as string;
        const keys = stack.at(-1);
        if (keys instanceof Set) {
          if (keys.has(key)) throw new ProfileError(`duplicate JSON key: ${key}`);
          keys.add(key);
        }
      }
      index += 1;
      continue;
    }
    index += 1;
  }
}

export function unverifiedTemplate(): JsonObject {
  const unavailable = {
    support: "unavailable",
    command: null,
    flags: [],
    output_contract: null,
  };
  const evidence = {
    binary_sha256: "0".repeat(64),
    version: "replace-with-exact-version",
    help_stdout_sha256: "0".repeat(64),
    capability_vectors: {
      recursive_pull: ["pull", "--recursive", "--json"],
      search: ["search", "--json"],
      create: ["create", "--json"],
      push: ["push", "--json"],
      conditional_update: [],
      conditional_create: [],
    },
    output_contracts: {
      ...OUTPUT_CONTRACTS,
      conditional_update: "unavailable",
      conditional_create: "unavailable",
    },
    results: {
      recursive_pull: "pass",
      search: "pass",
      create: "pass",
      push: "pass",
      conditional_update: "unavailable",
      conditional_create: "unavailable",
    },
    tested_at: "1970-01-01T00:00:00Z",
  };
  return {
    status: "unverified_template",
    warning: "Replace every placeholder and attach checksum-bound conformance evidence before validation; this output authorizes no remote operation.",
    profile: {
      schema: "notion-sync-transport-profile/v1",
      name: "replace-with-profile-name",
      installation: {
        source: "team-artifact",
        package: "replace-with-exact-package",
        version: "replace-with-exact-version",
        executable: "/absolute/path/to/notion-sync",
        sha256: "0".repeat(64),
      },
      probes: {
        version_argv: ["--version"],
        version_stdout_sha256: "0".repeat(64),
        help_argv: ["--help"],
        help_stdout_sha256: "0".repeat(64),
      },
      capabilities: {
        recursive_pull: { command: "pull", flags: ["--recursive", "--json"], output_contract: OUTPUT_CONTRACTS.recursive_pull },
        search: { command: "search", flags: ["--json"], output_contract: OUTPUT_CONTRACTS.search },
        create: { command: "create", flags: ["--json"], output_contract: OUTPUT_CONTRACTS.create },
        push: { command: "push", flags: ["--json"], output_contract: OUTPUT_CONTRACTS.push },
        conditional_update: { ...unavailable },
        conditional_create: { ...unavailable },
      },
      conformance: {
        schema: "notion-sync-conformance/v1",
        evidence,
        evidence_sha256: "0".repeat(64),
      },
    },
  };
}

function requireKeys(value: unknown, expected: ReadonlySet<string>, location: string): JsonObject {
  if (!isObject(value)) throw new ProfileError(`${location} must be an object`);
  const actual = new Set(Object.keys(value));
  const missing = [...expected].filter((key) => !actual.has(key)).sort();
  const unknown = [...actual].filter((key) => !expected.has(key)).sort();
  if (missing.length > 0 || unknown.length > 0) {
    const pythonList = (items: string[]): string => `[${items.map((item) => `'${item}'`).join(", ")}]`;
    throw new ProfileError(`${location} fields mismatch; missing=${pythonList(missing)}, unknown=${pythonList(unknown)}`);
  }
  return value;
}

function requireString(value: unknown, location: string): string {
  if (typeof value !== "string" || value.length === 0) throw new ProfileError(`${location} must be a non-empty string`);
  if ([...value].some((character) => character.charCodeAt(0) < 0x20)) throw new ProfileError(`${location} contains a control character`);
  if (SECRET_TEXT.test(value)) throw new ProfileError(`${location} appears to contain a secret`);
  if (PLACEHOLDER_TEXT.test(value)) throw new ProfileError(`${location} contains a placeholder`);
  return value;
}

function requireHex(value: unknown, location: string): string {
  const text = requireString(value, location);
  if (!HEX64.test(text)) throw new ProfileError(`${location} must be 64 lowercase hex characters`);
  return text;
}

function requireToken(value: unknown, location: string, flag = false): string {
  const text = requireString(value, location);
  if (!(flag ? FLAG : TOKEN).test(text)) throw new ProfileError(`${location} must be one literal argv token`);
  return text;
}

function safeAbsoluteFile(pathText: string, label: string): string {
  if (!isAbsolute(pathText) || normalize(pathText) !== pathText) throw new ProfileError(`${label} must be an absolute normalized path`);
  const root = parse(pathText).root;
  const parts = pathText.slice(root.length).split(sep).filter(Boolean);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    let stats: ReturnType<typeof lstatSync>;
    try {
      stats = lstatSync(current);
    } catch (error) {
      const exception = error as Error;
      throw new ProfileError(`cannot inspect ${label} component ${current}: ${exception.message}`);
    }
    if (stats.isSymbolicLink()) throw new ProfileError(`${label} contains a symlink component: ${current}`);
    if (index < parts.length - 1 && !stats.isDirectory()) throw new ProfileError(`${label} parent is not a directory: ${current}`);
  }
  const stats = lstatSync(pathText);
  if (!stats.isFile()) throw new ProfileError(`${label} must be a regular file`);
  if ((stats.mode & 0o022) !== 0) throw new ProfileError(`${label} must not be group/world-writable`);
  return pathText;
}

function validateCapability(capabilities: JsonObject, name: CapabilityName): { command: string; flags: string[]; output_contract: string; vector: string[] } {
  const value = requireKeys(capabilities[name], new Set(["command", "flags", "output_contract"]), `capabilities.${name}`);
  const command = requireToken(value.command, `capabilities.${name}.command`);
  if (!Array.isArray(value.flags)) throw new ProfileError(`capabilities.${name}.flags must be an array`);
  const flags = value.flags.map((flag, index) => requireToken(flag, `capabilities.${name}.flags[${index}]`, true));
  if (new Set(flags).size !== flags.length) throw new ProfileError(`capabilities.${name}.flags contains duplicates`);
  const outputContract = requireString(value.output_contract, `capabilities.${name}.output_contract`);
  if (outputContract !== OUTPUT_CONTRACTS[name]) throw new ProfileError(`capabilities.${name}.output_contract must be ${OUTPUT_CONTRACTS[name]}`);
  return { command, flags, output_contract: outputContract, vector: [command, ...flags] };
}

type CheckedCapability = {
  command: string | null;
  flags: string[];
  output_contract: string | null;
  vector: string[];
  support?: string;
};

function validateConditionalCapability(capabilities: JsonObject, name: CapabilityName, coreName: CapabilityName, core: CheckedCapability): CheckedCapability {
  const value = requireKeys(capabilities[name], new Set(["support", "command", "flags", "output_contract"]), `capabilities.${name}`);
  const support = requireString(value.support, `capabilities.${name}.support`);
  if (support !== "supported" && support !== "unavailable") throw new ProfileError(`capabilities.${name}.support must be supported or unavailable`);
  if (!Array.isArray(value.flags)) throw new ProfileError(`capabilities.${name}.flags must be an array`);
  if (support === "unavailable") {
    if (value.command !== null || value.flags.length !== 0 || value.output_contract !== null) throw new ProfileError(`unavailable ${name} requires null command/output_contract and empty flags`);
    return { support, command: null, flags: [], output_contract: null, vector: [] };
  }
  const command = requireToken(value.command, `capabilities.${name}.command`);
  if (command !== core.command) throw new ProfileError(`capabilities.${name}.command must equal capabilities.${coreName}.command`);
  const flags = value.flags.map((flag, index) => requireToken(flag, `capabilities.${name}.flags[${index}]`, true));
  if (flags.length === 0) throw new ProfileError(`supported ${name} requires a precondition flag`);
  if (new Set(flags).size !== flags.length) throw new ProfileError(`capabilities.${name}.flags contains duplicates`);
  if (flags.some((flag) => core.flags.includes(flag))) throw new ProfileError(`capabilities.${name}.flags duplicates a capabilities.${coreName} flag`);
  const outputContract = requireString(value.output_contract, `capabilities.${name}.output_contract`);
  if (outputContract !== OUTPUT_CONTRACTS[name]) throw new ProfileError(`capabilities.${name}.output_contract must be ${OUTPUT_CONTRACTS[name]}`);
  return { support, command, flags, output_contract: outputContract, vector: [command, ...core.flags, ...flags] };
}

export function validate(profilePathText: string): JsonObject {
  const profilePath = safeAbsoluteFile(profilePathText, "profile file");
  const profileBytes = readFileSync(profilePath);
  if (profileBytes.includes(0)) throw new ProfileError("profile file contains NUL");
  let parsed: unknown;
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(profileBytes);
    detectDuplicateJsonKeys(source);
    parsed = JSON.parse(source) as unknown;
  } catch (error) {
    const exception = error as Error;
    throw new ProfileError(`invalid profile JSON: ${exception.message}`);
  }
  const profile = requireKeys(parsed, new Set(["schema", "name", "installation", "probes", "capabilities", "conformance"]), "profile");
  if (profile.schema !== "notion-sync-transport-profile/v1") throw new ProfileError("unsupported profile schema");
  const name = requireToken(profile.name, "name");
  const installation = requireKeys(profile.installation, new Set(["source", "package", "version", "executable", "sha256"]), "installation");
  const source = requireString(installation.source, "installation.source");
  if (!["npm", "pipx", "homebrew", "system-package", "team-artifact"].includes(source)) throw new ProfileError("installation.source is not supported by v1");
  const packageName = requireString(installation.package, "installation.package");
  const version = requireString(installation.version, "installation.version");
  if (!VERSION.test(version) || ["latest", "current"].includes(version.toLowerCase())) throw new ProfileError("installation.version must be an exact non-range version");
  const expectedExecutableHash = requireHex(installation.sha256, "installation.sha256");
  const executable = safeAbsoluteFile(requireString(installation.executable, "installation.executable"), "installation.executable");
  try {
    accessSync(executable, constants.X_OK);
  } catch {
    throw new ProfileError("installation.executable is not executable");
  }
  const actualExecutableHash = sha256(readFileSync(executable));
  if (actualExecutableHash !== expectedExecutableHash) throw new ProfileError("installation.executable SHA-256 mismatch");
  const probes = requireKeys(profile.probes, new Set(["version_argv", "version_stdout_sha256", "help_argv", "help_stdout_sha256"]), "probes");
  if (stableStringify(probes.version_argv) !== '["--version"]' || stableStringify(probes.help_argv) !== '["--help"]') throw new ProfileError("v1 probe argv must be exactly --version and --help");
  const versionStdoutHash = requireHex(probes.version_stdout_sha256, "probes.version_stdout_sha256");
  const helpStdoutHash = requireHex(probes.help_stdout_sha256, "probes.help_stdout_sha256");
  const capabilities = requireKeys(profile.capabilities, new Set(CAPABILITY_NAMES), "capabilities");
  const checked: Record<string, CheckedCapability> = {};
  for (const capabilityName of ["recursive_pull", "search", "create", "push"] as const) checked[capabilityName] = validateCapability(capabilities, capabilityName);
  checked.conditional_update = validateConditionalCapability(capabilities, "conditional_update", "push", checked.push);
  checked.conditional_create = validateConditionalCapability(capabilities, "conditional_create", "create", checked.create);
  const conformance = requireKeys(profile.conformance, new Set(["schema", "evidence", "evidence_sha256"]), "conformance");
  if (conformance.schema !== "notion-sync-conformance/v1") throw new ProfileError("unsupported conformance schema");
  const evidence = requireKeys(conformance.evidence, new Set(["binary_sha256", "version", "help_stdout_sha256", "capability_vectors", "output_contracts", "results", "tested_at"]), "conformance.evidence");
  for (const key of ["binary_sha256", "version", "help_stdout_sha256", "tested_at"]) requireString(evidence[key], `conformance.evidence.${key}`);
  if (evidence.binary_sha256 !== expectedExecutableHash) throw new ProfileError("conformance binary hash does not match installation");
  if (evidence.version !== version) throw new ProfileError("conformance version does not match installation");
  if (evidence.help_stdout_sha256 !== helpStdoutHash) throw new ProfileError("conformance help hash does not match probes");
  const vectors = requireKeys(evidence.capability_vectors, new Set(CAPABILITY_NAMES), "conformance.evidence.capability_vectors");
  const outputs = requireKeys(evidence.output_contracts, new Set(CAPABILITY_NAMES), "conformance.evidence.output_contracts");
  const results = requireKeys(evidence.results, new Set(CAPABILITY_NAMES), "conformance.evidence.results");
  for (const capabilityName of CAPABILITY_NAMES) {
    const expected = checked[capabilityName];
    if (stableStringify(vectors[capabilityName]) !== stableStringify(expected.vector)) throw new ProfileError(`conformance ${capabilityName} vector does not match capabilities`);
    const expectedOutput = expected.output_contract ?? "unavailable";
    if (requireString(outputs[capabilityName], `conformance.evidence.output_contracts.${capabilityName}`) !== expectedOutput) throw new ProfileError(`conformance ${capabilityName} output contract does not match capabilities`);
    const expectedResult = (["recursive_pull", "search", "create", "push"].includes(capabilityName) || expected.support === "supported") ? "pass" : "unavailable";
    if (requireString(results[capabilityName], `conformance.evidence.results.${capabilityName}`) !== expectedResult) throw new ProfileError(`conformance ${capabilityName} result disagrees with capabilities`);
  }
  if (!UTC_TIME.test(requireString(evidence.tested_at, "conformance.evidence.tested_at"))) throw new ProfileError("conformance tested_at must be UTC ISO-8601");
  const evidenceHash = sha256(stableStringify(evidence));
  if (evidenceHash !== requireHex(conformance.evidence_sha256, "conformance.evidence_sha256")) throw new ProfileError("conformance evidence SHA-256 mismatch");
  return {
    status: "profile_structure_verified",
    profile_schema: profile.schema,
    profile_name: name,
    profile_file: profilePath,
    profile_file_sha256: sha256(profileBytes),
    installation_source: source,
    package: packageName,
    expected_version: version,
    executable,
    expected_executable_sha256: expectedExecutableHash,
    actual_executable_sha256: actualExecutableHash,
    expected_version_stdout_sha256: versionStdoutHash,
    expected_help_stdout_sha256: helpStdoutHash,
    conformance_evidence_sha256: evidenceHash,
    capabilities: checked,
  };
}

function fail(message: string): never {
  process.stderr.write(`${stableStringify({ status: "transport_unverified", error: message })}\n`);
  process.exit(2);
}

export function run(argv: string[] = process.argv.slice(2)): number {
  if (argv.length === 1 && ["-h", "--help"].includes(argv[0])) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (argv.length === 1 && ["--print-template", "--template"].includes(argv[0])) {
    process.stdout.write(`${stableStringify(unverifiedTemplate(), true)}\n`);
    return 0;
  }
  if (argv.length !== 1 || argv[0].startsWith("-")) fail("usage: validate-transport-profile.ts <absolute-profile-file>|--print-template|--help");
  try {
    process.stdout.write(`${stableStringify(validate(argv[0]))}\n`);
    return 0;
  } catch (error) {
    const exception = error as Error;
    fail(exception.message);
  }
}

if (import.meta.main) process.exit(run());
