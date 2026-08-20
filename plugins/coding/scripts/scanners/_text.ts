import type { Match } from "../scanlib/rule.ts";

export function pushTextMatches(
  path: string,
  lines: readonly string[],
  matches: Match[],
  pattern: RegExp,
  text = lines.join("\n"),
): void {
  for (const hit of text.matchAll(pattern)) {
    const offset = hit.index ?? 0;
    const lineno = text.slice(0, offset).split("\n").length;
    matches.push({ path, lineno, line: lines[lineno - 1] ?? "" });
  }
}
