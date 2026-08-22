import { specFiles } from "../scanlib/predicates.ts";
import { lineRule } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "aaa-comment",
  label:
    "AAA section comment (`// Arrange`/`// Act`/`// Assert`) (TST-STRU-03)",
  order: 120,
  appliesTo: specFiles,
  ruleRefs: ["TST-STRU-03"],
  pattern: /^\s*\/\/\s*(?:Arrange|Act|Assert)\s*:?\s*$/,
});
