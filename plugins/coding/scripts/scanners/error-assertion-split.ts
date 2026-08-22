import { isSpecFile } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

const instance =
  /expect\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\.toBeInstanceOf\(\s*([A-Za-z_$][\w$]*)\s*\)/g;
const field =
  /expect\(\s*\(?\s*([A-Za-z_$][\w$]*)\b[^)\n]*\)?\s*\.(?:message|cause|name)\b/g;
export const RULE: Rule = {
  id: "error-assertion-split",
  label:
    "Split error assertion — collapse to `expect(error).toEqual(new Error('…'))` (TST-DATA-07)",
  order: 92,
  appliesTo: isSpecFile,
  ruleRefs: ["TST-DATA-07"],
  scan: ({ path, lines, matches }) => {
    const codes = lines.map((line) => line.replace(/\/\/.*$/, ""));
    const fields = new Set(
      codes.flatMap((line) =>
        [...line.matchAll(field)].map((hit) => hit[1] ?? ""),
      ),
    );
    for (const [index, code] of codes.entries())
      for (const hit of code.matchAll(instance)) {
        const type = hit[2] ?? "";
        if (
          (type === "Error" || type.endsWith("Error")) &&
          fields.has(hit[1] ?? "")
        )
          matches.push({ path, lineno: index + 1, line: lines[index] ?? "" });
      }
  },
};
