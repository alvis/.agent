import { descriptionAfterTag, jsdocProseLines } from "../scanlib/jsdoc.ts";
import { sourceFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

const codeHint = /[`(){};=]/;
export const RULE: Rule = {
  id: "jsdoc-fullstop",
  label: "JSDoc: trailing period",
  order: 10,
  appliesTo: sourceFiles,
  ruleRefs: ["DOC-FORM-03"],
  scan: ({ path, lines, matches }) => {
    for (const prose of jsdocProseLines(lines)) {
      if (prose.tag === "example" && codeHint.test(prose.text)) continue;
      const text = (
        prose.text.startsWith("@")
          ? descriptionAfterTag(prose.text)
          : prose.text
      ).trimEnd();
      if (
        text !== "" &&
        text.endsWith(".") &&
        !text.endsWith("...") &&
        !text.endsWith("e.g.") &&
        !text.endsWith("i.e.")
      )
        matches.push({
          path,
          lineno: prose.lineno,
          line: lines[prose.lineno - 1] ?? "",
        });
    }
  },
};
