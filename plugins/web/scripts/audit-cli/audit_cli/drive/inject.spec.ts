import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BrowserDriver } from "./browser";
import { AuditServer, injectAndRun, serveAuditScripts } from "./inject";

const scriptNames = [
  "wcag-text-audit.js",
  "semantic-structure-audit.js",
  "interaction-audit.js",
  "mobile-layout-audit.js",
  "visual-layout-audit.js",
  "design-tokens-audit.js",
  "typography-audit.js",
  "spatial-layout-audit.js",
  "unused-css-audit.js",
  "modal-audit.js",
  "design-audit-aggregator.js",
] as const;

async function startServer(root: string): Promise<AuditServer> {
  return await serveAuditScripts(root);
}

describe("audit script server", () => {
  it("binds an isolated localhost server and serves files by path", async () => {
    const root = await mkdtemp(join(tmpdir(), "audit-inject-"));
    await writeFile(join(root, "probe.js"), "ignored fixture payload");
    const server = await startServer(root);

    try {
      expect(server.host).toBe("127.0.0.1");
      expect(server.port).toBeGreaterThan(0);
      const response = await fetch(
        `http://${server.host}:${server.port}/probe.js`,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("javascript");
      const missing = await fetch(
        `http://${server.host}:${server.port}/missing.js`,
      );
      expect(missing.status).toBe(404);
    } finally {
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
  });

  it("stops serving after close and does not share ports between live servers", async () => {
    const firstRoot = await mkdtemp(join(tmpdir(), "audit-inject-one-"));
    const secondRoot = await mkdtemp(join(tmpdir(), "audit-inject-two-"));
    const first = await startServer(firstRoot);
    const second = await startServer(secondRoot);

    try {
      expect(second.port).not.toBe(first.port);
      await first.close();
      await first.close();
      await expect(
        fetch(`http://${first.host}:${first.port}/missing.js`),
      ).rejects.toThrow();
      const response = await fetch(
        `http://${second.host}:${second.port}/missing.js`,
      );
      expect(response.status).toBe(404);
    } finally {
      await second.close();
      await rm(firstRoot, { force: true, recursive: true });
      await rm(secondRoot, { force: true, recursive: true });
    }
  });

  it("rejects traversal paths and encoded traversal without exposing files", async () => {
    const root = await mkdtemp(join(tmpdir(), "audit-inject-traversal-"));
    const server = await startServer(root);

    try {
      for (const path of ["/../package.json", "/%2e%2e/package.json"]) {
        const response = await fetch(
          `http://${server.host}:${server.port}${path}`,
        );
        expect(response.status).toBe(404);
      }
    } finally {
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
  });
});

describe("audit script injection", () => {
  it("loads scripts in contract order, waits for each global, and returns structured JSON", async () => {
    const server = {
      host: "127.0.0.1",
      port: 19001,
      scripts_dir: "/tmp/audit",
    } as AuditServer;
    const calls: string[] = [];
    const driver = {
      evaluate(expression: string) {
        calls.push(`evaluate:${expression}`);
        if (expression.includes("runDesignAudit")) {
          return { stdout: '[{"result":{"result":"{\\"score\\":82}"}}]' };
        }
        return { stdout: "" };
      },
      wait_for_fn(expression: string) {
        calls.push(`wait:${expression}`);
        return { stdout: "" };
      },
    } satisfies Pick<BrowserDriver, "evaluate" | "wait_for_fn">;

    const result = await injectAndRun(driver, server, {
      viewport_label: "Desktop 1440x900",
      viewport_kind: "desktop",
    });

    expect(result).toEqual({ score: 82 });
    expect(calls.filter((call) => call.startsWith("evaluate:")).length).toBe(
      12,
    );
    expect(calls.filter((call) => call.startsWith("wait:")).length).toBe(12);
    expect(calls[0]).toContain("wcag-text-audit.js");
    expect(calls[2]).toContain("semantic-structure-audit.js");
    expect(calls.at(-2)).toContain("runDesignAudit");
    expect(calls.at(-1)).toContain("runDesignAudit");
    for (const [index, scriptName] of scriptNames.entries()) {
      expect(calls[index * 2]).toContain(scriptName);
    }
  });

  it("rejects a non-object aggregator result", async () => {
    const server = {
      host: "127.0.0.1",
      port: 19002,
      scripts_dir: "/tmp/audit",
    } as AuditServer;
    const driver = {
      evaluate: () => ({ stdout: '[{"result":{"result":"[]"}}]' }),
      wait_for_fn: () => ({ stdout: "" }),
    } satisfies Pick<BrowserDriver, "evaluate" | "wait_for_fn">;

    await expect(
      injectAndRun(driver, server, {
        viewport_label: "Mobile 390x844",
        viewport_kind: "mobile",
      }),
    ).rejects.toThrow();
  });

  it("stops the sequence when a driver evaluation fails", async () => {
    const calls: string[] = [];
    const driver = {
      evaluate(expression: string) {
        calls.push(`evaluate:${expression}`);
        throw new Error("evaluate failed");
      },
      wait_for_fn(expression: string) {
        calls.push(`wait:${expression}`);
        return { stdout: "" };
      },
    } satisfies Pick<BrowserDriver, "evaluate" | "wait_for_fn">;

    await expect(
      injectAndRun(
        driver,
        { host: "127.0.0.1", port: 1 },
        {
          viewport_label: "Mobile 390x844",
          viewport_kind: "mobile",
        },
      ),
    ).rejects.toThrow("evaluate failed");
    expect(calls).toHaveLength(1);
  });
});
