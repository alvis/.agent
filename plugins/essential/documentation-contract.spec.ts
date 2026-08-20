import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const plugin = dirname(fileURLToPath(import.meta.url));
const plugins = resolve(plugin, "..");
const fence = /^\s*(`{3,}|~{3,})(.*)$/;
const heading = /^(#{1,6})\s+\S/;

function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    return entry.isDirectory()
      ? files(path)
      : statSync(path).isFile()
        ? [path]
        : [];
  });
}

function markdownBody(path: string): string[] {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  if (lines[0] !== "---") return lines;
  const delimiter = lines.indexOf("---", 1);
  expect(delimiter, `${path}: unclosed front matter`).toBeGreaterThan(0);
  expect(
    lines.slice(1, delimiter).some((line) => line.trim() !== ""),
    path,
  ).toBe(true);
  return lines.slice(delimiter + 1);
}

function markdownStructure(lines: readonly string[]): {
  readonly headings: number[];
  readonly textFences: string[][];
} {
  const headings: number[] = [];
  const textFences: string[][] = [];
  let open: { marker: string; width: number; info: string } | undefined;
  let fenced: string[] = [];
  for (const line of lines) {
    const match = fence.exec(line);
    if (match !== null) {
      const marker = match[1]!;
      if (open === undefined) {
        open = {
          marker: marker[0]!,
          width: marker.length,
          info: match[2]!.trim(),
        };
        fenced = [];
      } else if (marker[0] === open.marker && marker.length >= open.width) {
        if (open.info === "text") textFences.push(fenced);
        open = undefined;
      } else fenced.push(line);
      continue;
    }
    if (open !== undefined) {
      fenced.push(line);
      continue;
    }
    const found = heading.exec(line);
    if (found !== null) headings.push(found[1]!.length);
  }
  expect(open, "unclosed Markdown fence").toBeUndefined();
  return { headings, textFences };
}

function duplicateObjectKeys(source: string): string[] {
  const stack: Array<{
    readonly kind: "object" | "array";
    readonly keys: Set<string>;
  }> = [];
  const duplicates: string[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") stack.push({ kind: "object", keys: new Set() });
    else if (character === "[") stack.push({ kind: "array", keys: new Set() });
    else if (character === "}" || character === "]") stack.pop();
    else if (character === '"') {
      const start = index;
      for (index += 1; index < source.length; index += 1) {
        if (source[index] === "\\") index += 1;
        else if (source[index] === '"') break;
      }
      let next = index + 1;
      while (/\s/.test(source[next] ?? "")) next += 1;
      const current = stack.at(-1);
      if (source[next] === ":" && current?.kind === "object") {
        const key = JSON.parse(source.slice(start, index + 1)) as string;
        if (current.keys.has(key)) duplicates.push(key);
        current.keys.add(key);
      }
    }
  }
  return duplicates;
}

describe("documentation structure", () => {
  it("keeps Markdown templates structurally valid", () => {
    const templates = files(plugins).filter((path) =>
      path.endsWith(".template.md"),
    );
    expect(templates.length).toBeGreaterThan(0);
    for (const path of templates) {
      const { headings } = markdownStructure(markdownBody(path));
      expect(headings[0], path).toBe(1);
      expect(
        headings.filter((level) => level === 1),
        path,
      ).toHaveLength(1);
      for (let index = 1; index < headings.length; index += 1)
        expect(headings[index]!, path).toBeLessThanOrEqual(
          headings[index - 1]! + 1,
        );
    }
  });

  it("keeps JSON templates non-empty objects without duplicate keys", () => {
    const templates = files(plugins).filter((path) =>
      path.endsWith(".template.json"),
    );
    expect(templates.length).toBeGreaterThan(0);
    for (const path of templates) {
      const source = readFileSync(path, "utf8");
      expect(
        duplicateObjectKeys(source),
        `${path}: duplicate object key`,
      ).toEqual([]);
      const document = JSON.parse(source) as unknown;
      expect(
        document !== null &&
          typeof document === "object" &&
          !Array.isArray(document),
        path,
      ).toBe(true);
      expect(Object.keys(document as object).length, path).toBeGreaterThan(0);
    }
  });

  it("keeps commented topology fences consistent", () => {
    let checked = 0;
    for (const path of files(plugins).filter((candidate) =>
      candidate.endsWith(".md"),
    )) {
      for (const topology of markdownStructure(
        readFileSync(path, "utf8").split(/\r?\n/),
      ).textFences) {
        const entries = topology.filter((line) => line.trim() !== "");
        if (
          entries.length === 0 ||
          !entries[0]!.includes(" # ") ||
          !entries.some((line) => /[├└│]/.test(line))
        )
          continue;
        checked += 1;
        expect(
          entries.every((line) => line.includes(" # ")),
          path,
        ).toBe(true);
        expect(
          entries.every((line) => /\S {2,}# /.test(line)),
          path,
        ).toBe(true);
        expect(
          entries.some((line) => /\/\s+#/.test(line)),
          path,
        ).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
