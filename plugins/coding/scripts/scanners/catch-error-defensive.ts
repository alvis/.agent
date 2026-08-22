import { sourceFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";
import { pushTextMatches } from "./_text.ts";

const ternary =
  /\b([A-Za-z_$][\w$]*)\s+instanceof\s+Error\s*\?\s*\1\.\w+\s*:\s*\S/gs;
const catches = /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g;
export const RULE: Rule = {
  id: "catch-error-defensive",
  label: "Defensive catch-block error narrowing (TYP-TYPE-08)",
  order: 80,
  appliesTo: sourceFiles,
  ruleRefs: ["TYP-TYPE-08"],
  scan: ({ path, lines, matches }) => {
    const text = lines.join("\n");
    pushTextMatches(path, lines, matches, ternary);
    for (const opener of text.matchAll(catches)) {
      const binding = opener[1] ?? "";
      const brace = text.indexOf("{", (opener.index ?? 0) + opener[0].length);
      if (brace < 0) break;
      let depth = 1;
      let end = brace + 1;
      while (end < text.length && depth > 0) {
        if (text[end] === "{") depth += 1;
        else if (text[end] === "}") depth -= 1;
        end += 1;
      }
      const body = text.slice(brace + 1, end - 1);
      const strings = /\bString\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g;
      for (const hit of body.matchAll(strings)) {
        if (hit[1] !== binding) continue;
        const offset = brace + 1 + (hit.index ?? 0);
        const lineno = text.slice(0, offset).split("\n").length;
        matches.push({ path, lineno, line: lines[lineno - 1] ?? "" });
      }
    }
  },
};
