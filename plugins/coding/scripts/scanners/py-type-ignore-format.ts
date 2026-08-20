import { pythonFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

const directive = /^#\s*type:\s*ignore(.*)$/;
const compliant = /^\[[^\]\s]+\]  # reason:\s*\S/;
function commentStart(line: string): number {
  let quote: string | undefined;
  for (const [index, character] of [...line].entries()) {
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
    } else if (character === "'" || character === '"') quote = character;
    else if (character === "#") return index;
  }
  return -1;
}
export const RULE: Rule = {
  id: "py-type-ignore-format",
  label: "`# type: ignore` missing `[code]  # reason:` form (PYT-CORE-03)",
  order: 230,
  appliesTo: pythonFiles,
  ruleRefs: ["PYT-CORE-03"],
  scan: ({ path, lines, matches }) => {
    for (const [index, line] of lines.entries()) {
      const start = commentStart(line);
      if (start < 0) continue;
      const hit = directive.exec(line.slice(start));
      if (hit !== null && !compliant.test(hit[1] ?? ""))
        matches.push({ path, lineno: index + 1, line });
    }
  },
};
