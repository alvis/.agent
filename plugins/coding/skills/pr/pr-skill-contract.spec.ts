import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pr = dirname(fileURLToPath(import.meta.url));
const coding = join(pr, "../..");
const read = (path: string): string => readFileSync(path, "utf8");
const createUpdate = join(pr, "references/create-update.md");
const stackedPrs = join(pr, "references/stacked-prs.md");
const reviewWorkflow = join(pr, "references/review-workflow.md");
const mergeWorkflow = join(pr, "references/merge.md");
const messageTemplate = join(pr, "templates/message.md");
const overallReviewTemplate = join(pr, "templates/overall-review.md");
const gitStandard = join(coding, "standards/git");
const verifyCiParity = join(pr, "references/verify-ci-parity.md");
const partialToBranch = join(
  coding,
  "skills/commit/references/workflow-partial-to-branch.md",
);

function fencedBlockContaining(markdown: string, token: string): string {
  const matches = [...markdown.matchAll(/```(?:bash|text)\n([\s\S]*?)```/g)]
    .map((match) => match[1]!)
    .filter((block) => block.includes(token));
  if (matches.length > 0) {
    expect(matches).toHaveLength(1);
    return matches[0]!;
  }
  const scripts: Record<string, string> = {
    SELECTED_STACK_JSON: join(pr, "scripts/select-verification-target.sh"),
    CI_PARITY_WORKFLOW_DECISION: join(
      pr,
      "scripts/select-workflow-applicability.sh",
    ),
    CI_PARITY_SECRET_GATE: join(pr, "scripts/gate-missing-secrets.sh"),
    CI_PARITY_RECEIPT_GATE: join(
      coding,
      "scripts/validate-ci-parity-receipt.sh",
    ),
    'case "$REMOTE_TARGET_SHA"': join(
      coding,
      "skills/commit/scripts/classify-target-route.sh",
    ),
    "jj bookmark create <target>": join(
      coding,
      "skills/commit/scripts/move-target-bookmark.sh",
    ),
    "jj git push --bookmark <target>": join(
      coding,
      "skills/commit/scripts/push-target-bookmark.sh",
    ),
  };
  expect(scripts[token]).toBeDefined();
  const content = read(scripts[token]!);
  if (token === "jj bookmark create <target>")
    return content
      .replace("TARGET=$1", "TARGET=<target>")
      .replace("NEW_CHANGE_ID=$2", "NEW_CHANGE_ID=<new-change-id>");
  if (token === "jj git push --bookmark <target>")
    return content.replace("TARGET=$1", "TARGET=<target>");
  return content;
}

function runShell(
  block: string,
  environment: Record<string, string> = {},
): ReturnType<typeof spawnSync> {
  return spawnSync("bash", [], {
    input: block,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

function shellFields(
  completed: ReturnType<typeof spawnSync>,
): Record<string, string> {
  expect(completed.status, completed.stderr).toBe(0);
  return Object.fromEntries(
    completed.stdout
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split(/=(.*)/s, 2)),
  );
}

function assertTargetGatePrecedesPush(workflow: string): void {
  const lines = workflow.split("\n").map((line) => line.trim());
  const definitions = ["TARGET_SHA", "TARGET_BASE"].map((name) =>
    lines.flatMap((line, index) =>
      new RegExp(`^${name}=`).test(line) ? [index] : [],
    ),
  );
  const gates = lines.flatMap((line, index) =>
    line.startsWith("coding:pr verify ") ? [index] : [],
  );
  const pushes = lines.flatMap((line, index) =>
    line.startsWith("jj git push --bookmark") ||
    line.includes("push-target-bookmark.sh")
      ? [index]
      : [],
  );
  expect(gates).toHaveLength(1);
  expect(pushes.length).toBeGreaterThan(0);
  if (definitions[1]!.length === 0)
    definitions[1] = lines.flatMap((line, index) =>
      line.includes("classify-target-route.sh") ? [index] : [],
    );
  expect(
    definitions.every(
      (positions) => positions.length > 0 && Math.max(...positions) < gates[0]!,
    ),
  ).toBe(true);
  expect(gates[0]!).toBeLessThan(Math.min(...pushes));
  expect(lines[gates[0]!]).toMatch(/--target "\$TARGET_SHA"(?:\s|$)/);
  expect(lines[gates[0]!]).toMatch(/--base "\$TARGET_BASE"(?:\s|$)/);
}

const receiptConsumers = (): string[] => [
  createUpdate,
  partialToBranch,
  join(coding, "skills/commit/references/workflow-correct-merged.md"),
];
const receiptGates = (): string[] =>
  receiptConsumers().map((path) =>
    fencedBlockContaining(read(path), "CI_PARITY_RECEIPT_GATE"),
  );

function expectLinksWithin(path: string, root: string): void {
  for (const match of read(path).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1]!;
    if (target.includes("://") || target.startsWith("#")) continue;
    const resolved = join(dirname(path), target.split("#", 1)[0]!);
    expect(resolved.startsWith(root)).toBe(true);
    expect(existsSync(resolved)).toBe(true);
  }
}

describe("PR skill contract", () => {
  it("binds every deterministic authoring input and publication output", () => {
    const authoring = read(createUpdate);
    for (const phrase of [
      "`git hash-object -t tree /dev/null`",
      "head's `TITLE` and `BODY`",
      "base/empty-tree OID",
      "template, thresholds, and placeholder map",
      "`BREAKING CHANGE:` footers",
    ])
      expect(authoring).toContain(phrase);
  });

  it("keeps section-authoring guidance in the canonical message template", () => {
    const template = read(messageTemplate);
    for (const phrase of [
      "\n📌\n",
      "## 🎯 Goal",
      "## ✅ Requirements",
      "observable behavior",
      "generic gates",
      "what problem it solves and why",
      "design patterns",
      "anything a reader would reasonably expect here",
      "RFCs, specs, and discussions",
    ])
      expect(template).toContain(phrase);
    const headings = template
      .split("\n")
      .filter((line) => line.startsWith("## "));
    expect(
      headings.every((heading) => !/^[\x00-\x7f]$/.test(heading[3]!)),
    ).toBe(true);
    const required = new Set(
      headings.filter((heading) => !heading.endsWith("[ Optional ]")),
    );
    expect(required).toEqual(
      new Set([
        "## 🎯 Goal",
        "## ✅ Requirements",
        "## 🧵 Context",
        "## 🧪 Verification",
      ]),
    );
    expect(
      headings
        .filter((heading) => !required.has(heading))
        .every((heading) => heading.endsWith("[ Optional ]")),
    ).toBe(true);
  });

  it("separates version-control standards, directions, and templates", () => {
    const commit = read(join(coding, "skills/commit/SKILL.md"));
    const author = read(createUpdate),
      stack = read(stackedPrs),
      review = read(reviewWorkflow),
      merge = read(mergeWorkflow);
    const meta = read(join(gitStandard, "meta.md")),
      scan = read(join(gitStandard, "scan.md")),
      inline = read(join(pr, "templates/inline-review.md"));
    expect(existsSync(join(gitStandard, "write.md"))).toBe(true);
    expect(existsSync(join(gitStandard, "rules/GIT-PR-02.md"))).toBe(true);
    expect(existsSync(join(gitStandard, "rules/GIT-PR-SIZE-04.md"))).toBe(true);
    expect(existsSync(join(pr, "scripts/scan-pr-message.ts"))).toBe(true);
    expect(existsSync(join(pr, "templates/pr.md"))).toBe(false);
    expect(existsSync(join(coding, "directions/version-control.md"))).toBe(
      false,
    );
    expect(
      new Set(
        readdirSync(join(gitStandard, "rules")).filter((name) =>
          name.endsWith(".md"),
        ),
      ),
    ).toEqual(
      new Set([
        "GIT-PR-02.md",
        "GIT-PR-SIZE-01.md",
        "GIT-PR-SIZE-02.md",
        "GIT-PR-SIZE-03.md",
        "GIT-PR-SIZE-04.md",
        "GIT-PR-STACK-04.md",
        "GIT-PR-TYPE-02.md",
        "GIT-PR-TYPE-03.md",
        "GIT-PR-TYPE-04.md",
        "GIT-PR-TYPE-05.md",
      ]),
    );
    expect(commit).toContain("## Commit and branch directions");
    expect(author).toContain("## Pull-request directions");
    expect(stack).toContain("## Stack directions");
    expect(review).toContain("## Review directions");
    expect(merge).toContain("## Merge directions");
    const directions = [commit, author, stack, review, merge];
    for (const phrase of [
      "size-thresholds.json",
      "at most 15 files",
      "500 authored net LOC",
      "≤ 15 files",
      "≤ 30 files",
      "≤ 60 files",
      "> 60 files",
      "≤ 500 authored",
      "≤ 1200 authored",
      "≤ 2000 authored",
      "> 2000 authored",
    ])
      expect(directions.every((content) => !content.includes(phrase))).toBe(
        true,
      );
    expect(author).toContain("Run the classifier only after binding");
    expect(author).toContain(
      "After rendering and before emission or publication",
    );
    expect(meta).toContain("Each violation is an issue that");
    expect(scan).toContain("scan-pr-message.ts");
    expect(author).toContain("classify-pr-size.ts");
    expect(author).toContain("scan-pr-message.ts");
    expect(author).toContain("message.md");
    expect(review).toContain("inline-review.md");
    expect(inline).toContain("**{{marker}} {{title}}** — {{body}}");
    expect(inline).toContain("This file alone owns the posted markup");
  });

  it("reviews intent, standards, reuse, and minimality", () => {
    const workflow = read(reviewWorkflow),
      checklist = read(join(pr, "references/review-checklist.md")),
      template = read(overallReviewTemplate);
    expect(checklist).not.toContain("Does the PR message state the contract?");
    for (const phrase of [
      "Does it really work as intended?",
      "Does it follow every applicable standard?",
      "Can anything be removed without changing the result?",
      "code, content, tests, helpers, types, fixtures",
    ])
      expect(checklist).toContain(phrase);
    for (const standard of [
      "`universal/`",
      "`file-structure/`",
      "`testing/`",
      "`documentation/`",
    ])
      expect(workflow).toContain(standard);
    expect(template).toContain("### 🎯 Goal and Requirements");
    expect(template).not.toContain("{{pr_message_verdict}}");
    expect(template).toContain("{{intent_behavior_verdict}}");
    expect(template).toContain("{{reuse_verdict}}");
    expect(template).toContain("{{minimality_verdict}}");
    expect(template).not.toContain("PR message and intent");
    expect(workflow).not.toContain("scan-pr-message.py");
    expect(checklist).not.toContain("message scanner");
  });

  it("normalizes canonical commit-body headings during authoring", () => {
    const text = read(createUpdate);
    for (const phrase of [
      "strip its leading emoji token",
      "trailing `[ Optional ]` suffix",
      "canonical template headings and their plain aliases",
    ])
      expect(text).toContain(phrase);
  });

  it("uses section and zone emoji in the review template", () => {
    const template = read(overallReviewTemplate),
      rendered = template.split("```markdown", 2)[1]!.split("```", 1)[0]!;
    const headings = rendered
      .split("\n")
      .filter((line) => line.startsWith("### "));
    expect(rendered).toMatch(
      /^\n📌\n\n\{\{zone_emoji\}\} Reviewed `\{\{head_sha_short\}\}`/,
    );
    expect(
      headings.every((heading) => !/^[\x00-\x7f]$/.test(heading[4]!)),
    ).toBe(true);
    for (const zone of ["`🟢` green", "`🟡` yellow", "`🔴` red", "`⚫` black"])
      expect(template).toContain(zone);
  });

  it("authors new stacks against existing commit OIDs", () => {
    const text = read(createUpdate);
    for (const phrase of [
      "`AUTHOR_BASE_OID`",
      "change/commit OID",
      "New-stack bookmarks do not yet exist",
      '--base "$PR_BASE"',
    ])
      expect(text).toContain(phrase);
  });

  it("binds the batch root base after resolution and before both pushes", () => {
    const workflow = read(createUpdate),
      normalized = workflow.split(/\s+/).join(" ");
    const resolution = workflow.indexOf(
        "If the immediate predecessor is selected",
      ),
      binding = workflow.indexOf("ROOT_BASE=$PR_BASE_01");
    const restacks = [...workflow.matchAll(/scripts\/restack\.sh/g)].map(
      (match) => match.index,
    );
    expect(restacks).toHaveLength(2);
    expect(resolution).toBeLessThan(binding);
    expect(binding).toBeLessThan(restacks[0]!);
    expect(restacks[0]!).toBeLessThan(restacks[1]!);
    for (const phrase of [
      "first selected affected head's exact base",
      "For a suffix restack, `PR_BASE_01` is the unselected predecessor",
      "keep it unchanged for a retry only while",
      "discovery restart or base-map change recomputes it",
    ])
      expect(normalized).toContain(phrase);
  });

  it("binds reviewer evidence to the complete review surface", () => {
    const skill = read(createUpdate),
      template = read(messageTemplate),
      review = read(reviewWorkflow);
    for (const phrase of [
      "capture an existing PR's `headRefOid` and",
      "`baseRefOid`",
      "only where the head or base OID changed",
      '--head-oid "$HEAD_OID"',
      '--base-oid "$BASE_OID"',
      "--allow-pending-reviewers",
    ])
      expect(skill).toContain(phrase);
    for (const phrase of [
      "head/base OID pairs",
      "no-op publication preserves evidence",
      "unchanged pair",
      "standard-owned",
      "<base-oid>",
    ])
      expect(template).toContain(phrase);
    expect(review).toContain('--base "$BASE_OID" --head "$HEAD_OID"');
    expect(review).not.toContain("scan-pr-message.py");
  });

  it("preserves the PR-title regex and ready transition", () => {
    const workflow = read(createUpdate);
    expect(workflow).toContain(String.raw`(\([\w./-]+\))?!?: .+`);
    expect(workflow).not.toContain(String.raw`(?:,\s*[\w./-]+)?`);
    for (const phrase of [
      "Leave draft only after CI passes",
      "author self-reviews the diff",
      "every lower stack PR has merged or is",
    ])
      expect(workflow).toContain(phrase);
  });

  it("retains raw review-ledger fields for recovery", () => {
    const checklist = read(join(pr, "references/review-checklist.md")),
      publishing = read(join(pr, "references/review-publishing.md"));
    for (const phrase of [
      "title: <concise raw title",
      "body: <raw explanatory body",
      "authoritative raw finding",
    ])
      expect(checklist).toContain(phrase);
    expect(publishing).toContain("raw finding's `title` and `body`");
  });

  it("reports only changed previous verdicts during rereview", () => {
    const template = read(overallReviewTemplate),
      workflow = read(reviewWorkflow),
      publishing = read(join(pr, "references/review-publishing.md"));
    expect(template).toContain("### 🔄 Previous reports");
    expect(template).not.toContain("### ✅ Previous");
    for (const phrase of ["immediately preceding review", "Omit unchanged"])
      expect(template).toContain(phrase);
    for (const phrase of ["Compare the latest verdict", "review-to-review"])
      expect(workflow).toContain(phrase);
    for (const phrase of [
      "Omit the section when no prior issue changed verdict",
      "links the original report",
    ])
      expect(publishing).toContain(phrase);
  });

  it("assigns distinct owners to inline replies and thread resolution", () => {
    const workflow = read(reviewWorkflow),
      publishing = read(join(pr, "references/review-publishing.md")),
      loop = read(join(pr, "references/review-loop.md"));
    for (const phrase of [
      "must not resolve the thread",
      "reply to the comments whose",
      "fixes are now present. Do not resolve those threads",
    ])
      expect(loop).toContain(phrase);
    for (const phrase of [
      "If no reply records the published work",
      "if such a reply already exists, do not post another",
      "resolveReviewThread",
      "Never resolve a thread whose concern still applies",
    ])
      expect(workflow).toContain(phrase);
    for (const phrase of [
      "post a concise confirmation reply only if no",
      "never duplicate an existing implementation reply",
    ])
      expect(publishing).toContain(phrase);
  });

  it("preserves the retired standard contract in commit-message directions", () => {
    const directions = read(
      join(coding, "skills/commit/references/conventional-commits.md"),
    );
    for (const phrase of [
      "repository's commit policy explicitly permits it",
      "canonical regex permits one scope",
      "this is a hard limit",
      "never substitute `Fixes` or `Resolves`",
    ])
      expect(directions).toContain(phrase);
  });

  it("resolves bundled helpers for their complete resource lifetime", () => {
    const router = read(join(pr, "SKILL.md")),
      author = read(createUpdate),
      merge = read(mergeWorkflow),
      extraction = read(join(pr, "references/review-extraction.md")),
      review = read(reviewWorkflow);
    expect(router).toContain(
      "set `CODING_PR_SKILL_DIR` to the absolute directory",
    );
    const consumers = new Map<string, string[]>([
      ["scripts/preflight-jj-range-push.sh", [merge]],
      [
        "scripts/temp-tree.sh",
        [read(join(pr, "references/verify-ci-parity.md")), extraction, review],
      ],
      ["scripts/review-scan.sh", [review]],
      ["scripts/scan-pr-message.ts", [author]],
    ]);
    for (const [helper, documents] of consumers) {
      expect(existsSync(join(pr, helper))).toBe(true);
      expect(documents.every((document) => document.includes(helper))).toBe(
        true,
      );
    }
    expect(author).not.toContain("cleanup() {");
  });

  it("self-resolves review-scan and propagates helper failure", () => {
    const root = mkdtempSync(join(tmpdir(), "review-scan-contract-"));
    try {
      const plugin = join(root, "plugin"),
        helper = join(plugin, "skills/pr/scripts/review-scan.sh"),
        scripts = join(plugin, "scripts"),
        bin = join(root, "bin"),
        marker = join(root, "review-scan-argv"),
        elsewhere = join(root, "elsewhere");
      mkdirSync(dirname(helper), { recursive: true });
      cpSync(join(pr, "scripts/review-scan.sh"), helper);
      mkdirSync(scripts);
      mkdirSync(bin);
      mkdirSync(elsewhere);
      const bun = join(bin, "bun");
      writeFileSync(
        bun,
        '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$REVIEW_SCAN_MARKER"\nexit 99\n',
      );
      chmodSync(bun, 0o755);
      const scanner = join(scripts, "scan_potential_violations.ts");
      writeFileSync(scanner, "");
      const environment = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        REVIEW_SCAN_MARKER: marker,
      };
      delete environment.CLAUDE_PLUGIN_ROOT;
      delete environment.CLAUDE_SKILL_DIR;
      const completed = spawnSync(
        "bash",
        [helper, "--area=security", "target path.py"],
        { cwd: elsewhere, env: environment },
      );
      expect(completed.status).toBe(99);
      expect(read(marker).split(/\r?\n/).filter(Boolean)).toEqual([
        "run",
        scanner,
        "--area=security",
        "target path.py",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses the canonical verification section name during review", () => {
    const review = read(reviewWorkflow);
    for (const phrase of [
      "Every zone requires Summary",
      "`## 🎯 Goal`",
      "`## ✅ Requirements`",
      "`## 🧵 Context`",
      "`## 🧪 Verification`",
    ])
      expect(review).toContain(phrase);
    expect(review).not.toContain("Summary, Checklist");
  });

  it("keeps correct-merged monitoring read-only", () => {
    const workflow = read(
        join(coding, "skills/commit/references/workflow-correct-merged.md"),
      ),
      followups = workflow.split("## Mandatory follow-ups", 2)[1]!;
    expect(followups).toContain("read-only `gh pr checks`");
    expect(followups).not.toContain("`coding:pr update`");
  });

  it("binds owned-tree outputs while retaining cleanup in the parent", () => {
    const verify = read(join(pr, "references/verify-ci-parity.md")),
      extraction = read(join(pr, "references/review-extraction.md")),
      helper = read(join(pr, "scripts/temp-tree.sh"));
    const blocks = [...verify.matchAll(/```(?:bash|text)\n([\s\S]*?)```/g)]
      .map((match) => match[1]!)
      .filter((block) => block.includes("open-git"));
    expect(blocks).toHaveLength(1);
    const setup = blocks[0]!,
      treeJson = setup.indexOf("TREE_JSON="),
      lease = setup.indexOf("TREE_LEASE="),
      tree = setup.indexOf("TEST_WORKTREE="),
      revision = setup.indexOf('git -C "$TEST_WORKTREE" rev-parse HEAD');
    expect(treeJson).toBeLessThan(lease);
    expect(lease).toBeLessThan(tree);
    expect(tree).toBeLessThan(revision);
    expect(setup.match(/TREE_LEASE/g)).toHaveLength(1);
    expect(setup.match(/TEST_WORKTREE/g)).toHaveLength(2);
    expect(verify.indexOf(setup)).toBeLessThan(verify.indexOf("<report>"));
    const report = verify.split("<report>", 2)[1]!.split("</report>", 1)[0]!;
    expect(report).not.toMatch(/^\s*(?:cleanup|lease)\w*\s*:/im);
    expect(extraction).toContain(
      'open-clone "https://$HOST/$OWNER/$REPO" "$PR_NUMBER" "$HEAD_OID"',
    );
    expect(extraction).toContain("signal trap protects construction only");
    for (const phrase of [
      'workspace="pr-tree-$(basename "$lease")"',
      "workspace add --name",
      'workspace forget "$workspace"',
    ])
      expect(helper).toContain(phrase);
  });

  it("opens and closes a Git tree lease", () => {
    const root = mkdtempSync(join(tmpdir(), "git-tree-contract-"));
    try {
      const repo = join(root, "repo");
      expect(
        spawnSync("git", ["init", "--quiet", "--initial-branch=main", repo])
          .status,
      ).toBe(0);
      spawnSync("git", ["-C", repo, "config", "user.name", "Test"]);
      spawnSync("git", [
        "-C",
        repo,
        "config",
        "user.email",
        "test@example.com",
      ]);
      writeFileSync(join(repo, "tracked"), "one\n");
      spawnSync("git", ["-C", repo, "add", "tracked"]);
      expect(
        spawnSync("git", [
          "-C",
          repo,
          "commit",
          "--quiet",
          "--no-gpg-sign",
          "-m",
          "base",
        ]).status,
      ).toBe(0);
      const head = spawnSync("git", ["-C", repo, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).stdout.trim();
      const helper = join(pr, "scripts/temp-tree.sh"),
        opened = spawnSync("bash", [helper, "open-git", repo, head], {
          encoding: "utf8",
        });
      expect(opened.status, opened.stderr).toBe(0);
      const lease = JSON.parse(opened.stdout) as {
        lease: string;
        tree: string;
      };
      expect(existsSync(lease.tree)).toBe(true);
      expect(
        spawnSync("git", ["-C", lease.tree, "rev-parse", "HEAD"], {
          encoding: "utf8",
        }).stdout.trim(),
      ).toBe(head);
      expect(spawnSync("bash", [helper, "close", lease.lease]).status).toBe(0);
      expect(existsSync(lease.lease)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires an explicit restack root base and reports partial progress", () => {
    const workflow = read(createUpdate),
      helper = read(join(pr, "scripts/restack.sh"));
    for (const phrase of [
      '--base "$ROOT_BASE"',
      "for a suffix restack this is its unselected",
      "forge operations are not transactional",
    ])
      expect(workflow).toContain(phrase);
    for (const phrase of [
      "missing-base",
      "duplicate-bookmark",
      "multiple-open",
      "closed-head",
      "nonlinear",
      "vcs_is_ancestor",
      "previous_base=$root_base",
    ])
      expect(helper).toContain(phrase);
    expect(helper.indexOf("if ! state=$(gh pr list")).toBeLessThan(
      helper.indexOf('if [ "$state" != MERGED ]'),
    );
    const verified = '[ "$remote_sha" = "$expected_sha" ]',
      postVerify = helper.slice(helper.indexOf(verified) + verified.length);
    expect(postVerify.indexOf("restacked[")).toBeLessThan(
      postVerify.indexOf('gh pr edit "$bookmark"'),
    );
  });

  it.each([
    ["octo/widgets", "octo:fix/labels"],
    ["fork-owner/widgets", "fork-owner:fix/labels"],
  ])(
    "qualifies PR head with selected push owner for %s",
    (pushRepository, expectedHead) => {
      const root = mkdtempSync(join(tmpdir(), "pr-create-contract-"));
      try {
        const workflow = read(createUpdate),
          creation = workflow
            .split("When the head has no open PR", 2)[1]!
            .split("```bash\n", 2)[1]!
            .split("\n```", 1)[0]!,
          bin = join(root, "bin"),
          log = join(root, "arguments");
        mkdirSync(bin);
        const git = join(bin, "git"),
          gh = join(bin, "gh");
        writeFileSync(
          git,
          '#!/usr/bin/env bash\nif [ "$1 $2" = "branch --show-current" ]; then printf "fix/labels\\n"; elif [ "$1 $2 $3 $4 $5" = "remote get-url --push -- push" ]; then printf "https://github.example/push/widgets.git\\n"; else exit 1; fi\n',
        );
        writeFileSync(
          gh,
          '#!/usr/bin/env bash\nif [ "$#" -eq 7 ] && [ "$*" = "repo view https://github.example/push/widgets.git --json nameWithOwner --jq .nameWithOwner" ]; then printf "%s\\n" "$PUSH_REPOSITORY"; elif [ "$1 $2" = "pr create" ]; then printf "%s\\n" "$@" >"$ARGUMENT_LOG"; printf "https://github.example/octo/widgets/pull/41\\n"; else exit 1; fi\n',
        );
        chmodSync(git, 0o755);
        chmodSync(gh, 0o755);
        const script = `set -euo pipefail\nCALLER_REMOTE=push\nHOST=github.example\nREPOSITORY=octo/widgets\nTITLE="fix: preserve labels"\nBODY="body"\nPR_BASE=main\nBOOKMARK=fix/labels\nCODING_PR_SKILL_DIR="${pr}"\nsource "$CODING_PR_SKILL_DIR/scripts/resolve-push-remote.sh"\n${creation}`;
        const completed = spawnSync("bash", ["-c", script], {
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            ARGUMENT_LOG: log,
            PUSH_REPOSITORY: pushRepository,
          },
          encoding: "utf8",
        });
        expect(completed.status, completed.stderr).toBe(0);
        const args = read(log).trim().split(/\r?\n/);
        expect(args[args.indexOf("--head") + 1]).toBe(expectedHead);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("binds the remote before publication and reuses it", () => {
    const workflow = read(createUpdate),
      resolver = read(join(pr, "scripts/resolve-push-remote.sh")),
      normalized = workflow.split(/\s+/).join(" ");
    expect(workflow.indexOf("scripts/resolve-push-remote.sh")).toBeLessThan(
      workflow.indexOf("scripts/restack.sh"),
    );
    for (const phrase of [
      "REMOTE=${CALLER_REMOTE:-}",
      'git remote get-url --push -- "$REMOTE"',
      'git remote get-url --push -- "$CANDIDATE"',
    ])
      expect(resolver).toContain(phrase);
    expect(normalized).toContain(
      "sole remote whose push URL resolves through GitHub",
    );
    for (const phrase of [
      "Record `REMOTE`",
      'jj git fetch --remote "$REMOTE"',
      'git fetch -- "$REMOTE"',
    ])
      expect(workflow).toContain(phrase);
  });

  it("has no implicit origin in stack publication or inspection", () => {
    const author = read(createUpdate),
      stacked = read(stackedPrs);
    for (const reference of [author, stacked])
      for (const phrase of ["main@origin", "@origin", "origin/"])
        expect(reference).not.toContain(phrase);
    for (const phrase of [
      "selected `ROOT_BASE`/`DESTINATION`",
      "at authoritative `$REMOTE`",
    ])
      expect(author).toContain(phrase);
    for (const phrase of [
      "create-update.md#bind-the-push-remote",
      '"$REMOTE"/<destination>',
      "<parent>@$REMOTE",
    ])
      expect(stacked).toContain(phrase);
  });

  it("does not dispatch PR mutations from partial-to-branch", () => {
    const workflow = read(partialToBranch),
      normalized = workflow.split(/\s+/).join(" ");
    const dispatches = [
      ...workflow.matchAll(
        /(?<!do not )\b(?:invoke|run|execute|call|dispatch|hand off to)\s+`?\/?(coding:pr (?:create|update))\b/gi,
      ),
    ].map((match) => match[1]);
    expect(dispatches).toEqual([]);
    for (const phrase of [
      "return the exact synchronized `<target>` bookmark",
      "Do not mutate a PR or dispatch another action",
      "caller must separately authorize the matching",
      "`coding:pr create` or `coding:pr update` action",
    ])
      expect(normalized).toContain(phrase);
  });

  it("gives the reviewer the pinned mission capsule", () => {
    const review = read(reviewWorkflow);
    expect(review).not.toContain("bounded mission capsule");
    for (const phrase of [
      "`PR_SURFACES` array",
      "one clean `REVIEW_DIR` at the top head",
      "reviews the complete stack diff against the bottom base",
      "holistically",
      "one holistic map",
      "A stack never receives a second lease",
    ])
      expect(review).toContain(phrase);
  });

  it("selects a CI-parity target spanning the selected surface", () => {
    const selector = fencedBlockContaining(
      read(createUpdate),
      "SELECTED_STACK_JSON",
    );
    expect(
      shellFields(
        runShell(selector, {
          SELECTED_STACK_JSON: JSON.stringify([
            { head: "standalone-head", base: "standalone-base" },
          ]),
        }),
      ),
    ).toEqual({
      TARGET_KIND: "standalone",
      TARGET_SHA: "standalone-head",
      TARGET_BASE: "standalone-base",
    });
    expect(
      shellFields(
        runShell(selector, {
          SELECTED_STACK_JSON: JSON.stringify([
            { head: "bottom-head", base: "stack-root-base" },
            { head: "middle-head", base: "bottom-head" },
            { head: "stack-tip", base: "middle-head" },
          ]),
        }),
      ),
    ).toEqual({
      TARGET_KIND: "stack-tip",
      TARGET_SHA: "stack-tip",
      TARGET_BASE: "stack-root-base",
    });
  });

  it("requires jj run with an exact resolved CI-parity target", () => {
    const selector = fencedBlockContaining(
        read(verifyCiParity),
        "CI_PARITY_EXECUTION_ENGINE",
      ),
      target = "a".repeat(40),
      root = mkdtempSync(join(tmpdir(), "jj-target-contract-"));
    try {
      const missing = runShell(selector, {
        PATH: "/bin:/usr/bin",
        SOURCE_REPO_ROOT: "/repo",
        TARGET_SHA: target,
      });
      expect(missing.status).toBe(42);
      expect(missing.stdout).toBe("");
      const jj = join(root, "jj");
      writeFileSync(jj, "#!/bin/sh\nprintf '%s' 'not-the-target'\n");
      chmodSync(jj, 0o755);
      const mismatch = runShell(selector, {
        PATH: `${root}:/bin:/usr/bin`,
        SOURCE_REPO_ROOT: "/repo",
        TARGET_SHA: target,
      });
      expect(mismatch.status).toBe(42);
      expect(mismatch.stdout).toBe("");
      writeFileSync(jj, `#!/bin/sh\nprintf '%s' '${target}'\n`);
      expect(
        shellFields(
          runShell(selector, {
            PATH: `${root}:/bin:/usr/bin`,
            SOURCE_REPO_ROOT: "/repo",
            TARGET_SHA: target,
          }),
        ),
      ).toEqual({ CI_PARITY_EXECUTION_ENGINE: "jj-run" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps the jj CI-parity runner clean, read-only, and revision-bound", () => {
    const contract = read(verifyCiParity),
      runner = fencedBlockContaining(contract, "CI_TASK_SCRIPT");
    for (const phrase of [
      'jj --repository "$SOURCE_REPO_ROOT" --ignore-working-copy run',
      '--clean --ignore-changes --root -r "$TARGET_SHA"',
      "CI_SHELL_TEMPLATE",
      "'{0}'",
    ])
      expect(runner).toContain(phrase);
    expect(runner).not.toContain('"$CI_SHELL" -c "$CI_TASK_SCRIPT"');
    expect(runner).not.toContain("--ignore-errors");
    expect(contract).toContain("JJ_COMMIT_ID");
    expect(contract).toContain("The public verifier remains read-only");
  });

  it("preserves shell failure flags in the jj CI-parity runner", () => {
    const runner = fencedBlockContaining(
        read(verifyCiParity),
        "CI_TASK_SCRIPT",
      ),
      executable =
        'jj() {\n  while test "$1" != --; do shift; done\n  shift\n  "$@"\n}\n' +
        runner;
    const failed = runShell(executable, {
      CI_SHELL_TEMPLATE: "bash --noprofile --norc -eo pipefail {0}",
      CI_TASK_SCRIPT: "false\nprintf 'masked-success\\n'",
      SOURCE_REPO_ROOT: "/repo",
      TARGET_SHA: "target-sha",
    });
    expect(failed.status).not.toBe(0);
    expect(failed.stdout).not.toContain("masked-success");
  });

  it("selects CI parity conservatively without evaluating workflow filters", () => {
    const selector = fencedBlockContaining(
      read(verifyCiParity),
      "CI_PARITY_WORKFLOW_DECISION",
    );
    for (const fixture of ["all-match", "base-miss", "type-miss", "paths-miss"])
      expect(
        shellFields(
          runShell(selector, {
            HAS_PULL_REQUEST_TRIGGER: "1",
            UNEVALUATED_FILTER_FIXTURE: fixture,
          }),
        ),
      ).toEqual({
        CI_PARITY_WORKFLOW_DECISION: "include",
        CI_PARITY_APPLICABILITY_MODE: "conservative_pull_request",
        CI_PARITY_UNEVALUATED_FILTERS: "base_ref,event_type,paths",
      });
    expect(
      shellFields(runShell(selector, { HAS_PULL_REQUEST_TRIGGER: "0" })),
    ).toEqual({
      CI_PARITY_WORKFLOW_DECISION: "exclude",
      CI_PARITY_APPLICABILITY_MODE: "not_applicable",
      CI_PARITY_UNEVALUATED_FILTERS: "",
    });
  });

  it("routes every CI-parity caller through the public verify action", () => {
    const invocation = fencedBlockContaining(
      read(createUpdate),
      "coding:pr verify ",
    );
    expect(invocation.trim()).toBe(
      'coding:pr verify --target "$TARGET_SHA" --base "$TARGET_BASE" --kind "$TARGET_KIND"',
    );
    assertTargetGatePrecedesPush(read(partialToBranch));
    assertTargetGatePrecedesPush(
      read(join(coding, "skills/commit/references/workflow-correct-merged.md")),
    );
  });

  it("fails the missing-secret gate closed unless approval is exact", () => {
    const gate = fencedBlockContaining(
        read(verifyCiParity),
        "CI_PARITY_SECRET_GATE",
      ),
      target = "target-sha",
      missing = "API_TOKEN,SIGNING_KEY";
    expect(
      shellFields(
        runShell(gate, { TARGET_SHA: target, MISSING_SECRET_NAMES: "" }),
      ),
    ).toEqual({
      CI_PARITY_SECRET_GATE: "run_local",
      CI_PARITY_OVERALL: "pending_local_run",
    });
    const blockedCases = [
      {},
      {
        MISSING_SECRET_APPROVED: "true",
        MISSING_SECRET_APPROVAL_SHA: "other-sha",
        MISSING_SECRET_APPROVAL_NAMES: missing,
      },
      {
        MISSING_SECRET_APPROVED: "true",
        MISSING_SECRET_APPROVAL_SHA: target,
        MISSING_SECRET_APPROVAL_NAMES: "API_TOKEN",
      },
    ];
    for (const approval of blockedCases) {
      const blocked = runShell(gate, {
        TARGET_SHA: target,
        MISSING_SECRET_NAMES: missing,
        ...approval,
      });
      expect(blocked.status).toBe(42);
      expect(blocked.stdout.trim().split(/\r?\n/)).toEqual([
        "CI_PARITY_SECRET_GATE=stop_before_push",
        "CI_PARITY_OVERALL=blocked",
      ]);
    }
    expect(
      shellFields(
        runShell(gate, {
          TARGET_SHA: target,
          MISSING_SECRET_NAMES: missing,
          MISSING_SECRET_APPROVED: "true",
          MISSING_SECRET_APPROVAL_SHA: target,
          MISSING_SECRET_APPROVAL_NAMES: missing,
        }),
      ),
    ).toEqual({
      CI_PARITY_SECRET_GATE: "approved_without_local_run",
      CI_PARITY_OVERALL: "approved_without_local_run",
    });
  });

  it("requires exact SHA and sorted secret names in every CI-parity consumer", () => {
    for (const path of receiptConsumers()) {
      const contract = read(path).split(/\s+/).join(" ");
      expect(contract).toContain("its `sha` equals the exact `TARGET_SHA`");
      expect(contract).toContain(
        "its `names` equal the verifier's exact lexically sorted missing-secret names",
      );
      expect(contract).toContain(
        "A SHA-only approval or any name/order mismatch",
      );
    }
  });

  it("accepts only the exact local-run CI-parity receipt", () => {
    const results = [
        {
          command: "uvx pytest",
          kind: "test",
          ref: "target-sha",
          source: ".github/workflows/ci.yml:test",
          status: 0,
        },
        {
          command: "uvx ruff check",
          kind: "lint",
          ref: "target-sha",
          source: ".github/workflows/ci.yml:lint",
          status: 0,
        },
      ],
      receipt = {
        applicability_mode: "conservative_pull_request",
        execution_engine: "jj-run",
        missing_secret_approval: { approved: false, names: [], sha: null },
        overall: "pass",
        target: { base: "target-base", kind: "standalone", sha: "target-sha" },
        workflow_command_results: results,
      },
      environment = {
        CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON: "[]",
        CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON:
          JSON.stringify(results),
        CI_PARITY_RECEIPT_JSON: JSON.stringify(receipt),
        TARGET_BASE: "target-base",
        TARGET_KIND: "standalone",
        TARGET_SHA: "target-sha",
      };
    for (const gate of receiptGates())
      expect(shellFields(runShell(gate, environment))).toEqual({
        CI_PARITY_RECEIPT_GATE: "accepted",
      });
  });

  it.each([undefined, "git-worktree"])(
    "rejects CI-parity execution engine %s",
    (executionEngine) => {
      const results = [
          {
            command: "uvx pytest",
            kind: "test",
            ref: "target-sha",
            source: ".github/workflows/ci.yml:test",
            status: 0,
          },
        ],
        receipt: Record<string, unknown> = {
          applicability_mode: "conservative_pull_request",
          missing_secret_approval: { approved: false, names: [], sha: null },
          overall: "pass",
          target: {
            base: "target-base",
            kind: "standalone",
            sha: "target-sha",
          },
          workflow_command_results: results,
        };
      if (executionEngine !== undefined)
        receipt.execution_engine = executionEngine;
      const environment = {
        CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON: "[]",
        CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON:
          JSON.stringify(results),
        CI_PARITY_RECEIPT_JSON: JSON.stringify(receipt),
        TARGET_BASE: "target-base",
        TARGET_KIND: "standalone",
        TARGET_SHA: "target-sha",
      };
      for (const gate of receiptGates())
        expect(runShell(gate, environment).status).toBe(42);
    },
  );

  it("rejects a CI-parity receipt for a changed base", () => {
    const results = [
        {
          command: "uvx pytest",
          kind: "test",
          ref: "target-sha",
          source: ".github/workflows/ci.yml:test",
          status: 0,
        },
      ],
      receipt = {
        applicability_mode: "conservative_pull_request",
        execution_engine: "jj-run",
        missing_secret_approval: { approved: false, names: [], sha: null },
        overall: "pass",
        target: { base: "stale-base", kind: "standalone", sha: "target-sha" },
        workflow_command_results: results,
      },
      environment = {
        CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON: "[]",
        CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON:
          JSON.stringify(results),
        CI_PARITY_RECEIPT_JSON: JSON.stringify(receipt),
        TARGET_BASE: "target-base",
        TARGET_KIND: "standalone",
        TARGET_SHA: "target-sha",
      };
    for (const gate of receiptGates()) {
      const rejected = runShell(gate, environment);
      expect(rejected.status).toBe(42);
      expect(rejected.stdout).toBe("");
    }
  });

  it("rejects a CI-parity receipt with mismatched missing-secret names", () => {
    const results = [
        {
          command: "uvx pytest",
          kind: "test",
          ref: "target-sha",
          source: ".github/workflows/ci.yml:test",
          status: "not_run_missing_secret",
        },
      ],
      receipt = {
        applicability_mode: "conservative_pull_request",
        execution_engine: "jj-run",
        missing_secret_approval: {
          approved: true,
          names: ["API_TOKEN"],
          sha: "target-sha",
        },
        overall: "approved_without_local_run",
        target: { base: "target-base", kind: "standalone", sha: "target-sha" },
        workflow_command_results: results,
      },
      environment = {
        CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON: JSON.stringify([
          "API_TOKEN",
          "SIGNING_KEY",
        ]),
        CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON:
          JSON.stringify(results),
        CI_PARITY_RECEIPT_JSON: JSON.stringify(receipt),
        TARGET_BASE: "target-base",
        TARGET_KIND: "standalone",
        TARGET_SHA: "target-sha",
      };
    for (const gate of receiptGates()) {
      const rejected = runShell(gate, environment);
      expect(rejected.status).toBe(42);
      expect(rejected.stdout).toBe("");
    }
  });

  it("rejects a passing receipt when expected secret names are nonempty", () => {
    const results = [
        {
          command: "uvx pytest",
          kind: "test",
          ref: "target-sha",
          source: ".github/workflows/ci.yml:test",
          status: 0,
        },
      ],
      receipt = {
        applicability_mode: "conservative_pull_request",
        execution_engine: "jj-run",
        missing_secret_approval: { approved: false, names: [], sha: null },
        overall: "pass",
        target: { base: "target-base", kind: "standalone", sha: "target-sha" },
        workflow_command_results: results,
      },
      environment = {
        CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON: '["API_TOKEN"]',
        CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON:
          JSON.stringify(results),
        CI_PARITY_RECEIPT_JSON: JSON.stringify(receipt),
        TARGET_BASE: "target-base",
        TARGET_KIND: "standalone",
        TARGET_SHA: "target-sha",
      };
    for (const gate of receiptGates()) {
      const rejected = runShell(gate, environment);
      expect(rejected.status).toBe(42);
      expect(rejected.stdout).toBe("");
    }
  });

  it("rejects a raw SHA/name approval instead of a complete receipt", () => {
    const approval = {
        missing_secret_approval: {
          approved: true,
          names: ["API_TOKEN"],
          sha: "target-sha",
        },
      },
      environment = {
        CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON: '["API_TOKEN"]',
        CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON: "[]",
        CI_PARITY_RECEIPT_JSON: JSON.stringify(approval),
        TARGET_BASE: "target-base",
        TARGET_KIND: "standalone",
        TARGET_SHA: "target-sha",
      };
    for (const gate of receiptGates()) {
      const rejected = runShell(gate, environment);
      expect(rejected.status).toBe(42);
      expect(rejected.stdout).toBe("");
    }
  });

  it("selects direct-sync bases and gate order fail-closed", () => {
    const partial = read(partialToBranch),
      correctPath = join(
        coding,
        "skills/commit/references/workflow-correct-merged.md",
      ),
      correctMerged = read(correctPath),
      selector = fencedBlockContaining(partial, 'case "$REMOTE_TARGET_SHA"');
    const cases = [
      [
        {
          LOCAL_TARGET_SHA: "",
          REMOTE_TARGET_SHA: "existing-remote",
          TARGET_CREATION_BASE: "existing-remote",
        },
        { TARGET_ROUTE: "remote-only", TARGET_BASE: "existing-remote" },
      ],
      [
        {
          LOCAL_TARGET_SHA: "local-target",
          REMOTE_TARGET_SHA: "",
          TARGET_CREATION_BASE: "local-target",
        },
        { TARGET_ROUTE: "local-only", TARGET_BASE: "local-target" },
      ],
      [
        {
          LOCAL_TARGET_SHA: "shared-target",
          REMOTE_TARGET_SHA: "shared-target",
          TARGET_CREATION_BASE: "shared-target",
        },
        { TARGET_ROUTE: "synchronized", TARGET_BASE: "shared-target" },
      ],
      [
        {
          LOCAL_TARGET_SHA: "",
          REMOTE_TARGET_SHA: "",
          TARGET_CREATION_BASE: "creation-base",
        },
        { TARGET_ROUTE: "new-target", TARGET_BASE: "creation-base" },
      ],
    ] as const;
    for (const [environment, expected] of cases)
      expect(shellFields(runShell(selector, environment))).toEqual(expected);
    const correctSelector = fencedBlockContaining(
        correctMerged,
        "TARGET_BASE=$(jj log",
      ).replaceAll("<affected-bookmark>", "target"),
      correct = shellFields(
        runShell(
          'jj() {\n case " $* " in\n *" target@origin "*) printf "remote-base" ;;\n *" target "*) printf "rewritten-head" ;;\n *) return 2 ;;\n esac\n}\n' +
            correctSelector +
            'printf "TARGET_SHA=%s\\nTARGET_BASE=%s\\n" "$TARGET_SHA" "$TARGET_BASE"\n',
        ),
      );
    expect(correct).toEqual({
      TARGET_SHA: "rewritten-head",
      TARGET_BASE: "remote-base",
    });
    assertTargetGatePrecedesPush(partial);
    assertTargetGatePrecedesPush(correctMerged);
  });

  it("creates, moves, and pushes the exact remote-only partial bookmark", () => {
    const partial = read(partialToBranch),
      classification = fencedBlockContaining(
        partial,
        'case "$REMOTE_TARGET_SHA"',
      ),
      operation = fencedBlockContaining(partial, "jj bookmark create <target>"),
      push = fencedBlockContaining(partial, "jj git push --bookmark <target>"),
      executable =
        'JJ_CALL_COUNT=0\njj() {\n JJ_CALL_COUNT=$((JJ_CALL_COUNT + 1))\n printf "JJ_%s=%s\\n" "$JJ_CALL_COUNT" "$*"\n}\n' +
        classification +
        operation
          .replaceAll("<target>", "target")
          .replace("<new-change-id>", "new-change") +
        push.replaceAll("<target>", "target");
    expect(
      shellFields(
        runShell(executable, {
          LOCAL_TARGET_SHA: "",
          REMOTE_TARGET_SHA: "remote-target",
          TARGET_CREATION_BASE: "remote-target",
        }),
      ),
    ).toEqual({
      TARGET_ROUTE: "remote-only",
      TARGET_BASE: "remote-target",
      JJ_1: "bookmark create target --revision remote-target",
      JJ_2: "bookmark move target --to new-change",
      JJ_3: "git push --bookmark target",
    });
  });

  it.each(["shared-target", "f".repeat(40)])(
    "reuses, moves, and pushes synchronized bookmark %s",
    (targetSha) => {
      const partial = read(partialToBranch),
        classification = fencedBlockContaining(
          partial,
          'case "$REMOTE_TARGET_SHA"',
        ),
        operation = fencedBlockContaining(
          partial,
          "jj bookmark create <target>",
        ),
        push = fencedBlockContaining(
          partial,
          "jj git push --bookmark <target>",
        ),
        executable =
          'JJ_CALL_COUNT=0\njj() {\n JJ_CALL_COUNT=$((JJ_CALL_COUNT + 1))\n printf "JJ_%s=%s\\n" "$JJ_CALL_COUNT" "$*"\n}\n' +
          classification +
          operation
            .replaceAll("<target>", "target")
            .replace("<new-change-id>", "new-change") +
          push.replaceAll("<target>", "target");
      expect(
        shellFields(
          runShell(executable, {
            LOCAL_TARGET_SHA: targetSha,
            REMOTE_TARGET_SHA: targetSha,
            TARGET_CREATION_BASE: targetSha,
          }),
        ),
      ).toEqual({
        TARGET_ROUTE: "synchronized",
        TARGET_BASE: targetSha,
        JJ_1: "bookmark move target --to new-change",
        JJ_2: "git push --bookmark target",
      });
    },
  );

  it.each([
    ["local-target", "remote-target"],
    ["remote-target", "local-target"],
  ])(
    "rejects divergent partial targets %s/%s before mutation",
    (local, remote) => {
      const partial = read(partialToBranch),
        rejected = runShell(
          fencedBlockContaining(partial, 'case "$REMOTE_TARGET_SHA"'),
          {
            LOCAL_TARGET_SHA: local,
            REMOTE_TARGET_SHA: remote,
            TARGET_CREATION_BASE: remote,
          },
        );
      expect(rejected.status).not.toBe(0);
      expect(rejected.stdout).toBe("");
      expect(rejected.stderr).toContain(
        "local and remote target bookmarks diverge",
      );
      expect(partial.indexOf("scripts/classify-target-route.sh")).toBeLessThan(
        partial.indexOf("### 1. Surface the hunk plan"),
      );
    },
  );

  it.each(["remote", "local-only"])(
    "rejects a divergent head for existing %s partial target",
    (targetKind) => {
      const root = mkdtempSync(join(tmpdir(), "partial-target-contract-"));
      try {
        const repo = join(root, "repo");
        spawnSync("git", ["init", "--quiet", "--initial-branch=main", repo]);
        spawnSync("git", ["-C", repo, "config", "user.name", "Test"]);
        spawnSync("git", [
          "-C",
          repo,
          "config",
          "user.email",
          "test@example.com",
        ]);
        spawnSync("git", [
          "-C",
          repo,
          "commit",
          "--quiet",
          "--allow-empty",
          "--no-gpg-sign",
          "-m",
          "base",
        ]);
        const base = spawnSync("git", ["-C", repo, "rev-parse", "HEAD"], {
          encoding: "utf8",
        }).stdout.trim();
        spawnSync("git", [
          "-C",
          repo,
          "commit",
          "--quiet",
          "--allow-empty",
          "--no-gpg-sign",
          "-m",
          "fetched target",
        ]);
        const fetched = spawnSync("git", ["-C", repo, "rev-parse", "HEAD"], {
          encoding: "utf8",
        }).stdout.trim();
        spawnSync("git", ["-C", repo, "switch", "--quiet", "--detach", base]);
        spawnSync("git", [
          "-C",
          repo,
          "commit",
          "--quiet",
          "--allow-empty",
          "--no-gpg-sign",
          "-m",
          "divergent head",
        ]);
        const divergent = spawnSync("git", ["-C", repo, "rev-parse", "HEAD"], {
          encoding: "utf8",
        }).stdout.trim();
        expect(
          spawnSync("git", ["-C", repo, "merge-base", fetched, divergent], {
            encoding: "utf8",
          }).stdout.trim(),
        ).toBe(base);
        const partial = read(partialToBranch),
          target =
            targetKind === "remote"
              ? { REMOTE_TARGET_SHA: fetched, LOCAL_TARGET_SHA: "" }
              : { REMOTE_TARGET_SHA: "", LOCAL_TARGET_SHA: fetched },
          rejected = runShell(
            fencedBlockContaining(partial, 'case "$REMOTE_TARGET_SHA"'),
            { TARGET_CREATION_BASE: divergent, ...target },
          );
        expect(rejected.status).not.toBe(0);
        expect(rejected.stdout).toBe("");
        expect(rejected.stderr).toContain(
          targetKind === "remote"
            ? "must equal fetched target"
            : "must equal local target",
        );
        expect(
          partial.indexOf("scripts/classify-target-route.sh"),
        ).toBeLessThan(partial.indexOf("### 1. Surface the hunk plan"));
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("keeps changed commit references portable", () => {
    const commitRoot = join(coding, "skills/commit");
    for (const path of [
      join(commitRoot, "SKILL.md"),
      partialToBranch,
      join(commitRoot, "references/workflow-correct-merged.md"),
    ])
      expectLinksWithin(path, commitRoot);
  });

  it("routes the CI-parity reference and keeps its links portable", () => {
    const skill = join(pr, "SKILL.md"),
      routed = new Set(
        [...read(skill).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
          .map((match) => match[1]!)
          .filter(
            (target) => !target.includes("://") && !target.startsWith("#"),
          )
          .map((target) => join(pr, target.split("#", 1)[0]!)),
      );
    expect(routed).toContain(verifyCiParity);
    expectLinksWithin(skill, pr);
    expectLinksWithin(verifyCiParity, pr);
  });

  it("keeps PR metadata internal while the template owns rationale", () => {
    const workflow = read(createUpdate),
      template = read(messageTemplate),
      sizeRule = read(join(gitStandard, "rules/GIT-PR-SIZE-03.md"));
    expect(workflow).toContain("specific indivisibility prose");
    for (const phrase of [
      "## 📐 Why This Size [ Optional ]",
      "reviewer-time estimates",
      "## 🧪 Verification",
    ])
      expect(template).toContain(phrase);
    expect(sizeRule).toContain("Keep size counts, zone metadata");
    expect(workflow).toContain("size counts, zone metadata");
  });

  it("requires a complete black-zone body and live authorization receipt", () => {
    const author = read(createUpdate),
      review = read(reviewWorkflow),
      publishing = read(join(pr, "references/review-publishing.md")),
      checklist = read(join(pr, "references/review-checklist.md")),
      sizeRule = read(join(gitStandard, "rules/GIT-PR-SIZE-04.md"));
    expect(author).toContain("requires specific `## ⚠️ Risk`,");
    expect(author).toContain("yellow/red/black");
    for (const phrase of [
      "`## ⚠️ Risk`",
      "`## 🧭 Test Plan`",
      "`## 📐 Why This Size`",
    ])
      expect(review).toContain(phrase);
    for (const contract of [review, publishing])
      for (const phrase of [
        "`comment_url`",
        "`authorization_body`",
        "`rationale`",
        "sole semantic authorization-review input",
      ])
        expect(contract).toContain(phrase);
    expect(checklist).toContain("earlier fetched comment or body");
    expect(sizeRule.split(/\s+/).join(" ")).toContain(
      "uses only that receipt's `authorization_body`",
    );
  });
});
