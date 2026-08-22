import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  codexCachePluginRoot,
  discoverAgentTemplates,
  installAgents,
  installedPluginRoots,
} from "./install_agents.ts";
import { AgentTemplateError } from "./stitch_agent.ts";

const here = dirname(fileURLToPath(import.meta.url));
const script = resolve(here, "install_agents.ts");
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function temporaryRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "install-agents-"));
  roots.push(root);
  return root;
}

function memory(name: string): string {
  return `\n## Memory\n\nI retain durable facts in \`.claude/agent-memory/${name}/MEMORY.md\` following \`essential:templates/memory.md\`. Claims carry evidence and a last-verified date. I archive stale claims before 150 lines or 20KB, with detail in \`topics/<stable-area>/<specific-subject>.md\`.\n`;
}

function writeTemplate(plugin: string, name: string, alias = false): string {
  const template = resolve(plugin, "agents", name);
  mkdirSync(resolve(template, "frontmatter"), { recursive: true });
  writeFileSync(
    resolve(template, "frontmatter/meta.json"),
    JSON.stringify({
      name,
      description: `Test role. Preferably named Ava, Kit, or June when the main agent spawns this role.`,
      intelligence: "inherit",
    }),
  );
  writeFileSync(
    resolve(template, "frontmatter/claude.json"),
    JSON.stringify({ memory: "project" }),
  );
  writeFileSync(resolve(template, "frontmatter/codex.json"), "{}");
  writeFileSync(
    resolve(template, "base.md"),
    `# ${name}\n${alias ? "\nApply @essential:references/directions/lead-agent.md.\n" : ""}${memory(name)}`,
  );
  return template;
}

function sourceCheckout(): {
  readonly root: string;
  readonly essential: string;
} {
  const root = temporaryRoot();
  const essential = resolve(root, "plugins/essential");
  const direction = resolve(essential, "references/directions/lead-agent.md");
  mkdirSync(dirname(direction), { recursive: true });
  writeFileSync(direction, "Lead direction.\n");
  writeTemplate(essential, "first-agent", true);
  writeTemplate(resolve(root, "plugins/coding"), "second-agent");
  return { root, essential };
}

function run(...args: readonly string[]) {
  const result = spawnSync("bun", ["run", script, ...args], {
    encoding: "utf8",
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe("agent discovery and installation", () => {
  it("discovers all source-checkout siblings in stable order", () => {
    const { essential } = sourceCheckout();
    expect(
      discoverAgentTemplates(essential).map(({ owner, name }) => [owner, name]),
    ).toEqual([
      ["coding", "second-agent"],
      ["essential", "first-agent"],
    ]);
  });

  it.each([
    ["claude", ".md"],
    ["codex", ".toml"],
  ] as const)("installs source templates for %s", (harness, suffix) => {
    const { essential } = sourceCheckout();
    const destination = resolve(temporaryRoot(), "agents");
    const output: string[] = [];
    expect(
      installAgents(essential, destination, {
        harness,
        stdout: (text) => output.push(text),
      }),
    ).toBe(2);
    expect(readdirSync(destination).sort()).toEqual([
      ".essential",
      `first-agent${suffix}`,
      `second-agent${suffix}`,
    ]);
    expect(
      readFileSync(resolve(destination, `first-agent${suffix}`), "utf8"),
    ).toContain(
      `@${resolve(destination, ".essential/references/directions/lead-agent.md")}`,
    );
    expect(output.at(-1)).toContain("done — installed 2 agent(s)");
  });

  it("fails duplicate names before writing the destination", () => {
    const { root, essential } = sourceCheckout();
    writeTemplate(resolve(root, "plugins/react"), "first-agent");
    const destination = resolve(temporaryRoot(), "agents");
    expect(() => installAgents(essential, destination)).toThrow(
      "duplicate agent name 'first-agent'",
    );
    expect(existsSync(destination)).toBe(false);
  });

  it("rejects an escaping symlink before installing valid templates", () => {
    const { essential } = sourceCheckout();
    const external = writeTemplate(temporaryRoot(), "external-agent");
    symlinkSync(external, resolve(essential, "agents/linked-agent"), "dir");
    const destination = resolve(temporaryRoot(), "agents");

    expect(() => installAgents(essential, destination)).toThrow(
      "template symlink or path escapes plugin root",
    );
    expect(existsSync(destination)).toBe(false);
  });

  it("replaces an existing destination symlink without following it", () => {
    const { essential } = sourceCheckout();
    const root = temporaryRoot();
    const destination = resolve(root, "agents");
    mkdirSync(destination, { recursive: true });
    const external = resolve(root, "external.md");
    writeFileSync(external, "do not overwrite\n");
    symlinkSync(external, resolve(destination, "first-agent.md"));

    installAgents(essential, destination);

    expect(readFileSync(external, "utf8")).toBe("do not overwrite\n");
    expect(
      readFileSync(resolve(destination, "first-agent.md"), "utf8"),
    ).toContain('"name": "first-agent"');
  });

  it("keeps only enabled latest records from trusted marketplaces", () => {
    const root = temporaryRoot();
    const essential = resolve(root, "installed/essential");
    const codingOld = resolve(root, "installed/coding-old");
    const codingNew = resolve(root, "installed/coding-new");
    const react = resolve(root, "installed/react");
    for (const path of [essential, codingOld, codingNew, react])
      mkdirSync(path, { recursive: true });
    const roots = installedPluginRoots(
      essential,
      [
        {
          id: "essential@main",
          enabled: true,
          installPath: essential,
          lastUpdated: "2026-01-01",
        },
        {
          id: "coding@main",
          enabled: true,
          installPath: codingOld,
          lastUpdated: "2026-01-01",
        },
        {
          id: "coding@main",
          enabled: true,
          installPath: codingNew,
          lastUpdated: "2026-02-01",
        },
        {
          id: "react@trusted",
          enabled: true,
          installPath: react,
          lastUpdated: "2026-01-01",
        },
        {
          id: "disabled@main",
          enabled: false,
          installPath: root,
        },
      ],
      "claude",
      ["trusted"],
    );
    expect(roots).toEqual([
      ["coding", codingNew],
      ["essential", essential],
      ["react", react],
    ]);
  });

  it("rejects untrusted marketplace names and ambiguous Essential identity", () => {
    const root = temporaryRoot();
    const essential = resolve(root, "essential");
    mkdirSync(essential);
    const record = {
      id: "essential@main",
      enabled: true,
      installPath: essential,
    };
    expect(() =>
      installedPluginRoots(essential, [record], "claude", ["../escape"]),
    ).toThrow("invalid included marketplace name");
    expect(() =>
      installedPluginRoots(essential, [record, record], "claude"),
    ).toThrow("multiple essential plugin records");
  });

  it("resolves versioned Codex cache coordinates", () => {
    const cache = resolve(temporaryRoot(), "cache");
    const essential = resolve(cache, "main/essential/1.0.0");
    const coding = resolve(cache, "main/coding/2.0.0+build");
    mkdirSync(essential, { recursive: true });
    mkdirSync(coding, { recursive: true });
    const records = [
      {
        id: "essential@main",
        enabled: true,
        version: "1.0.0",
      },
      { id: "coding@main", enabled: true, version: "2.0.0+build" },
    ];
    expect(codexCachePluginRoot(essential, records[1]!)).toBe(coding);
    expect(installedPluginRoots(essential, records, "codex")).toEqual([
      ["coding", coding],
      ["essential", essential],
    ]);
  });

  it("rejects Codex cache traversal and missing roots", () => {
    const cache = resolve(temporaryRoot(), "cache");
    const essential = resolve(cache, "main/essential/1.0.0");
    mkdirSync(essential, { recursive: true });
    expect(() =>
      codexCachePluginRoot(essential, {
        id: "coding@../escape",
        version: "1.0.0",
      }),
    ).toThrow(AgentTemplateError);
    expect(() =>
      codexCachePluginRoot(essential, {
        id: "coding@main",
        version: "missing",
      }),
    ).toThrow("cache root is absent");
  });
});

describe("install_agents CLI", () => {
  it("preserves help and parser errors", () => {
    const shown = run("--help");
    expect(shown).toMatchObject({ exitCode: 0, stderr: "" });
    expect(shown.stdout).toContain("usage: install_agents.ts");
    expect(shown.stdout).toContain("--include-marketplace");

    const missing = run("--destination");
    expect(missing.exitCode).toBe(2);
    expect(missing.stdout).toBe("");
    expect(missing.stderr).toContain(
      "argument --destination: expected one argument",
    );

    const unknown = run("--unknown");
    expect(unknown.exitCode).toBe(2);
    expect(unknown.stderr).toContain("unrecognized arguments: --unknown");
  });

  it("installs through Bun with explicit paths", () => {
    const { essential } = sourceCheckout();
    const destination = resolve(temporaryRoot(), "agents");
    const result = run(
      "--plugin-root",
      essential,
      "--destination",
      destination,
      "--harness",
      "codex",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("done — installed 2 agent(s)");
    expect(existsSync(resolve(destination, "first-agent.toml"))).toBe(true);
  });
});
