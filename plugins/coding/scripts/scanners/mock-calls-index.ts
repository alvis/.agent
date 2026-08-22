import { specFiles } from "../scanlib/predicates.ts";
import { lineRule, withoutLineComment } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "mock-calls-index",
  label:
    "Manual mock.calls[N] indexing — single call: toHaveBeenCalledWith; sequence: toEqual([...]) (TST-CORE-09/TST-DATA-02)",
  order: 126,
  appliesTo: specFiles,
  ruleRefs: ["TST-CORE-09", "TST-DATA-02"],
  pattern: /\.mock\.(?:calls|results)\[\s*\d+\s*\]/,
  code: withoutLineComment,
});
