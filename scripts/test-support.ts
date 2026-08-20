import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const MINIMUM_NODE_MAJOR = 20;

export function assertSupportedTestRuntime(version = process.versions.node): void {
  const major = Number.parseInt(version.split(".", 1)[0]!, 10);
  if (!Number.isInteger(major) || major < MINIMUM_NODE_MAJOR) {
    throw new Error(
      `this suite needs Node ${MINIMUM_NODE_MAJOR}+ but Vitest is running on ${version}; retry with a current bunx runtime`,
    );
  }
}

assertSupportedTestRuntime();

export async function createTemporaryDirectory(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function removeTemporaryDirectory(path: string): Promise<void> {
  await rm(path, { force: true, recursive: true });
}

export async function writeFixture(
  root: string,
  relativePath: string,
  content: string,
): Promise<string> {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  return path;
}

export async function runBun(
  script: string,
  arguments_: readonly string[],
  options: { readonly cwd?: string; readonly env?: Readonly<Record<string, string>> } = {},
): Promise<{ readonly exitCode: number; readonly stderr: string; readonly stdout: string }> {
  const child = Bun.spawn([process.execPath, script, ...arguments_], {
    cwd: options.cwd,
    env: options.env === undefined ? undefined : { ...process.env, ...options.env },
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stderr, stdout] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ]);
  return { exitCode, stderr, stdout };
}
