import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

import { REGISTRY, resolveToolList } from "./sync.ts";

const script = fileURLToPath(new URL("./sync.ts", import.meta.url));
const bunExecutable = spawnSync("which", ["bun"], {
  encoding: "utf8",
}).stdout.trim();
const usage =
  "usage: sync.ts [-h] [--only ONLY] [--check] [--dry-run] [--force]";

function cli(args: string[], path = process.env.PATH ?? "") {
  return spawnSync("bun", ["run", script, ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: path },
  });
}

async function fakeExecutable(root: string, name: string, body: string) {
  const path = join(root, name);
  await writeFile(path, `#!/bin/sh\n${body}\n`);
  await chmod(path, 0o755);
}

async function isolatedPath(root: string): Promise<string> {
  await symlink(bunExecutable, join(root, "bun"));
  return `${root}${delimiter}/usr/bin:/bin`;
}

describe("sync-tool CLI", () => {
  it("keeps the authoritative registry order and metadata", () => {
    expect(REGISTRY).toEqual([
      {
        name: "brew",
        installer: "brew.sh",
        minVersion: "4.0.0",
        macosOnly: true,
      },
      { name: "jj", installer: "jj.sh", minVersion: "0.44.0" },
      { name: "gh", installer: "gh.sh", minVersion: "2.0.0" },
      { name: "fallow", installer: "fallow.sh", minVersion: "2.0.0" },
      {
        name: "python",
        installer: "python.sh",
        executable: "python3",
        alwaysRunInstaller: true,
      },
    ]);
  });

  it("selects trimmed CSV names in registry order and deduplicates", () => {
    expect(resolveToolList(" python, jj,jj ").map(({ name }) => name)).toEqual([
      "jj",
      "python",
    ]);
    expect(resolveToolList("")).toBe(REGISTRY);
  });

  it("rejects sorted unknown names with the registered roster", () => {
    expect(() => resolveToolList("zzz,aaa")).toThrow(
      "sync-tool: unknown tool name(s): aaa, zzz. Registered: brew, jj, gh, fallow, python",
    );
  });

  it.each(["-h", "--help"])("prints help for %s", (option) => {
    const completed = cli([option]);
    expect(completed.status).toBe(0);
    expect(completed.stderr).toBe("");
    expect(completed.stdout).toContain(usage);
    expect(completed.stdout).toContain("--dry-run");
  });

  it.each([["--only"], ["--only", "--check"]])(
    "rejects a missing --only value",
    (...args) => {
      const completed = cli(args);
      expect(completed.status).toBe(2);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe(
        `${usage}\nsync.ts: error: argument --only: expected one argument\n`,
      );
    },
  );

  it("rejects unknown options exactly", () => {
    const completed = cli(["--unknown"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(
      `${usage}\nsync.ts: error: unrecognized arguments: --unknown\n`,
    );
  });

  it("rejects an empty long-option name like argparse", () => {
    const completed = cli(["--=x"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(
      `${usage}\nsync.ts: error: ambiguous option: --=x could match --help, --only, --check, --dry-run, --force\n`,
    );
  });

  it("accepts equals syntax and reports unknown selected tools", () => {
    const completed = cli(["--only=missing", "--check"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(
      "sync-tool: unknown tool name(s): missing. Registered: brew, jj, gh, fallow, python\n",
    );
  });

  it.each(["--he", "--hel"])(
    "accepts the unambiguous help abbreviation %s",
    (option) => {
      const completed = cli([option, "--unknown"]);
      expect(completed.status).toBe(0);
      expect(completed.stdout).toContain(usage);
      expect(completed.stderr).toBe("");
    },
  );

  it.each([
    ["--help=value", "argument -h/--help: ignored explicit argument 'value'"],
    ["--check=yes", "argument --check: ignored explicit argument 'yes'"],
    ["--dry-run=no", "argument --dry-run: ignored explicit argument 'no'"],
    ["--force=1", "argument --force: ignored explicit argument '1'"],
  ])("rejects forbidden explicit option value %s", (option, message) => {
    const completed = cli([option]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(`${usage}\nsync.ts: error: ${message}\n`);
  });

  it.each(["-1", "-.1", "-١"])(
    "accepts complete negative numeric --only value %s before registry validation",
    (value) => {
      const completed = cli(["--only", value]);
      expect(completed.status).toBe(2);
      expect(completed.stderr).toContain(`unknown tool name(s): ${value}`);
    },
  );

  it.each(["-1x", "-1."])(
    "rejects incomplete negative numeric --only value %s",
    (value) => {
      const completed = cli(["--only", value]);
      expect(completed.status).toBe(2);
      expect(completed.stderr).toBe(
        `${usage}\nsync.ts: error: argument --only: expected one argument\n`,
      );
    },
  );

  it("rejects a trailing -- before checking tools", () => {
    const completed = cli(["--check", "--"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(
      `${usage}\nsync.ts: error: unrecognized arguments: --\n`,
    );
  });

  it("reports -h after -- as an extra rather than help", () => {
    const completed = cli(["--", "--", "-h"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(
      `${usage}\nsync.ts: error: unrecognized arguments: -- -h\n`,
    );
  });

  it("reports terminator and following extras in order", () => {
    const completed = cli(["--", "--", "--check", "extra"]);
    expect(completed.status).toBe(2);
    expect(completed.stderr).toBe(
      `${usage}\nsync.ts: error: unrecognized arguments: -- --check extra\n`,
    );
  });

  it("reports unknown and positional extras in encounter order", () => {
    const completed = cli(["extra", "--unknown", "tail"]);
    expect(completed.status).toBe(2);
    expect(completed.stderr).toBe(
      `${usage}\nsync.ts: error: unrecognized arguments: extra --unknown tail\n`,
    );
  });

  it("treats an empty equals selection as all registered tools", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-tool-path-"));
    try {
      const completed = cli(["--only=", "--check"], await isolatedPath(root));
      expect(completed.status).toBe(1);
      expect(completed.stdout).toContain("summary: 5 tools");
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("reports a missing selected executable and summary on stdout", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-tool-path-"));
    try {
      const completed = cli(["--only=jj", "--check"], await isolatedPath(root));
      expect(completed.status).toBe(1);
      expect(completed.stderr).toBe("");
      expect(completed.stdout).toBe(
        "jj: failed (jj missing)\nsummary: 1 tools — 1 failed\n",
      );
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it.each([
    ["0.43.0", 1, "failed", "jj below 0.44.0 (got jj 0.43.0)"],
    ["0.44.0", 0, "already_current", "version >= 0.44.0"],
    ["0.45.0", 0, "already_current", "version >= 0.44.0"],
  ])(
    "enforces the predecessor jj minimum for %s",
    async (version, status, state, action) => {
      const root = await mkdtemp(join(tmpdir(), "sync-tool-"));
      await fakeExecutable(root, "jj", `printf '%s\\n' 'jj ${version}'`);
      try {
        const completed = cli(
          ["--only=jj", "--check"],
          `${root}${delimiter}${process.env.PATH}`,
        );
        expect(completed.status).toBe(status);
        expect(completed.stderr).toBe("");
        expect(completed.stdout).toBe(
          `jj: ${state} (${action})\nsummary: 1 tools — 1 ${state}\n`,
        );
        expect(completed.stdout).toContain("0.44.0");
      } finally {
        await rm(root, { recursive: true });
      }
    },
  );

  it("uses version stderr when stdout is empty", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-tool-"));
    await fakeExecutable(root, "jj", "printf '%s\\n' 'jj 0.45.0' >&2");
    try {
      const completed = cli(
        ["--only", "jj", "--check"],
        `${root}${delimiter}${process.env.PATH}`,
      );
      expect(completed.status).toBe(0);
      expect(completed.stdout).toContain(
        "jj: already_current (version >= 0.44.0)",
      );
      expect(completed.stderr).toBe("");
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("reports an unparseable version as unknown", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-tool-"));
    await fakeExecutable(root, "jj", "printf unknown");
    try {
      const completed = cli(
        ["--only=jj", "--check"],
        `${root}${delimiter}${process.env.PATH}`,
      );
      expect(completed.status).toBe(1);
      expect(completed.stdout).toContain("jj below 0.44.0 (got unknown)");
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it.each([
    [false, "installed"],
    [true, "updated"],
  ])(
    "reports jj as %s after a successful mutating installer",
    async (present, state) => {
      const root = await mkdtemp(join(tmpdir(), "sync-tool-mutate-"));
      try {
        const path = await isolatedPath(root);
        await fakeExecutable(root, "uname", "printf Linux");
        const template = join(root, "jj-template");
        await fakeExecutable(
          root,
          "cargo",
          'cp "$JJ_TEMPLATE" "$SYNC_BIN/jj"; chmod 755 "$SYNC_BIN/jj"',
        );
        await fakeExecutable(root, "jj-template", "printf '%s\\n' 'jj 0.45.0'");
        if (present)
          await fakeExecutable(root, "jj", "printf '%s\\n' 'jj 0.43.0'");
        const completed = spawnSync("bun", ["run", script, "--only=jj"], {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: path,
            JJ_TEMPLATE: template,
            SYNC_BIN: root,
          },
        });
        expect(completed.status, completed.stderr).toBe(0);
        expect(completed.stdout).toContain(`jj: ${state} (jj.sh)`);
      } finally {
        await rm(root, { recursive: true });
      }
    },
  );

  it("preserves installer output and reports installer failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-tool-failure-"));
    try {
      const path = await isolatedPath(root);
      await fakeExecutable(root, "uname", "printf Linux");
      await fakeExecutable(
        root,
        "cargo",
        "printf inherited-out; printf inherited-error >&2; exit 7",
      );
      const completed = cli(["--only=jj"], path);
      expect(completed.status).toBe(1);
      expect(completed.stdout).toContain("inherited-out");
      expect(completed.stdout).toContain("jj: failed (jj.sh exited 7)");
      expect(completed.stderr).toContain("inherited-error");
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("fails when the installer exits successfully without providing the executable", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-tool-post-install-"));
    try {
      const path = await isolatedPath(root);
      await fakeExecutable(root, "uname", "printf Linux");
      await fakeExecutable(root, "cargo", "exit 0");
      const completed = cli(["--only=jj"], path);
      expect(completed.status).toBe(1);
      expect(completed.stdout).toContain(
        "jj: failed (jj still missing after installer)",
      );
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("passes DRY_RUN and skips post-install verification", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-tool-dry-run-"));
    try {
      const path = await isolatedPath(root);
      await fakeExecutable(root, "uname", "printf Linux");
      await fakeExecutable(root, "cargo", "exit 99");
      const completed = cli(["--only=jj", "--dry-run"], path);
      expect(completed.status).toBe(0);
      expect(completed.stderr).toContain(
        "+ cargo install --locked --bin jj jj-cli",
      );
      expect(completed.stdout).toContain("jj: skipped (dry-run)");
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("passes FORCE to an installer for an already-current tool", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-tool-force-"));
    try {
      const path = await isolatedPath(root),
        log = join(root, "force-log");
      await fakeExecutable(root, "uname", "printf Linux");
      await fakeExecutable(root, "jj", "printf '%s\\n' 'jj 0.45.0'");
      await fakeExecutable(root, "cargo", 'printf "%s" "$FORCE" >"$FORCE_LOG"');
      const completed = spawnSync(
        "bun",
        ["run", script, "--only=jj", "--force"],
        {
          encoding: "utf8",
          env: { ...process.env, PATH: path, FORCE_LOG: log },
        },
      );
      expect(completed.status, completed.stderr).toBe(0);
      expect(await readFile(log, "utf8")).toBe("1");
      expect(completed.stdout).toContain("jj: updated (jj.sh)");
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("always runs the rolling Python installer and reports updated", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-tool-python-"));
    try {
      const path = await isolatedPath(root),
        log = join(root, "brew-log");
      await fakeExecutable(root, "uname", "printf Darwin");
      await fakeExecutable(root, "python3", "printf '%s\\n' 'Python 3.14.0'");
      await fakeExecutable(root, "brew", 'printf "%s" "$*" >"$BREW_LOG"');
      const completed = spawnSync("bun", ["run", script, "--only=python"], {
        encoding: "utf8",
        env: { ...process.env, PATH: path, BREW_LOG: log },
      });
      expect(completed.status, completed.stderr).toBe(0);
      expect(await readFile(log, "utf8")).toBe("upgrade python");
      expect(completed.stdout).toContain("python: updated (python.sh)");
    } finally {
      await rm(root, { recursive: true });
    }
  });
});
