import { propsBlocks } from "./_blocks.ts";
import { tsOnly } from "./_rule.ts";
import type { Rule } from "./_rule.ts";
const pattern = /\bchildren\??\s*:\s*(?:React\.)?ReactNode\b/g;
export const RULE: Rule = {
  id: "props-children-inline",
  label:
    "Inline `children: ReactNode` in Props (RC-STRUCT-03 — use `PropsWithChildren`)",
  order: 10,
  appliesTo: tsOnly,
  ruleRefs: ["RC-STRUCT-03"],
  scan: ({ path, lines, matches }) => {
    const text = lines.join("\n");
    for (const [start, end] of propsBlocks(text))
      for (const hit of text.slice(start, end).matchAll(pattern)) {
        const offset = start + (hit.index ?? 0);
        const lineno = text.slice(0, offset).split("\n").length;
        matches.push({ path, lineno, line: lines[lineno - 1] ?? "" });
      }
  },
};
