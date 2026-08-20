import type { Rule, ScanParams } from "../scanlib/rule.ts";

interface LineRuleOptions extends Omit<Rule, "scan"> {
  readonly pattern: RegExp;
  readonly code?: (line: string) => string;
  readonly accept?: (params: {
    readonly path: string;
    readonly line: string;
    readonly lineno: number;
  }) => boolean;
}

export function lineRule(options: LineRuleOptions): Rule {
  const {
    pattern,
    code = (line) => line,
    accept = () => true,
    ...rule
  } = options;
  return {
    ...rule,
    scan: ({ path, lines, matches }: ScanParams): void => {
      for (const [index, line] of lines.entries()) {
        pattern.lastIndex = 0;
        if (
          pattern.test(code(line)) &&
          accept({ path, line, lineno: index + 1 })
        ) {
          matches.push({ path, lineno: index + 1, line });
        }
      }
    },
  };
}

export const withoutLineComment = (line: string): string =>
  line.replace(/\/\/.*$/, "");
