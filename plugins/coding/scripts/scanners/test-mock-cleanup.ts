import { specFiles } from "../scanlib/predicates.ts";
import { lineRule, withoutLineComment } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "test-mock-cleanup",
  label: "Manual mock/stub cleanup in spec file (TST-MOCK-10)",
  order: 26,
  appliesTo: specFiles,
  ruleRefs: ["TST-MOCK-10"],
  pattern:
    /\b(?:mockReset|mockClear|mockRestore|resetAllMocks|clearAllMocks|restoreAllMocks|unstubAllEnvs|unstubAllGlobals|reset)\b/,
  code: withoutLineComment,
});
