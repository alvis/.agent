import { sourceFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

const names = new Set([
  "IDENTIFIERS",
  "PROPERTIES",
  "DISPLAY",
  "FLAGS",
  "TIMESTAMPS",
  "RELATIONS",
  "AUTHENTICATION DETAILS",
  "PERMISSIONS",
  "METADATA",
  "INDEX",
]);
const divider = /\/\/\s*-{2,}\s*(.+?)\s*-{2,}\s*\/\//;
export const RULE: Rule = {
  id: "section-name",
  label: "Non-standard section divider name (DOC-FORM-06)",
  order: 220,
  appliesTo: sourceFiles,
  ruleRefs: ["DOC-FORM-06"],
  scan: ({ path, lines, matches }) => {
    for (const [index, line] of lines.entries()) {
      const hit = divider.exec(line);
      if (hit !== null && !names.has((hit[1] ?? "").trim()))
        matches.push({ path, lineno: index + 1, line });
    }
  },
};
