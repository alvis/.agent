import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const plugin = resolve(here, "../..");
const codingWorkflow = resolve(plugin, "../coding/references/WORKFLOW.md");
const direction = "directions/establish-work-stream.md";

function section(document: string, heading: string): string {
  const level = heading.match(/^#+/)?.[0].length ?? 0;
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `^${escaped}\\n([\\s\\S]*?)(?=^#{1,${level}} |$(?![\\s\\S]))`,
    "gm",
  ).exec(document);
  expect(match, heading).not.toBeNull();
  return match![1]!;
}

describe("substantial work confirmation", () => {
  it("routes every first-use bootstrap authority through confirmation", () => {
    const authorities: Array<readonly [string, string]> = [];
    const references = resolve(plugin, "references");
    for (const entry of readdirSync(references, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const path = resolve(entry.parentPath, entry.name);
      const source = readFileSync(path, "utf8");
      const heading = /^#+ First-use work-memory bootstrap$/m.exec(source)?.[0];
      if (heading !== undefined) authorities.push([path, heading]);
    }
    expect(authorities.map(([path]) => path.split("/").at(-1)).sort()).toEqual([
      "lease.md",
      "state.md",
    ]);
    for (const [path, heading] of authorities)
      expect(section(readFileSync(path, "utf8"), heading), path).toContain(
        direction,
      );
  });

  it("routes Coding substantial work through confirmation", () => {
    const location = section(
      readFileSync(codingWorkflow, "utf8"),
      "### Decide where the work will live",
    );
    expect(location).toContain(`essential:references/${direction}`);
  });
});
