import { specFiles } from "../scanlib/predicates.ts";
import { lineRule, withoutLineComment } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "test-env-access",
  label: "Direct process.env/global access in spec file (TST-MOCK-11)",
  order: 25,
  appliesTo: specFiles,
  ruleRefs: ["TST-MOCK-11"],
  pattern:
    /(?<![\w$.])(?:process\s*(?:\.\s*env|\[\s*['"]env['"]\s*\])|(?:global|globalThis|self|window)\s*(?:\.|\[\s*['"]))/,
  code: withoutLineComment,
});
