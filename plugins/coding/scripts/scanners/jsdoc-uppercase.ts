import { descriptionAfterTag, jsdocProseLines } from "../scanlib/jsdoc.ts";
import { sourceFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

const acronymOrPascal = /^([A-Z][A-Z0-9_]+|[A-Z][a-z]+[A-Z]\w*)\b/;
const codeHint = /[`(){};=]/;
export const RULE: Rule = {
  id: "jsdoc-uppercase",
  label: "JSDoc: uppercase first letter",
  order: 0,
  appliesTo: sourceFiles,
  ruleRefs: ["DOC-FORM-03"],
  scan: ({ path, lines, matches }) => {
    for (const prose of jsdocProseLines(lines)) {
      if (
        prose.tag === "example" &&
        codeHint.test(prose.text) &&
        !prose.text.startsWith("@")
      )
        continue;
      if (prose.tag === "param" || prose.text.startsWith("@param")) continue;
      const text = prose.text.startsWith("@")
        ? descriptionAfterTag(prose.text)
        : prose.text;
      if (/^[A-Z][a-z]/.test(text) && !acronymOrPascal.test(text))
        matches.push({
          path,
          lineno: prose.lineno,
          line: lines[prose.lineno - 1] ?? "",
        });
    }
  },
};
