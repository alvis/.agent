import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const checker = resolve(here, "check-markdown-size");
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

class Harness {
  readonly root = mkdtempSync(resolve(tmpdir(), "markdown-size-"));
  readonly state = resolve(this.root, ".state");
  readonly log = resolve(this.root, "wc.log");
  readonly environment: NodeJS.ProcessEnv;
  constructor() {
    roots.push(this.root);
    mkdirSync(this.state);
    const binaries = resolve(this.root, "bin");
    mkdirSync(binaries);
    const wc = resolve(binaries, "wc");
    writeFileSync(
      wc,
      '#!/bin/sh\nprintf \'call\\n\' >>"$WC_LOG"\nexec /usr/bin/wc "$@"\n',
    );
    chmodSync(wc, 0o755);
    this.environment = {
      ...process.env,
      PATH: `${binaries}:${process.env.PATH}`,
      WC_LOG: this.log,
    };
  }
  bytes(name: string, size: number): string {
    const path = resolve(this.root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.alloc(size, "x"));
    return path;
  }
  run(...paths: readonly string[]) {
    const result = spawnSync(checker, ["--state-dir", this.state, ...paths], {
      encoding: "utf8",
      env: this.environment,
    });
    return {
      exitCode: result.status ?? 1,
      payload: JSON.parse(result.stdout) as Record<string, unknown>,
      stderr: result.stderr,
    };
  }
  calls(): number {
    try {
      return readFileSync(this.log, "utf8").trim().split("\n").filter(Boolean)
        .length;
    } catch {
      return 0;
    }
  }
}

describe("check-markdown-size", () => {
  it("keeps the 16 KiB boundary in one measurement pass", () => {
    const harness = new Harness();
    const result = harness.run(
      harness.bytes(".state/works/eng-421/fifteen kib.md", 15 * 1024),
      harness.bytes(".state/works/eng-421/boundary.md", 16_384),
    );
    expect(result).toMatchObject({
      exitCode: 0,
      payload: { status: "pass", checked: 2, oversized: [] },
    });
    expect(harness.calls()).toBe(1);
  });

  it("returns every oversized file after one measurement", () => {
    const harness = new Harness();
    const first = harness.bytes(".state/works/eng-421/one.md", 16_385);
    const second = harness.bytes(
      ".state/works/eng-421/dir with spaces/two.md",
      20_000,
    );
    const result = harness.run(
      first,
      second,
      harness.bytes(".state/works/eng-421/valid.md", 12_289),
    );
    expect(result.exitCode).toBe(1);
    expect(result.payload.status).toBe("split_required");
    expect(result.payload.oversized).toEqual([
      { path: first, bytes: 16_385 },
      { path: second, bytes: 20_000 },
    ]);
    expect(harness.calls()).toBe(1);
  });

  it("deduplicates and excludes working and external Markdown", () => {
    const harness = new Harness();
    const measured = harness.bytes(".state/works/eng-421/normal.md", 100);
    const excluded = [
      harness.bytes(".state/works/eng-421/state/working.md", 30_000),
      harness.bytes("docs/specs/payments/README.md", 30_000),
      harness.bytes("plugins/example/SKILL.md", 30_000),
    ];
    const result = harness.run(measured, measured, ...excluded);
    expect(result).toMatchObject({ exitCode: 0, payload: { checked: 1 } });
    expect((result.payload.excluded as string[]).sort()).toEqual(
      excluded.sort(),
    );
    expect(harness.calls()).toBe(1);
  });

  it("passes all-excluded input without calling wc", () => {
    const harness = new Harness();
    const result = harness.run(
      harness.bytes(".state/works/eng-421/state/working.md", 30_000),
      harness.bytes("docs/architecture/large.md", 30_000),
    );
    expect(result).toMatchObject({
      exitCode: 0,
      payload: { status: "pass", checked: 0 },
    });
    expect(harness.calls()).toBe(0);
  });

  it("excludes traversal, symlink, and another state root", () => {
    const harness = new Harness();
    const outside = harness.bytes("docs/outside.md", 20_000);
    const linked = harness.bytes("docs/linked-outside.md", 20_000);
    const traversal = `${harness.state}/../docs/outside.md`;
    const symlink = resolve(harness.state, "works/eng-421/linked.md");
    mkdirSync(dirname(symlink), { recursive: true });
    symlinkSync(linked, symlink);
    const other = harness.bytes("other/.state/works/eng-9/other.md", 20_000);
    const result = harness.run(traversal, symlink, other);
    expect(result).toMatchObject({
      exitCode: 0,
      payload: { status: "pass", checked: 0 },
    });
    expect((result.payload.excluded as string[]).sort()).toEqual(
      [traversal, symlink, other].sort(),
    );
    expect(readFileSync(outside).length).toBe(20_000);
  });

  it("distinguishes invalid input from a required split", () => {
    const harness = new Harness();
    const invalid = harness.bytes(".state/works/eng-421/data.mdc", 10);
    for (const paths of [
      [],
      ["relative.md"],
      [resolve(harness.root, "missing.md")],
      [invalid],
    ]) {
      expect(harness.run(...paths)).toMatchObject({
        exitCode: 2,
        payload: { status: "invalid" },
      });
    }
    expect(harness.calls()).toBe(0);
    const missingState = spawnSync(
      checker,
      [resolve(harness.root, "missing.md")],
      { encoding: "utf8", env: harness.environment },
    );
    expect(missingState.status).toBe(2);
    expect(JSON.parse(missingState.stdout).status).toBe("invalid");
  });
});
