import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { removeDirectory, runBun, temporaryDirectory } from "./test-support.ts";
import { run } from "./test-html-templates.ts";

const scripts = fileURLToPath(new URL(".", import.meta.url));
const discover = fileURLToPath(new URL("..", import.meta.url));
const validator = join(scripts, "test-html-templates.ts");

describe("presentation validator", () => {
  it("should pass the complete repository contract with cached builder runtimes", async () => {
    const result = await run("complete", true);
    expect(result.errors).toEqual([]);
    expect(result.status).toBe("pass");
  });
  it("should pass the non-network representative stage", async () => {
    const result = await run("representative", false);
    expect(result.errors).toEqual([]);
    expect(result.status).toBe("pass");
  });
  it("should return success for the representative CLI stage", () => {
    const result = runBun(validator, ["--stage", "representative"]);
    expect(result.exitCode).toBe(0);
  });
  it("should route help and invalid choices to the correct streams", () => {
    const help = runBun(validator, ["--help"]);
    expect(help.exitCode).toBe(0);
    const invalid = runBun(validator, ["--stage", "wrong"]);
    expect(invalid.exitCode).toBe(2);
    expect(invalid.stdout).toBe("");
  });
  it("should accept equals-form stage", () => {
    const result = runBun(validator, ["--stage=representative"]);
    expect(result.exitCode).toBe(0);
  });
  it.each([false, true])(
    "should skip an unavailable network with partial runtime caches=%s",
    async (tailwindOnly) => {
      const root = await temporaryDirectory();
      try {
        const isolated = join(root, "discover");
        await cp(discover, isolated, { recursive: true });
        const vendor = join(isolated, "assets/html/vendor");
        await rm(vendor, { force: true, recursive: true });
        if (tailwindOnly) {
          await mkdir(vendor, { recursive: true });
          await writeFile(
            join(vendor, "tailwind-browser.cache.js"),
            "/* deterministic @tailwindcss/browser test runtime */",
          );
        }
        const dead = {
          ALL_PROXY: "http://127.0.0.1:9",
          HTTP_PROXY: "http://127.0.0.1:9",
          HTTPS_PROXY: "http://127.0.0.1:9",
        };
        const result = runBun(
          join(isolated, "scripts/test-html-templates.ts"),
          ["--stage=complete"],
          dead,
        );
        expect(result).toMatchObject({ exitCode: 0, stderr: "" });
      } finally {
        await removeDirectory(root);
      }
    },
  );
});
