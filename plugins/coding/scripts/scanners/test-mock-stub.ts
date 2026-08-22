import { specFiles } from "../scanlib/predicates.ts";
import { lineRule } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "test-mock-stub",
  label: "Mock/stub identifiers in spec files",
  order: 30,
  appliesTo: specFiles,
  ruleRefs: ["TST-STRU-01"],
  pattern:
    /\b(?:(?!(?:setup|use)[A-Z])[A-Za-z]\w*(?:Stub|Mock)|(?:mock|mocked|stub|stubbed|stubed)[A-Z]\w*)\b/,
});
