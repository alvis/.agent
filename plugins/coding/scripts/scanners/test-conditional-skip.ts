import { specFiles } from "../scanlib/predicates.ts";
import { lineRule, withoutLineComment } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "test-conditional-skip",
  label: "Conditional test skip (`runIf`/`skipIf`) (TST-CORE-11)",
  order: 110,
  appliesTo: specFiles,
  ruleRefs: ["TST-CORE-11"],
  pattern: /\b(?:describe|it|test)\s*\.\s*(?:runIf|skipIf)\b/,
  code: withoutLineComment,
});
