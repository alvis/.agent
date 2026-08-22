import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const runner = resolve(here, "lint_profile_runner.ts");
const repositoryRoot = resolve(here, "../../..");
const roots: string[] = [];
function runBun(
  command: readonly string[],
  options: { readonly cwd?: string; readonly env?: NodeJS.ProcessEnv } = {},
): {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
} {
  const args = command[0] === process.execPath ? command.slice(1) : command;
  const result = spawnSync("bun", args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function temporaryRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "lint-profile-"));
  roots.push(root);
  return root;
}
function writeScanner(
  path: string,
  label: string,
  exitCode = 0,
  forged = false,
): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(
    path,
    `console.log(JSON.stringify(${forged ? "{ label: 'forged', exit_code: 0 }" : `{ label: ${JSON.stringify(label)}, args: process.argv.slice(2), standard_roots: process.env.CODING_LINT_STANDARD_ROOTS ?? '' }`})); process.exit(${exitCode});\n`,
  );
}
function runRunner(
  root: string,
  profile: string,
  files: readonly string[],
  env = process.env,
): ReturnType<typeof runBun> {
  const generic = resolve(root, "coding/scripts/generic.ts");
  mkdirSync(resolve(root, "coding/scripts/scanlib"), { recursive: true });
  writeScanner(generic, "generic");
  return runBun(
    [
      process.execPath,
      "run",
      runner,
      "--coding-root",
      resolve(root, "coding"),
      "--generic-scanner",
      generic,
      "--profile",
      profile,
      ...files,
    ],
    { env },
  );
}
function writeProfile(root: string, value: Record<string, unknown>): string {
  const path = resolve(root, "react/skills/lint/profile.json");
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
  return path;
}

describe("lint profile runner", () => {
  it.each([
    [[], "the following arguments are required: files"],
    [["--unknown", "src/App.tsx"], "unrecognized arguments: --unknown"],
    [["--profile"], "argument --profile: expected one argument"],
  ])("preserves argparse errors for %j", (args, message) => {
    const result = runBun([process.execPath, "run", runner, ...args]);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      `usage: lint_profile_runner.ts [-h] [--profile PROFILE]\n                              [--coding-root CODING_ROOT]\n                              [--generic-scanner GENERIC_SCANNER]\n                              files [files ...]\nlint_profile_runner.ts: error: ${message}\n`,
    );
  });
  it("preserves argparse help output", () => {
    const result = runBun([process.execPath, "run", runner, "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      "usage: lint_profile_runner.ts [-h] [--profile PROFILE]\n                              [--coding-root CODING_ROOT]\n                              [--generic-scanner GENERIC_SCANNER]\n                              files [files ...]\n\npositional arguments:\n  files\n\noptions:\n  -h, --help            show this help message and exit\n  --profile PROFILE\n  --coding-root CODING_ROOT\n  --generic-scanner GENERIC_SCANNER\n",
    );
  });
  it("runs generic and profile scanners once in order with eligible files", () => {
    const root = temporaryRoot();
    const scanner = resolve(root, "react/scripts/react.ts");
    writeScanner(scanner, "react");
    for (const standard of ["components", "hooks"])
      mkdirSync(resolve(root, `react/standards/${standard}`), {
        recursive: true,
      });
    const profile = writeProfile(root, {
      eligibility: { extensions: [".tsx", ".jsx"] },
      exclusions: ["**/*.generated.tsx", "**/node_modules/**", "**/dist/**"],
      scanners: [
        { path: "../../scripts/react.ts", needs_coding_scanlib: true },
      ],
      standards: ["../../standards/components", "../../standards/hooks"],
      report_label: "React lint",
    });
    const result = runRunner(root, profile, [
      "src/App.tsx",
      "src/Skip.generated.tsx",
      "node_modules/X.tsx",
      "src/plain.ts",
    ]);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    const report = JSON.parse(result.stdout.toString());
    expect(report.files).toEqual(["src/App.tsx"]);
    expect(
      report.scanner_runs.map((run: { label: string }) => run.label),
    ).toEqual(["generic", "react"]);
    const standards = [
      resolve(root, "react/standards/components"),
      resolve(root, "react/standards/hooks"),
    ].join(delimiter);
    expect(report.scanner_runs[0].output.standard_roots).toBe(standards);
    expect(report.scanner_runs[1].args).toContain(
      resolve(root, "coding/scripts/scanlib"),
    );
    expect(report.report_label).toBe("React lint");
  });
  it("propagates scanner failures", () => {
    const root = temporaryRoot();
    const scanner = resolve(root, "react/scripts/react.ts");
    writeScanner(scanner, "react", 7);
    const profile = writeProfile(root, {
      scanners: [
        { path: "../../scripts/react.ts", needs_coding_scanlib: true },
      ],
      standards: [],
    });
    const result = runRunner(root, profile, ["src/App.tsx"]);
    expect(result.exitCode).toBe(7);
    const report = JSON.parse(result.stdout.toString());
    expect(report.status).toBe("failure");
    expect(report.scanner_runs).toHaveLength(2);
  });
  it("clears inherited standard roots for an empty profile", () => {
    const root = temporaryRoot();
    const profile = writeProfile(root, { standards: [] });
    const result = runRunner(root, profile, ["src/App.tsx"], {
      ...process.env,
      CODING_LINT_STANDARD_ROOTS: "/stale/root",
    });
    expect(result.exitCode).toBe(0);
    expect(
      JSON.parse(result.stdout.toString()).scanner_runs[0].output
        .standard_roots,
    ).toBe("");
  });
  it("rejects a relative profile", () => {
    const root = temporaryRoot();
    const result = runBun(
      [
        process.execPath,
        "run",
        runner,
        "--profile",
        "relative.json",
        "src/App.tsx",
      ],
      { cwd: root },
    );
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout.toString()).error).toContain(
      "absolute path",
    );
  });
  it("accepts the documented equals form for profile options", () => {
    const root = temporaryRoot();
    const profile = writeProfile(root, { standards: [] });
    const generic = resolve(root, "coding/scripts/generic.ts");
    mkdirSync(resolve(generic, ".."), { recursive: true });
    writeScanner(generic, "generic");
    const result = runBun([
      process.execPath,
      "run",
      runner,
      `--profile=${profile}`,
      `--coding-root=${resolve(root, "coding")}`,
      `--generic-scanner=${generic}`,
      "src/App.tsx",
    ]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString()).files).toEqual(["src/App.tsx"]);
  });
  it("does not let scanner output forge process metadata", () => {
    const root = temporaryRoot();
    const scanner = resolve(root, "react/scripts/react.ts");
    writeScanner(scanner, "react", 7, true);
    const profile = writeProfile(root, {
      scanners: [{ path: "../../scripts/react.ts" }],
    });
    const result = runRunner(root, profile, ["src/App.tsx"]);
    const report = JSON.parse(result.stdout.toString());
    expect(result.exitCode).toBe(7);
    expect(report.scanner_runs[1].label).toBe("react");
    expect(report.scanner_runs[1].exit_code).toBe(7);
    expect(report.scanner_runs[1].output.label).toBe("forged");
  });
  it("rejects resources outside the profile root", () => {
    const root = temporaryRoot();
    const outside = resolve(root, "outside");
    mkdirSync(outside);
    const profile = writeProfile(root, { standards: ["../../../outside"] });
    const result = runRunner(root, profile, ["src/App.tsx"]);
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout.toString()).error).toContain(
      "escapes profile root",
    );
  });
  it("keeps the committed React profile portable and nonrecursive", () => {
    const profile = JSON.parse(
      readFileSync(
        resolve(here, "../../react/skills/lint/assets/profile.json"),
        "utf8",
      ),
    );
    expect(profile.eligibility.extensions).toEqual([".tsx", ".jsx"]);
    expect(profile.scanners[0].needs_coding_scanlib).toBe(true);
  });
  it("keeps declared Claude plugin dependencies resolvable and nonrecursive", () => {
    const manifests = new Map(
      readdirSync(resolve(repositoryRoot, "plugins"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) =>
          resolve(
            repositoryRoot,
            "plugins",
            entry.name,
            ".claude-plugin/plugin.json",
          ),
        )
        .filter((path) => existsSync(path))
        .map((path) => {
          const manifest = JSON.parse(readFileSync(path, "utf8")) as {
            readonly name: string;
            readonly dependencies?: readonly string[];
          };
          return [manifest.name, manifest] as const;
        }),
    );
    expect(manifests.size).toBeGreaterThan(0);
    for (const [name, manifest] of manifests)
      for (const dependency of manifest.dependencies ?? []) {
        expect(manifests.has(dependency), `${name}: ${dependency}`).toBe(true);
        expect(dependency).not.toBe(name);
      }
  });
  it("keeps dependencies out of Claude marketplace entries", () => {
    const marketplace = JSON.parse(
      readFileSync(
        resolve(repositoryRoot, ".claude-plugin/marketplace.json"),
        "utf8",
      ),
    ) as { readonly plugins: readonly Record<string, unknown>[] };
    for (const plugin of marketplace.plugins)
      expect(plugin, String(plugin.name)).not.toHaveProperty("dependencies");
  });
});
