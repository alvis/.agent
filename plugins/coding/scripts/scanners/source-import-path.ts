import { sourceFiles } from "../scanlib/predicates.ts";
import { lineRule, withoutLineComment } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "source-import-path",
  label: "Relative import traverses into src/source (TYP-IMPT-08)",
  order: 65,
  appliesTo: sourceFiles,
  ruleRefs: ["TYP-IMPT-08"],
  pattern:
    /['"`][^'"`\n]*(?:\.\.\/)+(?:[^/'"`\n]+\/)*(?:src|source)(?:\/|['"`])/,
  code: withoutLineComment,
});
