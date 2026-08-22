import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  detectOs,
  getVersion,
  hasExecutable,
  parseVersion,
  pollUntil,
  run,
  statusLine,
  versionAtLeast,
} from "./lib.ts";

describe("sync-tool library", () => {
  it.each([
    ["darwin", "darwin"],
    ["linux", "linux"],
    ["win32", "windows"],
    ["mingw64", "windows"],
    ["msys_nt", "windows"],
    ["cygwin_nt", "windows"],
    ["freebsd", "unknown"],
  ])("maps platform %s to %s", (platform, expected) => {
    expect(detectOs(platform)).toBe(expected);
  });

  it("looks up executables using the supplied PATH", () => {
    expect(hasExecutable("sh", "/bin")).toBe(true);
    expect(hasExecutable("definitely-absent", "")).toBe(false);
  });

  it("uses PATHEXT case-insensitively for Windows PATH lookup", () => {
    const root = mkdtempSync(join(tmpdir(), "sync-tool-windows-"));
    try {
      writeFileSync(join(root, "tool.CMD"), "stub");
      expect(
        hasExecutable("tool", root, {
          platform: "win32",
          pathExtensions: ".EXE;.CMD",
        }),
      ).toBe(true);
      expect(
        hasExecutable("tool.CMD", root, {
          platform: "win32",
          pathExtensions: ".exe;.cmd",
        }),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("applies Windows extensions to direct paths only when absent", () => {
    const root = mkdtempSync(join(tmpdir(), "sync-tool-direct-"));
    try {
      const command = join(root, "direct");
      writeFileSync(`${command}.EXE`, "stub");
      expect(
        hasExecutable(command, "ignored", {
          platform: "win32",
          pathExtensions: ".EXE;.CMD",
        }),
      ).toBe(true);
      expect(
        hasExecutable(`${command}.EXE`, "ignored", {
          platform: "win32",
          pathExtensions: ".EXE;.CMD",
        }),
      ).toBe(true);
      expect(
        hasExecutable(`${command}.BAT`, "ignored", {
          platform: "win32",
          pathExtensions: ".EXE;.CMD",
        }),
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ["jj 0.44.0", [0, 44, 0]],
    ["v2.3", [2, 3]],
    ["tool 1.2.3.4 extra", [1, 2, 3, 4]],
    ["1", undefined],
    ["", undefined],
  ])("parses version from %j", (text, expected) => {
    expect(parseVersion(text)).toEqual(expected);
  });

  it.each([
    ["0.44.0", "0.44.0", true],
    ["0.45", "0.44.9", true],
    ["1.2", "1.2.0.1", false],
    ["garbage", "1.0", false],
  ])("compares %s against %s", (actual, minimum, expected) => {
    expect(versionAtLeast(actual, minimum)).toBe(expected);
  });

  it("runs argv and shell commands with capture, cwd, and environment", () => {
    const argv = run(["sh", "-c", 'printf "%s:%s" "$PWD" "$SYNC_TEST"'], {
      cwd: "/tmp",
      env: { SYNC_TEST: "value" },
    });
    expect(argv).toMatchObject({
      ok: true,
      returnCode: 0,
      stdout: `${realpathSync("/tmp")}:value`,
      stderr: "",
    });
    expect(run("printf shell")).toMatchObject({ ok: true, stdout: "shell" });
  });

  it("echoes dry runs without executing", () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expect(run(["false"], { dryRun: true })).toEqual({
      ok: true,
      returnCode: 0,
      stdout: "",
      stderr: "",
    });
    expect(error).toHaveBeenCalledWith("+ false");
    error.mockRestore();
  });

  it("returns failures and throws when check is requested", () => {
    expect(run(["sh", "-c", "printf bad >&2; exit 7"])).toMatchObject({
      ok: false,
      returnCode: 7,
      stderr: "bad",
    });
    expect(() => run(["sh", "-c", "exit 9"], { check: true })).toThrow(
      "returned non-zero exit status 9",
    );
  });

  it.each([false, true])(
    "throws when a command cannot be spawned (check=%s)",
    (check) => {
      expect(() => run(["definitely-absent-sync-command"], { check })).toThrow();
    },
  );

  it("reads versions from stdout, stderr, failure, and absence", () => {
    expect(getVersion("sh", ["-c", "printf 1.2.3"])).toBe("1.2.3");
    expect(getVersion("sh", ["-c", "printf 2.0 >&2"])).toBe("2.0");
    expect(getVersion("sh", ["-c", "exit 1"])).toBeUndefined();
    expect(getVersion("definitely-absent")).toBeUndefined();
  });

  it("polls until true and periodically reprints its banner", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    let polls = 0;
    expect(
      pollUntil(() => ++polls === 3, {
        banner: "waiting",
        intervalSeconds: 0,
        reprintEveryPolls: 2,
      }),
    ).toBe(true);
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it("supports no-wait without evaluating the check", () => {
    const check = vi.fn(() => true);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(pollUntil(check, { banner: "waiting", noWait: true })).toBe(false);
    expect(check).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("formats status lines", () => {
    expect(statusLine("jj", "updated", "jj.sh")).toBe("jj: updated (jj.sh)");
  });
});
import { realpathSync } from "node:fs";
