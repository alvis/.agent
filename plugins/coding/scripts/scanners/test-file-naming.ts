import { basename } from "node:path";
import { sourceFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

export const RULE: Rule = {
  id: "test-file-naming",
  label: "Test file uses `.test.*` instead of `.spec.*` (TST-STRU-01)",
  order: 140,
  appliesTo: sourceFiles,
  ruleRefs: ["TST-STRU-01"],
  scan: ({ path, lines, matches }) => {
    if (/\.test\./.test(basename(path)))
      matches.push({ path, lineno: 1, line: lines[0] ?? "" });
  },
};
