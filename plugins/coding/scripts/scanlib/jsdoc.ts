const ONELINE_JSDOC = /\/\*\*\s*([^*][^*]*?)\s*\*\//;
const JSDOC_PROSE_LINE = /^\s*\*\s+(\S.*)$/;
const TAG_LINE = /^@(\w+)\b\s*(.*)$/;

export interface JsdocProse {
  readonly lineno: number;
  readonly text: string;
  readonly tag: string | null;
}

export function jsdocProseLines(lines: readonly string[]): JsdocProse[] {
  const prose: JsdocProse[] = [];
  let inBlock = false;
  let currentTag: string | null = null;
  for (const [index, raw] of lines.entries()) {
    const oneline = ONELINE_JSDOC.exec(raw);
    if (oneline !== null && !inBlock) {
      prose.push({
        lineno: index + 1,
        text: oneline[1]?.trim() ?? "",
        tag: null,
      });
      continue;
    }
    if (!inBlock) {
      const opening = raw.indexOf("/**");
      if (opening < 0) continue;
      inBlock = true;
      currentTag = null;
      const tail =
        raw
          .slice(opening + 3)
          .split("*/", 1)[0]
          ?.trim()
          .replace(/^\*+/, "")
          .trim() ?? "";
      if (tail) prose.push({ lineno: index + 1, text: tail, tag: null });
      if (raw.includes("*/")) inBlock = false;
      continue;
    }
    const match = JSDOC_PROSE_LINE.exec(raw);
    if (match !== null) {
      const text = match[1]?.trim() ?? "";
      currentTag = TAG_LINE.exec(text)?.[1] ?? currentTag;
      prose.push({ lineno: index + 1, text, tag: currentTag });
    }
    if (raw.includes("*/")) {
      inBlock = false;
      currentTag = null;
    }
  }
  return prose;
}

export function descriptionAfterTag(text: string): string {
  const match = TAG_LINE.exec(text);
  if (match === null) return text;
  const tag = match[1] ?? "";
  const rest = (match[2] ?? "").trim();
  if (["param", "property", "arg", "argument"].includes(tag))
    return rest.split(/\s+/, 2)[1]?.trim() ?? "";
  return rest;
}
