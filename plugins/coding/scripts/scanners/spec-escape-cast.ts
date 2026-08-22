import { isSpecFile } from "../scanlib/predicates.ts";
import { lineRule, withoutLineComment } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "spec-escape-cast",
  label:
    "`as unknown as` test-double cast — validate with `satisfies Partial<T>` first (TST-MOCK-09)",
  order: 91,
  appliesTo: isSpecFile,
  ruleRefs: ["TST-MOCK-09"],
  pattern: /\bas\s+unknown\s+as\b/,
  code: withoutLineComment,
});
