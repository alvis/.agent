import { sourceFiles } from "../scanlib/predicates.ts";
import { lineRule } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "star-import-export",
  label: "Wildcard `import * as` / `export *` (TYP-IMPT-03, TYP-MODL-04)",
  order: 100,
  appliesTo: sourceFiles,
  ruleRefs: ["TYP-IMPT-03", "TYP-MODL-04"],
  pattern: /^\s*import\s+\*\s+as\s+\w|^\s*export\s+\*\s+(?:as\s+\w+\s+)?from\b/,
});
