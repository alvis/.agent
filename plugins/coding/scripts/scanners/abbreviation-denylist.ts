import { sourceFiles } from "../scanlib/predicates.ts";
import { lineRule } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "abbreviation-denylist",
  label: "Non-allowlisted abbreviation in identifier (NAM-CORE-03)",
  order: 180,
  appliesTo: sourceFiles,
  ruleRefs: ["NAM-CORE-03"],
  pattern:
    /\b(?:const|let|var)\s+(?:cfg|usr|repo|ctx|tmp|env|btn|msg|err|req|res|val|obj|arr|str|num|idx|len|fn2)\b/,
});
