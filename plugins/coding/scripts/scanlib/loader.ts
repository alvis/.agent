import { readdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Rule } from "./rule.ts";

interface RuleModule {
  readonly RULE?: Rule;
  readonly RULES?: readonly Rule[];
}

export async function loadRules(
  directory = resolve(dirname(fileURLToPath(import.meta.url)), "../scanners"),
): Promise<Rule[]> {
  const rules: Rule[] = [];
  const modules = readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.startsWith("_") &&
        entry.name !== "index.ts",
    )
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of modules) {
    try {
      const module = (await import(
        `${pathToFileURL(resolve(directory, entry.name)).href}?scanner=${Date.now()}-${entry.name}`
      )) as RuleModule;
      if (module.RULES !== undefined) rules.push(...module.RULES);
      else if (module.RULE !== undefined) rules.push(module.RULE);
    } catch (error) {
      process.stderr.write(
        `warn: failed to load rule module ${basename(entry.name, ".ts")}: ${(error as Error).message}\n`,
      );
    }
  }
  return rules.sort(
    (left, right) =>
      left.order - right.order || left.id.localeCompare(right.id),
  );
}
