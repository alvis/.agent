import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

interface HookEntry {
  readonly command: string;
  readonly args?: readonly string[];
}
interface HooksDocument {
  readonly hooks: Readonly<Record<string, readonly { readonly hooks: readonly HookEntry[] }[]>>;
}
interface InstalledPlugin {
  readonly enabled: boolean;
  readonly id: string;
  readonly installPath: string;
}
interface HookPayload {
  readonly additionalContext: unknown;
  readonly hookEventName: string;
}

function which(binary: string): string | undefined {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (directory === "") continue;
    const candidate = join(directory, binary);
    try {
      if (!statSync(candidate).isFile()) continue;
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* absent or not executable on this PATH entry: keep scanning */
    }
  }
  return undefined;
}

const claude = which("claude");

// these tests drive the real `claude plugin` CLI end to end; without the
// binary they cannot state anything, so they skip instead of failing the
// whole run (e.g. on a CI runner without Claude Code installed).
describe.skipIf(claude === undefined)("claude plugin dependency integration", () => {
  function runClaude(config: string, args: readonly string[]): SpawnSyncReturns<string> {
    expect(claude).toBeDefined();
    return spawnSync(claude!, ["plugin", ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, CLAUDE_CONFIG_DIR: config },
    });
  }

  function runInstalledHooks(
    config: string,
    pluginRoot: string,
    event: string,
    inputJson: string,
  ): SpawnSyncReturns<string>[] {
    const document = JSON.parse(
      readFileSync(join(pluginRoot, "hooks/hooks.json"), "utf8"),
    ) as HooksDocument;
    const substitutions: readonly (readonly [string, string])[] = [
      ["${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}", pluginRoot],
      ["${HOME}", process.env.HOME!],
    ];
    const completed: SpawnSyncReturns<string>[] = [];
    for (const matcher of document.hooks[event] ?? []) {
      for (const hook of matcher.hooks) {
        let command = hook.command;
        let args = hook.args ?? [];
        for (const [key, value] of substitutions) {
          command = command.replaceAll(key, value);
          args = args.map((argument) => argument.replaceAll(key, value));
        }
        const invocation = args.length > 0 ? [command, ...args] : ["/bin/bash", "-c", command];
        completed.push(
          spawnSync(invocation[0]!, invocation.slice(1), {
            cwd: "/tmp",
            encoding: "utf8",
            env: { ...process.env, CLAUDE_CONFIG_DIR: config },
            input: inputJson,
          }),
        );
      }
    }
    return completed;
  }

  function enabledByPlugin(plugins: readonly InstalledPlugin[]): Record<string, boolean> {
    return Object.fromEntries(plugins.map((item) => [item.id, item.enabled]));
  }

  it("should install react and gate disabling on its dependencies", async () => {
    const config = await mkdtemp(join(tmpdir(), "claude-plugin-integration-"));
    try {
      const added = runClaude(config, ["marketplace", "add", root]);
      expect(added.status, added.stderr).toBe(0);
      const installed = runClaude(config, ["install", "react@alvis"]);
      expect(installed.status, installed.stderr).toBe(0);
      const listed = runClaude(config, ["list", "--json"]);
      const records = JSON.parse(listed.stdout) as InstalledPlugin[];
      expect(enabledByPlugin(records)).toEqual({
        "coding@alvis": true,
        "essential@alvis": true,
        "react@alvis": true,
      });
      const essentialRoot = records.find((item) => item.id === "essential@alvis")!.installPath;
      const sessionHook = join(essentialRoot, "hooks/scripts/session-start");
      expect(statSync(sessionHook).isFile()).toBe(true);
      expect(() => accessSync(sessionHook, constants.X_OK)).not.toThrow();
      expect(statSync(join(essentialRoot, "hooks/scripts/subagent-start")).isFile()).toBe(true);
      const payloads = runInstalledHooks(
        config,
        essentialRoot,
        "SessionStart",
        '{"source":"startup","session_id":"integration"}',
      ).map((hook) => {
        expect(hook.status, hook.stderr).toBe(0);
        return (JSON.parse(hook.stdout) as { hookSpecificOutput: HookPayload }).hookSpecificOutput;
      });
      expect(payloads.length).toBeGreaterThan(0);
      expect(
        payloads.every(
          (payload) =>
            payload.hookEventName === "SessionStart" && Boolean(payload.additionalContext),
        ),
      ).toBe(true);
      const blockedEssential = runClaude(config, ["disable", "essential@alvis"]);
      expect(blockedEssential.status).not.toBe(0);
      const essentialError = `${blockedEssential.stderr}${blockedEssential.stdout}`;
      expect(essentialError).toContain("still required by");
      expect(essentialError).toContain("coding");
      const blockedCoding = runClaude(config, ["disable", "coding@alvis"]);
      expect(blockedCoding.status).not.toBe(0);
      expect(`${blockedCoding.stderr}${blockedCoding.stdout}`).toContain("still required by react");
      expect(runClaude(config, ["disable", "react@alvis"]).status).toBe(0);
      expect(runClaude(config, ["disable", "coding@alvis"]).status).toBe(0);
      expect(runClaude(config, ["disable", "essential@alvis"]).status).toBe(0);
      const final = runClaude(config, ["list", "--json"]);
      expect(enabledByPlugin(JSON.parse(final.stdout) as InstalledPlugin[])).toEqual({
        "coding@alvis": false,
        "essential@alvis": false,
        "react@alvis": false,
      });
    } finally {
      await rm(config, { force: true, recursive: true });
    }
  }, 300_000);

  it("should emit SessionStart environment context from the essential hook script", () => {
    const completed = spawnSync(
      join(root, "plugins/essential/hooks/scripts/session-start"),
      [
        "--plugin-dir",
        join(root, "plugins/essential"),
        "--constitution-paths",
        join(root, "plugins/essential"),
      ],
      { encoding: "utf8", input: '{"source":"startup","session_id":"test"}' },
    );
    expect(completed.status, completed.stderr).toBe(0);
    const output = (JSON.parse(completed.stdout) as { hookSpecificOutput: HookPayload })
      .hookSpecificOutput;
    expect(output.hookEventName).toBe("SessionStart");
    expect(Boolean(output.additionalContext)).toBe(true);
  }, 120_000);

  it("should emit SubagentStart environment context from the essential hook script", () => {
    const completed = spawnSync(
      join(root, "plugins/essential/hooks/scripts/subagent-start"),
      [
        "--plugin-dir",
        join(root, "plugins/essential"),
        "--constitution-paths",
        join(root, "plugins/essential"),
      ],
      { encoding: "utf8", input: '{"session_id":"test"}' },
    );
    expect(completed.status, completed.stderr).toBe(0);
    const output = (JSON.parse(completed.stdout) as { hookSpecificOutput: HookPayload })
      .hookSpecificOutput;
    expect(output.hookEventName).toBe("SubagentStart");
    expect(Boolean(output.additionalContext)).toBe(true);
  }, 120_000);
});
