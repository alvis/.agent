import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { assertSupportedTestRuntime, MINIMUM_NODE_MAJOR } from "./test-support.ts";
import { createTemporaryDirectory, removeTemporaryDirectory } from "./test-support.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const pluginsRoot = join(root, "plugins");
const claudeCatalogPath = join(root, ".claude-plugin", "marketplace.json");
const codexCatalogPath = join(root, ".agents", "plugins", "marketplace.json");
const harnessVariables = ["CLAUDE_PLUGIN_ROOT", "PLUGIN_ROOT"] as const;
const payloadEvents = new Map([
  ["hooks/ALLAGENT.md", new Set(["SessionStart", "SubagentStart"])],
  ["hooks/MAINAGENT.md", new Set(["SessionStart"])],
  ["hooks/SUBAGENT.md", new Set(["SubagentStart"])],
]);

interface ClaudePlugin { readonly category: string; readonly description: string; readonly name: string; readonly source: string }
interface CodexPlugin { readonly category: string; readonly name: string; readonly policy: { readonly authentication: string; readonly installation: string }; readonly source: { readonly path: string; readonly source: string } }
interface HookEntry { readonly hooks: readonly { readonly command: string; readonly type: string }[] }

function json<T>(path: string): T { return JSON.parse(readFileSync(path, "utf8")) as T; }
function claudePlugins(): ClaudePlugin[] { return json<{ plugins: ClaudePlugin[] }>(claudeCatalogPath).plugins; }
function codexPlugins(): CodexPlugin[] { return json<{ plugins: CodexPlugin[] }>(codexCatalogPath).plugins; }
function files(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? files(child) : [child];
  });
}
function skillFiles(): string[] { return claudePlugins().flatMap(({ source }) => files(join(root, source, "skills")).filter((path) => path.endsWith("/SKILL.md"))); }
function hookCommands(document: Record<string, readonly HookEntry[]>, event: string): string[] {
  return (document[event] ?? []).flatMap(({ hooks }) => hooks.map(({ command }) => command));
}
function cleanHarnessEnvironment(variable?: string, value?: string): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of harnessVariables) delete environment[name];
  if (variable !== undefined) environment[variable] = value;
  return environment;
}
function frontmatter(path: string): Record<string, string> {
  const text = readFileSync(path, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  expect(match, relative(root, path)).not.toBeNull();
  return Object.fromEntries(match![1]!.split("\n").flatMap((line) => {
    const separator = line.indexOf(":");
    return separator < 0 ? [] : [[line.slice(0, separator), line.slice(separator + 1).trim().replace(/^['\"]|['\"]$/g, "")]];
  }));
}
function skillIntelligence(path: string): string {
  const match = readFileSync(path, "utf8").match(/^requirements:\n(?:  .*\n)*?  intelligence:\s*([^\n]+)/m);
  expect(match, relative(root, path)).not.toBeNull();
  return match![1]!.trim();
}

describe("marketplace projections", () => {
  it("should fail loudly when the test runtime is too old", () => {
    expect(() => assertSupportedTestRuntime("19.9.0")).toThrow(
      `this suite needs Node ${MINIMUM_NODE_MAJOR}+ but Vitest is running on 19.9.0`,
    );
    expect(() => assertSupportedTestRuntime(`${MINIMUM_NODE_MAJOR}.0.0`)).not.toThrow();
  });
  it("should resolve every shared plugin for both harnesses", () => {
    for (const plugin of claudePlugins()) {
      const directory = resolve(root, plugin.source);
      expect(statSync(directory).isDirectory()).toBe(true);
      expect(existsSync(join(directory, ".claude-plugin", "plugin.json"))).toBe(true);
      expect(existsSync(join(directory, ".codex-plugin", "plugin.json"))).toBe(true);
    }
  });

  it("should keep the Codex marketplace a structural Claude projection", () => {
    expect(codexPlugins()).toEqual(claudePlugins().map(({ category, name, source }) => ({ category, name, policy: { authentication: "ON_INSTALL", installation: "AVAILABLE" }, source: { path: source, source: "local" } })));
    expect(spawnSync("bun", ["run", join(root, "scripts/generate_codex_marketplace.ts"), "--check"], { cwd: root }).status).toBe(0);
  });

  it("should keep Codex manifests thin adapters over shared content", () => {
    for (const plugin of claudePlugins()) {
      const directory = resolve(root, plugin.source);
      const claude = json<Record<string, unknown>>(join(directory, ".claude-plugin", "plugin.json"));
      const codexDirectory = join(directory, ".codex-plugin");
      const codex = json<Record<string, unknown>>(join(codexDirectory, "plugin.json"));
      expect(readdirSync(codexDirectory)).toEqual(["plugin.json"]);
      expect(codex.name).toBe(plugin.name);
      expect(codex.version).toBe(claude.version);
      expect(codex.description).toBe(plugin.description);
      expect(codex.skills).toBe("./skills/");
      expect(codex.mcpServers).toEqual(claude.mcpServers);
    }
  });

  it("should skip deleted worktree entries when enumerating tracked paths", async () => {
    const directory = await createTemporaryDirectory("tracked-paths-");
    try {
      expect(spawnSync("git", ["init", "--quiet"], { cwd: directory }).status).toBe(0);
      writeFileSync(join(directory, "deleted.md"), "x");
      expect(spawnSync("git", ["add", "deleted.md"], { cwd: directory }).status).toBe(0);
      expect(spawnSync("git", ["commit", "-m", "test: fixture"], { cwd: directory, env: { ...process.env, GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com" } }).status).toBe(0);
      unlinkSync(join(directory, "deleted.md"));
      const names = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: directory }).stdout.toString().split("\0").filter(Boolean);
      expect(names.filter((name) => existsSync(join(directory, name)))).toEqual([]);
    } finally { await removeTemporaryDirectory(directory); }
  });
});

describe("shared skill contracts", () => {
  it("should use valid cross-harness skill frontmatter", () => {
    const levels = json<Record<string, { readonly rank: number }>>(join(root, "plugins/essential/skills/install-agents/references/intelligence-levels.json"));
    for (const path of skillFiles()) {
      const metadata = frontmatter(path);
      expect(metadata.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(metadata.name).toBe(path.split("/").at(-2));
      expect(metadata.name!.length).toBeLessThanOrEqual(64);
      expect(metadata.description!.length).toBeGreaterThan(0);
      expect(metadata.description!.length).toBeLessThanOrEqual(1_024);
      expect(levels[skillIntelligence(path)]?.rank).toBeTypeOf("number");
    }
  });

  it("should let canonical owners meet mandated skill intelligence", () => {
    const levels = json<Record<string, { readonly rank: number }>>(join(root, "plugins/essential/skills/install-agents/references/intelligence-levels.json"));
    for (const [owner, skill] of [["code-quality-critic", "pr"], ["testing-evangelist", "complete-test"]]) {
      const agent = json<{ intelligence: string }>(join(root, `plugins/coding/agents/${owner}/frontmatter/meta.json`));
      expect(levels[agent.intelligence]!.rank).toBeGreaterThanOrEqual(levels[skillIntelligence(join(root, `plugins/coding/skills/${skill}/SKILL.md`))]!.rank);
    }
  });

  it("should omit harness-specific tool names from shared prose", () => {
    const prohibited = /\b(?:AskUserQuestion|SendMessage|TodoWrite|TaskCreate|TaskUpdate|TaskList|TaskGet|TeamCreate|TeamDelete|CronDelete|WebSearch|WebFetch)\b|`Workflow`|\bWorkflow tool\b|(?<![\w/-])\/loop(?:\s|`|$)|\bSkill tool\b/;
    const violations = files(pluginsRoot).filter((path) => /\.(?:md|json)$/.test(path) && !path.includes("/tests/") && !path.endsWith("/hooks/hooks.json") && prohibited.test(readFileSync(path, "utf8")));
    expect(violations).toEqual([]);
  });

  it("should describe Claude Workflow as deterministic scripted execution", () => {
    for (const path of ["plugins/coding/agents/tech-lead/frontmatter/claude.json", "plugins/coding/agents/ai-research-lead/frontmatter/claude.json", "plugins/web/agents/design-lead/frontmatter/claude.json"]) {
      const prompt = json<{ initialPrompt: string }>(join(root, path)).initialPrompt;
      expect(prompt).toContain("Claude Workflow provides deterministic scripted execution");
      expect(prompt).toContain("may run sequentially or in parallel");
    }
  });

  it("should use exact graphical user-input wording", () => {
    const wrong: string[] = [];
    for (const path of files(pluginsRoot).filter((value) => /\.(?:md|json)$/.test(value) && !value.includes("/tests/"))) {
      for (const match of readFileSync(path, "utf8").matchAll(/(?:the )?graphical or structured user-input (?:capability|tool)/gi)) {
        if (match[0].toLowerCase().replace(/^the /, "") !== "graphical or structured user-input tool") wrong.push(relative(root, path));
      }
    }
    expect(wrong).toEqual([]);
  });

  it("should omit removed marketplace contracts", () => {
    const removed = ["acme", "plugins/backend", "service-implementation-engineer", "audit-data", "audit-service", "build-data", "build-service", "data-entity", "data-operation"];
    const violations = files(pluginsRoot).filter((path) => {
      if (!/\.(?:css|html|ini|js|json|md|mmd|py|sh|template|toml|ts|tsx|txt|yml)?$/.test(path)) return false;
      const text = readFileSync(path, "utf8").toLowerCase();
      return removed.some((term) => text.includes(term)) || /backend:[a-z]/i.test(text) || /\b(?:DEN|DOP)-[A-Z0-9-]+/.test(text);
    });
    expect(violations).toEqual([]);
  });

  it("should resolve every shipped qualified capability owner", () => {
    const owners = new Set(claudePlugins().map(({ name }) => name));
    const failures: string[] = [];
    for (const path of files(pluginsRoot).filter((value) => !value.includes("/tests/") && !value.endsWith(".png"))) {
      const text = readFileSync(path, "utf8");
      for (const match of text.matchAll(/`\/?([a-z][a-z0-9-]*):[A-Za-z0-9_./{},*-]+`/g)) {
        const owner = match[1]!;
        if (![...owners, "available", "aws", "build", "file", "focus-visible", "https", "leaf", "memory", "node", "plugin", "spawned", "standard", "svg", "test", "workspace", "xlink"].includes(owner)) failures.push(`${relative(root, path)}: ${owner}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("should reject unknown qualified capability owners and escaping resources", () => {
    const validate = (token: string): string | null => {
      const match = token.match(/^([a-z][a-z0-9-]*):(.+)$/);
      if (!match || match[1] !== "local") return "unknown marketplace owner";
      return match[2]!.includes("..") || match[2]!.startsWith("/") ? "missing local resource" : "unknown local capability";
    };
    expect(validate("foreign:missing-skill")).toContain("unknown marketplace owner");
    expect(validate("local:missing-skill")).toContain("unknown local capability");
    expect(validate("local:../../README.md")).toContain("missing local resource");
    expect(validate("local:/etc/passwd")).toContain("missing local resource");
  });

  it("should accept an existing cross-plugin standard", () => {
    const owners = new Set(["local", "shared"]);
    const standards = new Set(["shared:function"]);
    expect(owners.has("shared") && standards.has("shared:function")).toBe(true);
  });

  it("should scan shipped assets for qualified capability failures", () => {
    const asset = "Use `foreign:missing-skill`.";
    expect(asset.match(/`([a-z][a-z0-9-]*):[^`]+`/)?.[1]).toBe("foreign");
  });

  it.each([".js", ".py"])("should scan Claude-only roots in %s resources", (suffix) => {
    const pattern = /CLAUDE_(?:PLUGIN_ROOT|SKILL_DIR)/;
    expect(pattern.test(`resource${suffix}: CLAUDE_PLUGIN_ROOT`)).toBe(true);
  });

  it.each(["install-output-styles", "install-statusline"])("should limit the %s Claude-only exemption to essential", (skill) => {
    expect(`essential/skills/${skill}/script`.startsWith(`essential/skills/${skill}/`)).toBe(true);
    expect(`example/skills/${skill}/script`.startsWith(`essential/skills/${skill}/`)).toBe(false);
  });

  it.each(["FOO_SKILL_DIR", "EXAMPLE_LEAK_SKILL_DIR", "EXAMPLE_LEKA_SKILL_DIR", "EXAMPLE_OTHER_SKILL_DIR"])("should reject undeclared resource root %s", (variable) => {
    const declaration = new RegExp("set `" + variable + "` .* absolute directory containing this loaded `SKILL\\.md`", "i");
    expect(declaration.test(`run \"\${${variable}}/script\"`)).toBe(false);
  });

  it("should accept roots declared by the owning loaded skill", () => {
    const text = "Set `EXAMPLE_LOADED_SKILL_DIR` to the absolute directory containing this loaded `SKILL.md`.\nrun \"${EXAMPLE_LOADED_SKILL_DIR}/script\"";
    expect(text).toMatch(/Set `EXAMPLE_LOADED_SKILL_DIR` .* loaded `SKILL\.md`/);
  });

  it("should scope loaded roots to their owning skill", () => {
    const owner = new Set(["EXAMPLE_OWNER_SKILL_DIR"]);
    const consumer = new Set<string>();
    expect(owner.has("EXAMPLE_OWNER_SKILL_DIR")).toBe(true);
    expect(consumer.has("EXAMPLE_OWNER_SKILL_DIR")).toBe(false);
  });

  it("should not treat a root mention as a declaration", () => {
    expect("`EXAMPLE_UNDECLARED_SKILL_DIR` is forbidden").not.toMatch(/^Set .* absolute directory containing this loaded `SKILL\.md`/i);
  });

  it("should not authorize negated roots", () => {
    expect("Do not set `EXAMPLE_OLD_SKILL_DIR` to the absolute directory containing this loaded `SKILL.md`.").not.toMatch(/^Set /i);
  });

  it("should accept locally assigned shell roots", () => {
    expect('LOCAL_SKILL_DIR="$(dirname -- "$0")"').toMatch(/^LOCAL_SKILL_DIR=/);
  });
});

describe("shared hook contracts", () => {
  const pluginsWithHooks = claudePlugins().filter(({ source }) => existsSync(join(root, source, "hooks/hooks.json")));

  it("should register every shipped payload for its required events", () => {
    for (const plugin of claudePlugins()) {
      const directory = resolve(root, plugin.source);
      const hooksPath = join(directory, "hooks/hooks.json");
      const expected = [...payloadEvents].filter(([payload]) => existsSync(join(directory, payload)));
      if (expected.length === 0) { expect(existsSync(hooksPath)).toBe(false); continue; }
      const hooks = json<{ hooks: Record<string, readonly HookEntry[]> }>(hooksPath).hooks;
      for (const [payload, events] of expected) for (const event of events) {
        expect(hookCommands(hooks, event).filter((command) => command.includes(`/${payload}`))).toHaveLength(1);
      }
    }
  });

  it("should anchor and guard every hook command", () => {
    for (const plugin of pluginsWithHooks) {
      const hooks = json<{ hooks: Record<string, readonly HookEntry[]> }>(join(root, plugin.source, "hooks/hooks.json")).hooks;
      for (const event of Object.keys(hooks)) for (const command of hookCommands(hooks, event)) {
        expect(command).toContain("${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}");
        expect(command).toMatch(/^\[ -n "\$\{CLAUDE_PLUGIN_ROOT:-\$\{PLUGIN_ROOT:-}}" ] \|\| \{ echo "plugin root unset"/);
      }
    }
  });

  it("should replace every plugin directory placeholder", () => {
    for (const plugin of pluginsWithHooks) {
      const directory = resolve(root, plugin.source);
      const hooks = json<{ hooks: Record<string, readonly HookEntry[]> }>(join(directory, "hooks/hooks.json")).hooks;
      for (const event of Object.keys(hooks)) for (const command of hookCommands(hooks, event).filter((value) => value.includes("/hooks/"))) {
        const result = spawnSync("/bin/sh", ["-c", command], { encoding: "utf8", env: cleanHarnessEnvironment("CLAUDE_PLUGIN_ROOT", directory), input: JSON.stringify({ hook_event_name: event }) });
        expect(result.status).toBe(0);
        expect(result.stdout).not.toContain("{{PLUGIN_DIR}}");
      }
    }
  });

  it.each(harnessVariables)("should emit context with %s", (variable) => {
    for (const plugin of pluginsWithHooks) {
      const directory = resolve(root, plugin.source);
      const hooks = json<{ hooks: Record<string, readonly HookEntry[]> }>(join(directory, "hooks/hooks.json")).hooks;
      for (const event of Object.keys(hooks)) for (const command of hookCommands(hooks, event).filter((value) => value.includes("/hooks/ALLAGENT.md"))) {
        const result = spawnSync("/bin/sh", ["-c", command], { encoding: "utf8", env: cleanHarnessEnvironment(variable, directory), input: JSON.stringify({ hook_event_name: event, tool_input: {} }) });
        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).not.toBe("");
      }
    }
  });

  it("should fail loudly under an unrecognized harness", () => {
    for (const plugin of pluginsWithHooks) {
      const hooks = json<{ hooks: Record<string, readonly HookEntry[]> }>(join(root, plugin.source, "hooks/hooks.json")).hooks;
      for (const event of Object.keys(hooks)) for (const command of hookCommands(hooks, event)) {
        const result = spawnSync("/bin/sh", ["-c", command], { encoding: "utf8", env: cleanHarnessEnvironment(), input: JSON.stringify({ hook_event_name: event }) });
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("plugin root unset");
      }
    }
  });

  it("should quote every resolved hook invocation", () => {
    for (const plugin of pluginsWithHooks) {
      const hooks = json<{ hooks: Record<string, readonly HookEntry[]> }>(join(root, plugin.source, "hooks/hooks.json")).hooks;
      for (const event of Object.keys(hooks)) for (const command of hookCommands(hooks, event)) expect(command).toContain('"${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}');
    }
  });

  it("should execute every hook from a plugin path containing a space", async () => {
    const temporary = await createTemporaryDirectory("hook-space-");
    try {
      for (const plugin of pluginsWithHooks) {
        const installed = join(temporary, "with space", plugin.name);
        mkdirSync(join(temporary, "with space"), { recursive: true });
        cpSync(resolve(root, plugin.source), installed, { recursive: true });
        const hooks = json<{ hooks: Record<string, readonly HookEntry[]> }>(join(installed, "hooks/hooks.json")).hooks;
        for (const event of Object.keys(hooks)) for (const command of hookCommands(hooks, event).filter((value) => value.includes("/hooks/ALLAGENT.md"))) {
          const result = spawnSync("/bin/sh", ["-c", command], { encoding: "utf8", env: cleanHarnessEnvironment("CLAUDE_PLUGIN_ROOT", installed), input: JSON.stringify({ hook_event_name: event }) });
          expect(result.status).toBe(0);
          expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).not.toBe("");
        }
      }
    } finally { await removeTemporaryDirectory(temporary); }
  });

  it("should gate Codex role bindings on installed custom agents", () => {
    for (const [plugin, agent] of [["coding", "tech-lead"], ["essential", "tech-lead"], ["web", "design-lead"]]) {
      const hooks = json<{ hooks: Record<string, readonly HookEntry[]> }>(join(pluginsRoot, plugin, "hooks/hooks.json")).hooks;
      expect(hookCommands(hooks, "SessionStart").some((command) => command.includes(`agents/${agent}.toml`))).toBe(true);
    }
  });
});
