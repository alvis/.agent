import { sourceFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";
import { pushTextMatches } from "./_text.ts";

const pattern = /\bcatch\s*(?:\(\s*[\w$]*\s*\))?\s*\{\s*return\s*;?\s*\}/gs;
export const RULE: Rule = {
  id: "silent-catch",
  label: "Silent `catch` block (`catch { return }`) (ERR-HAND-02)",
  order: 200,
  appliesTo: sourceFiles,
  ruleRefs: ["ERR-HAND-02"],
  scan: ({ path, lines, matches }) =>
    pushTextMatches(
      path,
      lines,
      matches,
      pattern,
      lines.join("\n").replace(/\/\/[^\n]*/g, ""),
    ),
};
