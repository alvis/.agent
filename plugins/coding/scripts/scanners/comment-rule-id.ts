import { sourceFiles } from "../scanlib/predicates.ts";
import { deriveRuleIdPrefixes } from "../scanlib/prefixes.ts";
import type { Rule } from "../scanlib/rule.ts";

const token = new RegExp(
  `\\b(?:${deriveRuleIdPrefixes().join("|")})(?:-(?:[A-Z]{2,10}|\\d{1,3})){1,3}\\b`,
);
const opener = /\/\/|\/\*+|^\s*\*\s/;
export const RULE: Rule = {
  id: "comment-rule-id",
  label: "Standard rule ID in source comment (DOC-CONT-05)",
  order: 70,
  appliesTo: sourceFiles,
  ruleRefs: ["DOC-CONT-05"],
  scan: ({ path, lines, matches }) => {
    let inBlock = false;
    for (const [index, line] of lines.entries()) {
      let start: number | undefined;
      if (inBlock) {
        start = 0;
        if (line.includes("*/")) inBlock = false;
      } else {
        const hit = opener.exec(line);
        if (hit !== null) {
          start = hit.index;
          if (line.includes("/*", start) && !line.slice(start).includes("*/"))
            inBlock = true;
        }
      }
      if (start !== undefined && token.test(line.slice(start)))
        matches.push({ path, lineno: index + 1, line });
    }
  },
};
