import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export async function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "discover-test-"));
}
export async function removeDirectory(path: string): Promise<void> {
  await rm(path, { force: true, recursive: true });
}
export async function fixture(
  root: string,
  relative: string,
  text: string,
): Promise<string> {
  const path = join(root, relative);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
  return path;
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
