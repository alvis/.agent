import { sourceFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

const imports = /\bimport\s*\(\s*(?:'[^'\n]*'|"[^"\n]*"|`[^`$\n]*`)\s*\)/g;
const heads = /\bvi\s*\.\s*(?:mock|hoist)\s*\(/g;
function exempt(text: string, position: number): boolean {
  for (const head of text.slice(0, position).matchAll(heads)) {
    const segment = text.slice((head.index ?? 0) + head[0].length, position);
    if (
      (segment.match(/\(/g)?.length ?? 0) >= (segment.match(/\)/g)?.length ?? 0)
    )
      return true;
  }
  return false;
}
export const RULE: Rule = {
  id: "dynamic-import-static",
  label: "Dynamic `import()` with static path (TYP-IMPT-07)",
  order: 60,
  appliesTo: sourceFiles,
  ruleRefs: ["TYP-IMPT-07"],
  scan: ({ path, lines, matches }) => {
    const text = lines.join("\n");
    for (const hit of text.matchAll(imports)) {
      const offset = hit.index ?? 0;
      if (exempt(text, offset)) continue;
      const lineno = text.slice(0, offset).split("\n").length;
      matches.push({ path, lineno, line: lines[lineno - 1] ?? "" });
    }
  },
};
