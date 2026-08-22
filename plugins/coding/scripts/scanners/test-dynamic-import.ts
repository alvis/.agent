import { specFiles } from "../scanlib/predicates.ts";
import { lineRule, withoutLineComment } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "test-dynamic-import",
  label: "Dynamic `import()` in spec file (TST-CORE-08)",
  order: 150,
  appliesTo: specFiles,
  ruleRefs: ["TST-CORE-08"],
  pattern: /\bimport\s*\(/,
  code: withoutLineComment,
});
