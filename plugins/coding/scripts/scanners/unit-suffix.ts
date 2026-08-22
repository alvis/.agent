import { sourceFiles } from "../scanlib/predicates.ts";
import { lineRule } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "unit-suffix",
  label: "Time/measurement identifier without unit suffix (NAM-CORE-04)",
  order: 170,
  appliesTo: sourceFiles,
  ruleRefs: ["NAM-CORE-04"],
  pattern: /\b(?:const|let|var)\s+(?:timeout|delay|duration|interval)\b/,
});
