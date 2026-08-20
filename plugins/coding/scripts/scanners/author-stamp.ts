import { sourceFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

const stamp =
  /\b(?:modified|updated|created|authored)\s+by\b|\b\d{4}-\d{2}-\d{2}\b/i;
const opener = /\/\/|\/\*+|^\s*\*\s/;
export const RULE: Rule = {
  id: "author-stamp",
  label: "Author/date stamp in source comment (DOC-CONT-03)",
  order: 160,
  appliesTo: sourceFiles,
  ruleRefs: ["DOC-CONT-03"],
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
      if (start !== undefined && stamp.test(line.slice(start)))
        matches.push({ path, lineno: index + 1, line });
    }
  },
};
