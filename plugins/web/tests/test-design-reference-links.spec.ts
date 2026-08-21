import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const designReferences = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "skills",
  "design",
  "references",
);

// GitHub turns `## Heading Text` into an anchor by lowercasing the text,
// dropping every character outside letters, digits, whitespace, and hyphens,
// then collapsing whitespace and hyphen runs into single hyphens.
function githubHeadingAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

describe("design reference integrity", () => {
  it("keeps the facelift and design reference artifacts addressable", () => {
    for (const name of ["facelift.md", "design-reference.md"]) {
      const path = join(designReferences, name);
      expect(existsSync(path)).toBe(true);
      expect(statSync(path).isFile()).toBe(true);
    }
  });

  it("resolves the Motion Libraries link to a GitHub-style anchor", () => {
    const source = readFileSync(join(designReferences, "facelift.md"), "utf8");
    const match = /\[Motion Libraries\]\(([^)#]+)#([^)]+)\)/.exec(source);
    expect(match, "facelift.md lost its Motion Libraries link").not.toBeNull();
    const [, relative = "", anchor = ""] = match ?? [];
    const targetPath = join(designReferences, relative);
    expect(statSync(targetPath).isFile()).toBe(true);
    const anchors = readFileSync(targetPath, "utf8")
      .split("\n")
      .filter((line) => line.startsWith("## "))
      .map((line) => githubHeadingAnchor(line.slice("## ".length)));
    expect(anchors).toContain(anchor);
  });
});
