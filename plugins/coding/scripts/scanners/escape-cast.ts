import { isSpecFile, sourceFiles } from "../scanlib/predicates.ts";
import { lineRule, withoutLineComment } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "escape-cast",
  label: "Type-escape cast (`as unknown as` / `as never`) (TYP-CORE-03)",
  order: 90,
  appliesTo: sourceFiles,
  ruleRefs: ["TYP-CORE-03"],
  pattern: /\bas\s+unknown\s+as\b|\bas\s+never\b/,
  code: withoutLineComment,
  accept: ({ path }) => !isSpecFile(path),
});
