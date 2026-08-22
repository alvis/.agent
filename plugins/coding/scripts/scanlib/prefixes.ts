import { existsSync, readFileSync, readdirSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const FALLBACK_PREFIXES = [
  "A11Y",
  "AUT",
  "CRV",
  "CSS",
  "DEL",
  "DES",
  "DOC",
  "ERR",
  "FST",
  "FUNC",
  "GEN",
  "GIT",
  "LOG",
  "NAM",
  "PYT",
  "RC",
  "RH",
  "RPS",
  "RST",
  "SB",
  "TST",
  "TYP",
  "WT",
] as const;

export function pluginsRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

export function deriveRuleIdPrefixes(
  root = pluginsRoot(),
  standardRoots = process.env.CODING_LINT_STANDARD_ROOTS ?? "",
): readonly string[] {
  const metaFiles: string[] = [];
  if (existsSync(root))
    for (const plugin of readdirSync(root, { withFileTypes: true })) {
      if (!plugin.isDirectory()) continue;
      const standards = resolve(root, plugin.name, "standards");
      if (!existsSync(standards)) continue;
      for (const standard of readdirSync(standards, { withFileTypes: true }))
        if (standard.isDirectory())
          metaFiles.push(resolve(standards, standard.name, "meta.md"));
    }
  metaFiles.push(
    ...standardRoots
      .split(delimiter)
      .filter(Boolean)
      .map((path) => resolve(path, "meta.md")),
  );
  const prefixes = new Set<string>();
  const pattern = /`([A-Z][A-Z0-9]*)(?:-[A-Z0-9]+)+-\*`/g;
  for (const path of metaFiles) {
    if (!existsSync(path)) continue;
    for (const match of readFileSync(path, "utf8").matchAll(pattern))
      if (match[1] !== undefined) prefixes.add(match[1]);
  }
  return prefixes.size === 0 ? FALLBACK_PREFIXES : [...prefixes].sort();
}
