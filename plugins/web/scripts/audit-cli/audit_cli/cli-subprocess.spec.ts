import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));

function runCli(
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
): ReturnType<typeof spawnSync> {
  return spawnSync("bun", [cli, ...args], {
    encoding: "utf8",
    env: environment,
  });
}

function fakeBrowserEnvironment(root: string): NodeJS.ProcessEnv {
  const bin = join(root, "bin");
  const executable = join(bin, "agent-browser");
  mkdirSync(bin, { recursive: true });
  writeFileSync(executable, "#!/bin/sh\nexit 0\n");
  chmodSync(executable, 0o755);
  return { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` };
}

describe("audit CLI Bun subprocess contract", () => {
  it("runs a dry-run in isolation and emits report/action-log artifacts", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-cli-subprocess-"));
    const out = join(root, "out");

    try {
      const result = runCli(
        [
          "audit",
          "http://127.0.0.1:1/start/",
          `--out=${out}`,
          "--dry-run",
          "--seeds",
          "/pricing",
          "--max-pages=1",
        ],
        fakeBrowserEnvironment(root),
      );

      expect(result.status).toBe(0);
      expect(result.stderr ?? "").toBe("");
      const reportPath = resolve(out, "report.json");
      expect((result.stdout ?? "").trim()).toBe(reportPath);
      const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
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
      expect(readFileSync(resolve(out, "action-log.jsonl"), "utf8")).not.toBe(
        "",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns nonzero for invalid targets and invalid invocation", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-cli-subprocess-invalid-"));
    const environment = fakeBrowserEnvironment(root);

    try {
      const invalidTarget = runCli(
        ["audit", "not-a-url", "--dry-run"],
        environment,
      );
      expect(invalidTarget.status).not.toBe(0);
      expect(invalidTarget.stdout).toBe("");

      const invalidInvocation = runCli([], environment);
      expect(invalidInvocation.status).not.toBe(0);
      expect(invalidInvocation.stdout).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails preflight deterministically when agent-browser is unavailable", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-cli-subprocess-preflight-"));

    try {
      const environment = {
        ...process.env,
        PATH: join(root, "empty-bin"),
      };
      const result = runCli(
        ["audit", "http://127.0.0.1:1/", "--dry-run"],
        environment,
      );

      expect(result.status).not.toBe(0);
      expect(result.stdout ?? "").toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
