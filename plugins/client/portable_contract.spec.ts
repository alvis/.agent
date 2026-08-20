import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const plugin = resolve(fileURLToPath(new URL(".", import.meta.url)));
const skills = join(plugin, "skills");
const fixedNotionId = /(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])/;

function markdownFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? markdownFiles(child) : child.endsWith(".md") ? [child] : [];
  });
}

it("should require external configuration for screen design contracts", () => {
  const contracts = [join(skills, "create-screen-design/SKILL.md"), join(skills, "update-screen-design/SKILL.md")];
  for (const contract of contracts) {
    const text = readFileSync(contract, "utf8");
    for (const argument of ["--body-author=<plugin:skill>", "--template-ref=<ref>", "--parent-ref=<ref>", "--collection-ref=<ref>"]) expect(text, contract).toContain(argument);
    expect(text, contract).not.toMatch(fixedNotionId);
    expect(text, contract).toContain("defaults");
  }
  const create = readFileSync(contracts[0]!, "utf8");
  expect(create).toContain("Accept the canonical ref only from the validated create");
  expect(create).toContain("Never expect an external executable");
});

it("should ship no Client body grammar", () => {
  const text = markdownFiles(plugin).sort().map((path) => readFileSync(path, "utf8")).join("\n").toLowerCase();
  expect(text).not.toContain("closing marker");
  expect(text).not.toContain("annotation bodies");
});
