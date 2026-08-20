import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { markdownFiles, violations } from "./check_markdown_scripts.ts";
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  writeFixture,
} from "./test-support.ts";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

describe("fn:violations", () => {
  it("should count content lines beyond the shell fence limit", async () => {
    const root = await createTemporaryDirectory("markdown-scripts-");
    try {
      const path = await writeFixture(root, "guide.md", `\`\`\`bash\n${"true\n".repeat(11)}\`\`\`\n`);

      expect(await violations(path)).toEqual([{ language: "bash", line: 1, lines: 11, path }]);
    } finally {
      await removeTemporaryDirectory(root);
    }
  });

  it("should allow non-shell examples and ten-line shell fences", async () => {
    const root = await createTemporaryDirectory("markdown-scripts-");
    try {
      const path = await writeFixture(
        root,
        "guide.md",
        `\`\`\`bash\n${"true\n".repeat(10)}\`\`\`\n\`\`\`python\n${"pass\n".repeat(11)}\`\`\`\n`,
      );

      expect(await violations(path)).toEqual([]);
    } finally {
      await removeTemporaryDirectory(root);
    }
  });

  it("should require a matching-length marker with no trailing info to close a fence", async () => {
    const root = await createTemporaryDirectory("markdown-scripts-");
    try {
      const path = await writeFixture(
        root,
        "guide.md",
        `\`\`\`\`bash\n\`\`\`\n${"true\n".repeat(10)}\`\`\`not-a-closer\n\`\`\`\`\n`,
      );

      expect(await violations(path)).toEqual([{ language: "bash", line: 1, lines: 12, path }]);
    } finally {
      await removeTemporaryDirectory(root);
    }
  });

  it("should check an unterminated shell fence at end of file", async () => {
    const root = await createTemporaryDirectory("markdown-scripts-");
    try {
      const path = await writeFixture(root, "guide.md", `\`\`\`zsh\n${"true\n".repeat(11).trimEnd()}`);

      expect(await violations(path)).toEqual([{ language: "zsh", line: 1, lines: 11, path }]);
    } finally {
      await removeTemporaryDirectory(root);
    }
  });
});

describe("fn:markdownFiles", () => {
  it("should keep repository Markdown shell fences within the executable limit", async () => {
    const paths = await markdownFiles([repositoryRoot]);
    const found = (await Promise.all(paths.map(violations))).flat();

    expect(found).toEqual([]);
  });
});
