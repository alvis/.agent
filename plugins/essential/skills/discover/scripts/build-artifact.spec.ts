import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { BuildError, build, resolveSource } from "./build-artifact.ts";
import { removeDirectory, runBun, temporaryDirectory } from "./test-support.ts";

const scripts = fileURLToPath(new URL(".", import.meta.url));
const discover = fileURLToPath(new URL("..", import.meta.url));
const builder = join(scripts, "build-artifact.ts");
const tailwind = "/* @tailwindcss/browser */";

async function isolatedDiscover(root: string): Promise<{
  builder: string;
  discover: string;
}> {
  const isolated = join(root, "discover");
  await cp(discover, isolated, { recursive: true });
  await mkdir(join(isolated, "assets/html/vendor"), { recursive: true });
  await writeFile(
    join(isolated, "assets/html/vendor/tailwind-browser.cache.js"),
    "/* deterministic offline test runtime */",
    "utf8",
  );
  return {
    builder: join(isolated, "scripts/build-artifact.ts"),
    discover: isolated,
  };
}

describe("source composition and building", () => {
  it("should resolve example and template slugs", async () => {
    expect(await resolveSource("specimen-board")).toBe(
      join(discover, "examples/src/specimen-board"),
    );
    expect(await resolveSource("page")).toBe(
      join(discover, "templates/src/page"),
    );
    await expect(
      resolveSource("missing-board-for-test"),
    ).rejects.toBeInstanceOf(BuildError);
  });
  it.each([false, true])(
    "should build self-contained output in artifact=%s mode",
    async (artifact) => {
      await expect(
        build(join(discover, "examples/html/specimen-board.html"), {
          artifact,
          runtime: tailwind,
          offline: true,
        }),
      ).resolves.toBeTypeOf("string");
    },
  );
});

describe("builder CLI", () => {
  it("should accept the help option", () => {
    const result = runBun(builder, ["--help"]);
    expect(result.exitCode).toBe(0);
  });
  it("should report missing source as an argument error", () => {
    const result = runBun(builder);
    expect(result.exitCode).toBe(2);
  });
  it("should emit a composed page and print only its path", async () => {
    const root = await temporaryDirectory();
    try {
      const out = join(root, "page.html");
      const result = runBun(builder, [
        join(discover, "templates/src/page"),
        "--emit-page",
        out,
      ]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe(out);
      expect((await stat(out)).isFile()).toBe(true);
    } finally {
      await removeDirectory(root);
    }
  });
  it("should build from offline caches without network", async () => {
    const root = await temporaryDirectory();
    try {
      const isolated = await isolatedDiscover(root);
      const out = join(root, "board.html");
      const result = runBun(isolated.builder, [
        "specimen-board",
        "--offline",
        "-o",
        out,
      ]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe(out);
      expect((await stat(out)).isFile()).toBe(true);
    } finally {
      await removeDirectory(root);
    }
  });
  it("should accept equals-form output and emit-page options", async () => {
    const root = await temporaryDirectory();
    try {
      const isolated = await isolatedDiscover(root);
      const output = join(root, "board.html");
      const built = runBun(isolated.builder, [
        "specimen-board",
        "--offline",
        `--out=${output}`,
      ]);
      expect(built).toMatchObject({ exitCode: 0, stderr: "" });
      expect(built.stdout.trim()).toBe(output);
      const page = join(root, "page.html");
      const emitted = runBun(isolated.builder, [
        join(isolated.discover, "templates/src/page"),
        `--emit-page=${page}`,
      ]);
      expect(emitted).toMatchObject({ exitCode: 0, stderr: "" });
      expect(emitted.stdout.trim()).toBe(page);
      expect((await stat(page)).isFile()).toBe(true);
    } finally {
      await removeDirectory(root);
    }
  });
});
