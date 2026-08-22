import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ActionLogger } from "./action_log";
import { BrowserDriver } from "./drive/browser";

const spawnSyncMock = vi.mocked(spawnSync);

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

describe("ActionLogger", () => {
  it("writes JSONL entries with optional fields", () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "action-log-")),
      "events.jsonl",
    );
    const logger = new ActionLogger(path);

    logger.log("page_start", {
      page: "https://example.com",
      viewport: "desktop",
    });
    logger.log("page_finish", { page: "https://example.com", issues: 2 });

    const entries = readFileSync(path, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(
      entries.map((entry) => [entry.event, entry.page, entry.issues]),
    ).toEqual([
      ["page_start", "https://example.com", undefined],
      ["page_finish", "https://example.com", 2],
    ]);
    expect(entries.every((entry) => typeof entry.timestamp === "string")).toBe(
      true,
    );
    expect(entries[0]).not.toHaveProperty("issues");
  });

  it("logs a successful browser action", () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "action-log-")),
      "events.jsonl",
    );
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: '[{"result":{"url":"https://example.com"},"success":true}]',
      stderr: "",
    } as ReturnType<typeof spawnSync>);

    const driver = new BrowserDriver({ logger: new ActionLogger(path) });
    driver.navigate("https://example.com");

    const entries = readFileSync(path, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const lastEntry = entries.at(-1);
    expect(lastEntry).toBeDefined();
    expect({
      event: lastEntry?.event,
      action: lastEntry?.action,
      success: lastEntry?.success,
    }).toEqual({
      event: "browser_action",
      action: "open",
      success: true,
    });
  });
});
