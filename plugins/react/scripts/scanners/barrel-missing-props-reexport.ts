import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseNamedSpecifiers } from "./_blocks.ts";
import { indexFiles } from "./_rule.ts";
import type { Rule } from "./_rule.ts";
const declaration = /^\s*export\s+(?:type|interface)\s+(\w+Props)\b/gm;
const star = /^\s*export\s*\*\s*from\s*['"](\.\.?\/[^'"]+)['"]/gm;
const named =
  /^\s*export\s+(?:type\s+)?\{([^}]+)\}\s*from\s*['"](\.\.?\/[^'"]+)['"]/gms;

export function scanBarrel(
  { path, lines, matches }: Parameters<Rule["scan"]>[0],
  readSibling: (path: string) => string = (sibling) =>
    readFileSync(sibling, "utf8"),
): void {
  const text = lines.join("\n");
  const wildcards = new Set(
    [...text.matchAll(star)].map((hit) => hit[1] ?? ""),
  );
  for (const hit of text.matchAll(named)) {
    const source = hit[2] ?? "";
    if (wildcards.has(source)) continue;
    let sibling: string | undefined;
    for (const extension of [".tsx", ".ts", ".jsx", ".js"]) {
      const candidate = `${resolve(dirname(path), source).replace(/\.[^.\\/]+$/, "")}${extension}`;
      if (existsSync(candidate)) {
        sibling = candidate;
        break;
      }
    }
    if (sibling === undefined) continue;
    let siblingText: string;
    try {
      siblingText = readSibling(sibling);
    } catch {
      continue;
    }
    const props = new Set(
      [...siblingText.matchAll(declaration)].map((item) => item[1] ?? ""),
    );
    const names = new Set(parseNamedSpecifiers(hit[1] ?? ""));
    const missing = [...props].filter((name) => !names.has(name)).sort();
    if (missing.length === 0) continue;
    const lineno = text.slice(0, hit.index ?? 0).split("\n").length;
    matches.push({
      path,
      lineno,
      line: `${lines[lineno - 1] ?? ""}   # missing: ${missing.join(", ")}`,
    });
  }
}

export const RULE: Rule = {
  id: "barrel-missing-props-reexport",
  label: "Barrel re-exports component but not `<Name>Props` (RC-STRUCT-05)",
  order: 30,
  appliesTo: indexFiles,
  ruleRefs: ["RC-STRUCT-05"],
  scan: (params) => {
    scanBarrel(params);
  },
};
