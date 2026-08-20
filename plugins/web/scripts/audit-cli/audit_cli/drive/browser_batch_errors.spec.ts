import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ActionLogger } from "../action_log";
import { BrowserDriver, BrowserDriverError } from "./browser";

const spawnSyncMock = vi.mocked(spawnSync);

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

describe("BrowserDriver batch errors", () => {
  beforeEach(() => spawnSyncMock.mockReset());

  it("uses structured stdout errors when stderr is empty", () => {
    spawnSyncMock.mockReturnValue({
      status: 1,
      stdout:
        '[{"command":["connect","ws://127.0.0.1:9222"],"error":"CDP WebSocket connect failed: IO error: Connection refused (os error 61)","result":null,"success":false}]',
      stderr: "",
    } as ReturnType<typeof spawnSync>);

    const commands = [["connect", "ws://127.0.0.1:9222"]];
    const driver = new BrowserDriver();
    let thrown: unknown;
    const runBatch = () => {
      try {
        driver._run_batch(commands);
      } catch (error) {
        thrown = error;
        throw error;
      }
    };

    expect(runBatch).toThrow(BrowserDriverError);
    expect(String(thrown)).toContain("CDP WebSocket connect failed");
    expect(String(thrown)).not.toContain("<no error details>");
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock.mock.calls[0]?.[0]).toBe("agent-browser");
    expect(spawnSyncMock.mock.calls[0]?.[1]).toContain("batch");
    expect(spawnSyncMock.mock.calls[0]?.[2]).toMatchObject({
      input: expect.stringContaining("connect"),
    });
    expect(spawnSyncMock.mock.calls[0]?.[2]).toMatchObject({
      input: expect.stringContaining("ws://127.0.0.1:9222"),
    });
  });

  it("includes stderr when structured output has no error detail", () => {
    spawnSyncMock.mockReturnValue({
      status: 1,
      stdout: "not-json",
      stderr: "transport failed",
    } as ReturnType<typeof spawnSync>);

    expect(() => new BrowserDriver()._run_batch([["eval", "true"]])).toThrow(
      /transport failed/,
    );
  });

  it("passes batch argv, JSON input, encoding, and timeout to the subprocess", () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: "{}",
      stderr: "",
    } as ReturnType<typeof spawnSync>);

    new BrowserDriver({ binary: "browser-bin", timeout: 4 }).evaluate("true");

    expect(spawnSyncMock).toHaveBeenCalledWith(
      "browser-bin",
      ["batch", "--bail", "--json"],
      expect.objectContaining({
        encoding: "utf8",
        timeout: 4000,
        input: JSON.stringify([["eval", "true"]]),
      }),
    );
  });

  it("reports missing binaries and subprocess timeouts as driver errors", () => {
    const missing = Object.assign(new Error("missing"), { code: "ENOENT" });
    spawnSyncMock.mockReturnValue({
      status: null,
      stdout: "",
      stderr: "",
      error: missing,
    } as ReturnType<typeof spawnSync>);
    expect(() =>
      new BrowserDriver({ binary: "missing-bin" }).evaluate("true"),
    ).toThrow(/binary not found: missing-bin/);

    spawnSyncMock.mockReturnValue({
      status: null,
      stdout: "",
      stderr: "",
      error: Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }),
    } as ReturnType<typeof spawnSync>);
    expect(() => new BrowserDriver({ timeout: 2 }).evaluate("true")).toThrow(
      /timed out after 2s/,
    );
  });

  it("retains non-timeout spawn diagnostics and logs the accurate failure", () => {
    const permissionDenied = Object.assign(new Error("permission denied"), {
      code: "EACCES",
    });
    spawnSyncMock.mockReturnValue({
      status: null,
      stdout: "",
      stderr: "",
      error: permissionDenied,
    } as ReturnType<typeof spawnSync>);
    const root = mkdtempSync(join(tmpdir(), "browser-error-"));
    const logPath = join(root, "events.jsonl");
    try {
      expect(() =>
        new BrowserDriver({
          binary: "protected-bin",
          logger: new ActionLogger(logPath),
        }).evaluate("true"),
      ).toThrow(/permission denied/);
      const entry = JSON.parse(readFileSync(logPath, "utf8").trim()) as {
        event: string;
        error: string;
      };
      expect(entry).toMatchObject({
        event: "browser_action",
        error: expect.stringContaining("permission denied"),
      });
      expect(entry.error).not.toContain("timed out");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
