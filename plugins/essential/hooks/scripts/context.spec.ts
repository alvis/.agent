import { spawnSync } from "node:child_process";
import {
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contextScript = resolve(here, "context.sh");
const sessionStart = resolve(here, "session-start");
const subagentStart = resolve(here, "subagent-start");
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function temporary(): string {
  const root = mkdtempSync(resolve(tmpdir(), "context-hook-"));
  roots.push(root);
  return root;
}
function fixture(): string {
  const root = temporary();
  const init = spawnSync("git", ["init", "-q", root], { encoding: "utf8" });
  expect(init.status, init.stderr).toBe(0);
  const branch = spawnSync(
    "git",
    ["-C", root, "symbolic-ref", "HEAD", "refs/heads/main"],
    { encoding: "utf8" },
  );
  expect(branch.status, branch.stderr).toBe(0);
  writeFileSync(resolve(root, ".gitignore"), ".state/\n");
  for (const relative of [
    "README.md",
    "CONTEXT.md",
    "DESIGN.md",
    "PLAN.md",
    "NOTES.md",
    ".state/works/eng-42/state/working.md",
    ".state/works/eng-42/state.md",
    ".state/works/eng-42/decisions.md",
    ".state/works/eng-99/state/working.md",
    ".state/works/eng-99/state.md",
    "docs/README.md",
    "docs/architecture/README.md",
    "docs/architecture/runtime-boundaries.md",
    "docs/architecture/LEGACY.md",
    "docs/architecture/decisions/0001-runtime.md",
    "docs/design/README.md",
    "docs/design/system.md",
    "docs/design/checkout-flow.md",
    "docs/design/LEGACY.md",
    "docs/design/system/10-tokens.md",
    "docs/specs/README.md",
    "docs/specs/accounts/README.md",
    "docs/specs/accounts/session.md",
    "docs/specs/payments/README.md",
    "docs/specs/payments/error-contract.md",
    "docs/specs/payments/UPPER.md",
  ]) {
    const path = resolve(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "");
  }
  try {
    linkSync(resolve(root, "README.md"), resolve(root, "readme.md"));
  } catch {
    /* case-insensitive filesystem */
  }
  return root;
}
function hook(root: string, executable: string, input = ""): string {
  const environment = { ...process.env };
  delete environment.STATE_WORK_ID;
  const result = spawnSync(executable, [], {
    cwd: root,
    encoding: "utf8",
    input,
    env: environment,
  });
  expect(result.status, result.stderr).toBe(0);
  const payload = JSON.parse(result.stdout) as {
    hookSpecificOutput: { additionalContext: string };
  };
  return payload.hookSpecificOutput.additionalContext;
}
function repoContext(root: string, workId?: string): string {
  const environment = { ...process.env };
  if (workId === undefined) delete environment.STATE_WORK_ID;
  else environment.STATE_WORK_ID = workId;
  const result = spawnSync(
    "/bin/bash",
    [
      "-c",
      `source "$CONTEXT_SCRIPT"; get_repo_root_documents_context "$CONTEXT_ROOT"`,
    ],
    {
      encoding: "utf8",
      env: {
        ...environment,
        CONTEXT_SCRIPT: contextScript,
        CONTEXT_ROOT: root,
      },
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}
function assertOrdered(context: string, paths: readonly string[]): void {
  for (const path of paths) expect(context).toContain(path);
  for (let index = 1; index < paths.length; index += 1)
    expect(context.indexOf(paths[index - 1]!)).toBeLessThan(
      context.indexOf(paths[index]!),
    );
}

describe("Essential context discovery", () => {
  it("selects only canonical root documents and active work entrypoints", () => {
    const root = fixture();
    const output = repoContext(root, "eng-42");
    expect(output).not.toContain("\\n");
    assertOrdered(output, [
      "README.md",
      ".state/works/eng-42/state/working.md",
      ".state/works/eng-42/state.md",
      "docs/README.md",
      "docs/architecture/README.md",
      "docs/design/README.md",
      "docs/specs/README.md",
    ]);
    for (const absent of [
      ".state/works/eng-99/state/working.md",
      ".state/works/eng-99/state.md",
      "CONTEXT.md",
      "DESIGN.md",
      "PLAN.md",
      "NOTES.md",
      ".state/works/eng-42/decisions.md",
      "docs/architecture/LEGACY.md",
      "docs/architecture/runtime-boundaries.md",
      "docs/architecture/decisions/0001-runtime.md",
      "docs/design/LEGACY.md",
      "docs/design/system.md",
      "docs/design/checkout-flow.md",
      "docs/design/system/10-tokens.md",
      "docs/specs/accounts/README.md",
      "docs/specs/accounts/session.md",
      "docs/specs/payments/README.md",
      "docs/specs/payments/error-contract.md",
      "docs/specs/payments/UPPER.md",
    ])
      expect(output, absent).not.toContain(absent);
    expect(output.match(/^- readme\.md$/gim)).toHaveLength(1);
  });

  it("omits every work detail when active selection is ambiguous", () => {
    const output = repoContext(fixture());
    expect(output).not.toMatch(/\.state\/works\/(?:eng-42|eng-99)\/state/);
    expect(output).toContain(
      "State selection is unresolved; ask only when artifact work begins.",
    );
  });

  it("session start injects ordered state entrypoints while subagent start omits catalogs", () => {
    const root = fixture();
    rmSync(resolve(root, ".state/works/eng-99"), { recursive: true });
    const session = hook(root, sessionStart, '{"source":"startup"}\n');
    expect(session).not.toContain("\\n");
    expect(session).not.toContain("CONTEXT.md");
    assertOrdered(session, [
      ".state/works/eng-42/state/working.md",
      ".state/works/eng-42/state.md",
      "docs/README.md",
      "docs/architecture/README.md",
      "docs/design/README.md",
      "docs/specs/README.md",
    ]);
    const subagent = hook(root, subagentStart);
    expect(subagent).toContain("**Working directory**");
    expect(subagent).toContain("Standards:");
    expect(subagent).not.toContain("## Target Repo Documents");
    for (const path of [
      "README.md",
      ".state/works/eng-42/state/working.md",
      ".state/works/eng-42/state.md",
      "docs/README.md",
    ])
      expect(subagent).not.toContain(path);
  });

  it("discovers a pure jj root from a nested directory", () => {
    const base = temporary();
    const root = resolve(base, "pure jj");
    const nested = resolve(root, "nested/project");
    const binaries = resolve(base, "bin");
    mkdirSync(nested, { recursive: true });
    mkdirSync(binaries);
    const jj = resolve(binaries, "jj");
    writeFileSync(
      jj,
      '#!/bin/sh\n[ "$1" = --ignore-working-copy ] && shift\n[ "$1" = root ] || exit 1\nprintf \'%s\\n\' "$JJ_ACTIVE_ROOT"\n',
    );
    chmodSync(jj, 0o755);
    const result = spawnSync(
      "/bin/bash",
      ["-c", 'source "$CONTEXT_SCRIPT"; get_repo_root'],
      {
        cwd: nested,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binaries}:${process.env.PATH}`,
          JJ_ACTIVE_ROOT: root,
          CONTEXT_SCRIPT: contextScript,
        },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(root);
  });
});
