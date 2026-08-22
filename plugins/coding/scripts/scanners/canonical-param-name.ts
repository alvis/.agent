import { sourceFiles } from "../scanlib/predicates.ts";
import { lineRule } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "canonical-param-name",
  label: "Non-canonical parameter name (NAM-TYPE-02, FUNC-SIGN-03)",
  order: 190,
  appliesTo: sourceFiles,
  ruleRefs: ["NAM-TYPE-02", "FUNC-SIGN-03"],
  pattern: /[(,]\s*(?:payload|cfg|extra|obj)\s*[?:]/,
});
