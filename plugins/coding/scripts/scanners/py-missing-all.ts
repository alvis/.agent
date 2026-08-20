import { basename, dirname, parse } from "node:path";
import { pythonFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

const reexport = /^\s*from\s+(?!__future__\b)[\w.]+\s+import\s+/;
const declaration = /^\s*__all__\s*[:=]/;
function privatePackage(path: string): boolean {
  const directory = dirname(path);
  return directory
    .split(/[\\/]/)
    .some((part) => part.startsWith("_") && part !== parse(directory).root);
}
export const RULE: Rule = {
  id: "py-missing-all",
  label:
    "Public package `__init__.py` re-exports without `__all__` (PYT-IMPT-05)",
  order: 250,
  appliesTo: pythonFiles,
  ruleRefs: ["PYT-IMPT-05"],
  scan: ({ path, lines, matches }) => {
    if (basename(path) !== "__init__.py" || privatePackage(path)) return;
    let reexportLine = 0;
    for (const [index, line] of lines.entries()) {
      if (declaration.test(line)) return;
      if (reexportLine === 0 && reexport.test(line)) reexportLine = index + 1;
    }
    if (reexportLine > 0)
      matches.push({
        path,
        lineno: reexportLine,
        line: lines[reexportLine - 1] ?? "",
      });
  },
};
