import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const leaseScript = resolve(here, "state-lease");
const stateWrite = resolve(here, "state-write");
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

class StateWriteHarness {
  readonly root: string;
  readonly workDirectory: string;
  readonly leasePath: string;
  constructor() {
    this.root = mkdtempSync(resolve(tmpdir(), "state-write-"));
    roots.push(this.root);
    this.workDirectory = resolve(this.root, "works/demo");
    this.leasePath = resolve(this.workDirectory, "lease.json");
    mkdirSync(resolve(this.workDirectory, "state"), { recursive: true });
  }
  acquire(...args: readonly string[]): string {
    const completed = spawnSync(
      "/bin/bash",
      [
        leaseScript,
        "acquire",
        "--work-dir",
        this.workDirectory,
        "--capability",
        "pm",
        "--session",
        "s1",
        ...args,
      ],
      { encoding: "utf8" },
    );
    expect(completed.status, completed.stderr).toBe(0);
    return String((JSON.parse(completed.stdout) as { token: string }).token);
  }
  write(token: string, target: string, content = "content\n") {
    const completed = spawnSync(
      "/bin/bash",
      [
        stateWrite,
        "--work-dir",
        this.workDirectory,
        "--token",
        token,
        "--target",
        target,
      ],
      { encoding: "utf8", input: content },
    );
    return {
      exitCode: completed.status ?? 1,
      payload: JSON.parse(completed.stdout) as Record<string, unknown>,
    };
  }
  expire(): void {
    const record = JSON.parse(readFileSync(this.leasePath, "utf8")) as Record<
      string,
      unknown
    >;
    record.expires_at_epoch = 0;
    writeFileSync(this.leasePath, JSON.stringify(record));
  }
}

describe("state-write", () => {
  it("atomically writes content and heartbeats the lease", () => {
    const harness = new StateWriteHarness();
    const token = harness.acquire();
    const before = JSON.parse(readFileSync(harness.leasePath, "utf8")) as {
      acquired_at: string;
      expires_at_epoch: number;
    };
    const result = harness.write(token, "state.md", "fresh state\n");
    expect(result).toMatchObject({
      exitCode: 0,
      payload: { status: "written" },
    });
    expect(
      readFileSync(resolve(harness.workDirectory, "state.md"), "utf8"),
    ).toBe("fresh state\n");
    const after = JSON.parse(readFileSync(harness.leasePath, "utf8")) as {
      acquired_at: string;
      expires_at_epoch: number;
    };
    expect(after.expires_at_epoch).toBeGreaterThanOrEqual(
      before.expires_at_epoch,
    );
    expect(after.acquired_at).toBe(before.acquired_at);
  });

  it("creates a nested target", () => {
    const harness = new StateWriteHarness();
    const token = harness.acquire();
    expect(harness.write(token, "state/journal.md", "line\n").exitCode).toBe(0);
    expect(
      readFileSync(resolve(harness.workDirectory, "state/journal.md"), "utf8"),
    ).toBe("line\n");
  });

  it("refuses free, expired, and foreign leases", () => {
    const free = new StateWriteHarness();
    expect(free.write("anything", "state.md")).toMatchObject({
      exitCode: 4,
      payload: { status: "lease_free" },
    });
    expect(existsSync(resolve(free.workDirectory, "state.md"))).toBe(false);

    const expired = new StateWriteHarness();
    const token = expired.acquire();
    expired.expire();
    expect(expired.write(token, "state.md")).toMatchObject({
      exitCode: 4,
      payload: { status: "lease_expired" },
    });

    const foreign = new StateWriteHarness();
    foreign.acquire();
    expect(foreign.write("deadbeef", "state.md")).toMatchObject({
      exitCode: 5,
      payload: { status: "lease_foreign" },
    });
  });

  it.each(["../escape.md", "/etc/escape.md", "state/../../up.md"])(
    "refuses unsafe target %s",
    (target) => {
      const harness = new StateWriteHarness();
      const token = harness.acquire();
      expect(harness.write(token, target)).toMatchObject({
        exitCode: 2,
        payload: { status: "invalid" },
      });
    },
  );

  it("refuses a symlink target without touching its referent", () => {
    const harness = new StateWriteHarness();
    const token = harness.acquire();
    const victim = resolve(harness.root, "victim.md");
    writeFileSync(victim, "original");
    symlinkSync(victim, resolve(harness.workDirectory, "state.md"));
    expect(harness.write(token, "state.md")).toMatchObject({
      exitCode: 2,
      payload: { status: "invalid" },
    });
    expect(readFileSync(victim, "utf8")).toBe("original");
  });

  it("leaves no temporary files on success or refusal", () => {
    const harness = new StateWriteHarness();
    const token = harness.acquire();
    harness.write(token, "state.md");
    harness.write("wrong", "state.md");
    expect(
      readdirSync(harness.workDirectory).filter((name) =>
        name.startsWith(".state-write."),
      ),
    ).toEqual([]);
  });
});
