import { specFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

const property = /\b[\w$]+\s*:\s*undefined\b/g;
const openers = /\(\s*\{/g;
function inside(text: string, position: number): boolean {
  for (const opener of text.slice(0, position).matchAll(openers)) {
    const brace = text.indexOf("{", opener.index ?? 0);
    if (brace < 0 || brace >= position) continue;
    const segment = text.slice(brace + 1, position);
    if (
      (segment.match(/\{/g)?.length ?? 0) >= (segment.match(/\}/g)?.length ?? 0)
    )
      return true;
  }
  return false;
}
export const RULE: Rule = {
  id: "undefined-override",
  label: "Explicit `key: undefined` override in call argument (TST-DATA-04)",
  order: 210,
  appliesTo: specFiles,
  ruleRefs: ["TST-DATA-04"],
  scan: ({ path, lines, matches }) => {
    const text = lines.join("\n");
    for (const hit of text.matchAll(property)) {
      const offset = hit.index ?? 0;
      if (!inside(text, offset)) continue;
      const lineno = text.slice(0, offset).split("\n").length;
      matches.push({ path, lineno, line: lines[lineno - 1] ?? "" });
    }
  },
};
