import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "audit-cli-lane2-"));
}

export async function removeDirectory(path: string): Promise<void> {
  await rm(path, { force: true, recursive: true });
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export function runBun(
  script: string,
  args: readonly string[] = [],
  environment: NodeJS.ProcessEnv = {},
): { exitCode: number; stderr: string; stdout: string } {
  const result = spawnSync("bun", ["run", script, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
  return {
    exitCode: result.status ?? 1,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}
