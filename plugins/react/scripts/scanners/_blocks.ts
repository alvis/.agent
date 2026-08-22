const head =
  /(?:^|\n)\s*(?:export\s+)?(?:interface\s+\w+Props\b[^\n{]*\{|type\s+\w+Props\b[^\n=]*=\s*\{)/g;
export function findBlockEnd(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return text.length;
}
export function propsBlocks(text: string): Array<readonly [number, number]> {
  const blocks: Array<readonly [number, number]> = [];
  for (const match of text.matchAll(head)) {
    const offset = match[0].lastIndexOf("{");
    if (offset >= 0) {
      const open = (match.index ?? 0) + offset;
      blocks.push([open, findBlockEnd(text, open)]);
    }
  }
  return blocks;
}
export function parseNamedSpecifiers(group: string): string[] {
  return group.split(",").flatMap((raw) => {
    let token = raw.trim();
    if (token === "") return [];
    if (token.startsWith("type ")) token = token.slice(5).trim();
    const renamed = token.split(/\s+as\s+/, 2).map((part) => part.trim());
    return renamed.length === 2 ? renamed : [token];
  });
}
