import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
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
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

interface LeaseResult {
  readonly exitCode: number;
  readonly payload: Record<string, unknown>;
  readonly stderr: string;
}

class LeaseHarness {
  readonly root: string;
  readonly workDirectory: string;
  readonly leasePath: string;
  constructor() {
    this.root = mkdtempSync(resolve(tmpdir(), "state-lease-"));
    roots.push(this.root);
    this.workDirectory = resolve(this.root, "works/demo");
    this.leasePath = resolve(this.workDirectory, "lease.json");
    mkdirSync(this.workDirectory, { recursive: true });
  }
  run(verb: string, ...args: readonly string[]): LeaseResult {
    const completed = spawnSync(
      "/bin/bash",
      [leaseScript, verb, "--work-dir", this.workDirectory, ...args],
      { encoding: "utf8" },
    );
    return {
      exitCode: completed.status ?? 1,
      payload: JSON.parse(completed.stdout) as Record<string, unknown>,
      stderr: completed.stderr,
    };
  }
  acquire(session = "s1", ...args: readonly string[]): string {
    const result = this.run(
      "acquire",
      "--capability",
      "pm",
      "--session",
      session,
      ...args,
    );
    expect(result.exitCode, JSON.stringify(result.payload)).toBe(0);
    expect(result.payload.status).toBe("acquired");
    return String(result.payload.token);
  }
  record(): Record<string, unknown> {
    return JSON.parse(readFileSync(this.leasePath, "utf8")) as Record<
      string,
      unknown
    >;
  }
  expire(): void {
    const record = this.record();
    record.expires_at_epoch = 0;
    writeFileSync(this.leasePath, JSON.stringify(record));
  }
}

describe("state-lease", () => {
  it("acquires a well-formed digest-only lease", () => {
    const lease = new LeaseHarness();
    const token = lease.acquire();
    const record = lease.record();
    for (const key of [
      "work_id",
      "owner_session",
      "owner_capability",
      "host",
      "pid",
      "token_sha256",
      "acquired_at",
      "acquired_epoch",
      "heartbeat_at",
      "expires_at",
      "expires_at_epoch",
      "ttl_seconds",
    ])
      expect(record).toHaveProperty(key);
    expect(record).toMatchObject({
      work_id: "demo",
      owner_session: "s1",
      owner_capability: "pm",
    });
    expect(record).not.toHaveProperty("token");
    expect(record.token_sha256).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
  });

  it("reports contention without changing the owner", () => {
    const lease = new LeaseHarness();
    lease.acquire();
    const result = lease.run(
      "acquire",
      "--capability",
      "pm",
      "--session",
      "s2",
    );
    expect(result).toMatchObject({
      exitCode: 3,
      payload: { status: "contended" },
    });
    expect(lease.record().owner_session).toBe("s1");
  });

  it("distinguishes free, held, and foreign status", () => {
    const lease = new LeaseHarness();
    expect(lease.run("status").payload.status).toBe("free");
    const token = lease.acquire();
    expect(lease.run("status", "--token", token).payload.status).toBe("held");
    expect(lease.run("status", "--token", "deadbeef").payload.status).toBe(
      "foreign",
    );
    expect(lease.run("status").payload.status).toBe("foreign");
  });

  it("token-gates heartbeat and records state revision", () => {
    const lease = new LeaseHarness();
    const token = lease.acquire();
    expect(lease.run("heartbeat", "--token", "deadbeef")).toMatchObject({
      exitCode: 5,
      payload: { status: "refused" },
    });
    expect(
      lease.run("heartbeat", "--token", token, "--state-revision", "7"),
    ).toMatchObject({ exitCode: 0, payload: { status: "renewed" } });
    expect(lease.record()).toMatchObject({
      state_revision: 7,
      owner_session: "s1",
    });
  });

  it("token-gates release and leaves no partial file", () => {
    const lease = new LeaseHarness();
    const token = lease.acquire();
    expect(lease.run("release", "--token", "deadbeef")).toMatchObject({
      exitCode: 5,
      payload: { status: "refused" },
    });
    expect(lease.run("release", "--token", token)).toMatchObject({
      exitCode: 0,
      payload: { status: "released" },
    });
    expect(readdirSync(lease.workDirectory)).toEqual([]);
  });

  it("requires explicit takeover and preserves previous lease evidence", () => {
    const lease = new LeaseHarness();
    lease.acquire("s1");
    expect(
      lease.run("takeover", "--capability", "pm", "--session", "s2"),
    ).toMatchObject({ exitCode: 5, payload: { status: "refused" } });
    lease.expire();
    expect(
      lease.run("acquire", "--capability", "pm", "--session", "s2"),
    ).toMatchObject({
      exitCode: 4,
      payload: { status: "takeover_required" },
    });
    const takeover = lease.run(
      "takeover",
      "--capability",
      "essential:takeover",
      "--session",
      "s2",
    );
    expect(takeover).toMatchObject({
      exitCode: 0,
      payload: {
        status: "taken_over",
        journal_event: "lease",
        previous_lease: { owner_session: "s1" },
      },
    });
    expect(lease.record()).toMatchObject({
      owner_session: "s2",
      owner_capability: "essential:takeover",
    });
  });

  it("refuses a symlinked lease path", () => {
    const lease = new LeaseHarness();
    const victim = resolve(lease.root, "victim.json");
    writeFileSync(victim, "{}");
    symlinkSync(victim, lease.leasePath);
    expect(lease.run("status")).toMatchObject({
      exitCode: 2,
      payload: { status: "invalid" },
    });
  });

  it("uses explicit, environment, then pid session identity", () => {
    const explicit = new LeaseHarness();
    explicit.acquire("explicit");
    expect(explicit.record().owner_session).toBe("explicit");

    const environment = new LeaseHarness();
    const envRun = spawnSync(
      "/bin/bash",
      [
        leaseScript,
        "acquire",
        "--work-dir",
        environment.workDirectory,
        "--capability",
        "pm",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, CLAUDE_SESSION_ID: "env-session" },
      },
    );
    expect(envRun.status).toBe(0);
    expect(environment.record().owner_session).toBe("env-session");

    const fallback = new LeaseHarness();
    const env = { ...process.env };
    delete env.CLAUDE_SESSION_ID;
    const fallbackRun = spawnSync(
      "/bin/bash",
      [
        leaseScript,
        "acquire",
        "--work-dir",
        fallback.workDirectory,
        "--capability",
        "pm",
      ],
      { encoding: "utf8", env },
    );
    expect(fallbackRun.status).toBe(0);
    expect(String(fallback.record().owner_session)).toMatch(/^pid-\d+$/);
  });

  it("preserves acquisition evidence across heartbeat", () => {
    const lease = new LeaseHarness();
    const token = lease.acquire();
    const before = lease.record();
    expect(lease.run("heartbeat", "--token", token).exitCode).toBe(0);
    const after = lease.record();
    expect(after.acquired_at).toBe(before.acquired_at);
    expect(after.acquired_epoch).toBe(before.acquired_epoch);
    expect(Number(after.heartbeat_epoch)).toBeGreaterThanOrEqual(
      Number(before.heartbeat_epoch),
    );
  });

  it("ensure acquires, renews, refuses foreign, and revives own expiry", () => {
    const lease = new LeaseHarness();
    const acquired = lease.run(
      "ensure",
      "--capability",
      "pm",
      "--session",
      "s1",
    );
    expect(acquired).toMatchObject({
      exitCode: 0,
      payload: { status: "acquired" },
    });
    const token = String(acquired.payload.token);
    expect(
      lease.run("ensure", "--capability", "pm", "--token", token),
    ).toMatchObject({ exitCode: 0, payload: { status: "renewed" } });
    expect(lease.run("ensure", "--capability", "pm")).toMatchObject({
      exitCode: 3,
      payload: { status: "contended" },
    });
    lease.expire();
    expect(lease.run("ensure", "--capability", "pm")).toMatchObject({
      exitCode: 4,
      payload: { status: "takeover_required" },
    });
    expect(
      lease.run("ensure", "--capability", "pm", "--token", token),
    ).toMatchObject({ exitCode: 0, payload: { status: "renewed" } });
  });
});
