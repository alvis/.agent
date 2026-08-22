import { spawnSync } from "node:child_process";
import {
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
  AgentTemplateError,
  intelligenceLevels,
  loadAgentSources,
  preferredNameCandidates,
  stitchAgentDefinition,
  stitchCodexAgentDefinition,
  validateAgentContract,
} from "./stitch_agent.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, "../../../../..");
const script = resolve(here, "stitch_agent.ts");
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function temporaryRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "stitch-agent-"));
  roots.push(root);
  return root;
}

function memory(name: string): string {
  return `\n## Memory\n\nI retain durable repository knowledge in \`.claude/agent-memory/${name}/MEMORY.md\`. I follow \`essential:templates/memory.md\`. Current facts carry evidence and a last-verified date. Sources override memory; I archive old claims before 150 lines or 20KB. I move detail to \`topics/<stable-area>/<specific-subject>.md\`.\n`;
}

function writeTemplate(
  pluginRoot: string,
  name = "test-agent",
  options: {
    readonly metadata?: Record<string, unknown>;
    readonly claude?: Record<string, unknown>;
    readonly codex?: Record<string, unknown>;
    readonly body?: string;
  } = {},
): string {
  const template = resolve(pluginRoot, "agents", name);
  mkdirSync(resolve(template, "frontmatter"), { recursive: true });
  writeFileSync(
    resolve(template, "frontmatter/meta.json"),
    JSON.stringify({
      name,
      description:
        "A test role. Preferably named Ava, Kit, or June when the main agent spawns this role.",
      intelligence: "inherit",
      ...options.metadata,
    }),
  );
  writeFileSync(
    resolve(template, "frontmatter/claude.json"),
    JSON.stringify({ memory: "project", ...options.claude }),
  );
  writeFileSync(
    resolve(template, "frontmatter/codex.json"),
    JSON.stringify(options.codex ?? {}),
  );
  const body = options.body ?? "# Test agent\n";
  writeFileSync(
    resolve(template, "base.md"),
    body.includes("## Memory") ? body : `${body}${memory(name)}`,
  );
  return template;
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

describe("agent stitching", () => {
  it("projects one split template deterministically for both harnesses", () => {
    const root = temporaryRoot();
    const template = writeTemplate(root, "test-agent", {
      metadata: { intelligence: "high" },
      claude: { color: "blue", permissionMode: "default" },
      codex: { sandbox_mode: "workspace-write" },
      body: "\n# Test agent\n\nInstructions.\n",
    });

    const claude = stitchAgentDefinition(template);
    const projected = JSON.parse(claude.split("---\n", 3)[1]!) as Record<
      string,
      unknown
    >;
    expect(projected).toMatchObject({
      name: "test-agent",
      color: "blue",
      model: intelligenceLevels.high!.claude.model,
      effort: intelligenceLevels.high!.claude.effort,
      memory: "project",
    });
    expect(projected).not.toHaveProperty("intelligence");
    expect(claude).toContain("# Test agent\n\nIntelligence level: high.");
    expect(stitchAgentDefinition(template)).toBe(claude);

    const codex = stitchCodexAgentDefinition(template);
    expect(codex).toContain('name = "test-agent"\n');
    expect(codex).toContain('nickname_candidates = ["Ava", "Kit", "June"]');
    expect(codex).toContain('sandbox_mode = "workspace-write"');
    expect(codex).not.toContain("## Memory");
    expect(stitchCodexAgentDefinition(template)).toBe(codex);
  });

  it("preserves plugin namespaces while removing Claude-only delegation", () => {
    const root = temporaryRoot();
    const template = writeTemplate(root, "test-agent", {
      body: `# Test agent\n\nUse \`coding:write-code\`.\n\n## Delegation Modes\n\n- **Direct persistent delegation** — keep this.\n- **Dynamic Workflow delegation** — remove this.\n${memory("test-agent")}\n## End\n\nDone.\n`,
    });

    const codex = stitchCodexAgentDefinition(template);
    expect(codex).toContain("coding:write-code");
    expect(codex).toContain("Direct persistent delegation");
    expect(codex).not.toContain("Dynamic Workflow");
    expect(codex).toContain("## End");
  });

  it("requires three distinct preferred names", () => {
    expect(
      preferredNameCandidates(
        "Role. Preferably named Ava, Kit, or June when the main agent spawns this role.",
      ),
    ).toEqual(["Ava", "Kit", "June"]);
    expect(() =>
      preferredNameCandidates(
        "Role. Preferably named Ava, Ava, or June when the main agent spawns this role.",
      ),
    ).toThrow(AgentTemplateError);
  });

  it.each([
    ["missing memory", "# Test agent\n", "exactly one ## Memory"],
    [
      "fixed routing",
      `# Test agent\n\nI always spawn helpers.\n${memory("test-agent")}`,
      "fixed routing language",
    ],
    [
      "shared policy",
      `# Test agent\n\nUse the current \`Agent\` roster.\n${memory("test-agent")}`,
      "shared delegation policy",
    ],
  ])("rejects %s contract violations", (_label, body, message) => {
    const root = temporaryRoot();
    const template = writeTemplate(root, "test-agent", { body });
    const sources = loadAgentSources(template);
    expect(() => validateAgentContract(sources, body)).toThrow(message);
  });

  it.each([
    [{ name: "Wrong" }, "invalid agent name"],
    [{ name: "other-agent" }, "does not match directory"],
    [{ intelligence: "unknown" }, "invalid intelligence"],
  ])("rejects invalid metadata %#", (metadata, message) => {
    const root = temporaryRoot();
    const template = writeTemplate(root, "test-agent", { metadata });
    expect(() => stitchAgentDefinition(template)).toThrow(message);
  });

  it("rejects derived overlay fields and non-scalar Codex values", () => {
    const root = temporaryRoot();
    const claude = writeTemplate(root, "claude-agent", {
      claude: { model: "forged" },
    });
    expect(() => loadAgentSources(claude)).toThrow("derived field 'model'");
    const codex = writeTemplate(root, "codex-agent", {
      codex: { nested: { forged: true } },
    });
    expect(() => loadAgentSources(codex)).toThrow("TOML scalar fields");
  });

  it("rejects split-source symlinks that escape the template", () => {
    const root = temporaryRoot();
    const template = writeTemplate(root);
    const external = resolve(root, "external.json");
    writeFileSync(external, "{}");
    rmSync(resolve(template, "frontmatter/codex.json"));
    symlinkSync(external, resolve(template, "frontmatter/codex.json"));
    expect(() => loadAgentSources(template)).toThrow("escapes agent directory");
  });

  it("resolves Essential aliases against an explicit durable reference root", () => {
    const root = temporaryRoot();
    const essential = resolve(root, "plugins/essential");
    const direction = resolve(essential, "references/directions/lead-agent.md");
    mkdirSync(dirname(direction), { recursive: true });
    writeFileSync(direction, "direction");
    const template = writeTemplate(resolve(root, "plugins/coding"), "lead", {
      body: `# Lead\n\nApply @essential:references/directions/lead-agent.md.\n${memory("lead")}`,
    });
    const reference = resolve(root, "installed/.essential");
    expect(
      stitchAgentDefinition(template, {
        essentialRoot: essential,
        referenceRoot: reference,
      }),
    ).toContain(
      `@${resolve(reference, "references/directions/lead-agent.md")}`,
    );
  });

  it("stitches every distributed template for both harnesses", () => {
    let count = 0;
    for (const plugin of readdirSync(resolve(repositoryRoot, "plugins"))) {
      const agents = resolve(repositoryRoot, "plugins", plugin, "agents");
      try {
        for (const agent of readdirSync(agents)) {
          const template = resolve(agents, agent);
          expect(stitchAgentDefinition(template).length).toBeGreaterThan(100);
          expect(stitchCodexAgentDefinition(template).length).toBeGreaterThan(
            100,
          );
          count += 1;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    expect(count).toBeGreaterThan(10);
  });
});

describe("stitch_agent CLI", () => {
  it("preserves help, required-argument, and invalid-choice behavior", () => {
    const shown = run("--help");
    expect(shown).toMatchObject({ exitCode: 0, stderr: "" });
    expect(shown.stdout).toContain("usage: stitch_agent.ts");
    expect(shown.stdout).toContain("--harness {claude,codex}");

    const missing = run();
    expect(missing.exitCode).toBe(2);
    expect(missing.stdout).toBe("");
    expect(missing.stderr).toContain(
      "the following arguments are required: template",
    );

    const invalid = run("--harness", "other", "template");
    expect(invalid.exitCode).toBe(2);
    expect(invalid.stderr).toContain(
      "invalid choice: 'other' (choose from 'claude', 'codex')",
    );
  });

  it("writes output only when validation succeeds", () => {
    const root = temporaryRoot();
    const template = writeTemplate(root);
    const output = resolve(root, "agent.md");
    const result = run(template, "--output", output);
    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
    expect(readFileSync(output, "utf8")).toContain('"name": "test-agent"');
  });
});
