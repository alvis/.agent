import { specFiles } from "../scanlib/predicates.ts";
import type { Rule } from "../scanlib/rule.ts";

const prefixes = new Set([
  "fn",
  "op",
  "sv",
  "cl",
  "mt",
  "gt",
  "st",
  "re",
  "ty",
  "rc",
  "hk",
  "cmd",
]);
const itTitle = /\bit\s*\(\s*(['"])(.*?)\1/g;
const describeTitle = /\bdescribe\s*\(\s*(['"])(.*?)\1/g;
export const RULE: Rule = {
  id: "test-title-convention",
  label: "Non-canonical test title (`it`/`describe`) (TST-CORE-03)",
  order: 130,
  appliesTo: specFiles,
  ruleRefs: ["TST-CORE-03"],
  scan: ({ path, lines, matches }) => {
    for (const [index, line] of lines.entries()) {
      let flagged = [...line.matchAll(itTitle)].some((hit) => {
        const title = (hit[2] ?? "").trim();
        return title !== "" && !title.toLowerCase().startsWith("should");
      });
      if (!flagged)
        flagged = [...line.matchAll(describeTitle)].some((hit) => {
          const head = /^([a-z]{1,5}):/.exec((hit[2] ?? "").trim());
          return head !== null && !prefixes.has(head[1] ?? "");
        });
      if (flagged) matches.push({ path, lineno: index + 1, line });
    }
  },
};
