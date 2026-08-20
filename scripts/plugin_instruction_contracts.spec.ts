import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const marketplacePath = join(root, ".claude-plugin", "marketplace.json");
const instructionFile = "WORKFLOW.md";
const domainPlugins = new Set([
  "client",
  "coding",
  "governance",
  "production",
  "react",
  "specification",
  "web",
]);
const promptJsonFields = ["initialPrompt", "description"] as const;
const suppressedReporting = [
  /be conservative[^.!?;\n]*?\b(?:report|flag|raise|surface|mention)\w*[^.!?;\n]*?(?:problems?|issues?|findings?|violations?|observations?|concerns?|bugs?|defects?)/i,
  /when in doubt,? (?:omit|skip|stay silent|do ?n[o']t report)/i,
  /err on the side of (?:silence|not reporting|caution[^.!?;\n]*?(?:\b(?:report|flag|raise|surface|mention|omit|skip)\w*[^.!?;\n]*?(?:problems?|issues?|findings?|violations?|observations?|concerns?|bugs?|defects?)|leave (?:it|them|the \w+) out))/i,
  /(?:report|flag|raise)[^.!?;\n]*?only (?:if|when) you (?:are|'re) (?:certain|sure|confident)/i,
  /(?:only report|report only)[^.!?;\n]*?(?:(?:definite|certain|provable|proven|unambiguous|indisputable|unmistakable|obvious|clearly visible)\w* (?:problems?|issues?|findings?|violations?)|(?:problems?|issues?|findings?|violations?)[^.!?;\n]*? (?:you can prove|you (?:are|'re) (?:certain|sure|confident)|clearly visible))/i,
  /(?:(?:do ?n[o']t|never|avoid)\s+(?:report|mention|flag|raise|surface|list|includ)\w*|omit|suppress|withhold|exclude)[^.!?;\n]*?(?:(?:uncertain|unsure|unverified|unconfirmed|unproven|speculative|suspected|tentative|doubtful|ambiguous|possible|potential|low[- ]confidence)[^.!?;\n]*?(?:problems?|issues?|findings?|violations?)|(?:problems?|issues?|findings?|violations?)[^.!?;\n]*?(?:uncertain|unsure|unverified|unconfirmed|unproven|speculative|suspected|tentative|doubtful|ambiguous|possible|potential|low[- ]confidence))/i,
];

interface MarketplaceEntry {
  readonly name: string;
  readonly source: string;
}

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function marketplaceEntries(): MarketplaceEntry[] {
  const plugins = loadJson(marketplacePath).plugins;
  expect(Array.isArray(plugins)).toBe(true);
  return plugins as MarketplaceEntry[];
}

function walk(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

function mentionedPlugins(text: string, names: ReadonlySet<string>): Set<string> {
  return new Set(
    [...names].filter((name) => {
      const label = `${name.slice(0, 1).toUpperCase()}${name.slice(1)}`;
      return [
        new RegExp(`plugins/${name}/`),
        new RegExp(`plugin:${name}:`),
        new RegExp(`(^|[^\\w-])${name}:[a-z]`),
        new RegExp(`\\b${label} plugin\\b`),
      ].some((pattern) => pattern.test(text));
    }),
  );
}

describe("repository plugin instruction contracts", () => {
  it("should ship action instructions and both hook events for every domain plugin", () => {
    const entries = marketplaceEntries().filter(({ name }) => name !== "essential");
    expect(new Set(entries.map(({ name }) => name))).toEqual(domainPlugins);

    for (const { name, source } of entries) {
      const plugin = resolve(root, source);
      const workflow = join(plugin, "references", instructionFile);
      const allAgent = join(plugin, "hooks", "ALLAGENT.md");
      const manifest = loadJson(join(plugin, ".claude-plugin", "plugin.json"));
      const hooks = readFileSync(join(plugin, "hooks", "hooks.json"), "utf8");
      expect(statSync(workflow).isFile(), name).toBe(true);
      expect(statSync(allAgent).isFile(), name).toBe(true);
      expect(manifest.hooks, name).toBeUndefined();
      expect(readFileSync(allAgent, "utf8"), name).toContain(`{{PLUGIN_DIR}}/references/${instructionFile}`);
      expect(hooks, name).toContain("SessionStart");
      expect(hooks, name).toContain("SubagentStart");
    }
  });

  it("should use semantic versions with a major version of at least one", () => {
    const marketplace = loadJson(marketplacePath);
    const metadata = marketplace.metadata as Record<string, unknown>;
    const versions = [metadata.version as string, ...marketplaceEntries().map(({ source }) => loadJson(join(root, source, ".claude-plugin", "plugin.json")).version as string)];
    const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
    for (const version of versions) {
      expect(version).toMatch(semanticVersion);
      expect(Number.parseInt(version.split(".", 1)[0] ?? "0", 10)).toBeGreaterThanOrEqual(1);
    }
  });

  it("should reject invalid semantic-version identifiers", () => {
    const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
    expect(["1.0.0", "2.1.3-alpha.1", "10.20.30+build.7"].every((value) => semanticVersion.test(value))).toBe(true);
    expect(["1.0", "01.0.0", "1.0.0-01", "1.0.0-.", "1.0.0-alpha..beta"].some((value) => semanticVersion.test(value))).toBe(false);
  });

  it("should reference only declared plugin dependencies and qualified standards", () => {
    const entries = marketplaceEntries();
    const names = new Set(entries.map(({ name }) => name));
    for (const { name, source } of entries.filter(({ name }) => name !== "essential")) {
      const plugin = resolve(root, source);
      const manifest = loadJson(join(plugin, ".claude-plugin", "plugin.json"));
      const dependencies = Array.isArray(manifest.dependencies) ? manifest.dependencies as string[] : [];
      const allowed = new Set([name, ...dependencies]);
      const text = readFileSync(join(plugin, "hooks", "ALLAGENT.md"), "utf8") + readFileSync(join(plugin, "references", instructionFile), "utf8");
      expect([...mentionedPlugins(text, names)].filter((mentioned) => !allowed.has(mentioned)), name).toEqual([]);
      const standardReferences = text.matchAll(/(?<![\w-])(?:(?<plugin>[a-z][a-z0-9-]*):)?standards\//g);
      for (const reference of standardReferences) {
        expect(reference.groups?.plugin, `${name}: unprefixed standard reference`).toBeDefined();
        expect(allowed.has(reference.groups?.plugin ?? ""), `${name}: undeclared standard prefix`).toBe(true);
      }
    }
  });

  it("should keep prompt reporting free from confidence suppression", () => {
    const promptFiles = walk(join(root, "plugins")).filter((path) => path.endsWith(".md") || path.endsWith(".json"));
    const findings: string[] = [];
    for (const path of promptFiles) {
      const raw = readFileSync(path, "utf8");
      const texts = path.endsWith(".json")
        ? promptJsonFields.flatMap((field) => {
            const value = (JSON.parse(raw) as Record<string, unknown>)[field];
            return typeof value === "string" ? [value] : [];
          })
        : [raw];
      if (texts.some((text) => suppressedReporting.some((pattern) => pattern.test(text)))) findings.push(path);
    }
    expect(findings).toEqual([]);
  });

  it("should include installed-agent prompts from JSON frontmatter in the scan", () => {
    const labels = walk(join(root, "plugins"))
      .filter((path) => /\/agents\/[^/]+\/frontmatter\/[^/]+\.json$/.test(path))
      .flatMap((path) => promptJsonFields.flatMap((field) => typeof loadJson(path)[field] === "string" ? [`${path}:${field}`] : []));
    expect(labels.some((label) => label.endsWith("frontmatter/claude.json:initialPrompt"))).toBe(true);
    expect(labels.some((label) => label.endsWith("frontmatter/meta.json:description"))).toBe(true);
  });

  it("should catch suppressive phrasings without rejecting legitimate scope rules", () => {
    const suppressing = ["Be conservative: only report problems clearly visible in the image.", "Err on the side of caution and leave it out.", "When in doubt, omit the finding.", "Report a violation only if you are certain it is one.", "Report only issues you can prove.", "Only report problems you are certain about.", "Report only definite violations.", "Only report the most clearly visible definite issues.", "Report, after weighing all the available evidence, only if you are certain.", "Only report problems clearly visible in the image.", "Only report clearly visible problems.", "Do not report uncertain findings.", "Don't mention low-confidence issues.", "Omit speculative problems from the report.", "Never surface findings you are unsure about."];
    const legitimate = ["Report context usage only when the runtime measures it.", "Only report accessibility issues.", "Report only security violations.", "Do not report context usage the runtime does not measure."];
    expect(suppressing.every((text) => suppressedReporting.some((pattern) => pattern.test(text)))).toBe(true);
    expect(legitimate.some((text) => suppressedReporting.some((pattern) => pattern.test(text)))).toBe(false);
  });

  it("should list every owned standard in its workflow", () => {
    for (const { name, source } of marketplaceEntries()) {
      const plugin = resolve(root, source);
      const standards = join(plugin, "standards");
      if (!statSync(plugin).isDirectory() || !readdirSync(plugin).includes("standards")) continue;
      const workflow = readFileSync(join(plugin, "references", instructionFile), "utf8");
      for (const standard of readdirSync(standards, { withFileTypes: true })) {
        expect(standard.isDirectory(), standard.name).toBe(true);
        const standardRoot = join(standards, standard.name);
        const tiers = readdirSync(standardRoot, { withFileTypes: true }).filter((entry) => entry.isFile()).map(({ name: file }) => file).sort();
        expect(tiers, `${name}:${standard.name}`).toEqual(["meta.md", "scan.md", "write.md"]);
        expect(workflow, name).toContain(`${name}:standards/${basename(standardRoot)}/`);
      }
    }
  });
});
