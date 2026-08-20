import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const classifier = fileURLToPath(
  new URL("./classify-pr-size.ts", import.meta.url),
);
const classifierUsage =
  "usage: classify-pr-size.ts [-h] [--repo REPO] --base BASE --head HEAD";
type Result = {
  authored_additions: number;
  authored_deletions: number;
  base_oid: string;
  files_changed: number;
  generated_files: string[];
  head_oid: string;
  net_loc: number;
  zone: string;
};
function git(repo: string, ...args: string[]): string {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}
async function repository(): Promise<{ base: string; repo: string }> {
  const repo = await mkdtemp(join(tmpdir(), "pr-size-test-"));
  git(repo, "init", "--quiet", "--initial-branch=main");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  await writeFile(join(repo, "README.md"), "base\n");
  return { repo, base: commit(repo, "base") };
}
function commit(repo: string, message: string): string {
  git(repo, "add", ".");
  git(repo, "commit", "--quiet", "--no-gpg-sign", "-m", message);
  return git(repo, "rev-parse", "HEAD");
}
function lines(count: number, value = "line"): string {
  return Array.from(
    { length: count },
    (_, index) => `${value}-${index}\n`,
  ).join("");
}
function classify(
  repo: string,
  base: string,
  head: string,
  environment: NodeJS.ProcessEnv = {},
): Result {
  const result = spawnSync(
    "bun",
    ["run", classifier, "--repo", repo, "--base", base, "--head", head],
    { encoding: "utf8", env: { ...process.env, ...environment } },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  return JSON.parse(result.stdout);
}

function runClassifier(args: string[], cwd?: string) {
  return spawnSync("bun", ["run", classifier, ...args], {
    cwd,
    encoding: "utf8",
  });
}

describe("PR size classification", () => {
  let repo: string, base: string;
  beforeEach(async () => ({ repo, base } = await repository()));
  afterEach(async () => rm(repo, { force: true, recursive: true }));

  it("preserves arbitrary invalid-UTF8 filename identity through attributes and JSON", async () => {
    await mkdir(join(repo, "generated"));
    await writeFile(
      join(repo, ".gitattributes"),
      "generated/*.bin linguist-generated=true\n",
    );
    git(repo, "add", ".");
    const blob = spawnSync(
      "git",
      ["-C", repo, "hash-object", "-w", "--stdin"],
      {
        encoding: "utf8",
        input: "generated\n",
      },
    ).stdout.trim();
    const indexRecord = Buffer.concat([
      Buffer.from(`100644 ${blob}\tgenerated/bad`),
      Buffer.from([0xff]),
      Buffer.from(".bin\0"),
    ]);
    const indexed = spawnSync(
      "git",
      ["-C", repo, "update-index", "-z", "--add", "--index-info"],
      { input: indexRecord },
    );
    expect(indexed.status, indexed.stderr?.toString()).toBe(0);
    git(repo, "commit", "--quiet", "--no-gpg-sign", "-m", "invalid byte path");
    const head = git(repo, "rev-parse", "HEAD");
    const result = classify(repo, base, head);
    expect(result).toMatchObject({
      files_changed: 2,
      authored_additions: 1,
      generated_files: ["generated/bad\udcff.bin"],
    });
  });

  it("does not let help consume a missing --repo value", () => {
    const completed = runClassifier(["--repo", "--help"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(
      "usage: classify-pr-size.ts [-h] [--repo REPO] --base BASE --head HEAD\n" +
        "classify-pr-size.ts: error: argument --repo: expected one argument\n",
    );
  });

  it("accepts an explicitly empty --repo= value as the current directory", () => {
    const head = base;
    const completed = runClassifier(
      ["--repo=", `--base=${base}`, `--head=${head}`],
      repo,
    );
    expect(completed.status, completed.stderr).toBe(0);
    expect(completed.stderr).toBe("");
    expect(JSON.parse(completed.stdout)).toMatchObject({
      base_oid: base,
      head_oid: head,
      files_changed: 0,
    });
  });

  it.each([
    ["--repo", "-h"],
    ["--base", "-h"],
    ["--head", "-h"],
    ["--repo", "-x"],
    ["--base", "-x"],
    ["--head", "-x"],
  ])(
    "rejects %s followed by option token %s as a missing value",
    (option, token) => {
      const completed = runClassifier([option, token]);
      expect(completed.status).toBe(2);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe(
        `${classifierUsage}\nclassify-pr-size.ts: error: argument ${option}: expected one argument\n`,
      );
    },
  );

  it.each(["--base", "--head"])(
    "accepts an empty %s= value and reaches Git",
    (option) => {
      const other = option === "--base" ? `--head=${base}` : `--base=${base}`;
      const completed = runClassifier(["--repo", repo, `${option}=`, other]);
      expect(completed.status).toBe(1);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe("fatal: Needed a single revision\n");
    },
  );

  it("accepts unambiguous long-option abbreviations", () => {
    const completed = runClassifier([
      "--r",
      repo,
      `--b=${base}`,
      `--hea=${base}`,
    ]);
    expect(completed.status, completed.stderr).toBe(0);
    expect(completed.stderr).toBe("");
    expect(JSON.parse(completed.stdout)).toMatchObject({
      base_oid: base,
      head_oid: base,
      files_changed: 0,
    });
  });

  it("rejects the ambiguous --he abbreviation exactly", () => {
    const completed = runClassifier(["--he"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(
      `${classifierUsage}\nclassify-pr-size.ts: error: ambiguous option: --he could match --help, --head\n`,
    );
  });

  it.each(["--unknown", "--repos"])(
    "rejects unknown long-option abbreviation %s exactly",
    (option) => {
      const completed = runClassifier([
        option,
        `--base=${base}`,
        `--head=${base}`,
      ]);
      expect(completed.status).toBe(2);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe(
        `${classifierUsage}\nclassify-pr-size.ts: error: unrecognized arguments: ${option}\n`,
      );
    },
  );

  it.each([
    ["--repo", "-1"],
    ["--repo", "-.5"],
    ["--base", "-1"],
    ["--base", "-.5"],
    ["--head", "-1"],
    ["--head", "-.5"],
  ])(
    "accepts separated negative-number-shaped %s value %s",
    (option, value) => {
      const args = ["--repo", repo, `--base=${base}`, `--head=${base}`];
      const index = args.indexOf(option);
      if (index >= 0) args.splice(index, 2, option, value);
      else args.push(option, value);
      const completed = runClassifier(args);
      expect(completed.status).toBe(1);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe(
        option === "--repo"
          ? `fatal: cannot change to '${join(process.cwd(), value)}': No such file or directory\n`
          : "fatal: Needed a single revision\n",
      );
    },
  );

  it.each(["-0", "-01"])(
    "accepts signed integer boundary %s as a base value",
    (value) => {
      const completed = runClassifier([
        "--repo",
        repo,
        "--base",
        value,
        `--head=${base}`,
      ]);
      expect(completed.status).toBe(1);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe("fatal: Needed a single revision\n");
    },
  );

  it.each(["-1.", "--1", "-+1"])(
    "rejects near-miss negative token %s as a missing base value",
    (value) => {
      const completed = runClassifier(["--base", value]);
      expect(completed.status).toBe(2);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe(
        `${classifierUsage}\nclassify-pr-size.ts: error: argument --base: expected one argument\n`,
      );
    },
  );

  it.each([
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "uv.lock",
    "Cargo.lock",
  ])("excludes %s LOC but counts its file", async (lockfile) => {
    await writeFile(join(repo, "src.py"), lines(12));
    await writeFile(join(repo, lockfile), lines(2500, "generated"));
    const result = classify(repo, base, commit(repo, "add"));
    expect(result).toMatchObject({
      files_changed: 2,
      authored_additions: 12,
      authored_deletions: 0,
      net_loc: 12,
      zone: "green",
      generated_files: [lockfile],
    });
  });
  it("excludes linguist-generated paths", async () => {
    await writeFile(
      join(repo, ".gitattributes"),
      "generated/** linguist-generated=true\n",
    );
    await mkdir(join(repo, "generated"));
    await writeFile(
      join(repo, "generated/client.ts"),
      lines(2500, "generated"),
    );
    await writeFile(join(repo, "app.ts"), lines(600, "authored"));
    expect(classify(repo, base, commit(repo, "add"))).toMatchObject({
      files_changed: 3,
      authored_additions: 601,
      net_loc: 601,
      zone: "yellow",
      generated_files: ["generated/client.ts"],
    });
  });
  it("excludes generated deletions before net LOC", async () => {
    await writeFile(join(repo, "pnpm-lock.yaml"), lines(2500));
    await writeFile(join(repo, "app.py"), lines(610, "old"));
    const prior = commit(repo, "prior");
    await rm(join(repo, "pnpm-lock.yaml"));
    await writeFile(join(repo, "app.py"), lines(10, "new"));
    expect(classify(repo, prior, commit(repo, "shrink"))).toMatchObject({
      files_changed: 2,
      authored_additions: 10,
      authored_deletions: 610,
      net_loc: 600,
      zone: "yellow",
      generated_files: ["pnpm-lock.yaml"],
    });
  });
  it("resolves deleted generated attributes from the base revision", async () => {
    await writeFile(
      join(repo, ".gitattributes"),
      "generated/** linguist-generated=true\n",
    );
    await mkdir(join(repo, "generated"));
    await writeFile(join(repo, "generated/client.ts"), lines(2500));
    const prior = commit(repo, "prior");
    await rm(join(repo, "generated"), { recursive: true });
    await rm(join(repo, ".gitattributes"));
    expect(classify(repo, prior, commit(repo, "remove"))).toMatchObject({
      files_changed: 2,
      authored_deletions: 1,
      net_loc: 1,
      generated_files: ["generated/client.ts"],
    });
  });
  it("works without the retired check-attr --source option", async () => {
    await writeFile(
      join(repo, ".gitattributes"),
      "generated/** linguist-generated=true\n",
    );
    await mkdir(join(repo, "generated"));
    await writeFile(join(repo, "generated/client.ts"), lines(2500));
    const prior = commit(repo, "prior");
    await rm(join(repo, "generated"), { recursive: true });
    await rm(join(repo, ".gitattributes"));
    expect(classify(repo, prior, commit(repo, "remove"))).toMatchObject({
      authored_deletions: 1,
      net_loc: 1,
      generated_files: ["generated/client.ts"],
    });
  });
  it("keeps explicitly non-generated LOC", async () => {
    await writeFile(
      join(repo, ".gitattributes"),
      "authored/** linguist-generated=false\n",
    );
    await mkdir(join(repo, "authored"));
    await writeFile(join(repo, "authored/source.ts"), lines(501));
    expect(classify(repo, base, commit(repo, "add"))).toMatchObject({
      authored_additions: 502,
      net_loc: 502,
      zone: "yellow",
      generated_files: [],
    });
  });
  it("counts generated files toward the file-count zone", async () => {
    await writeFile(
      join(repo, ".gitattributes"),
      "generated/** linguist-generated=true\n",
    );
    await mkdir(join(repo, "generated"));
    for (let index = 0; index < 61; index++)
      await writeFile(
        join(repo, `generated/artifact-${index}.txt`),
        lines(100),
      );
    const result = classify(repo, base, commit(repo, "add"));
    expect(result).toMatchObject({
      files_changed: 62,
      net_loc: 1,
      zone: "black",
    });
    expect(result.generated_files).toHaveLength(61);
  });
  it("counts authored source LOC", async () => {
    await writeFile(join(repo, "app.py"), lines(2001));
    expect(classify(repo, base, commit(repo, "add"))).toMatchObject({
      files_changed: 1,
      net_loc: 2001,
      zone: "black",
      generated_files: [],
    });
  });
  it("ignores repository info attributes and diff configuration", async () => {
    await writeFile(join(repo, "app.py"), lines(2001));
    const head = commit(repo, "add");
    const expected = classify(repo, base, head);
    const gitDir = join(repo, git(repo, "rev-parse", "--git-dir"));
    await writeFile(join(gitDir, "info/attributes"), "* linguist-generated\n");
    git(repo, "config", "diff.algorithm", "histogram");
    git(repo, "config", "diff.renames", "false");
    expect(classify(repo, base, head)).toEqual(expected);
  });
  it("ignores global attributes, external diff, and default hash overrides", async () => {
    await writeFile(join(repo, "app.py"), lines(2001));
    const head = commit(repo, "add");
    const expected = classify(repo, base, head);
    const root = await mkdtemp(join(tmpdir(), "pr-size-hostile-"));
    try {
      const attributes = join(root, "attributes");
      const config = join(root, "gitconfig");
      const external = join(root, "diff");
      await writeFile(attributes, "* linguist-generated\n");
      await writeFile(config, `[core]\n\tattributesFile = ${attributes}\n`);
      await writeFile(external, "#!/bin/sh\nexit 91\n");
      await chmod(external, 0o755);
      expect(
        classify(repo, base, head, {
          GIT_CONFIG_GLOBAL: config,
          GIT_CONFIG_PARAMETERS: `'core.attributesFile'='${attributes}'`,
          GIT_DEFAULT_HASH: "sha256",
          GIT_EXTERNAL_DIFF: external,
        }),
      ).toEqual(expected);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("preserves a SHA-256 repository object format", async () => {
    await rm(repo, { recursive: true, force: true });
    repo = await mkdtemp(join(tmpdir(), "pr-size-sha256-"));
    const initialized = spawnSync(
      "git",
      [
        "init",
        "--quiet",
        "--initial-branch=main",
        "--object-format=sha256",
        repo,
      ],
      { encoding: "utf8" },
    );
    if (initialized.status !== 0) return;
    git(repo, "config", "user.email", "test@example.com");
    git(repo, "config", "user.name", "Test");
    await writeFile(join(repo, "README.md"), "base\n");
    base = commit(repo, "base");
    await writeFile(join(repo, "app.py"), lines(2001));
    const head = commit(repo, "add");
    expect(classify(repo, base, head)).toMatchObject({
      base_oid: base,
      head_oid: head,
      net_loc: 2001,
      zone: "black",
    });
  });
  it("classifies an initial commit against the empty tree", async () => {
    await rm(repo, { recursive: true, force: true });
    repo = await mkdtemp(join(tmpdir(), "pr-size-empty-"));
    git(repo, "init", "--quiet", "--initial-branch=main");
    git(repo, "config", "user.email", "test@example.com");
    git(repo, "config", "user.name", "Test");
    await writeFile(join(repo, "app.py"), lines(501));
    const head = commit(repo, "initial");
    const empty = spawnSync(
      "git",
      ["-C", repo, "hash-object", "-t", "tree", "/dev/null"],
      { encoding: "utf8" },
    ).stdout.trim();
    expect(classify(repo, empty, head)).toMatchObject({
      base_oid: empty,
      head_oid: head,
      files_changed: 1,
      authored_additions: 501,
      zone: "yellow",
    });
  });
  it("hydrates only required blobs in a promisor clone", async () => {
    const source = repo;
    git(source, "config", "uploadpack.allowFilter", "true");
    await writeFile(
      join(source, ".gitattributes"),
      "generated/** linguist-generated=true\n",
    );
    await mkdir(join(source, "generated"));
    await writeFile(join(source, "generated/client.ts"), lines(2500));
    await writeFile(join(source, "unrelated.txt"), "must remain lazy\n");
    const prior = commit(source, "generated");
    await rm(join(source, "generated"), { recursive: true });
    await rm(join(source, ".gitattributes"));
    const head = commit(source, "remove");
    const clone = `${source}-clone`;
    const cloned = spawnSync(
      "git",
      [
        "clone",
        "--quiet",
        "--filter=blob:none",
        "--no-checkout",
        `file://${source}`,
        clone,
      ],
      { encoding: "utf8" },
    );
    expect(cloned.status, cloned.stderr).toBe(0);
    try {
      const unrelated = git(source, "rev-parse", `${prior}:unrelated.txt`);
      expect(
        git(clone, "rev-list", "--objects", "--missing=print", prior).split(
          "\n",
        ),
      ).toContain(`?${unrelated}`);
      expect(classify(clone, prior, head)).toMatchObject({
        files_changed: 2,
        authored_deletions: 1,
        net_loc: 1,
        generated_files: ["generated/client.ts"],
      });
      expect(
        git(clone, "rev-list", "--objects", "--missing=print", prior).split(
          "\n",
        ),
      ).toContain(`?${unrelated}`);
    } finally {
      await rm(clone, { recursive: true, force: true });
    }
  });
  it("bounds rename detection while preserving one-file rename semantics", async () => {
    await writeFile(join(repo, "original.py"), lines(20));
    const prior = commit(repo, "source");
    await rename(join(repo, "original.py"), join(repo, "renamed.py"));
    const result = classify(repo, prior, commit(repo, "rename"));
    expect(result).toMatchObject({
      files_changed: 1,
      authored_additions: 20,
      authored_deletions: 20,
      net_loc: 0,
    });
  });
  it("stops similarity matching beyond 1000 candidates", async () => {
    for (let index = 0; index < 1001; index++)
      await writeFile(
        join(repo, `original-${String(index).padStart(4, "0")}.txt`),
        `shared\nidentity-${index}\n`,
      );
    const prior = commit(repo, "candidates");
    for (let index = 0; index < 1001; index++) {
      const target = join(
        repo,
        `renamed-${String(index).padStart(4, "0")}.txt`,
      );
      await rename(
        join(repo, `original-${String(index).padStart(4, "0")}.txt`),
        target,
      );
      await writeFile(target, `changed\nidentity-${index}\n`);
    }
    expect(classify(repo, prior, commit(repo, "beyond cap"))).toMatchObject({
      files_changed: 2002,
      zone: "black",
    });
  }, 30_000);
  it("keeps authoring, stacking, and review on the canonical classifier", async () => {
    const pr = fileURLToPath(new URL("..", import.meta.url));
    for (const name of [
      "create-update.md",
      "review-workflow.md",
      "stacked-prs.md",
    ]) {
      const content = await readFile(join(pr, "references", name), "utf8");
      expect(content.split("scripts/classify-pr-size.ts")).toHaveLength(2);
      expect(content).toContain("generated");
      expect(content).toContain("file count");
    }
    const coding = fileURLToPath(new URL("../../..", import.meta.url));
    const rules = (await readdir(join(coding, "standards/git/rules"))).filter(
      (name) => name.startsWith("GIT-PR-SIZE-") && name.endsWith(".md"),
    );
    const policy = await Promise.all(
      [
        "meta.md",
        "scan.md",
        "write.md",
        ...rules.map((name) => `rules/${name}`),
      ].map((name) => readFile(join(coding, "standards/git", name), "utf8")),
    );
    const normalized = policy.join("\n").replace(/\s+/g, " ").toLowerCase();
    expect(normalized).toContain("authored net loc");
    expect(normalized).toContain("exclude additions and deletions");
    expect(normalized).toContain("remain in the file count");
  });
});
