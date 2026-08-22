import { sourceFiles } from "../scanlib/predicates.ts";
import { lineRule } from "./_line-rule.ts";

export const RULE = lineRule({
  id: "let",
  label: "`let` declarations",
  order: 40,
  appliesTo: sourceFiles,
  honorNoTests: true,
  pattern: /^\s*let\s+\w/,
  accept: ({ line }) => !/\/\/.*eslint-disable.*prefer-const/i.test(line),
});
