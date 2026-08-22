import { readFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildParser, runAudit } from "./cli";

describe("audit CLI orchestration", () => {
  it("parses target, output, crawl, viewport, and dry-run options", () => {
    const args = buildParser().parseArgs([
      "audit",
      "https://example.com/start/",
      "--out",
      "/tmp/audit-result",
      "--max-pages",
      "7",
      "--all-pages",
      "--seeds",
      "/pricing",
      "/docs",
      "--viewport",
      "tablet",
      "--dry-run",
      "--cdp-url",
      "http://127.0.0.1:9222",
    ]);

    expect(args).toMatchObject({
      command: "audit",
      target: "https://example.com/start/",
      out: "/tmp/audit-result",
      maxPages: 7,
      all_pages: true,
      seeds: ["/pricing", "/docs"],
      viewport: "tablet",
      dry_run: true,
      cdp_url: "http://127.0.0.1:9222",
    });
  });

  it("provides stable parser defaults", () => {
    const args = buildParser().parseArgs(["audit", "https://example.com"]);

    expect(args).toMatchObject({
      command: "audit",
      project: null,
      out: ".audit-out",
      maxPages: 25,
      all_pages: false,
      seeds: [],
      viewport: "all",
      dry_run: false,
      cdp_url: null,
    });
  });

  it("rejects an invalid target with exit code two", async () => {
    const args = buildParser().parseArgs([
      "audit",
      "not-a-url",
      "--dry-run",
    ]);

    await expect(runAudit(args)).resolves.toBe(2);
  });

  it("writes a structured dry-run report and returns its output path", async () => {
    const out = await mkdtemp(join(tmpdir(), "audit-cli-out-"));
    const print = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      const args = buildParser().parseArgs([
        "audit",
        "http://127.0.0.1:1/start/",
        "--out",
        out,
        "--dry-run",
        "--seeds",
        "/pricing",
      ]);
      await expect(runAudit(args)).resolves.toBe(0);

      const reportPath = join(out, "report.json");
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        contract_version: string;
        target: string;
        pages: Array<{ url: string }>;
      };
      expect(report).toMatchObject({
        contract_version: "3.0",
        target: "http://127.0.0.1:1/start",
      });
      expect(report.pages.map((page) => page.url)).toEqual([
        "http://127.0.0.1:1/start",
        "http://127.0.0.1:1/pricing",
      ]);
      expect(print).toHaveBeenCalledWith(reportPath);
    } finally {
      print.mockRestore();
      await rm(out, { force: true, recursive: true });
    }
  });

  it("uses the selected viewport without launching browser work in dry-run mode", async () => {
    const out = await mkdtemp(join(tmpdir(), "audit-cli-viewport-"));

    try {
      const args = buildParser().parseArgs([
        "audit",
        "http://127.0.0.1:1/",
        "--out",
        out,
        "--viewport",
        "mobile",
        "--dry-run",
      ]);
      await expect(runAudit(args)).resolves.toBe(0);

      const report = JSON.parse(
        await readFile(join(out, "report.json"), "utf8"),
      ) as {
        pages: Array<{ viewports: Array<{ label: string }> }>;
      };
      expect(report.pages[0]?.viewports).toEqual([
        expect.objectContaining({ label: "mobile" }),
      ]);
    } finally {
      await rm(out, { force: true, recursive: true });
    }
  });
});
