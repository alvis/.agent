import { specFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

const pattern = /\.toBe\(\s*[{[]/g;
export const RULE: Rule = {
  id: "to-be-object-literal",
  label: "`.toBe(...)` against object/array literal (TST-DATA-06)",
  order: 125,
  appliesTo: specFiles,
  ruleRefs: ["TST-DATA-06"],
  scan: ({ path, lines, matches }) => {
    const text = lines.join("\n");
    for (const hit of text.matchAll(pattern)) {
      const offset = hit.index ?? 0;
      matches.push({
        path,
        lineno: text.slice(0, offset).split("\n").length,
        line: lines[text.slice(0, offset).split("\n").length - 1] ?? "",
      });
    }
  },
};
