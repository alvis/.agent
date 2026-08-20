#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  build,
  composeDirectory,
  DISCOVER_ROOT,
  resolveSource,
} from "./build-artifact";

const EXAMPLES_ROOT = join(DISCOVER_ROOT, "examples", "html");
const EXAMPLES_SRC_ROOT = join(DISCOVER_ROOT, "examples", "src");
const TEMPLATE_SRC = join(DISCOVER_ROOT, "templates", "src", "page");
const TEMPLATE = join(DISCOVER_ROOT, "templates", "html", "page.html");
const CSS = join(DISCOVER_ROOT, "assets", "html", "discovery.css");
const JAVASCRIPT = join(DISCOVER_ROOT, "assets", "html", "discovery.js");
const ACTION_ROOT = join(
  DISCOVER_ROOT,
  "references",
  "presentation",
  "actions",
);
const COVERAGE_REFERENCE = join(
  DISCOVER_ROOT,
  "references",
  "presentation",
  "coverage.md",
);
const COMPONENTS_REFERENCE = join(
  DISCOVER_ROOT,
  "references",
  "presentation",
  "components.md",
);
const ACTIONS = [
  "risk-context-report",
  "domain-explainer",
  "ranked-options",
  "brainstorm-spectrum",
  "guided-interview",
  "semantics-map",
  "interactive-prototype",
  "readiness-check",
  "plan-review",
  "build-journal",
  "change-walkthrough",
] as const;
const CONVENTION_EXAMPLES = [
  "specimen-board",
  "board-hub",
  "architecture-board",
  "triage-board",
] as const;

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function validateRuntime(skipped: string[]): Promise<string[]> {
  const syntax = spawnSync("node", ["--check", JAVASCRIPT], {
    encoding: "utf8",
  });
  if (
    syntax.error &&
    "code" in syntax.error &&
    syntax.error.code === "ENOENT"
  ) {
    skipped.push(`${JAVASCRIPT}: JavaScript syntax check (node not installed)`);
    return [];
  }
  return syntax.status === 0
    ? []
    : [
        `${JAVASCRIPT}: JavaScript syntax check failed: ${syntax.stderr.trim()}`,
      ];
}

async function validateArtifactBuilder(skipped: string[]): Promise<string[]> {
  const tailwindCache = join(
    DISCOVER_ROOT,
    "assets",
    "html",
    "vendor",
    "tailwind-browser.cache.js",
  );
  const mermaidCache = join(
    DISCOVER_ROOT,
    "assets",
    "html",
    "vendor",
    "mermaid.cache.js",
  );
  try {
    const runtime = (await exists(tailwindCache))
      ? await readFile(tailwindCache, "utf8")
      : undefined;
    const source = await resolveSource("domain-explainer");
    await build(source, {
      artifact: false,
      runtime,
      offline: runtime !== undefined,
    });
    await build(source, {
      artifact: true,
      runtime,
      offline: runtime !== undefined,
    });
    const hasMermaidCache = await exists(mermaidCache);
    await build(await resolveSource("architecture-board"), {
      artifact: false,
      runtime,
      mermaid: hasMermaidCache
        ? await readFile(mermaidCache, "utf8")
        : undefined,
      offline: runtime !== undefined && hasMermaidCache,
    });
  } catch (error) {
    if (
      (!(await exists(tailwindCache)) || !(await exists(mermaidCache))) &&
      String(error).includes("could not fetch")
    ) {
      skipped.push(
        "build-artifact.ts: network probe unavailable and required runtime cache set is incomplete",
      );
      return [];
    }
    return [`build-artifact.ts validation failed: ${String(error)}`];
  }
  return [];
}

export type ValidationResult = {
  status: "pass" | "fail";
  stage: "representative" | "complete";
  examples_present: string[];
  examples_required: string[];
  errors: string[];
  skipped_checks: string[];
};

export async function run(
  stage: "representative" | "complete",
  includeBuilder = true,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const skipped: string[] = [];
  const required =
    stage === "representative" ? ["domain-explainer"] : [...ACTIONS];
  const convention = stage === "complete" ? [...CONVENTION_EXAMPLES] : [];
  for (const path of [
    TEMPLATE,
    TEMPLATE_SRC,
    CSS,
    JAVASCRIPT,
    COVERAGE_REFERENCE,
    COMPONENTS_REFERENCE,
    join(EXAMPLES_SRC_ROOT, "_shared", "board-set.html"),
  ]) {
    if (!(await exists(path)))
      errors.push(`${path}: required artifact is missing`);
  }
  if (await exists(TEMPLATE_SRC)) {
    try {
      await composeDirectory(TEMPLATE_SRC);
    } catch (error) {
      errors.push(
        `${TEMPLATE_SRC}: could not compose source: ${String(error)}`,
      );
    }
  }
  if (await exists(JAVASCRIPT)) {
    errors.push(...(await validateRuntime(skipped)));
  }
  for (const action of [...required, ...convention]) {
    const example = join(EXAMPLES_ROOT, `${action}.html`);
    const sourceDirectory = join(EXAMPLES_SRC_ROOT, action);
    const reference = join(ACTION_ROOT, `${action}.md`);
    if (!(await exists(example))) {
      errors.push(`${example}: required ${stage} example is missing`);
    }
    if (!(await exists(sourceDirectory))) {
      errors.push(`${sourceDirectory}: required modular source is missing`);
    } else {
      try {
        await composeDirectory(sourceDirectory);
      } catch (error) {
        errors.push(
          `${sourceDirectory}: could not compose source: ${String(error)}`,
        );
      }
    }
    if (required.includes(action) && !(await exists(reference))) {
      errors.push(
        `${reference}: required ${stage} action reference is missing`,
      );
    }
  }
  if (stage === "complete" && includeBuilder) {
    errors.push(...(await validateArtifactBuilder(skipped)));
  }
  const examplesPresent = (await readdir(EXAMPLES_ROOT))
    .filter((path) => path.endsWith(".html"))
    .map((path) => basename(path, ".html"))
    .sort();
  return {
    status: errors.length ? "fail" : "pass",
    stage,
    examples_present: examplesPresent,
    examples_required: [...required, ...convention],
    errors,
    skipped_checks: skipped,
  };
}

export async function main(argv = Bun.argv.slice(2)): Promise<number> {
  let stage: "representative" | "complete" = "complete";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      console.log(
        "usage: test-html-templates.ts [-h] [--stage {representative,complete}]",
      );
      return 0;
    }
    if (arg === "--stage" || arg.startsWith("--stage=")) {
      const value = arg.startsWith("--stage=")
        ? arg.slice("--stage=".length)
        : argv[++index];
      if (value !== "representative" && value !== "complete") {
        console.error(
          `test-html-templates.ts: error: argument --stage: invalid choice: '${value}'`,
        );
        return 2;
      }
      stage = value;
    } else {
      console.error(
        `test-html-templates.ts: error: unrecognized arguments: ${arg}`,
      );
      return 2;
    }
  }
  const result = await run(stage);
  console.log(JSON.stringify(result, null, 2));
  return result.status === "pass" ? 0 : 1;
}

if (import.meta.main) process.exit(await main());
