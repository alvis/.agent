#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const SOURCE = join(ROOT, ".claude-plugin", "marketplace.json");
export const TARGET = join(ROOT, ".agents", "plugins", "marketplace.json");

interface SourcePlugin { name: string; source: string; category: unknown }
interface SourceMarketplace { name: string; owner?: { name?: unknown }; plugins: SourcePlugin[] }

export function projectMarketplace(source: SourceMarketplace): Record<string, unknown> {
  const ownerName = typeof source.owner?.name === "string" ? source.owner.name : source.name;
  return {
    name: source.name,
    interface: { displayName: ownerName },
    plugins: source.plugins.filter((plugin): plugin is SourcePlugin => typeof plugin === "object" && plugin !== null).map((plugin) => ({
      name: plugin.name,
      source: { source: "local", path: plugin.source },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: plugin.category,
    })),
  };
}

export function renderProjection(): string {
  const source = JSON.parse(readFileSync(SOURCE, "utf8")) as SourceMarketplace;
  return `${JSON.stringify(projectMarketplace(source), null, 2)}\n`;
}

export function main(args = Bun.argv.slice(2)): number {
  const unknown = args.filter((arg) => arg !== "--check");
  if (unknown.length > 0) {
    process.stderr.write(`generate_codex_marketplace.ts: error: unrecognized arguments: ${unknown.join(" ")}\n`);
    return 2;
  }
  const rendered = renderProjection();
  if (args.includes("--check")) {
    if (!existsSync(TARGET) || readFileSync(TARGET, "utf8") !== rendered) {
      process.stderr.write("generate_codex_marketplace.ts: error: Codex marketplace projection is stale; rerun this script\n");
      return 2;
    }
    return 0;
  }
  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, rendered, "utf8");
  return 0;
}

if (import.meta.main) process.exit(main());
