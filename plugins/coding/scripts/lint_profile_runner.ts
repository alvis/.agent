import { existsSync, readFileSync, statSync } from "node:fs";
import {
  basename,
  delimiter,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

interface ProfileScanner {
  readonly path: string;
  readonly needs_coding_scanlib?: boolean;
}
interface Profile {
  readonly eligibility?: { readonly extensions?: readonly string[] };
  readonly exclusions?: readonly string[];
  readonly standards?: readonly string[];
  readonly scanners?: readonly ProfileScanner[];
  readonly report_label?: string;
}
interface ScannerRun {
  readonly label: string;
  readonly args: readonly string[];
  readonly exit_code: number;
  readonly output?: Record<string, unknown>;
  readonly stdout?: string;
  readonly stderr?: string;
}

function matchesGlob(path: string, pattern: string): boolean {
  return (
    new Bun.Glob(pattern).match(path) ||
    (pattern.startsWith("**/") && new Bun.Glob(pattern.slice(3)).match(path))
  );
}
export function eligibleFiles(
  files: readonly string[],
  profile: Profile,
): string[] {
  const extensions = profile.eligibility?.extensions ?? [];
  const exclusions = profile.exclusions ?? [];
  return files.filter(
    (file) =>
      (extensions.length === 0 ||
        extensions.some((extension) => file.endsWith(extension))) &&
      !exclusions.some((pattern) => matchesGlob(file, pattern)),
  );
}

function inside(root: string, target: string): boolean {
  const path = relative(root, target);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}
function profileRoot(profilePath: string): string {
  let directory = dirname(profilePath);
  while (basename(directory) !== "skills") {
    const parent = dirname(directory);
    if (parent === directory) return resolve(dirname(profilePath), "../..");
    directory = parent;
  }
  return dirname(directory);
}
export function validateProfile(
  profilePath: string | undefined,
  profile: unknown,
): string | undefined {
  if (profilePath === undefined) return undefined;
  if (!isAbsolute(profilePath)) return "--profile must be an absolute path";
  if (profile === null || typeof profile !== "object" || Array.isArray(profile))
    return "profile must contain a JSON object";
  const value = profile as Profile;
  if (
    value.eligibility !== undefined &&
    (typeof value.eligibility !== "object" ||
      !Array.isArray(value.eligibility.extensions ?? []))
  )
    return "profile eligibility.extensions must be a list";
  if (!Array.isArray(value.exclusions ?? []))
    return "profile exclusions must be a list";
  if (!Array.isArray(value.standards ?? []))
    return "profile standards must be a list";
  if (!Array.isArray(value.scanners ?? []))
    return "profile scanners must be a list";
  const root = profileRoot(profilePath);
  const base = dirname(profilePath);
  for (const item of value.standards ?? []) {
    if (typeof item !== "string")
      return "profile standards entries must be strings";
    const target = resolve(base, item);
    if (!existsSync(target) || !statSync(target).isDirectory())
      return `profile standard does not exist: ${item}`;
    if (!inside(root, target))
      return `profile standard escapes profile root: ${item}`;
  }
  for (const item of value.scanners ?? []) {
    if (
      item === null ||
      typeof item !== "object" ||
      typeof item.path !== "string"
    )
      return "profile scanners entries must contain a path";
    const target = resolve(base, item.path);
    if (!existsSync(target) || !statSync(target).isFile())
      return `profile scanner does not exist: ${item.path}`;
    if (!inside(root, target))
      return `profile scanner escapes profile root: ${item.path}`;
  }
  return undefined;
}

function scannerResult(
  script: string,
  args: readonly string[],
  label: string,
  env: Record<string, string | undefined>,
): [ScannerRun, number] {
  try {
    const result = Bun.spawnSync([process.execPath, "run", script, ...args], {
      stdout: "pipe",
      stderr: "pipe",
      env,
    });
    const stdout = result.stdout.toString();
    const stderr = result.stderr.toString();
    const exitCode = result.exitCode;
    const run: {
      label: string;
      args: readonly string[];
      exit_code: number;
      output?: Record<string, unknown>;
      stdout?: string;
      stderr?: string;
    } = { label, args, exit_code: exitCode };
    const lines = stdout.split(/\r?\n/).filter(Boolean);
    if (lines.length > 0) {
      try {
        const emitted = JSON.parse(lines.at(-1) ?? "");
        if (
          emitted !== null &&
          typeof emitted === "object" &&
          !Array.isArray(emitted)
        )
          run.output = emitted as Record<string, unknown>;
      } catch {
        run.stdout = stdout;
      }
    }
    if (stderr !== "") run.stderr = stderr;
    return [run, exitCode];
  } catch (error) {
    return [
      {
        label,
        args,
        exit_code: 1,
        stderr: error instanceof Error ? error.message : String(error),
      },
      1,
    ];
  }
}

function failure(message: string): number {
  console.log(
    JSON.stringify({
      violations_found_total: 0,
      status: "failure",
      report_label: "Coding lint",
      files: [],
      standards: [],
      scanner_runs: [],
      error: message,
    }),
  );
  return 2;
}

interface Arguments {
  readonly profile?: string;
  readonly codingRoot: string;
  readonly genericScanner: string;
  readonly files: readonly string[];
}
type ParsedArguments =
  | { readonly kind: "arguments"; readonly value: Arguments }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "help" };

const program = basename(fileURLToPath(import.meta.url));
const usage = `usage: ${program} [-h] [--profile PROFILE]\n${" ".repeat(program.length + 8)}[--coding-root CODING_ROOT]\n${" ".repeat(program.length + 8)}[--generic-scanner GENERIC_SCANNER]\n${" ".repeat(program.length + 8)}files [files ...]`;
const help = `${usage}\n\npositional arguments:\n  files\n\noptions:\n  -h, --help            show this help message and exit\n  --profile PROFILE\n  --coding-root CODING_ROOT\n  --generic-scanner GENERIC_SCANNER\n`;

function parseArgs(argv: readonly string[]): ParsedArguments {
  const here = dirname(fileURLToPath(import.meta.url));
  let profile: string | undefined;
  let codingRoot = resolve(here, "..");
  let genericScanner = resolve(here, "scan_potential_violations.ts");
  const files: string[] = [];
  let positionalOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    if (positionalOnly) files.push(argument);
    else if (argument === "--") positionalOnly = true;
    else if (argument === "-h" || argument === "--help")
      return { kind: "help" };
    else if (argument === "--profile") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-"))
        return {
          kind: "error",
          message: "argument --profile: expected one argument",
        };
      profile = value;
      index += 1;
    } else if (argument.startsWith("--profile="))
      profile = argument.slice("--profile=".length);
    else if (argument === "--coding-root") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-"))
        return {
          kind: "error",
          message: "argument --coding-root: expected one argument",
        };
      codingRoot = value;
      index += 1;
    } else if (argument.startsWith("--coding-root="))
      codingRoot = argument.slice("--coding-root=".length);
    else if (argument === "--generic-scanner") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-"))
        return {
          kind: "error",
          message: "argument --generic-scanner: expected one argument",
        };
      genericScanner = value;
      index += 1;
    } else if (argument.startsWith("--generic-scanner="))
      genericScanner = argument.slice("--generic-scanner=".length);
    else if (argument.startsWith("-"))
      return {
        kind: "error",
        message: `unrecognized arguments: ${argument}`,
      };
    else files.push(argument);
  }
  if (files.length === 0)
    return {
      kind: "error",
      message: "the following arguments are required: files",
    };
  return {
    kind: "arguments",
    value: { profile, codingRoot, genericScanner, files },
  };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(help);
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${usage}\n${program}: error: ${parsed.message}\n`);
    return 2;
  }
  const args = parsed.value;
  if (args.profile !== undefined && !isAbsolute(args.profile))
    return failure("--profile must be an absolute path");
  const profilePath =
    args.profile === undefined ? undefined : resolve(args.profile);
  let profile: Profile = {};
  if (profilePath !== undefined) {
    try {
      profile = JSON.parse(readFileSync(profilePath, "utf8")) as Profile;
    } catch (error) {
      return failure(
        `unable to read profile: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  const validation = validateProfile(profilePath, profile);
  if (validation !== undefined) return failure(validation);
  const files = eligibleFiles(args.files, profile);
  const standards =
    profilePath === undefined
      ? []
      : (profile.standards ?? []).map((item) =>
          resolve(dirname(profilePath), item),
        );
  const report: {
    violations_found_total: number;
    status: string;
    report_label: string;
    files: readonly string[];
    standards: readonly string[];
    scanner_runs: ScannerRun[];
  } = {
    violations_found_total: 0,
    status: "compliant",
    report_label: profile.report_label ?? "Coding lint",
    files,
    standards,
    scanner_runs: [],
  };
  if (files.length === 0) {
    console.log(JSON.stringify(report));
    return 0;
  }
  const common = [
    ...files,
    "--category",
    "all",
    "--before",
    "5",
    "--after",
    "10",
  ];
  const env = {
    ...process.env,
    CODING_LINT_STANDARD_ROOTS: standards.join(delimiter),
  };
  let [run, exitCode] = scannerResult(
    resolve(args.genericScanner),
    common,
    "generic",
    env,
  );
  report.scanner_runs.push(run);
  if (exitCode !== 0) {
    report.status = "failure";
    console.log(JSON.stringify(report));
    return exitCode;
  }
  for (const scanner of profile.scanners ?? []) {
    const scannerPath = resolve(dirname(profilePath as string), scanner.path);
    const scannerArgs = scanner.needs_coding_scanlib
      ? ["--scanlib", resolve(args.codingRoot, "scripts/scanlib"), ...common]
      : common;
    [run, exitCode] = scannerResult(
      scannerPath,
      scannerArgs,
      extname(scannerPath) === ""
        ? (scannerPath.split(/[\\/]/).at(-1) ?? scannerPath)
        : (scannerPath
            .split(/[\\/]/)
            .at(-1)
            ?.replace(/\.[^.]+$/, "") ?? scannerPath),
      env,
    );
    report.scanner_runs.push(run);
    if (exitCode !== 0) {
      report.status = "failure";
      console.log(JSON.stringify(report));
      return exitCode;
    }
  }
  console.log(JSON.stringify(report));
  return 0;
}

if (import.meta.main) process.exit(main());
