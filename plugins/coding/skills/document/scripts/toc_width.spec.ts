import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { classify, measure, run, scanText } from "./toc_width.ts";

const script = fileURLToPath(new URL("./toc_width.ts", import.meta.url));
const usage = "usage: toc_width.ts [-h] [--line TEXT] [files ...]";

function cli(args: string[], input?: string) {
  return spawnSync("bun", ["run", script, ...args], {
    encoding: "utf8",
    input,
  });
}

describe("TOC display width", () => {
  it.each([
    ["plain", 5],
    ["[caption](https://example.test/path)", 7],
    ["&emsp;&nbsp;&ensp;", 4],
    ["e\u0301", 1],
    ["中", 2],
    ["🙏", 2],
    ["👩‍💻", 4],
    ["a\n", 1],
    ["a\n\n", 1],
    ["𗀀", 2],
    ["\u0000\u001f\u007f", 3],
    ["\t", 1],
    ["😀", 2],
  ])("measures rendered %s width", (text, width) => {
    expect(measure(text)).toBe(width);
  });

  it.each([
    [100, "OK"],
    [101, "TIGHT"],
    [110, "TIGHT"],
    [111, "OVER"],
  ])("classifies width %i as %s", (width, status) => {
    expect(classify(width)).toBe(status);
  });

  it("scans only visible project TOC rows and preserves source lines", () => {
    const visible = "• [One](#one)&emsp;[Two](#two)\n";
    const text = `<!--\n${visible}-->\nnot a row\n<!-- hidden -->${visible}`;
    expect(scanText(text)).toEqual([[5, 10, "OK", visible.trimEnd()]]);
  });

  it("handles comments that close and reopen on one line", () => {
    const row = "• [One](#one)&emsp;[Two](#two)";
    expect(scanText(`<!-- hidden -->${row}<!-- tail -->\n`)).toEqual([
      [1, 10, "OK", row],
    ]);
  });

  it("normalizes CRLF and lone CR as universal line boundaries", () => {
    const row = "• [One](#one)&emsp;[Two](#two)";
    expect(scanText(`${row}\r\n${row}\r${row}`)).toEqual([
      [1, 10, "OK", row],
      [2, 10, "OK", row],
      [3, 10, "OK", row],
    ]);
  });

  it("truncates previews by Unicode code point rather than UTF-16 unit", () => {
    const value = "😀".repeat(81);
    expect(cli([`--line=${value}`]).stdout).toBe(
      `162\tOVER\t${"😀".repeat(80)}\n`,
    );
  });

  it("returns help with status zero", () => {
    const completed = cli(["--help"]);
    expect(completed.status).toBe(0);
    expect(completed.stderr).toBe("");
    expect(completed.stdout).toContain("110-char hard cap");
  });

  it("prints help with status two when no input is supplied", () => {
    const completed = cli([]);
    expect(completed.status).toBe(2);
    expect(completed.stderr).toBe("");
    expect(completed.stdout).toContain(usage);
  });

  it.each([
    ["--line", "abc", "3\tOK\tabc\n", 0],
    [
      "--line=" + "x".repeat(101),
      undefined,
      `101\tTIGHT\t${"x".repeat(80)}\n`,
      0,
    ],
    [
      "--line=" + "x".repeat(111),
      undefined,
      `111\tOVER\t${"x".repeat(80)}\n`,
      1,
    ],
    ["--line", "-", "1\tOK\t-\n", 0],
  ])("supports literal line form %s", (argument, value, stdout, status) => {
    const completed = cli(value === undefined ? [argument] : [argument, value]);
    expect(completed.status).toBe(status);
    expect(completed.stdout).toBe(stdout);
    expect(completed.stderr).toBe("");
  });

  it("rejects missing and option-shaped --line values", () => {
    for (const args of [["--line"], ["--line", "--bad"]]) {
      const completed = cli(args);
      expect(completed.status).toBe(2);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe(
        `${usage}\ntoc_width.ts: error: argument --line: expected one argument\n`,
      );
    }
  });

  it("rejects unknown options", () => {
    const completed = cli(["--unknown"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(
      `${usage}\ntoc_width.ts: error: unrecognized arguments: --unknown\n`,
    );
  });

  it("rejects an empty long-option name like argparse", () => {
    const completed = cli(["--=x"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(
      `${usage}\ntoc_width.ts: error: ambiguous option: --=x could match --help, --line\n`,
    );
  });

  it.each([
    [["--he"], 0, "stdout"],
    [["--help", "--unknown"], 0, "stdout"],
    [["--help=value"], 2, "stderr"],
    [["--li", "value"], 0, "stdout"],
    [["--line", "-12"], 0, "stdout"],
    [["--line=value", "extra"], 0, "stdout"],
  ] as const)(
    "matches argparse edge behavior for %j",
    (args, status, stream) => {
      const completed = cli([...args]);
      expect(completed.status).toBe(status);
      expect(completed[stream]).not.toBe("");
    },
  );

  it("strips every trailing LF from literal width and preview", () => {
    const completed = cli(["--line=a\n\n"]);
    expect(completed.status).toBe(0);
    expect(completed.stdout).toBe("1\tOK\ta\n");
    expect(completed.stderr).toBe("");
  });

  it("treats option-shaped values after -- as positional files", () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expect(run(["--", "--unknown"])).toBe(0);
    expect(error).toHaveBeenCalledWith("skip (not a file): --unknown");
    error.mockRestore();
  });

  it.each(["-1", "-.1", "-١"])(
    "accepts complete negative numeric --line value %s",
    (value) => {
      const completed = cli(["--line", value]);
      expect(completed.status).toBe(0);
      expect(completed.stdout).toContain(`\tOK\t${value}\n`);
      expect(completed.stderr).toBe("");
    },
  );

  it.each(["-1x", "-1."])(
    "rejects incomplete negative numeric --line value %s",
    (value) => {
      const completed = cli(["--line", value]);
      expect(completed.status).toBe(2);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe(
        `${usage}\ntoc_width.ts: error: argument --line: expected one argument\n`,
      );
    },
  );

  it("treats a bare -- as an empty positional input", () => {
    const completed = cli(["--", "--"]);
    expect(completed.status).toBe(2);
    expect(completed.stderr).toBe("");
    expect(completed.stdout).toContain(usage);
  });

  it("measures every stdin line and returns the maximum severity", () => {
    const completed = cli(["-"], `abc\n${"x".repeat(111)}\n`);
    expect(completed.status).toBe(1);
    expect(completed.stdout).toBe(`3\tOK\tabc\n111\tOVER\t${"x".repeat(80)}\n`);
    expect(completed.stderr).toBe("");
  });

  it("reports file rows, skips missing paths, and fails only for over-width rows", async () => {
    const root = await mkdtemp(join(tmpdir(), "toc-width-"));
    const path = join(root, "README.md");
    const row = `• [${"x".repeat(105)}](#one)&emsp;[Two](#two)\n`;
    await writeFile(path, row);
    try {
      const completed = cli([join(root, "missing.md"), path]);
      expect(completed.status).toBe(1);
      expect(completed.stderr).toBe(
        `skip (not a file): ${join(root, "missing.md")}\n`,
      );
      expect(completed.stdout).toBe(
        `${path}:1\t112\tOVER\t${row.trimEnd().slice(0, 80)}\n`,
      );
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("rejects malformed UTF-8 strictly", async () => {
    const root = await mkdtemp(join(tmpdir(), "toc-width-utf8-"));
    const path = join(root, "bad.md");
    await writeFile(path, new Uint8Array([0xc3, 0x28]));
    try {
      const completed = cli([path]);
      expect(completed.status).not.toBe(0);
      expect(completed.stderr).toContain("ERR_ENCODING_INVALID_ENCODED_DATA");
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("exposes the same run status for direct callers", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(run(["--line=short"])).toBe(0);
    expect(log).toHaveBeenCalledWith("5\tOK\tshort");
    log.mockRestore();
  });
});
