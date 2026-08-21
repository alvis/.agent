import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createStorybookCommandEnvironment } from "./storybook-test-support";

const scripts = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "skills",
  "storybook",
  "scripts",
);

function runScript(
  script: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
  cwd: string,
): ReturnType<typeof spawnSync> {
  return spawnSync(join(scripts, script), args, {
    cwd,
    env: environment,
    encoding: "utf8",
    timeout: 15_000,
  });
}

describe("storybook script injection paths", () => {
  it("keeps injections outside the Storybook skill directory", () => {
    const localInjections = join(
      fileURLToPath(new URL(".", import.meta.url)),
      "..",
      "skills",
      "storybook",
      "injections",
    );
    expect(existsSync(localInjections)).toBe(false);
  });

  it.each([
    ["list-stories.sh", ["--cdp", "9222", "--url", "http://storybook"]],
    [
      "capture-states.sh",
      ["--cdp", "9222", "--url", "http://storybook", "--story", "button"],
    ],
    [
      "scrape-panels.sh",
      ["--cdp", "9222", "--url", "http://storybook", "--story", "button"],
    ],
  ] as const)(
    "resolves shared injection for %s",
    async (script, args) => {
      const root = await mkdtemp(join(tmpdir(), "storybook-injection-"));
      const runDir = join(root, "run");
      try {
        const environment = await createStorybookCommandEnvironment(root);
        const result = runScript(
          script,
          script === "list-stories.sh" ? args : [...args, "--run-dir", runDir],
          environment,
          root,
        );

        expect(result.status).toBe(0);
        expect(result.stderr).not.toContain("missing injection");
        expect(result.stdout).not.toBe("");
        expect(await readFile(join(root, "commands.log"), "utf8")).toContain(
          "--cdp 9222",
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    20_000,
  );

  it("passes an explicit run directory through the capture script", async () => {
    const root = await mkdtemp(join(tmpdir(), "storybook-run-dir-"));
    const runDir = join(root, "explicit-run");
    try {
      const environment = await createStorybookCommandEnvironment(root);
      const result = runScript(
        "capture-states.sh",
        [
          "--cdp",
          "9222",
          "--url",
          "http://storybook",
          "--story",
          "button",
          "--run-dir",
          runDir,
        ],
        environment,
        root,
      );

      expect(result.status).toBe(0);
      expect(result.stdout?.trim()).toContain("states.json");
      expect(result.stderr).not.toContain("missing injection");
      expect(result.stdout).toContain(runDir);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("degrades to an empty list when the shared story injection is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "storybook-missing-injection-"));
    try {
      const copiedScript = join(
        root,
        "plugin",
        "skills",
        "storybook",
        "scripts",
        "list-stories.sh",
      );
      await mkdir(join(copiedScript, ".."), { recursive: true });
      await copyFile(join(scripts, "list-stories.sh"), copiedScript);
      await chmod(copiedScript, 0o755);
      const environment = await createStorybookCommandEnvironment(root);
      const result = spawnSync(
        copiedScript,
        ["--cdp", "9222", "--url", "http://storybook"],
        { cwd: root, env: environment, encoding: "utf8", timeout: 15_000 },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("missing injection");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns usage errors without creating a run directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "storybook-usage-"));
    try {
      const environment = await createStorybookCommandEnvironment(root);
      const result = runScript("capture-states.sh", [], environment, root);

      expect(result.status).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("usage:");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
