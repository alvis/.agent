import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

// Paths and sha256 values come from the M09 pre-edit inventory
// (.state/works/test-ts-migration/artifacts/m09-inventory.md): §3 binds the five
// Python survivors byte-identically, §1 lists the tracked .py set at that revision.
// The fifth .py file there, plugins/react/tests/test_plugin_dependency_integration.py,
// has since migrated to Vitest and been deleted per its recorded disposition, so the
// live .py set is the four fixtures below.
const preservedFiles: ReadonlyArray<readonly [path: string, sha256: string]> = [
  [
    "plugins/coding/tests/fixtures/py-future-annotations/input.py",
    "647175f38107f79275cfc1dc826dbd15383289c302467ab9cabc2dff71036f9a",
  ],
  [
    "plugins/coding/tests/fixtures/py-missing-all/compliant_pkg/__init__.py",
    "63081a88fa08d5f370412bd7165c2a974e368a0a6ed5acfd9cc021269ebc9dfe",
  ],
  [
    "plugins/coding/tests/fixtures/py-missing-all/violating_pkg/__init__.py",
    "7a3393d2021a9424753b1f2cc6a542ed543bddef54debf219617cbd7145a208f",
  ],
  [
    "plugins/coding/tests/fixtures/py-type-ignore-format/input.py",
    "23a4b9431feab75d9c8ee495bbecb8de052a26352465da47085bc622b89f7e9e",
  ],
  [
    "plugins/essential/skills/doctor/scripts/state-doctor",
    "d7e7819ef314a6ff5012191d6e2dc5cac52270997cc35423899090d1a03bda04",
  ],
];

const inventoriedPythonPaths = [
  "plugins/coding/tests/fixtures/py-future-annotations/input.py",
  "plugins/coding/tests/fixtures/py-missing-all/compliant_pkg/__init__.py",
  "plugins/coding/tests/fixtures/py-missing-all/violating_pkg/__init__.py",
  "plugins/coding/tests/fixtures/py-type-ignore-format/input.py",
];

// Excluded names are generated or VCS-internal stores whose contents no checkout
// shares byte-for-byte (.git exists only in CI's git checkout, .jj only in this jj
// workspace); tracked dot-directories such as .github stay walked so a stray .py
// placed there is still caught. Excluding exactly these four keeps the walk
// identical here and under CI.
const excludedDirectories = new Set(["node_modules", ".git", ".jj", ".state"]);

async function pythonFilePaths(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (excludedDirectories.has(entry.name)) continue;

      const path = join(directory, entry.name);
      // Symlinks are never followed — a symlinked directory is not descended,
      // which keeps the walk cycle-free — but a .py-named symlink still matches
      // the name rule below.
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.name.endsWith(".py")) {
        found.push(relative(root, path).split(sep).join("/"));
      }
    }
  }

  await walk(root);
  return found.sort();
}

describe("repository python inventory", () => {
  it("should keep every preserved Python survivor byte-identical to its inventoried hash", async () => {
    for (const [path, sha256] of preservedFiles) {
      const content = await readFile(join(repositoryRoot, path));

      expect(
        createHash("sha256").update(content).digest("hex"),
        `${path} drifted from its recorded bytes`,
      ).toBe(sha256);
    }
  });

  it("should leave exactly the inventoried .py files in the repository", async () => {
    expect(await pythonFilePaths(repositoryRoot)).toEqual(inventoriedPythonPaths);
  });

  it("should keep the retired pytest configuration deleted", async () => {
    const exists = await stat(join(repositoryRoot, "pytest.ini")).then(
      () => true,
      (error) => {
        if ((error as { code?: string }).code !== "ENOENT") throw error;
        return false;
      },
    );

    expect(exists, "pytest.ini was deleted by the TypeScript cutover").toBe(false);
  });
});
