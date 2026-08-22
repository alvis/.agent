import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pr = dirname(fileURLToPath(import.meta.url));
const coding = join(pr, "../..");
const read = (path: string): string => readFileSync(path, "utf8");
const createUpdate = join(pr, "references/create-update.md");
const thresholdsPath = join(pr, "assets/size-thresholds.json");
const labelLister = join(pr, "scripts/list-repository-labels.sh");
const messageTemplate = join(pr, "templates/message.md");
const gitStandard = join(coding, "standards/git");
const classifier = join(pr, "scripts/classify-pr-size.ts");
const githubStacks = join(pr, "references/github-stacks.md");
const stackLister = join(pr, "scripts/list-github-stacks.sh");
const mergeReference = join(pr, "references/merge.md");
const mergeVcsSelector = join(pr, "scripts/select-merge-vcs.sh");

function temporary(): string {
  return mkdtempSync(join(tmpdir(), "pr-contract-stream-"));
}
function executable(path: string, content: string): void {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}
function bash(script: string, environment: NodeJS.ProcessEnv = {}) {
  return spawnSync("bash", ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}
function fencedAfter(document: string, heading: string): string {
  return document
    .split(heading, 2)[1]!
    .split("```bash\n", 2)[1]!
    .split("\n```", 1)[0]!;
}
function git(repo: string, ...args: string[]): string {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}
function classifierFixture(
  root: string,
  thresholds: unknown,
): { base: string; head: string; repo: string; script: string } {
  const repo = join(root, "repo"),
    scripts = join(root, "skill/scripts"),
    assets = join(root, "skill/assets");
  mkdirSync(repo);
  mkdirSync(scripts, { recursive: true });
  mkdirSync(assets);
  git(repo, "init", "--quiet", "--initial-branch=main");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "README.md"), "base\n");
  git(repo, "add", ".");
  git(repo, "commit", "--quiet", "--no-gpg-sign", "-m", "base");
  const base = git(repo, "rev-parse", "HEAD");
  writeFileSync(join(repo, "app.py"), "one\ntwo\n");
  git(repo, "add", ".");
  git(repo, "commit", "--quiet", "--no-gpg-sign", "-m", "head");
  const head = git(repo, "rev-parse", "HEAD");
  const script = join(scripts, "classify-pr-size.ts");
  copyFileSync(classifier, script);
  writeFileSync(
    join(assets, "size-thresholds.json"),
    JSON.stringify(thresholds),
  );
  return { base, head, repo, script };
}
function filesBelow(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(root, entry.name);
      return entry.isDirectory() ? filesBelow(path) : [path];
    })
    .sort();
}

describe("PR skill contract stream", () => {
  it("lists the complete repository label inventory deterministically", () => {
    const root = temporary();
    try {
      const bin = join(root, "bin"),
        log = join(root, "gh-args");
      mkdirSync(bin);
      executable(
        join(bin, "gh"),
        `#!/usr/bin/env bash\nprintf '%s\\n' "$@" >"$GH_CALL_LOG"\nprintf '%s\\n' '[[{"name":"zeta","description":"later"},{"name":"Alpha","description":"first","color":"ffffff"}],[{"name":"beta","description":"second"},{"name":"zeta","description":null}]]'\n`,
      );
      const result = spawnSync(
        "bash",
        [labelLister, "github example", "octo/widgets repository"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            GH_CALL_LOG: log,
          },
        },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual([
        { name: "Alpha", description: "first" },
        { name: "beta", description: "second" },
        { name: "zeta", description: null },
        { name: "zeta", description: "later" },
      ]);
      expect(read(log).trim().split("\n")).toEqual([
        "api",
        "--hostname",
        "github example",
        "--paginate",
        "--slurp",
        "repos/octo/widgets repository/labels?per_page=100",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("propagates repository label API errors", () => {
    const root = temporary();
    try {
      const bin = join(root, "bin");
      mkdirSync(bin);
      executable(
        join(bin, "gh"),
        "#!/usr/bin/env bash\nprintf 'label lookup failed\\n' >&2\nexit 42\n",
      );
      const result = spawnSync(
        "bash",
        [labelLister, "github.example", "octo/widgets"],
        {
          encoding: "utf8",
          env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
        },
      );
      expect(result.status).toBe(42);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("label lookup failed\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    [
      "When the head has no open PR",
      "",
      '["api,breaking", "docs"]',
      ["pr create", "pr view", "api --method"],
      { labels: ["api,breaking", "docs"] },
    ],
    [
      "When the head has one open PR",
      'PR="https://github.example/octo/widgets/pull/41"',
      '["api,breaking"]',
      ["pr edit", "pr ready", "pr view", "api --method"],
      { labels: ["api,breaking"] },
    ],
    ["When the head has no open PR", "", "[]", ["pr create"], null],
  ] as const)(
    "preserves exact selected label names for %s",
    (marker, setup, labels, commands, payload) => {
      const root = temporary();
      try {
        const document = read(createUpdate),
          preflight = fencedAfter(
            document,
            "#### Validate selected repository labels",
          ),
          operation = document
            .split(marker, 2)[1]!
            .split("```bash\n", 2)[1]!
            .split("\n```", 1)[0]!,
          attachment = fencedAfter(
            document,
            "#### Attach selected repository labels",
          );
        const bin = join(root, "bin"),
          commandLog = join(root, "commands"),
          apiLog = join(root, "api"),
          inputLog = join(root, "input");
        mkdirSync(bin);
        executable(
          join(bin, "gh"),
          `#!/usr/bin/env bash\nprintf '%s %s\\n' "$1" "\${2:-}" >>"$GH_COMMAND_LOG"\nif [ "$1 $2" = "pr create" ]; then [[ " $* " == *" --repo github.example/octo/widgets "* ]] || exit 1; printf '%s\\n' 'https://github.example/octo/widgets/pull/41'; elif [ "$1 $2" = "pr view" ]; then printf '41\\n'; elif [ "$1" = api ]; then printf '%s\\n' "$@" >"$GH_API_LOG"; cat >"$GH_INPUT_LOG"; fi\n`,
        );
        const result = bash(
          [
            "set -euo pipefail",
            "HOST=github.example",
            "REPOSITORY=octo/widgets",
            'TITLE="fix: preserve labels"',
            'BODY="body"',
            "PR_BASE=main",
            "BOOKMARK=fix/labels",
            "PUSH_OWNER=octo",
            `SELECTED_LABELS='${labels}'`,
            setup,
            preflight,
            operation,
            attachment,
          ].join("\n"),
          {
            PATH: `${bin}:${process.env.PATH}`,
            CODING_PR_SKILL_DIR: pr,
            GH_COMMAND_LOG: commandLog,
            GH_API_LOG: apiLog,
            GH_INPUT_LOG: inputLog,
            REPOSITORY_LABELS: '[{"name":"api,breaking"},{"name":"docs"}]',
          },
        );
        expect(result.status, result.stderr).toBe(0);
        expect(read(commandLog).trim().split("\n")).toEqual(commands);
        if (payload === null) {
          expect(existsSync(apiLog)).toBe(false);
          expect(existsSync(inputLog)).toBe(false);
        } else {
          expect(read(apiLog).trim().split("\n")).toEqual([
            "api",
            "--method",
            "POST",
            "--hostname",
            "github.example",
            "repos/octo/widgets/issues/41/labels",
            "--input",
            "-",
          ]);
          expect(JSON.parse(read(inputLog))).toEqual(payload);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it.each(["{", '{"name":"docs"}', '["docs", null]', '["unknown"]'])(
    "stops before mutation for invalid selected labels: %s",
    (labels) => {
      const root = temporary();
      try {
        const mutationLog = join(root, "mutations"),
          preflight = fencedAfter(
            read(createUpdate),
            "#### Validate selected repository labels",
          );
        const result = bash(
          [
            "set -euo pipefail",
            `git() { printf 'mutation\\n' >>"$MUTATION_LOG"; }`,
            `jj() { printf 'mutation\\n' >>"$MUTATION_LOG"; }`,
            `gh() { printf 'mutation\\n' >>"$MUTATION_LOG"; }`,
            preflight,
            "git push origin HEAD",
            "jj git push",
            "gh pr create",
            "gh pr edit 41",
            "gh api --method POST repos/octo/widgets/issues/41/labels",
          ].join("\n"),
          {
            MUTATION_LOG: mutationLog,
            REPOSITORY_LABELS: '[{"name":"docs"}]',
            SELECTED_LABELS: labels,
          },
        );
        expect(result.status).not.toBe(0);
        expect(existsSync(mutationLog)).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("names and conditionally emits the generated-files section", () => {
    const workflow = read(createUpdate),
      template = read(messageTemplate);
    expect(template).toContain("## 🏭 Generated Files [ Optional ]");
    expect(template).toContain("whenever any generated files exist");
    expect(workflow).toContain("`{{generated_files_body}}`");
  });

  it("keeps PR-size thresholds in one machine-readable home with matching presentations", () => {
    const thresholds = JSON.parse(read(thresholdsPath)) as {
      schema_version: number;
      metrics: Record<string, { unit: string; reason: string }>;
      zones: Array<Record<string, number | string>>;
    };
    expect(thresholds.schema_version).toBe(1);
    expect(new Set(Object.keys(thresholds.metrics))).toEqual(
      new Set(["files_changed", "authored_net_loc", "required_reviewers"]),
    );
    for (const metric of Object.values(thresholds.metrics)) {
      expect(metric.unit.length).toBeGreaterThan(0);
      expect(metric.reason.length).toBeGreaterThan(0);
    }
    const zones = thresholds.zones;
    expect(zones.map((zone) => zone.name)).toEqual(["green", "yellow", "red"]);
    for (const zone of zones)
      expect(new Set(Object.keys(zone))).toEqual(
        new Set([
          "name",
          "max_files_changed",
          "max_authored_net_loc",
          "required_reviewers",
        ]),
      );
    for (let index = 1; index < zones.length; index++) {
      expect(zones[index]!.max_files_changed as number).toBeGreaterThan(
        zones[index - 1]!.max_files_changed as number,
      );
      expect(zones[index]!.max_authored_net_loc as number).toBeGreaterThan(
        zones[index - 1]!.max_authored_net_loc as number,
      );
      expect(zones[index]!.required_reviewers as number).toBeGreaterThanOrEqual(
        zones[index - 1]!.required_reviewers as number,
      );
    }
    expect(zones.map((zone) => zone.required_reviewers)).toEqual([0, 1, 2]);
    const presentations = new Map([
      [join(gitStandard, "rules/GIT-PR-SIZE-01.md"), "green"],
      [join(gitStandard, "rules/GIT-PR-SIZE-02.md"), "yellow"],
      [join(gitStandard, "rules/GIT-PR-SIZE-03.md"), "red"],
      [join(gitStandard, "rules/GIT-PR-SIZE-04.md"), "black"],
    ]);
    const candidates = [
      ...readdirSync(join(gitStandard, "rules")).map((name) =>
        join(gitStandard, "rules", name),
      ),
      ...readdirSync(join(pr, "references")).map((name) =>
        join(pr, "references", name),
      ),
    ].filter((path) => path.endsWith(".md"));
    const discovered = candidates.filter((path) => {
      const content = read(path).toLowerCase();
      return (
        content.includes("files") &&
        content.includes("authored") &&
        zones.some((zone) =>
          content.includes(`${zone.max_files_changed} files`),
        ) &&
        zones.some((zone) =>
          content.includes(`${zone.max_authored_net_loc} authored`),
        )
      );
    });
    expect(new Set(discovered)).toEqual(new Set(presentations.keys()));
    for (const [path, name] of presentations) {
      const content = read(path).replaceAll(",", "").replaceAll("**", ""),
        limits = zones.find((zone) => zone.name === name) ?? zones.at(-1)!,
        operator = name === "black" ? ">" : "≤";
      if (content.includes("| Zone")) {
        const row = content
          .split("\n")
          .find((line) => line.toLowerCase().startsWith(`| ${name}`))!;
        expect(row).toContain(`${operator} ${limits.max_files_changed}`);
        expect(row).toContain(`${operator} ${limits.max_authored_net_loc}`);
      } else {
        expect(content).toContain(
          `${operator} ${limits.max_files_changed} files`,
        );
        expect(content).toContain(
          `${operator} ${limits.max_authored_net_loc} authored`,
        );
      }
    }
  });

  it("uses limits from the controlled threshold asset", () => {
    const root = temporary();
    try {
      const thresholds = JSON.parse(read(thresholdsPath));
      for (const [index, zone] of thresholds.zones.entries()) {
        zone.max_files_changed = index + 1;
        zone.max_authored_net_loc = index + 1;
      }
      const fixture = classifierFixture(root, thresholds),
        result = spawnSync(
          "bun",
          [
            "run",
            fixture.script,
            "--repo",
            fixture.repo,
            "--base",
            fixture.base,
            "--head",
            fixture.head,
          ],
          { encoding: "utf8" },
        );
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        files_changed: 1,
        net_loc: 2,
        zone: "yellow",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    [0, "max_files_changed", true],
    [0, "max_authored_net_loc", true],
    [0, "max_files_changed", 0],
    [0, "max_authored_net_loc", 0],
    [0, "max_files_changed", -1],
    [0, "max_authored_net_loc", -1],
    [0, "required_reviewers", true],
    [0, "required_reviewers", -1],
    [1, "max_files_changed", 15],
    [1, "max_authored_net_loc", 500],
    [1, "required_reviewers", -1],
  ] as const)(
    "rejects invalid threshold limit zone %i %s=%s",
    (zoneIndex, field, invalidValue) => {
      const root = temporary();
      try {
        const thresholds = JSON.parse(read(thresholdsPath));
        thresholds.zones[zoneIndex][field] = invalidValue;
        const fixture = classifierFixture(root, thresholds);
        const result = spawnSync(
          "bun",
          [
            "run",
            fixture.script,
            "--repo",
            fixture.repo,
            "--base",
            fixture.base,
            "--head",
            fixture.head,
          ],
          { encoding: "utf8" },
        );
        expect(result.status).not.toBe(0);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("enforces conditional evidence before emitting repo-local templates", () => {
    const gate = read(createUpdate)
      .split("<IMPORTANT>A repo-local template is emitted verbatim", 2)[1]!
      .split("When no repo-local template exists", 1)[0]!;
    for (const phrase of [
      "every predicate",
      "archetype-required, and diff-required",
      "never inserts category, label, title, or body metadata",
      "exact `## 🏭 Generated Files` heading",
      "generated path or",
      "its source or generator",
      "path-free summary is generic",
    ])
      expect(gate).toContain(phrase);
  });
  it("validates zone evidence before verbatim repo-template emission", () => {
    const workflow = read(createUpdate);
    for (const phrase of [
      "apply step 6's evidence",
      "predicates to the content",
      "A heading's presence alone never passes",
      "specific indivisibility prose",
    ])
      expect(workflow).toContain(phrase);
  });

  it("tracks the current upstream GitHub stack contract", () => {
    const text = read(githubStacks);
    for (const phrase of [
      "github.com/github/gh-stack/blob/main/skills/gh-stack/SKILL.md",
      "https://gh.io/stacks",
      "https://docs.jj-vcs.dev/latest/bookmarks/",
      "https://docs.jj-vcs.dev/latest/git-experts/",
      "`jj git push --help`",
    ])
      expect(text).toContain(phrase);
    expect(text.toLowerCase()).not.toContain("pinned");
    expect(text).not.toContain("14fc42ed9b6c376a53b2f999f138d3bd26dac546");
  });
  it("uses conditional history routes for GitHub stack updates", () => {
    const text = read(githubStacks),
      update = text
        .split("## Update and synchronize", 2)[1]!
        .split("## Restructure or remove grouping", 1)[0]!,
      jj = update
        .split("### jj-colocated repositories", 2)[1]!
        .split("### Plain Git repositories", 1)[0]!,
      plain = update.split("### Plain Git repositories", 2)[1]!;
    for (const phrase of [
      "`coding:commit`",
      "automatic",
      "affected-unmerged-bookmark batch",
    ])
      expect(jj).toContain(phrase);
    for (const command of [
      "gh stack rebase",
      "gh stack sync",
      "gh stack push",
      "gh stack submit",
    ])
      expect(jj).not.toContain(command);
    for (const command of ["gh stack rebase", "gh stack sync", "gh stack push"])
      expect(plain).toContain(command);
  });
  it("attempts GitHub stack actions before optional installation", () => {
    const text = read(githubStacks),
      attempt = text.indexOf(
        "Attempt the requested command or API call directly",
      ),
      missing = text.indexOf("reports that the extension is missing"),
      approval = text.indexOf("ask before running"),
      install = text.indexOf("gh extension install github/gh-stack");
    expect(attempt).toBeLessThan(missing);
    expect(missing).toBeLessThan(approval);
    expect(approval).toBeLessThan(install);
    expect(text).toContain("Never install implicitly");
    expect(text).toContain("Do not run `gh auth status`");
  });
  it("loads the GitHub stack contract for every stack request", () => {
    const router = read(join(pr, "SKILL.md"));
    for (const phrase of [
      "/coding:pr stack list",
      "/coding:pr stack checkout <stack-number-or-pr-number-or-pr-url-or-local-branch>",
      "references/github-stacks.md",
      "For every request to create, inspect, update, restructure, publish",
      "GitHub PR stack",
    ])
      expect(router).toContain(phrase);
  });
  it("nests list and checkout beneath the stack route", () => {
    const routing = read(join(pr, "SKILL.md")).split("## Routing", 2)[1]!,
      start = routing.indexOf("\n- `stack`"),
      route = routing.slice(start, routing.indexOf("\n- `merge`", start));
    expect(route).toContain("\n  - `list`");
    expect(route).toContain("\n  - `checkout");
    expect(routing).not.toContain("\n- `stack list`");
    expect(routing).not.toContain("\n- `stack checkout`");
  });
  it("exposes remote and merge-destination inputs in router usage", () => {
    const router = read(join(pr, "SKILL.md"));
    for (const phrase of [
      "/coding:pr create [<commit-ref>] [--branch-prefix <name>] [--remote <name>]",
      "/coding:pr update [<pr-number-or-url> | <commit-ref>] [--branch-prefix <name>] [--remote <name>]",
      "[--method=rebase|squash|merge] [--remote <name>] [--destination <branch>] [--force]",
    ])
      expect(router).toContain(phrase);
  });
  it("delegates GitHub listing from the generic stack contract", () => {
    const normalized = read(join(pr, "references/stacked-prs.md"))
      .split(/\s+/)
      .join(" ");
    for (const phrase of [
      "Load [github-stacks.md](github-stacks.md) for every GitHub PR-stack request",
      "including discovery",
      "sole owner of GitHub stack inventory behavior",
    ])
      expect(normalized).toContain(phrase);
    expect(normalized).not.toContain("paginated GitHub REST endpoint");
    expect(normalized).not.toContain("GET /repos/{owner}/{repo}/stacks");
  });
  it("uses only the paginated REST inventory for GitHub stack listing", () => {
    const text = read(githubStacks),
      lister = read(stackLister),
      section = text
        .split("## List and land", 2)[1]!
        .split("## Create, extend, and publish", 1)[0]!,
      normalized = section.split(/\s+/).join(" ");
    expect(text).not.toContain("gh stack list");
    for (const phrase of [
      "unconditionally inventory",
      "GET /repos/{owner}/{repo}/stacks",
      "fully merged and closed stacks",
      "Do not run `gh auth status`",
    ])
      expect(
        phrase === "unconditionally inventory" ? normalized : text,
      ).toContain(phrase);
    for (const phrase of [
      "gh api --paginate --slurp",
      '"repos/$REPOSITORY/stacks?per_page=100"',
      "number,",
      "url,",
      "base: .base.ref",
      "open,",
      "pullRequests: [.pull_requests[]",
      "headSha: .head.sha",
    ])
      expect(lister).toContain(phrase);
  });

  it("lands stacks in a jj workspace using REST metadata", () => {
    const text = read(githubStacks),
      resolution = read(join(pr, "references/resolve-reference.md")),
      landing = text
        .split("## List and land", 2)[1]!
        .split("## Create, extend, and publish", 1)[0]!,
      normalized = landing.split(/\s+/).join(" ").toLowerCase(),
      normalizedResolution = resolution.split(/\s+/).join(" ").toLowerCase();
    for (const phrase of [
      "only stack metadata this skill needs",
      "needs no terminal",
      "require the caller's stack number, pr number, pr url",
      "no gh-stack operator lands a stack for an agent",
      "rather than `gh stack view --json`",
    ])
      expect(normalized).toContain(phrase);
    expect(landing).toContain("resolve-reference.md#land-the-resolved-surface");
    for (const phrase of [
      'jj git fetch --remote "$REMOTE" || exit $?',
      '--revision "$HEAD_REF@$REMOTE" || exit $?',
    ])
      expect(resolution).toContain(phrase);
    for (const phrase of [
      "top member's head branch",
      "leaves every other workspace's uncommitted work untouched",
    ])
      expect(normalizedResolution).toContain(phrase);
  });
  it("never moves a source tree with Git or gh", () => {
    const paths = filesBelow(pr).filter(
      (path) =>
        path.endsWith(".md") ||
        path.endsWith(".sh") ||
        (path.endsWith(".ts") && !path.endsWith(".spec.ts")),
    );
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths)
      for (const command of [
        "gh stack checkout",
        "gh pr checkout",
        "git checkout",
        "git switch",
      ])
        expect(
          read(path),
          `${path.split("/").at(-1)} still moves a tree: ${command}`,
        ).not.toContain(command);
  });
  it("shares one clean-tree guard across tree-moving stack operators", () => {
    const text = read(githubStacks),
      action = text
        .split("## Run the requested action", 2)[1]!
        .split("## List and land", 1)[0]!,
      status = action.indexOf("git status --porcelain"),
      clean = action.indexOf('test -z "$WORKTREE_STATUS"', status),
      rejection = action.indexOf("refusing to move the source tree", clean);
    expect(status).toBeLessThan(clean);
    expect(clean).toBeLessThan(rejection);
    expect(action).toContain("so they move it");
    expect(action).toContain("The jj route needs no such guard");
    expect(text.split("git status --porcelain")).toHaveLength(2);
    for (const consumer of ["gh stack bottom", "`gh stack up [n]`, `down [n]`"])
      expect(
        text.lastIndexOf(
          "[Run the requested action](#run-the-requested-action)",
          text.indexOf(consumer),
        ),
      ).toBeLessThan(text.indexOf(consumer));
  });
  it("maps every supported GitHub stack operator", () => {
    const text = read(githubStacks);
    for (const command of [
      "gh stack init",
      "gh stack add",
      "gh stack link",
      "gh stack view --json",
      "gh stack rebase",
      "gh stack sync",
      "gh stack push",
      "gh stack submit",
      "gh stack modify",
      "gh stack unstack",
      "gh stack merge",
      "`gh stack up [n]`, `down [n]`, `top`, `bottom`, and `trunk`",
    ])
      expect(text).toContain(command);
  });
  it("matches current GitHub stack mutation semantics", () => {
    const text = read(githubStacks),
      normalized = text.split(/\s+/).join(" ");
    for (const phrase of [
      "It is non-atomic: a later branch push or PR update can fail",
      "pushes all active branches atomically",
      "`push` and `submit` are non-atomic",
      "merged, merging, or queued PRs",
      "PRs with auto-merge enabled",
      "leaves local tracking unchanged",
    ])
      expect(normalized).toContain(phrase);
    expect(text).toContain('gh stack merge "$STACK_OR_PR_NUMBER" --yes \\');
    expect(text).toContain('--merge-method "$MERGE_METHOD" || exit $?');
  });
  it("reports actual stack errors and verifies the owned scope", () => {
    const text = read(githubStacks),
      normalized = text.split(/\s+/).join(" ");
    for (const phrase of [
      "preserve stderr",
      "report the command and unchanged or partial state",
      "Do not trust exit status alone",
    ])
      expect(text).toContain(phrase);
    for (const phrase of [
      "operational failures, not preconditions",
      "After every locally tracked mutation",
      "use `gh stack view --json`",
      "For `link`, remote unstack, and regrouping",
      "paginated Stacks REST projection",
      "verify every PR with `gh pr view`",
      "`view --json` cannot verify state that has no local tracking",
      "separately use `gh pr view` to verify remote head",
    ])
      expect(normalized).toContain(phrase);
  });
  it("guards every dependency boundary in stack mutation snippets", () => {
    const text = read(githubStacks),
      normalized = text.split(/\s+/).join(" "),
      blocks = text
        .split("```bash\n")
        .slice(1)
        .map((part) => part.split("\n```", 1)[0]!);
    const sequential = blocks
      .map((block) => {
        const commands: string[] = [],
          parts: string[] = [];
        for (const line of block.split("\n")) {
          const stripped = line.trim();
          if (!stripped || stripped.startsWith("#")) continue;
          parts.push(
            stripped.endsWith("\\")
              ? stripped.slice(0, -1).trimEnd()
              : stripped,
          );
          if (!stripped.endsWith("\\")) {
            commands.push(parts.join(" "));
            parts.length = 0;
          }
        }
        return commands;
      })
      .filter(
        (commands) =>
          commands.length > 1 &&
          commands.some((command) => command.includes("gh stack ")),
      );
    expect(sequential.length).toBeGreaterThan(0);
    for (const commands of sequential)
      for (const command of commands)
        expect(command).toMatch(/\|\| exit \$\?$/);
    for (const phrase of [
      "Stop and verify the intended remote unstack",
      "through the paginated Stacks REST projection and `gh pr view`",
      "Only after that verification succeeds",
    ])
      expect(normalized).toContain(phrase);
  });
  it("stops stack snippets before consuming failed commands", () => {
    const text = read(githubStacks),
      discovery = read(stackLister),
      command = text.indexOf("gh stack rebase --upstack"),
      propagation = text.slice(
        text.lastIndexOf("```bash", command),
        text.indexOf("```", command),
      );
    for (const phrase of ["mktemp", "trap ", "rm "])
      expect(discovery).not.toContain(phrase);
    expect(discovery.split("\njq ")).toHaveLength(2);
    const repoCommand = discovery.indexOf("REPOSITORY=$(gh repo view"),
      repoGuard = discovery.indexOf(") || exit $?", repoCommand),
      apiCommand = discovery.indexOf("STACKS_JSON=$(gh api --paginate --slurp"),
      apiGuard = discovery.indexOf(") || exit $?", apiCommand),
      parsing = discovery.indexOf("jq '[.[][]"),
      parsingGuard = discovery.indexOf('<<<"$STACKS_JSON" || exit $?', parsing);
    expect(repoCommand).toBeLessThan(repoGuard);
    expect(repoGuard).toBeLessThan(apiCommand);
    expect(apiCommand).toBeLessThan(apiGuard);
    expect(apiGuard).toBeLessThan(parsing);
    expect(parsing).toBeLessThan(parsingGuard);
    const positions = [
      "gh stack bottom || exit $?",
      "gh stack rebase --upstack",
      "gh stack push --remote",
      "gh stack view --json || exit $?",
    ].map((phrase) => propagation.indexOf(phrase));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
  it("uses functional jj-colocation proof", () => {
    const normalized = read(githubStacks).split(/\s+/).join(" ");
    for (const phrase of [
      "`git rev-parse HEAD`",
      "`jj log -r @- --no-graph -T 'commit_id'`",
      "equals",
    ])
      expect(normalized).toContain(phrase);
    expect(normalized).not.toContain("presence of `.jj`");
  });
  it("leaves jj history mutation to coding:commit", () => {
    const route = read(githubStacks)
        .split("### jj-colocated repositories", 2)[1]!
        .split("### Plain Git repositories", 1)[0]!,
      normalized = route.split(/\s+/).join(" ");
    for (const phrase of [
      "`coding:commit`",
      "automatic descendant rebase",
      "bookmark movement",
    ])
      expect(normalized).toContain(phrase);
    for (const command of [
      "gh stack rebase",
      "gh stack sync",
      "gh stack push",
      "gh stack submit",
    ])
      expect(route).not.toContain(command);
  });

  it("publishes jj stacks with one explicit remote push", () => {
    const route = read(githubStacks)
      .split("### jj-colocated repositories", 2)[1]!
      .split("### Plain Git repositories", 1)[0]!;
    expect(route.split('jj git push --remote "$REMOTE"')).toHaveLength(2);
    expect(route.split("--bookmark").length - 1).toBeGreaterThanOrEqual(2);
    expect(route).toContain("--remote");
    expect(route).not.toContain("--all");
    expect(
      route
        .split("Publish all and only", 2)[1]!
        .split("`gh stack link`", 1)[0]!
        .toLowerCase(),
    ).not.toContain("atomic");
  });
  it("verifies every remote surface after jj stack publication", () => {
    const normalized = read(githubStacks)
      .split("### jj-colocated repositories", 2)[1]!
      .split("### Plain Git repositories", 1)[0]!
      .split(/\s+/)
      .join(" ");
    for (const phrase of [
      "every remote head",
      "every PR base",
      "grouping",
      "preserve stderr",
      "partial state",
    ])
      expect(normalized).toContain(phrase);
  });
  it("uses gh stack link only as an additive bridge for jj", () => {
    const normalized = read(githubStacks)
      .split("### jj-colocated repositories", 2)[1]!
      .split("### Plain Git repositories", 1)[0]!
      .split(/\s+/)
      .join(" ");
    for (const phrase of [
      "conditional",
      "additive",
      "no local tracking",
      "creation, grouping, base repair, or membership",
      "not routine history publication",
      "new stack requires at least two branch or PR selectors",
      "pass its stack number first",
      "at least one branch or PR selector",
      "never removes members",
    ])
      expect(normalized).toContain(phrase);
  });
  it("keeps native history operators on the plain-Git stack route", () => {
    const text = read(githubStacks),
      marker = "### Plain Git repositories",
      route = text.slice(text.indexOf(marker) + marker.length);
    for (const command of [
      "gh stack init",
      "gh stack add",
      "gh stack rebase",
      "gh stack push",
      "gh stack submit",
      "gh stack sync",
    ])
      expect(route).toContain(command);
  });
  it("publishes only remaining affected jj bookmarks once during merge", () => {
    const merge = read(mergeReference),
      helper = read(join(pr, "scripts/preflight-jj-range-push.sh")),
      normalized = merge.split(/\s+/).join(" ");
    expect(merge.split("scripts/preflight-jj-range-push.sh")).toHaveLength(2);
    expect(merge).toContain("scripts/test-jj-range-push.sh");
    expect(helper.split('git push --remote "$remote"')).toHaveLength(2);
    expect(merge.split('jj rebase -s "$child_root"')).toHaveLength(2);
    expect(merge).toContain(
      'jj rebase -s "$child_root" --onto <new-parent-ref>',
    );
    expect(merge).not.toContain('jj rebase -s "$child_root" -d');
    for (const phrase of [
      '--revision "$push_revset"',
      'push_revset="${first_commit}::${last_commit}"',
      "resolve_endpoint first",
      "resolve_endpoint last",
      "empty $position endpoint",
      "ambiguous $position endpoint",
      '"$first_commit & ::$last_commit"',
      "fail 'boundaries are not linear'",
      'actual_bookmarks" = "$expected_bookmarks',
      "fail 'unexpected bookmarks'",
      "fail 'selected tags'",
    ])
      expect(helper).toContain(phrase);
    expect(helper).not.toContain("--bookmark");
    expect(merge + helper).not.toContain("--all");
    expect(merge).not.toContain("jj bookmark set");
    expect(helper.split('--at-operation "$operation_id"')).toHaveLength(6);
    const bookmark = helper.indexOf("bookmark list"),
      tag = helper.indexOf("tag list"),
      push = helper.indexOf('git push --remote "$remote"');
    expect(bookmark).toBeLessThan(tag);
    expect(tag).toBeLessThan(push);
    for (const phrase of [
      "automatically rebases every descendant",
      "moves their bookmarks",
      "all and only remaining affected bookmarks",
    ])
      expect(normalized).toContain(phrase);
    expect(normalized.toLowerCase()).toContain("jj does not iterate links");
  });
  it("uses functional jj-colocation proof during merge", () => {
    const merge = read(mergeReference),
      selector = read(mergeVcsSelector);
    expect(merge + selector).not.toContain("jj root");
    for (const phrase of [
      "command -v jj",
      "git rev-parse HEAD",
      "jj log -r @- --no-graph -T 'commit_id'",
      '[ "$GIT_HEAD" = "$JJ_HEAD" ]',
      "git status --short",
      "git worktree list",
    ])
      expect(selector).toContain(phrase);
    expect(merge).toContain("fully supported Git route");
  });
  it("binds merge remote and destination before inspection", () => {
    const merge = read(mergeReference),
      selector = read(mergeVcsSelector),
      remote = merge.indexOf("create-update.md#bind-the-push-remote"),
      destination = merge.indexOf("DESTINATION=${CALLER_DESTINATION:-}"),
      inspection = merge.indexOf("scripts/select-merge-vcs.sh");
    expect(remote).toBeLessThan(inspection);
    expect(destination).toBeLessThan(inspection);
    expect(merge).toContain("sole owner of remote");
    expect(merge).not.toContain("GITHUB_REMOTES");
    expect(merge).not.toContain("git remote get-url");
    expect(selector).toContain('jj git fetch --remote "$REMOTE"');
    expect(merge).toContain('git fetch -- "$REMOTE"');
    for (const phrase of [
      "main@origin",
      "origin/main",
      "git fetch origin",
      "git push --force-with-lease origin",
    ])
      expect(merge).not.toContain(phrase);
  });
  it("preserves ownership of merge-induced stack topology", () => {
    const normalized = read(join(pr, "references/stacked-prs.md"))
      .split(/\s+/)
      .join(" ");
    for (const phrase of [
      "edit- and fix-induced rewrites",
      "Merge-induced descendant topology changes remain owned by",
      "`coding:pr merge`",
    ])
      expect(normalized).toContain(phrase);
  });
  it("resolves canonical review coordinates before API calls", () => {
    const workflow = read(join(pr, "references/review-workflow.md")),
      publishing = read(join(pr, "references/review-publishing.md")),
      loop = read(join(pr, "references/review-loop.md")),
      fetcher = read(join(pr, "scripts/fetch-review-loop-discussion.sh"));
    expect(workflow).toContain("scripts/resolve-pr.sh");
    expect(fetcher).toContain("scripts/resolve-pr.sh");
    for (const phrase of ["baseRefName,baseRefOid", "$PR_NUMBER"])
      expect(workflow).toContain(phrase);
    expect(publishing).toContain("$PR_NUMBER");
    expect(workflow).not.toContain("pulls/$PR/");
    expect(publishing).not.toContain("pulls/$PR/");
    for (const content of [workflow, publishing, loop]) {
      expect(content).not.toContain('gh api "repos/');
      expect(content).not.toContain("gh api graphql -F");
      expect(content).not.toContain("gh api --method");
    }
    expect(read(join(pr, "scripts/fetch-review-discussion.sh"))).toContain(
      '--hostname "$HOST"',
    );
    expect(publishing).toContain('--hostname "$HOST"');
    expect(fetcher).toContain('--hostname "$HOST"');
  });
  it("accepts a canonical enterprise PR URL", () => {
    const root = temporary();
    try {
      const bin = join(root, "bin");
      mkdirSync(bin);
      executable(
        join(bin, "gh"),
        '#!/usr/bin/env bash\nprintf "%s\\n" "$PR_METADATA"\n',
      );
      const metadata = {
          number: 42,
          url: "https://github.example.test/octo/repo/pull/42",
        },
        result = spawnSync(
          "bash",
          [join(pr, "scripts/resolve-pr.sh"), "42", "--repo", "octo/repo"],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              PATH: `${bin}:${process.env.PATH}`,
              PR_METADATA: JSON.stringify(metadata),
            },
          },
        );
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        host: "github.example.test",
        owner: "octo",
        repo: "repo",
        number: 42,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("fetches and verifies pinned review head and base objects", () => {
    const extraction = read(join(pr, "references/review-extraction.md")),
      workflow = read(join(pr, "references/review-workflow.md"));
    for (const phrase of [
      'fetch origin "pull/$PR_NUMBER/head"',
      'fetch origin "$BASE_OID"',
      'cat-file -e "$HEAD_OID^{commit}"',
      'cat-file -e "$BASE_OID^{commit}"',
      "if either object is unavailable",
    ])
      expect(extraction).toContain(phrase);
    expect(workflow.indexOf("load [review-extraction.md]")).toBeLessThan(
      workflow.indexOf("Search for a candidate"),
    );
    expect(workflow).toContain("before inspecting reuse candidates");
  });
  it("provisions distinct review ledger and payload paths", () => {
    const workflow = read(join(pr, "references/review-workflow.md")),
      publishing = read(join(pr, "references/review-publishing.md"));
    for (const phrase of [
      'REVIEW_LEDGER="$REVIEW_ARTIFACT_DIR/ledger.json"',
      'REVIEW_PAYLOAD="$REVIEW_ARTIFACT_DIR/payload.json"',
      '--input "$REVIEW_PAYLOAD"',
      "reviewer may write only those two files",
    ])
      expect(workflow).toContain(phrase);
    expect(publishing).toContain('--input "$REVIEW_PAYLOAD"');
  });
  it("reviews one stack tip and rechecks every PR surface", () => {
    const workflow = read(join(pr, "references/review-workflow.md")),
      loop = read(join(pr, "references/review-loop.md")),
      publishing = read(join(pr, "references/review-publishing.md"));
    for (const phrase of [
      "one clean `REVIEW_DIR` at the top head",
      "reviews the complete stack diff against the bottom base",
      "PR_SURFACES",
      "baseRefName",
      "baseRefOid",
      "for every `PR_SURFACES` entry",
    ])
      expect(workflow).toContain(phrase);
    for (const phrase of ["one holistic", "checkout or lease per PR"])
      expect(loop).toContain(phrase);
    expect(publishing).toContain("re-reads and compares those three");
  });
  it("follows the injected essential root for ADR references", () => {
    const plugins = dirname(coding),
      document = read(join(coding, "skills/document/SKILL.md")),
      doctor = read(join(plugins, "essential/skills/doctor/SKILL.md")),
      plan = read(join(plugins, "specification/skills/plan-code/SKILL.md"));
    for (const skill of [document, doctor, plan]) {
      expect(skill).toContain("${ESSENTIAL_ROOT}/references/adr.md");
      expect(skill).not.toContain("plugins/essential/references/adr.md");
    }
    expect(document).toContain(
      "${ESSENTIAL_ROOT}/templates/docs/adr.template.md",
    );
  });
  it("treats convergence dispatch as the dedicated reviewer", () => {
    const router = read(join(pr, "SKILL.md")),
      loop = read(join(pr, "references/review-loop.md")),
      workflow = read(join(pr, "references/review-workflow.md"));
    expect(router).toContain("preprovisioned stack capsule");
    for (const phrase of [
      "fresh critic",
      "do not invoke another",
      "router or delegate",
    ])
      expect(loop).toContain(phrase);
    for (const phrase of ["already the", "dedicated reviewer"])
      expect(workflow).toContain(phrase);
  });
  it("tracks unanchored findings until convergence", () => {
    const loop = read(join(pr, "references/review-loop.md")),
      workflow = read(join(pr, "references/review-workflow.md"));
    for (const phrase of [
      "findings with no inline anchor",
      "evidence OID",
      "still_applies`, `fixed`, or `does_not_apply",
    ])
      expect(loop).toContain(phrase);
    for (const phrase of ["null-anchor finding", "anchored or unanchored"])
      expect(workflow).toContain(phrase);
  });
  it("reads existing discussion after provisioning the review tree", () => {
    const workflow = read(join(pr, "references/review-workflow.md"));
    expect(
      workflow.indexOf("### Locate or create the review tree"),
    ).toBeLessThan(workflow.indexOf("### Read the existing discussion"));
    expect(workflow).toContain(
      "dedicated reviewer performs this phase after the parent has located or",
    );
    expect(workflow).toContain("created and verified `REVIEW_DIR`");
  });
  it("returns and cleans every stack ledger after batch review", () => {
    const loop = read(join(pr, "references/review-loop.md"));
    for (const phrase of [
      "distinct artifact",
      "directory for each stack",
      "stack-to-ledger-path map",
      "missing, duplicate, or cross-stack path",
      "same\nper-stack cleanup",
    ])
      expect(loop).toContain(phrase);
  });
  it("routes red CI to repair without spending a review retry", () => {
    const loop = read(join(pr, "references/review-loop.md")),
      authoring = read(createUpdate);
    for (const phrase of [
      "`action: repair_ci_then_review`",
      "retry count unchanged",
    ])
      expect(loop).toContain(phrase);
    for (const phrase of [
      "`action: repair_ci_then_review`",
      "Never retry a review against unchanged red-CI",
      "evidence.",
    ])
      expect(authoring).toContain(phrase);
  });
});
