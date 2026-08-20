import { propsBlocks } from "./_blocks.ts";
import { tsOnly } from "./_rule.ts";
import type { Rule } from "./_rule.ts";
const attributes =
  /^(?:\s*)(?:['"]?)(onClick|onChange|href|target|disabled|type|name|placeholder|role|id|className|style|aria-[a-z][a-z0-9-]*)(?:['"]?)\??\s*:/gm;
const imported =
  /\b(?:ComponentPropsWithoutRef|ComponentPropsWithRef|ComponentProps|HTMLAttributes)\b/;
export const RULE: Rule = {
  id: "props-element-handrolled",
  label:
    "Hand-rolled HTML attributes in Props (RC-STRUCT-04 — extend `ComponentPropsWithoutRef`)",
  order: 20,
  appliesTo: tsOnly,
  ruleRefs: ["RC-STRUCT-04"],
  scan: ({ path, lines, matches }) => {
    const text = lines.join("\n");
    if (imported.test(text)) return;
    for (const [start, end] of propsBlocks(text)) {
      const hits = [...text.slice(start, end).matchAll(attributes)];
      if (new Set(hits.map((hit) => hit[1])).size < 2) continue;
      const offset = start + (hits[0]?.index ?? 0);
      const lineno = text.slice(0, offset).split("\n").length;
      matches.push({ path, lineno, line: lines[lineno - 1] ?? "" });
    }
  },
};
