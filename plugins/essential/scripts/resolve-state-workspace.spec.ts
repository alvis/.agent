import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, "../../..");
const resolver = resolve(here, "resolve-state-workspace");
const namingReference = resolve(here, "../references/naming.md");
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function temporary(name = "resolver"): string {
  const base = mkdtempSync(resolve(tmpdir(), `${name}-`));
  roots.push(base);
  return realpathSync(base);
}
function git(cwd: string, ...args: readonly string[]): string {
  const result = spawnSync("git", ["-c", "commit.gpgSign=false", ...args], {
    cwd,
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}
function initialize(root: string, ignored = true): void {
  mkdirSync(root);
  git(root, "init", "-q");
  git(root, "symbolic-ref", "HEAD", "refs/heads/main");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "Test");
  if (ignored) writeFileSync(resolve(root, ".gitignore"), ".state/\n");
}
function commitInitial(root: string): void {
  writeFileSync(resolve(root, "readme.md"), "test\n");
  git(
    root,
    "add",
    "readme.md",
    ...(existsSync(resolve(root, ".gitignore")) ? [".gitignore"] : []),
  );
  git(root, "commit", "-qm", "initial");
}
function run(
  path: string,
  options: {
    readonly workId?: string;
    readonly bootstrap?: boolean;
    readonly environmentWorkId?: string;
    readonly environment?: NodeJS.ProcessEnv;
    readonly equals?: boolean;
  } = {},
) {
  const args = options.equals
    ? [
        `--path=${path}`,
        ...(options.workId === undefined
          ? []
          : [`--work-id=${options.workId}`]),
      ]
    : [
        "--path",
        path,
        ...(options.workId === undefined ? [] : ["--work-id", options.workId]),
      ];
  if (options.bootstrap === true) args.push("--bootstrap");
  const environment = { ...process.env, ...options.environment };
  delete environment.STATE_WORK_ID;
  if (options.environmentWorkId !== undefined)
    environment.STATE_WORK_ID = options.environmentWorkId;
  const result = spawnSync("/bin/bash", [resolver, ...args], {
    encoding: "utf8",
    env: environment,
  });
  return {
    exitCode: result.status ?? 1,
    payload: JSON.parse(result.stdout) as Record<string, unknown>,
    stderr: result.stderr,
  };
}

describe("resolve-state-workspace", () => {
  it("suggests but does not invent branch work, then resolves an existing stream", () => {
    const base = temporary();
    const root = resolve(base, "main workspace");
    const linked = resolve(base, "linked workspace");
    initialize(root);
    commitInitial(root);
    git(root, "worktree", "add", "-q", "-b", "feat/refunds", linked);
    const missing = run(linked);
    expect(missing).toMatchObject({
      exitCode: 4,
      payload: {
        status: "work_id_required",
        vcs: "git",
        repo_root: linked,
        durable_root: linked,
        default_workspace: root,
        active_workspace: linked,
        state_root: root,
        workspace_label: "feat/refunds",
        suggested_work_id: "refunds",
        existing_work_ids: [],
      },
    });
    expect(missing.payload).not.toHaveProperty("work_dir");
    for (const id of ["refunds", "other-work"])
      mkdirSync(resolve(root, ".state/works", id), { recursive: true });
    expect(run(linked)).toMatchObject({
      exitCode: 0,
      payload: {
        work_id: "refunds",
        work_id_source: "git_branch",
        work_dir: resolve(root, ".state/works/refunds"),
      },
    });
  });

  it("accepts one-PR and two-digit stacked conventional branches only", () => {
    const root = resolve(temporary(), "stacked");
    initialize(root);
    commitInitial(root);
    for (const id of ["work-id-naming", "unrelated-work"])
      mkdirSync(resolve(root, ".state/works", id), { recursive: true });
    for (const branch of [
      "feat/work-id-naming",
      "feat/work-id-naming/01-resolver",
      "feat/work-id-naming/99-contract",
      "fix/work-id-naming",
    ]) {
      git(root, "checkout", "-q", "--orphan", branch);
      expect(run(root)).toMatchObject({
        exitCode: 0,
        payload: { work_id: "work-id-naming", work_id_source: "git_branch" },
      });
    }
    for (const branch of [
      "feat/work-id-naming-rewrite",
      "feat/work-id-naming/3-late",
      "feat/work-id-naming/00-prep",
      "feat/work-id-naming/123-late",
      "feature/work-id-naming",
      "work-id-naming",
      "feat/work_id_naming",
    ]) {
      git(root, "checkout", "-q", "--orphan", branch);
      expect(run(root), branch).toMatchObject({
        exitCode: 4,
        payload: { status: "work_id_required" },
      });
    }
  });

  it("treats length as convention but grammar and path limits as requirements", () => {
    const root = resolve(temporary(), "bounded");
    initialize(root);
    commitInitial(root);
    const legacy = `legacy-${"x".repeat(34)}`;
    mkdirSync(resolve(root, ".state/works", legacy), { recursive: true });
    expect(run(root, { workId: legacy })).toMatchObject({
      exitCode: 0,
      payload: { work_id: legacy },
    });
    git(root, "checkout", "-q", "-b", `feat/${legacy}`);
    expect(run(root)).toMatchObject({
      exitCode: 0,
      payload: { work_id: legacy, work_id_source: "git_branch" },
    });
    const minted = `brand-new-${"y".repeat(31)}`;
    expect(run(root, { workId: minted })).toMatchObject({
      exitCode: 0,
      payload: { work_id: minted },
    });
    expect(run(root, { workId: "foo--bar" })).toMatchObject({
      exitCode: 2,
      payload: { status: "invalid" },
    });
    expect(String(run(root, { workId: "foo--bar" }).payload.error)).toContain(
      "single-hyphen",
    );
    expect(run(root, { workId: "a".repeat(256) })).toMatchObject({
      exitCode: 2,
      payload: { status: "invalid" },
    });
  });

  it("reserves parked names without resolving them", () => {
    const root = resolve(temporary(), "parked");
    initialize(root);
    commitInitial(root);
    mkdirSync(resolve(root, ".state/archive/refunds"), { recursive: true });
    mkdirSync(resolve(root, ".state/works/unrelated-work"), {
      recursive: true,
    });
    expect(String(run(root, { workId: "refunds" }).payload.error)).toContain(
      "parked stream",
    );
    git(root, "checkout", "-q", "-b", "feat/refunds");
    expect(run(root)).toMatchObject({
      exitCode: 4,
      payload: { status: "work_id_required", suggested_work_id: null },
    });
  });

  it.each(["z".repeat(33), "foo--bar", "影師嗎"])(
    "does not suggest noncanonical label %s",
    (segment) => {
      const root = resolve(temporary(), "suggestion");
      initialize(root);
      commitInitial(root);
      mkdirSync(resolve(root, ".state/works/unrelated-work"), {
        recursive: true,
      });
      git(
        root,
        "checkout",
        "-q",
        "-b",
        segment === "影師嗎" ? segment : `feat/${segment}`,
      );
      expect(run(root)).toMatchObject({
        exitCode: 4,
        payload: { status: "work_id_required", suggested_work_id: null },
      });
    },
  );

  it("selects explicit then environment then sole existing work", () => {
    const root = resolve(temporary(), "selection");
    initialize(root);
    mkdirSync(resolve(root, ".state/works/existing"), { recursive: true });
    expect(
      run(root, { workId: "explicit", environmentWorkId: "environment" }),
    ).toMatchObject({
      exitCode: 0,
      payload: { work_id: "explicit", work_id_source: "argument" },
    });
    expect(run(root, { environmentWorkId: "environment" })).toMatchObject({
      exitCode: 0,
      payload: { work_id: "environment", work_id_source: "environment" },
    });
    expect(run(root)).toMatchObject({
      exitCode: 0,
      payload: { work_id: "existing", work_id_source: "sole_existing" },
    });
  });

  it("accepts spaced and equals options and documents both", () => {
    const root = resolve(temporary(), "options");
    initialize(root);
    expect(run(root, { workId: "eng-421-spaced" })).toMatchObject({
      exitCode: 0,
      payload: { work_id: "eng-421-spaced" },
    });
    expect(run(root, { workId: "eng-421-equals", equals: true })).toMatchObject(
      {
        exitCode: 0,
        payload: { work_id: "eng-421-equals", work_id_source: "argument" },
      },
    );
    const help = spawnSync("/bin/bash", [resolver, "--help"], {
      encoding: "utf8",
    });
    expect(help.status).toBe(0);
    expect(help.stderr).toContain("--work-id=<id>");
    expect(help.stderr).toContain("--path=<path>");
    expect(help.stderr).toContain("--bootstrap");
  });

  it("bootstraps only missing entrypoints with current vocabulary", () => {
    const root = resolve(temporary(), "bootstrap");
    initialize(root);
    const id = "eng-421-bootstrap";
    const resolved = run(root, { workId: id });
    const work = String(resolved.payload.work_dir);
    expect(resolved).toMatchObject({
      exitCode: 0,
      payload: { bootstrap_requested: false, bootstrap_created: [] },
    });
    expect(existsSync(work)).toBe(false);
    const created = run(root, { workId: id, bootstrap: true });
    const expected = [
      resolve(work, "goal.md"),
      resolve(work, "state/working.md"),
      resolve(work, "state.md"),
      resolve(work, "state/journal.md"),
    ];
    expect(created).toMatchObject({
      exitCode: 0,
      payload: {
        bootstrap_requested: true,
        bootstrap_created: expected,
        bootstrap_existing: [],
      },
    });
    const working = resolve(work, "state/working.md");
    writeFileSync(working, "# Preserved owner state\n");
    rmSync(resolve(work, "state.md"));
    expect(run(root, { workId: id, bootstrap: true })).toMatchObject({
      exitCode: 0,
      payload: {
        bootstrap_created: [resolve(work, "state.md")],
        bootstrap_existing: [
          resolve(work, "goal.md"),
          working,
          resolve(work, "state/journal.md"),
        ],
      },
    });
    expect(readFileSync(working, "utf8")).toBe("# Preserved owner state\n");
    const state = readFileSync(resolve(work, "state.md"), "utf8");
    const goal = readFileSync(resolve(work, "goal.md"), "utf8");
    expect(state).toContain("- Phase: `planned`\n");
    expect(state).not.toContain("Blocked on");
    expect(state).not.toContain("Motion");
    expect(state).not.toContain(" · ");
    expect(goal).toContain("- Charter: `absent`");
  });

  it("cannot bootstrap past identity or ignore gates", () => {
    const root = resolve(temporary(), "gates");
    initialize(root, false);
    expect(run(root, { bootstrap: true })).toMatchObject({
      exitCode: 4,
      payload: { status: "work_id_required" },
    });
    expect(existsSync(resolve(root, ".state"))).toBe(false);
    expect(
      run(root, { workId: "eng-421-gated", bootstrap: true }),
    ).toMatchObject({ exitCode: 3, payload: { status: "requires_ignore" } });
    expect(existsSync(resolve(root, ".state"))).toBe(false);
  });

  it("rejects symlinked work roots and entrypoints without external writes", () => {
    const root = resolve(temporary(), "symlink");
    const outside = resolve(temporary(), "outside");
    mkdirSync(outside);
    initialize(root);
    mkdirSync(resolve(root, ".state"));
    symlinkSync(outside, resolve(root, ".state/works"), "dir");
    const linked = run(root, { workId: "eng-421-symlink", bootstrap: true });
    expect(linked).toMatchObject({
      exitCode: 2,
      payload: { status: "invalid" },
    });
    expect(String(linked.payload.error)).toContain("must not be a symlink");
    expect(readdirSync(outside)).toEqual([]);

    rmSync(resolve(root, ".state/works"), { recursive: true });
    const work = resolve(root, ".state/works/eng-421-symlink");
    mkdirSync(work, { recursive: true });
    const victim = resolve(outside, "state.md");
    writeFileSync(victim, "unchanged\n");
    symlinkSync(victim, resolve(work, "state.md"));
    for (const result of [
      run(root),
      run(root, { workId: "eng-421-symlink", bootstrap: true }),
    ]) {
      expect(result).toMatchObject({
        exitCode: 2,
        payload: { status: "invalid" },
      });
      expect(String(result.payload.error)).toContain(
        "entrypoint must not be a symlink",
      );
    }
    expect(readFileSync(victim, "utf8")).toBe("unchanged\n");
  });

  it("reports ambiguity, collision inventory, grammar, and naming authority", () => {
    const root = resolve(temporary(), "ambiguity");
    initialize(root);
    commitInitial(root);
    for (const id of [
      "20260727-feat-refunds-v5cfxb",
      "20260721-fix-ingest-a54yx4",
    ])
      mkdirSync(resolve(root, ".state/works", id), { recursive: true });
    mkdirSync(resolve(root, ".state/archive/parked-work"), { recursive: true });
    const result = run(root);
    expect(result.exitCode).toBe(4);
    expect(result.payload.existing_work_ids).toEqual([
      "20260721-fix-ingest-a54yx4",
      "20260727-feat-refunds-v5cfxb",
      "parked-work",
    ]);
    expect(result.payload).not.toHaveProperty("candidate_work_ids");
    expect(String(result.payload.error)).toContain("collision");
    expect(String(result.payload.error)).toContain(
      "not examples of the format",
    );
    expect(String(result.payload.work_id_grammar)).toContain(
      "^[a-z0-9]+(-[a-z0-9]+)*$",
    );
    expect(result.payload.naming_reference).toBe(namingReference);
    expect(existsSync(namingReference)).toBe(true);
  });

  it("requires the default tree ignore and rejects later negation", () => {
    const root = resolve(temporary(), "ignore");
    initialize(root, false);
    let result = run(root, { workId: "eng-421-test" });
    expect(result).toMatchObject({
      exitCode: 3,
      payload: {
        status: "requires_ignore",
        ignore_file: resolve(root, ".gitignore"),
      },
    });
    writeFileSync(resolve(root, ".gitignore"), ".state/\n!.state/\n");
    expect(run(root, { workId: "eng-421-test" })).toMatchObject({
      exitCode: 3,
      payload: { status: "requires_ignore" },
    });
    writeFileSync(resolve(root, ".gitignore"), ".state/\n");
    result = run(root, { workId: "eng-421-test" });
    expect(result).toMatchObject({
      exitCode: 0,
      payload: { status: "resolved", state_ignored: true },
    });
  });

  it("uses the default Git worktree for state and active worktree for durable context", () => {
    const base = temporary();
    const root = resolve(base, "main");
    const linked = resolve(base, "linked");
    initialize(root);
    commitInitial(root);
    git(root, "worktree", "add", "-q", "-b", "linked", linked);
    const result = run(linked, { workId: "eng-421-test" });
    expect(result).toMatchObject({
      exitCode: 0,
      payload: {
        status: "resolved",
        state_ignored: true,
        state_root: root,
        active_workspace: linked,
        durable_root: linked,
        work_dir: resolve(root, ".state/works/eng-421-test"),
      },
    });
  });

  it("refuses invalid IDs, environment values, and non-repositories", () => {
    const outside = temporary();
    for (const id of ["UPPER", "bad/path", "-leading"])
      expect(run(outside, { workId: id })).toMatchObject({
        exitCode: 2,
        payload: { status: "invalid" },
      });
    expect(
      String(run(outside, { workId: "valid-id" }).payload.error),
    ).toContain("not inside");
    expect(
      String(run(outside, { environmentWorkId: "INVALID" }).payload.error),
    ).toContain("environment");
  });

  it("resolves a pure jj workspace using native workspace metadata", () => {
    const base = temporary();
    const primary = resolve(base, "jj default");
    const secondary = resolve(base, "jj secondary");
    const gitDirectory = resolve(base, "backing.git");
    const binaries = resolve(base, "bin");
    for (const path of [primary, secondary, binaries]) mkdirSync(path);
    git(base, "init", "--bare", "-q", gitDirectory);
    writeFileSync(resolve(primary, ".gitignore"), ".state/\n");
    mkdirSync(resolve(primary, ".state/works/secondary"), { recursive: true });
    const jj = resolve(binaries, "jj");
    writeFileSync(
      jj,
      `#!/bin/sh\n[ "$1" = --ignore-working-copy ] && shift\ncase "$1:$2" in\nroot:) printf '%s\\n' "$JJ_ACTIVE_ROOT" ;;\ngit:root) printf '%s\\n' "$JJ_GIT_DIR" ;;\nworkspace:list) printf 'default\\nsecondary\\n' ;;\nworkspace:root)\n  if [ "\${3:-}" = --name ] && [ "\${4:-}" = default ]; then printf '%s\\n' "$JJ_DEFAULT_ROOT"; else printf '%s\\n' "$JJ_ACTIVE_ROOT"; fi ;;\n*) exit 1 ;;\nesac\n`,
    );
    chmodSync(jj, 0o755);
    const result = run(secondary, {
      environment: {
        PATH: `${binaries}:${process.env.PATH}`,
        JJ_ACTIVE_ROOT: secondary,
        JJ_DEFAULT_ROOT: primary,
        JJ_GIT_DIR: gitDirectory,
      },
    });
    expect(result).toMatchObject({
      exitCode: 0,
      payload: {
        vcs: "jj",
        default_workspace: primary,
        active_workspace: secondary,
        state_root: primary,
        work_id: "secondary",
        work_id_source: "jj_workspace",
        work_dir: resolve(primary, ".state/works/secondary"),
      },
    });
  });

  it("keeps state transport and work state ignored by the repository contract", () => {
    const root = resolve(temporary(), "ignore-contract");
    mkdirSync(root);
    git(root, "init", "-q");
    writeFileSync(
      resolve(root, ".gitignore"),
      readFileSync(resolve(repository, ".gitignore")),
    );
    const paths = [".state/notion/example.mdc", ".state/works/test/state.md"];
    const result = spawnSync("git", ["check-ignore", "--no-index", ...paths], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim().split("\n")).toEqual(paths);
  });
});
