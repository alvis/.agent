import { sourceFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";
import { pushTextMatches } from "./_text.ts";

const pattern =
  /\.\.\.\s*\(\s*[^?()]+\?\s*(?:\{[^{}]*\}\s*:\s*\{\s*\}|\{\s*\}\s*:\s*\{[^{}]*\})\s*\)/gs;
export const RULE: Rule = {
  id: "conditional-spread",
  label: "Conditional object spread (`...(cond ? {…} : {})`)",
  order: 50,
  appliesTo: sourceFiles,
  ruleRefs: ["FUNC-SIGN-06"],
  scan: ({ path, lines, matches }) =>
    pushTextMatches(path, lines, matches, pattern),
};
