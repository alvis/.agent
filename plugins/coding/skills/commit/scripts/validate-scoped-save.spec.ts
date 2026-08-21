import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const validator = fileURLToPath(
  new URL("./validate_scoped_save.ts", import.meta.url),
);
const buildUsage =
  "usage: validate_scoped_save.ts build [-h] --repo REPO --work-root WORK_ROOT\n" +
  "                                     --base-rev BASE_REV --scope SCOPE";

type Json = Record<string, any>;
function sha(bytes: string | Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}
function canonicalJson(value: unknown): string {
  const ordered = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(ordered)
      : item !== null && typeof item === "object"
        ? Object.fromEntries(
            Object.entries(item)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([key, nested]) => [key, ordered(nested)]),
          )
        : item;
  return `${JSON.stringify(ordered(value))}\n`;
}
function cli(args: string[]) {
  return spawnSync("bun", ["run", validator, ...args], { encoding: "utf8" });
}

class Harness {
  readonly root = mkdtempSync(join(tmpdir(), "scoped-save-"));
  readonly repo: string;
  readonly workRoot: string;
  baseRev: string;

  constructor() {
    const repo = resolve(this.root, "target");
    mkdirSync(repo);
    this.repo = realpathSync(repo);
    this.git("init", "-q");
    this.git("config", "user.name", "Scoped Save Test");
    this.git("config", "user.email", "scoped-save@example.test");
    this.git("config", "commit.gpgsign", "false");
    this.git("config", "core.autocrlf", "false");
    this.git("config", "core.filemode", "true");
    const files: Record<string, string> = {
      ".gitignore": ".state/\n",
      "src.txt": "source base\n",
      "tests.txt": "test base\n",
      "docs/specs/capability/README.md": "spec base\n",
      "docs/specs/capability/provenance.json": "{}\n",
      "developer.txt": "developer base\n",
    };
    for (const [relative, content] of Object.entries(files)) {
      const path = join(this.repo, relative);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    }
    this.git("add", ".");
    this.git("commit", "-q", "-m", "chore: initialize target");
    this.baseRev = this.git("rev-parse", "HEAD").stdout.trim();
    this.workRoot = join(this.repo, ".state/works/scoped-save");
    mkdirSync(this.workRoot, { recursive: true });
  }

  close() {
    rmSync(this.root, { recursive: true, force: true });
  }
  git(...args: string[]) {
    const result = spawnSync("git", ["-C", this.repo, ...args], {
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    return result;
  }
  gitUnchecked(...args: string[]) {
    return spawnSync("git", ["-C", this.repo, ...args], { encoding: "utf8" });
  }
  helper(action: string, values: Record<string, string>, check = true) {
    const args = [
      action,
      ...Object.entries(values).flatMap(([key, value]) => [key, value]),
    ];
    const result = spawnSync("bun", ["run", validator, ...args], {
      encoding: "utf8",
    });
    const output = JSON.parse(result.stdout) as Json;
    if (check)
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    return { result, output };
  }
  scope(publication: [string, string][], selected: string[]) {
    const scope = join(this.workRoot, "artifacts/history/scope-request.json");
    mkdirSync(dirname(scope), { recursive: true });
    const receipt = join(this.workRoot, "artifacts/children/coding.json");
    mkdirSync(dirname(receipt), { recursive: true });
    const generated_files = publication.map(([path]) => {
      const absolute = join(this.repo, path);
      try {
        const stat = lstatSync(absolute);
        if (stat.isSymbolicLink())
          return {
            path,
            state: "symlink",
            sha256: sha(readlinkSync(absolute)),
            mode: "120000",
          };
        return {
          path,
          state: "file",
          sha256: sha(readFileSync(absolute)),
          mode: stat.mode & 0o111 ? "100755" : "100644",
        };
      } catch {
        return { path, state: "deleted", sha256: null, mode: null };
      }
    });
    writeFileSync(
      receipt,
      canonicalJson({
        schema: "state-generated-files/v1",
        producer: "coding:test-fixture",
        base_rev: this.baseRev,
        generated_files,
      }),
    );
    writeFileSync(
      scope,
      JSON.stringify({
        schema: "state-scoped-save-request/v1",
        work_id: "scoped-save",
        scope_complete: true,
        publication_paths: publication.map(([path, origin]) => ({
          path,
          origin,
        })),
        selected_paths: selected,
        generated_file_manifests: [
          ".state/works/scoped-save/artifacts/children/coding.json",
        ],
      }),
    );
    return scope;
  }
  build(scope: string) {
    return this.helper("build", {
      "--repo": this.repo,
      "--work-root": this.workRoot,
      "--base-rev": this.baseRev,
      "--scope": scope,
    }).output;
  }
  preflight(manifest: Json, check = true) {
    return this.helper(
      "preflight",
      {
        "--repo": this.repo,
        "--manifest": manifest.manifest_path,
        "--manifest-sha256": manifest.manifest_sha256,
      },
      check,
    );
  }
  commitSelected(preflight: Json, message: string) {
    this.git(
      "commit",
      "--only",
      `--pathspec-from-file=${preflight.literal_pathspec_file}`,
      "--pathspec-file-nul",
      "-m",
      message,
    );
    return this.git("rev-parse", "HEAD").stdout.trim();
  }
  verify(manifest: Json, preflight: Json, saved: string, check = true) {
    return this.helper(
      "verify",
      {
        "--repo": this.repo,
        "--manifest": manifest.manifest_path,
        "--manifest-sha256": manifest.manifest_sha256,
        "--snapshot": preflight.snapshot_path,
        "--snapshot-sha256": preflight.snapshot_sha256,
        "--saved-rev": saved,
      },
      check,
    );
  }
}

describe("scoped save validator", () => {
  let h: Harness;
  beforeEach(() => {
    h = new Harness();
  });
  afterEach(() => h.close());

  // This test alone drives the full build→preflight→save→verify chain of real
  // bun and git subprocesses. It is the one in this file observed exceeding the
  // default budget on hosted macOS, so the raise lives on this test alone and
  // genuine hangs elsewhere still fail fast.
  it("preserves unrelated index and worktree in a real path-limited save", () => {
    const selected = [
      "src.txt",
      "tests.txt",
      "docs/specs/capability/README.md",
      "docs/specs/capability/provenance.json",
    ];
    for (const path of selected)
      writeFileSync(
        join(h.repo, path),
        readFileSync(join(h.repo, path), "utf8") + "lifecycle edit\n",
      );
    chmodSync(join(h.repo, "src.txt"), 0o755);
    writeFileSync(join(h.repo, "developer.txt"), "developer staged\n");
    h.git("add", "developer.txt");
    const staged = h.git("show", ":developer.txt").stdout;
    writeFileSync(
      join(h.repo, "developer.txt"),
      "developer unstaged after staged\n",
    );
    const worktree = readFileSync(join(h.repo, "developer.txt"));
    const manifest = h.build(
      h.scope(
        selected.map((path) => [path, `child-manifest:${path}`]),
        selected,
      ),
    );
    const sealed = JSON.parse(readFileSync(manifest.manifest_path, "utf8"));
    expect(sealed.schema).toBe("state-scoped-save/v1");
    expect(
      new Set(sealed.publication_paths.map(({ path }: Json) => path)),
    ).toEqual(new Set(selected));
    expect(
      sealed.selected_paths.find(({ path }: Json) => path === "src.txt").mode,
    ).toBe("100755");
    expect(sealed.excluded_dirty_paths.map(({ path }: Json) => path)).toEqual([
      "developer.txt",
    ]);
    const preflight = h.preflight(manifest).output;
    expect(
      JSON.parse(readFileSync(preflight.snapshot_path, "utf8")).schema,
    ).toBe("state-scoped-save-preflight/v1");
    const saved = h.commitSelected(preflight, "feat: save lifecycle scope");
    expect(h.git("show", ":developer.txt").stdout).toBe(staged);
    expect(readFileSync(join(h.repo, "developer.txt"))).toEqual(worktree);
    const verified = h.verify(manifest, preflight, saved).output;
    expect(verified).toMatchObject({
      status: "pass",
      non_selected_preserved: true,
    });
    expect(JSON.parse(readFileSync(verified.receipt_path, "utf8")).schema).toBe(
      "state-scoped-save-result/v1",
    );
    expect(h.verify(manifest, preflight, saved).output.receipt_path).toBe(
      verified.receipt_path,
    );
  }, 30_000);

  it("records and saves both sides of an exact rename", () => {
    h.git("mv", "src.txt", "renamed-src.txt");
    const manifest = h.build(
      h.scope(
        [
          ["src.txt", "child-manifest:rename-source"],
          ["renamed-src.txt", "child-manifest:rename-destination"],
        ],
        ["src.txt", "renamed-src.txt"],
      ),
    );
    const entries = Object.fromEntries(
      JSON.parse(
        readFileSync(manifest.manifest_path, "utf8"),
      ).selected_paths.map((entry: Json) => [entry.path, entry]),
    );
    expect(entries["src.txt"]).toMatchObject({ state: "deleted" });
    expect(entries["src.txt"].status).toContain("role=source");
    expect(entries["renamed-src.txt"]).toMatchObject({ state: "file" });
    expect(entries["renamed-src.txt"].status).toContain("role=destination");
    const preflight = h.preflight(manifest).output;
    expect(
      h.verify(
        manifest,
        preflight,
        h.commitSelected(preflight, "refactor: rename source"),
      ).output.non_selected_preserved,
    ).toBe(true);
  });

  it("rejects selected bytes changed after sealing", () => {
    writeFileSync(join(h.repo, "src.txt"), "lifecycle edit\n");
    const manifest = h.build(
      h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]),
    );
    writeFileSync(join(h.repo, "src.txt"), "changed after review\n");
    const blocked = h.preflight(manifest, false);
    expect(blocked.result.status).toBe(2);
    expect(blocked.output).toMatchObject({ status: "blocked_scope" });
    expect(blocked.output.error).toContain("stale");
  });

  it.each([
    [
      "duplicate JSON keys",
      (raw: Buffer) =>
        Buffer.from(
          raw
            .toString()
            .replace('"base_rev":', '"base_rev":"duplicate","base_rev":'),
        ),
      "duplicate JSON key",
    ],
    [
      "unknown manifest fields",
      (raw: Buffer) => {
        const value = JSON.parse(raw.toString());
        value.unexpected = true;
        return Buffer.from(canonicalJson(value));
      },
      "unknown=['unexpected']",
    ],
  ])(
    "rejects %s even under a matching filename hash",
    (_name, mutate, error) => {
      writeFileSync(join(h.repo, "src.txt"), "lifecycle edit\n");
      const manifest = h.build(
        h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]),
      );
      const raw = mutate(readFileSync(manifest.manifest_path));
      const digest = sha(raw);
      const path = join(dirname(manifest.manifest_path), `${digest}.json`);
      writeFileSync(path, raw);
      const blocked = h.helper(
        "preflight",
        { "--repo": h.repo, "--manifest": path, "--manifest-sha256": digest },
        false,
      );
      expect(blocked.result.status).toBe(2);
      expect(blocked.output.error).toContain(error);
    },
  );

  it("rejects snapshot mutation", () => {
    writeFileSync(join(h.repo, "src.txt"), "lifecycle edit\n");
    const manifest = h.build(
      h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]),
    );
    const preflight = h.preflight(manifest).output;
    const saved = h.commitSelected(preflight, "feat: save source");
    chmodSync(preflight.snapshot_path, 0o644);
    writeFileSync(
      preflight.snapshot_path,
      Buffer.concat([readFileSync(preflight.snapshot_path), Buffer.from(" ")]),
    );
    const blocked = h.verify(manifest, preflight, saved, false);
    expect(blocked.result.status).toBe(2);
    expect(blocked.output.error).toContain("snapshot");
  });

  it("rejects an intervening plain Git commit", () => {
    writeFileSync(join(h.repo, "src.txt"), "lifecycle edit\n");
    const manifest = h.build(
      h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]),
    );
    const preflight = h.preflight(manifest).output;
    const saved = h.commitSelected(preflight, "feat: save source");
    writeFileSync(join(h.repo, "developer.txt"), "concurrent commit\n");
    h.git("add", "developer.txt");
    h.git("commit", "-m", "chore: concurrent developer commit");
    const blocked = h.verify(manifest, preflight, saved, false);
    expect(blocked.result.status).toBe(2);
    expect(blocked.output.error).toContain("current HEAD no longer equals");
  });

  it("rejects lexical traversal in every CLI artifact path before access", () => {
    writeFileSync(join(h.repo, "src.txt"), "lifecycle edit\n");
    const scope = h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]);
    const escaped = (path: string) =>
      `${dirname(path)}/nested/../${path.split("/").at(-1)}`;
    let blocked = h.helper(
      "build",
      {
        "--repo": h.repo,
        "--work-root": h.workRoot,
        "--base-rev": h.baseRev,
        "--scope": escaped(scope),
      },
      false,
    );
    expect(blocked.output.error).toContain(
      "--scope contains lexical traversal",
    );
    const manifest = h.build(scope);
    blocked = h.helper(
      "preflight",
      {
        "--repo": h.repo,
        "--manifest": escaped(manifest.manifest_path),
        "--manifest-sha256": manifest.manifest_sha256,
      },
      false,
    );
    expect(blocked.output.error).toContain(
      "--manifest contains lexical traversal",
    );
    const preflight = h.preflight(manifest).output;
    const saved = h.commitSelected(preflight, "feat: save source");
    blocked = h.helper(
      "verify",
      {
        "--repo": h.repo,
        "--manifest": manifest.manifest_path,
        "--manifest-sha256": manifest.manifest_sha256,
        "--snapshot": escaped(preflight.snapshot_path),
        "--snapshot-sha256": preflight.snapshot_sha256,
        "--saved-rev": saved,
      },
      false,
    );
    expect(blocked.output.error).toContain(
      "--snapshot contains lexical traversal",
    );
  });

  it("rejects traversal in generated artifact pointers", () => {
    writeFileSync(join(h.repo, "src.txt"), "lifecycle edit\n");
    const scope = h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]);
    const request = JSON.parse(readFileSync(scope, "utf8"));
    request.generated_file_manifests = [
      "artifacts/children/nested/../coding.json",
    ];
    writeFileSync(scope, JSON.stringify(request));
    const blocked = h.helper(
      "build",
      {
        "--repo": h.repo,
        "--work-root": h.workRoot,
        "--base-rev": h.baseRev,
        "--scope": scope,
      },
      false,
    );
    expect(blocked.result.status).toBe(2);
    expect(blocked.output.error).toContain("not lexically normalized");
  });

  it.each([
    ["--assume-unchanged", "--no-assume-unchanged"],
    ["--skip-worktree", "--no-skip-worktree"],
  ])("rejects ambiguous index flag %s", (flag, clearFlag) => {
    writeFileSync(
      join(h.repo, "src.txt"),
      `lifecycle edit hidden by ${flag}\n`,
    );
    h.git("update-index", flag, "src.txt");
    const scope = h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]);
    const blocked = h.helper(
      "build",
      {
        "--repo": h.repo,
        "--work-root": h.workRoot,
        "--base-rev": h.baseRev,
        "--scope": scope,
      },
      false,
    );
    expect(blocked.result.status).toBe(2);
    expect(blocked.output.error).toContain(
      "index flag makes scoped proof ambiguous",
    );
    h.git("update-index", clearFlag, "src.txt");
  });

  it("rejects mode changes hidden by core.filemode=false", () => {
    chmodSync(join(h.repo, "src.txt"), 0o755);
    h.git("config", "core.filemode", "false");
    const scope = h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]);
    const blocked = h.helper(
      "build",
      {
        "--repo": h.repo,
        "--work-root": h.workRoot,
        "--base-rev": h.baseRev,
        "--scope": scope,
      },
      false,
    );
    expect(blocked.result.status).toBe(2);
    expect(blocked.output.error).toContain("core.filemode=false");
    expect(blocked.output.error).toContain("preservation ambiguous");
  });

  it("rejects history changes after manifest sealing", () => {
    writeFileSync(join(h.repo, "src.txt"), "lifecycle edit\n");
    const manifest = h.build(
      h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]),
    );
    writeFileSync(join(h.repo, "developer.txt"), "history writer\n");
    h.git("add", "developer.txt");
    h.git("commit", "-q", "-m", "chore: concurrent history writer");
    const blocked = h.preflight(manifest, false);
    expect(blocked.result.status).toBe(2);
    expect(blocked.output.error).toContain(
      "HEAD changed after scoped manifest sealing",
    );
  });

  it("rejects producer receipt mutation after sealing", () => {
    writeFileSync(join(h.repo, "src.txt"), "lifecycle edit\n");
    const manifest = h.build(
      h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]),
    );
    const receiptPath = join(h.workRoot, "artifacts/children/coding.json");
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    receipt.producer = "coding:mutated-after-seal";
    writeFileSync(receiptPath, canonicalJson(receipt));
    const blocked = h.preflight(manifest, false);
    expect(blocked.result.status).toBe(2);
    expect(blocked.output.error).toContain("bindings changed after sealing");
  });

  it("rejects producer omission from publication scope", () => {
    for (const relative of ["src.txt", "tests.txt"])
      writeFileSync(join(h.repo, relative), "lifecycle edit\n");
    const scope = h.scope(
      [
        ["src.txt", "child-manifest:source"],
        ["tests.txt", "child-manifest:tests"],
      ],
      ["src.txt", "tests.txt"],
    );
    const receiptPath = join(h.workRoot, "artifacts/children/coding.json");
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    receipt.generated_files = receipt.generated_files.filter(
      ({ path }: Json) => path === "src.txt",
    );
    writeFileSync(receiptPath, canonicalJson(receipt));
    const blocked = h.helper(
      "build",
      {
        "--repo": h.repo,
        "--work-root": h.workRoot,
        "--base-rev": h.baseRev,
        "--scope": scope,
      },
      false,
    );
    expect(blocked.result.status).toBe(2);
    expect(blocked.output.error).toContain(
      "generated_files must equal publication scope exactly",
    );
    expect(blocked.output.error).toContain("tests.txt");
  });

  it("recovers the exact preflight head, index, worktree, and status", () => {
    writeFileSync(join(h.repo, "src.txt"), "lifecycle edit\n");
    writeFileSync(join(h.repo, "developer.txt"), "developer staged\n");
    h.git("add", "developer.txt");
    writeFileSync(join(h.repo, "developer.txt"), "developer unstaged\n");
    const manifest = h.build(
      h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]),
    );
    const preflight = h.preflight(manifest).output;
    let indexPath = h.git("rev-parse", "--git-path", "index").stdout.trim();
    if (!indexPath.startsWith("/")) indexPath = join(h.repo, indexPath);
    const indexBefore = readFileSync(indexPath);
    const statusBefore = h.git(
      "status",
      "--porcelain=v2",
      "-z",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ).stdout;
    const srcBefore = readFileSync(join(h.repo, "src.txt"));
    const developerBefore = readFileSync(join(h.repo, "developer.txt"));
    const oldHead = h.git("rev-parse", "HEAD").stdout.trim();
    h.git("commit", "-q", "-a", "-m", "feat: faulty save captures extra path");
    const saved = h.git("rev-parse", "HEAD").stdout.trim();
    const failed = h.verify(manifest, preflight, saved, false);
    expect(failed.result.status).toBe(2);
    expect(failed.output.error).toContain("dirty path set changed");
    const recovered = h.helper("recover", {
      "--repo": h.repo,
      "--manifest": manifest.manifest_path,
      "--manifest-sha256": manifest.manifest_sha256,
      "--snapshot": preflight.snapshot_path,
      "--snapshot-sha256": preflight.snapshot_sha256,
      "--failed-head": saved,
    }).output;
    expect(recovered.status).toBe("recovered");
    expect(
      JSON.parse(readFileSync(recovered.receipt_path, "utf8")).schema,
    ).toBe("state-scoped-save-recovery/v1");
    expect(h.git("rev-parse", "HEAD").stdout.trim()).toBe(oldHead);
    expect(readFileSync(indexPath)).toEqual(indexBefore);
    expect(readFileSync(join(h.repo, "src.txt"))).toEqual(srcBefore);
    expect(readFileSync(join(h.repo, "developer.txt"))).toEqual(
      developerBefore,
    );
    expect(
      h.git(
        "status",
        "--porcelain=v2",
        "-z",
        "--untracked-files=all",
        "--ignore-submodules=none",
      ).stdout,
    ).toBe(statusBefore);
  });

  it("blocks selected clean filters before history mutation", () => {
    h.git("config", "filter.upper.clean", "tr '[:lower:]' '[:upper:]'");
    h.git("config", "filter.upper.smudge", "cat");
    writeFileSync(join(h.repo, ".gitattributes"), "src.txt filter=upper\n");
    h.git("add", ".gitattributes");
    h.git("commit", "-q", "-m", "chore: configure clean filter");
    h.baseRev = h.git("rev-parse", "HEAD").stdout.trim();
    writeFileSync(join(h.repo, "src.txt"), "lifecycle edit\n");
    const manifest = h.build(
      h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]),
    );
    const head = h.git("rev-parse", "HEAD").stdout.trim();
    const blocked = h.preflight(manifest, false);
    expect(blocked.result.status).toBe(2);
    expect(blocked.output.error).toContain("Git clean transform");
    expect(h.git("rev-parse", "HEAD").stdout.trim()).toBe(head);
  });

  it.each(["-١", "-۱۲", "-.٥", "-०.५"])(
    "accepts Unicode decimal negative value %s before downstream validation",
    (value) => {
      const completed = cli([
        "build",
        "--repo",
        value,
        "--work-root=/missing",
        "--base-rev=HEAD",
        "--scope=/missing",
      ]);
      expect(completed.status).toBe(1);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toContain(
        `ENOENT: no such file or directory, lstat '${value}'`,
      );
      expect(completed.stderr).toContain(`path: "${value}"`);
      expect(completed.stderr).toContain("at repositoryIdentity (");
    },
  );

  it.each(["-1x", "-1."])(
    "rejects near-negative value %s as a missing option argument",
    (value) => {
      const completed = cli(["build", "--repo", value]);
      expect(completed.status).toBe(2);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe(
        `${buildUsage}\nvalidate_scoped_save.ts build: error: argument --repo: expected one argument\n`,
      );
    },
  );

  it("honors subcommand help before required-option validation", () => {
    const completed = cli(["build", "--repo", "/missing", "--help"]);
    expect(completed.status).toBe(0);
    expect(completed.stderr).toBe("");
    expect(completed.stdout).toContain(buildUsage);
    expect(completed.stdout).toContain("--scope SCOPE");
  });

  it("treats root -- as ending options before help", () => {
    const completed = cli(["--", "--help"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toContain(
      "argument command: invalid choice: '--help'",
    );
  });

  it("treats subcommand -- and later help as positional unknowns after missing requirements", () => {
    const completed = cli(["build", "--repo=/missing", "--", "--help"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toContain(
      "the following arguments are required: --work-root, --base-rev, --scope",
    );
  });

  it("rejects a symlink ancestor without writing through it", () => {
    writeFileSync(join(h.repo, "src.txt"), "lifecycle edit\n");
    const scope = h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]);
    const attacker = join(h.root, "attacker");
    mkdirSync(attacker);
    const history = join(h.workRoot, "artifacts/history");
    symlinkSync(attacker, join(history, "save-manifests"));
    const blocked = h.helper(
      "build",
      {
        "--repo": h.repo,
        "--work-root": h.workRoot,
        "--base-rev": h.baseRev,
        "--scope": scope,
      },
      false,
    );
    expect(blocked.result.status).toBe(2);
    expect(blocked.output.error).toContain(
      "cannot open safe artifacts directory component: save-manifests",
    );
    expect(readFileSync(scope, "utf8")).toContain(
      "state-scoped-save-request/v1",
    );
    expect(() => statSync(join(attacker, "redirected.json"))).toThrow();
  });

  it("should keep descriptor-relative immutable writes after an ancestor swap", () => {
    const trustedAncestor = join(h.root, "trusted-ancestor");
    const movedAncestor = join(h.root, "opened-ancestor");
    const attackerAncestor = join(h.root, "attacker-ancestor");
    const attackerArtifacts = join(attackerAncestor, "artifacts");
    const raw = Buffer.from('{"trusted":true}\n');
    mkdirSync(join(trustedAncestor, "artifacts"), { recursive: true });
    mkdirSync(attackerArtifacts, { recursive: true });
    const exercise = `
import { fstatSync, renameSync, statSync, symlinkSync } from "node:fs";
import { withSecureDirectory, writeOrVerifyImmutable, readImmutable } from ${JSON.stringify(pathToFileURL(validator).href)};

const root = ${JSON.stringify(h.root)};
const trustedAncestor = ${JSON.stringify(trustedAncestor)};
const movedAncestor = ${JSON.stringify(movedAncestor)};
const attackerAncestor = ${JSON.stringify(attackerAncestor)};
const raw = Buffer.from(${JSON.stringify(raw.toString("base64"))}, "base64");

const identities = withSecureDirectory(
  root,
  ["trusted-ancestor", "artifacts"],
  false,
  (directory) => {
    const openedDirectory = fstatSync(directory.descriptor);
    renameSync(trustedAncestor, movedAncestor);
    symlinkSync(attackerAncestor, trustedAncestor);
    writeOrVerifyImmutable(directory, "manifest.json", raw);
    writeOrVerifyImmutable(directory, "snapshot.json", raw);
    writeOrVerifyImmutable(directory, "pathspec", raw, 0o400);
    writeOrVerifyImmutable(directory, "index.backup", raw, 0o400);
    const readBack = [
      "manifest.json",
      "snapshot.json",
      "pathspec",
      "index.backup",
    ].map((name) => Buffer.from(readImmutable(directory, name)).toString("base64"));
    const retainedDirectory = statSync(movedAncestor + "/artifacts");
    return [
      openedDirectory.dev + ":" + openedDirectory.ino,
      retainedDirectory.dev + ":" + retainedDirectory.ino,
      ...readBack,
    ];
  },
);
process.stdout.write(identities.join("\\n"));
`;
    const destinations = [
      ["manifest.json", 0o444],
      ["snapshot.json", 0o444],
      ["pathspec", 0o400],
      ["index.backup", 0o400],
    ] as const;

    const exercised = spawnSync("bun", ["--eval", exercise], {
      encoding: "utf8",
    });

    const [openedIdentity, retainedIdentity, ...readBack] = exercised.stdout
      .trimEnd()
      .split("\n");
    expect(exercised.status, exercised.stderr).toBe(0);
    expect(retainedIdentity).toBe(openedIdentity);
    expect(readBack).toEqual(Array(4).fill(raw.toString("base64")));
    for (const [name, mode] of destinations) {
      const destination = join(movedAncestor, "artifacts", name);
      expect(readFileSync(destination)).toEqual(raw);
      expect(statSync(destination).mode & 0o777).toBe(mode);
      expect(() => statSync(join(attackerArtifacts, name))).toThrow();
    }
  });

  it("rejects an immutable symlink leaf without writing its target", () => {
    writeFileSync(join(h.repo, "src.txt"), "lifecycle edit\n");
    const scope = h.scope([["src.txt", "child-manifest:source"]], ["src.txt"]);
    const manifest = h.build(scope);
    const raw = readFileSync(manifest.manifest_path);
    const mode = statSync(manifest.manifest_path).mode & 0o777;
    const attacker = join(h.root, "attacker-leaf");
    unlinkSync(manifest.manifest_path);
    symlinkSync(attacker, manifest.manifest_path);
    const blocked = h.helper(
      "build",
      {
        "--repo": h.repo,
        "--work-root": h.workRoot,
        "--base-rev": h.baseRev,
        "--scope": scope,
      },
      false,
    );
    expect(blocked.result.status).toBe(2);
    expect(blocked.output.error).toContain("immutable artifacts collision");
    expect(() => statSync(attacker)).toThrow();
    expect(readFileSync(scope)).not.toEqual(raw);
    expect(mode).toBe(0o444);
  });
});
