import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { run } from "../../coding/scripts/scanlib/core.ts";
import { loadRules } from "../../coding/scripts/scanlib/loader.ts";
import { scanBarrel } from "./scanners/barrel-missing-props-reexport.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, "../tests/fixtures");
const rulesDirectory = resolve(here, "scanners");
const roots: string[] = [];
function runBun(command: readonly string[]): {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
} {
  const args = command[0] === process.execPath ? command.slice(1) : command;
  const result = spawnSync("bun", args, { encoding: "utf8" });
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
async function capture(
  argv: readonly string[],
  directory = rulesDirectory,
): Promise<string> {
  let stdout = "";
  await run(argv, {
    rulesDirectory: directory,
    stdout: (text) => {
      stdout += text;
    },
  });
  return stdout;
}

describe("React scanner", () => {
  const cases = readdirSync(fixtures, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(resolve(fixtures, entry.name, "expected.txt")),
    )
    .map((entry) => entry.name)
    .sort();
  it.each(cases)("matches the %s golden", async (name) => {
    const directory = resolve(fixtures, name);
    const categoryFile = resolve(directory, "category.txt");
    const category = existsSync(categoryFile)
      ? readFileSync(categoryFile, "utf8").trim()
      : name;
    const previous = process.cwd();
    process.chdir(directory);
    try {
      expect(await capture([".", "--category", category])).toBe(
        readFileSync(resolve(directory, "expected.txt"), "utf8"),
      );
    } finally {
      process.chdir(previous);
    }
  });
  it("loads unique rules sorted by order", async () => {
    const rules = await loadRules(rulesDirectory);
    expect(new Set(rules.map((rule) => rule.id)).size).toBe(rules.length);
    expect(rules.map((rule) => rule.order)).toEqual([0, 10, 20, 30]);
  });
  it("skips underscore helpers and isolates a broken rule", async () => {
    const directory = mkdtempSync(resolve(tmpdir(), "react-rules-"));
    roots.push(directory);
    writeFileSync(
      resolve(directory, "_helper.ts"),
      'throw new Error("must not load");',
    );
    writeFileSync(
      resolve(directory, "broken.ts"),
      'throw new Error("broken");',
    );
    writeFileSync(
      resolve(directory, "good.ts"),
      'export const RULE = { id: "good", label: "Good", order: 0, scan: () => undefined };',
    );
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    try {
      expect((await loadRules(directory)).map((rule) => rule.id)).toEqual([
        "good",
      ]);
      expect(write).toHaveBeenCalledWith(expect.stringContaining("broken"));
    } finally {
      write.mockRestore();
    }
  });
  it("isolates an unreadable barrel sibling and scans later re-exports", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "react-barrel-"));
    roots.push(directory);
    const index = resolve(directory, "index.ts");
    const bad = resolve(directory, "bad.ts");
    const good = resolve(directory, "good.ts");
    writeFileSync(bad, "export interface BadProps {}\n");
    writeFileSync(good, "export interface GoodProps {}\n");
    const lines = [
      'export { Bad } from "./bad";',
      'export { Good } from "./good";',
    ];
    const matches: Array<{ path: string; lineno: number; line: string }> = [];
    const reads: string[] = [];
    scanBarrel({ path: index, lines, matches }, (sibling) => {
      reads.push(sibling);
      if (sibling === bad) throw new Error("EACCES: unreadable sibling");
      return readFileSync(sibling, "utf8");
    });
    expect(reads).toEqual([bad, good]);
    expect(matches).toEqual([
      {
        path: index,
        lineno: 2,
        line: 'export { Good } from "./good";   # missing: GoodProps',
      },
    ]);
  });
  it("requires the --scanlib CLI option", () => {
    const result = runBun([
      process.execPath,
      "run",
      resolve(here, "scan_potential_violations.ts"),
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr.toString()).toContain("--scanlib");
  });
  it("accepts the supplied Coding scanlib", () => {
    const result = runBun([
      process.execPath,
      "run",
      resolve(here, "scan_potential_violations.ts"),
      "--scanlib",
      resolve(here, "../../coding/scripts/scanlib"),
      fixtures,
      "--category",
      "props-interface",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("props-interface:");
  });
  it("accepts the equals form of --scanlib", () => {
    const result = runBun([
      process.execPath,
      "run",
      resolve(here, "scan_potential_violations.ts"),
      `--scanlib=${resolve(here, "../../coding/scripts/scanlib")}`,
      fixtures,
      "--category",
      "props-interface",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("props-interface:");
  });
});
