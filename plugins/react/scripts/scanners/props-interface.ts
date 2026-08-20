import { tsOnly } from "./_rule.ts";
import type { Rule } from "./_rule.ts";
const pattern = /^\s*(?:export\s+)?interface\s+\w+Props\b/gm;
export const RULE: Rule = {
  id: "props-interface",
  label: "Props declared as `interface` (RC-STRUCT-02 — prefer `type`)",
  order: 0,
  appliesTo: tsOnly,
  ruleRefs: ["RC-STRUCT-02"],
  scan: ({ path, lines, matches }) => {
    const text = lines.join("\n");
    for (const hit of text.matchAll(pattern)) {
      const lineno = text.slice(0, hit.index ?? 0).split("\n").length;
      matches.push({ path, lineno, line: lines[lineno - 1] ?? "" });
    }
  },
};
