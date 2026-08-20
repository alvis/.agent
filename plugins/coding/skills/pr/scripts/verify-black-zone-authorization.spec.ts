import { spawn } from "node:child_process";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scripts = fileURLToPath(new URL(".", import.meta.url));
const plugin = resolve(scripts, "../../..");
const repository = resolve(plugin, "../..");
const verifier = join(scripts, "verify-black-zone-authorization.sh");
const headOid = "a".repeat(40);
const baseOid = "b".repeat(40);

function authorizationBody(
  options: { baseOid?: string; headOid?: string; rationale?: string } = {},
): string {
  return [
    "Black-zone authorization",
    `Head OID: \`${options.headOid ?? headOid}\``,
    `Base OID: \`${options.baseOid ?? baseOid}\``,
    "Authorization: I authorize this one-off black-zone publication.",
    `Indivisibility: ${options.rationale ?? "The marketplace projections and source manifests are indivisible because they encode one revision; otherwise consumers observe a mixed contract."}`,
  ].join("\n");
}

function issueComment(
  options: {
    association?: string;
    body?: string;
    id?: number | null;
    nodeId?: string;
    userType?: string;
  } = {},
): Record<string, unknown> {
  return {
    author_association: options.association ?? "OWNER",
    body: options.body ?? authorizationBody(),
    html_url: "https://github.example/octo/repo/issues/17#issuecomment-42",
    id: options.id === undefined ? 42 : options.id,
    node_id: options.nodeId ?? "IC_kwDOExample",
    user: { login: "repository-owner", type: options.userType ?? "User" },
  };
}

async function runVerifier(
  comments: readonly Record<string, unknown>[],
  options: { ghExit?: number; liveBaseOid?: string; liveHeadOid?: string } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "black-zone-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  const log = join(root, "gh-invocations");
  const gh = join(bin, "gh");
  await writeFile(
    gh,
    `#!/usr/bin/env bash
set -u
printf '%s\\0' "$@" >> "$FAKE_GH_INVOCATIONS"
printf '\\n' >> "$FAKE_GH_INVOCATIONS"
if [ "\${FAKE_GH_EXIT:-0}" -ne 0 ]; then printf 'simulated GitHub failure\\n' >&2; exit "$FAKE_GH_EXIT"; fi
case "$*" in
  *"repos/octo/repo/pulls/17"*) printf '%s\\n' "$FAKE_GH_PULL" ;;
  *"repos/octo/repo/issues/17/comments?per_page=100"*) printf '%s\\n' "$FAKE_GH_COMMENTS" ;;
  *) exit 91 ;;
esac
`,
  );
  await chmod(gh, 0o755);
  const child = spawn(
    "bash",
    [verifier, "github.example", "octo/repo", "17", headOid, baseOid],
    {
      env: {
        ...process.env,
        FAKE_GH_COMMENTS: JSON.stringify([comments]),
        FAKE_GH_EXIT: String(options.ghExit ?? 0),
        FAKE_GH_INVOCATIONS: log,
        FAKE_GH_PULL: JSON.stringify({
          base: { sha: options.liveBaseOid ?? baseOid },
          head: { sha: options.liveHeadOid ?? headOid },
        }),
        PATH: `${bin}:${process.env.PATH ?? ""}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (value: string) => {
    stdout += value;
  });
  child.stderr.on("data", (value: string) => {
    stderr += value;
  });
  const exitCode = await new Promise<number>((resolveExit, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      resolveExit(code ?? 1);
    });
  });
  const invocations = await readFile(log).catch(() => Buffer.from(""));
  await rm(root, { force: true, recursive: true });
  return {
    exitCode,
    invocations: invocations.toString().replaceAll("\0", " "),
    stderr,
    stdout,
  };
}

describe("cmd:verify-black-zone-authorization", () => {
  it("should authorize an exact revision and return a stable receipt", async () => {
    const result = await runVerifier([issueComment()]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      author_login: "repository-owner",
      authorization_body: authorizationBody(),
      base_oid: baseOid,
      comment_id: 42,
      comment_node_id: "IC_kwDOExample",
      comment_url: "https://github.example/octo/repo/issues/17#issuecomment-42",
      head_oid: headOid,
      rationale: {
        consequence: "consumers observe a mixed contract.",
        coupling: "they encode one revision",
        subject:
          "The marketplace projections and source manifests are indivisible",
      },
    });
    expect(result.invocations).toContain(
      "api --hostname github.example repos/octo/repo/pulls/17",
    );
    expect(result.invocations).toContain("--paginate");
    expect(result.invocations).toContain("--slurp");
  });

  it("should return only the live mutated authorization body and rationale", async () => {
    const stale = authorizationBody({
      headOid: "c".repeat(40),
      rationale:
        "The stale source and projection are indivisible because they share an old revision; otherwise stale consumers see a mixed contract.",
    });
    const live = authorizationBody({
      rationale:
        "The current source and projection are indivisible because they share the live revision; otherwise current consumers see a mixed contract.",
    });
    const result = await runVerifier([
      issueComment({ body: stale, id: 41, nodeId: "IC_kwDOStale" }),
      issueComment({ body: live }),
    ]);
    const receipt = JSON.parse(result.stdout);
    expect(receipt.authorization_body).toBe(live);
    expect(receipt.rationale).toEqual({
      consequence: "current consumers see a mixed contract.",
      coupling: "they share the live revision",
      subject: "The current source and projection are indivisible",
    });
    expect(result.stdout).not.toContain(stale);
  });

  for (const comment of [
    issueComment({ id: null }),
    issueComment({ nodeId: "" }),
  ]) {
    it("should reject receipts without stable comment identifiers", async () => {
      const result = await runVerifier([comment]);
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("");
    });
  }

  const closedCases: Array<[readonly Record<string, unknown>[], number]> = [
    [[], 0],
    [[issueComment({ association: "MEMBER" })], 0],
    [[issueComment({ association: "NONE" })], 0],
    [[issueComment({ userType: "Bot" })], 0],
    [
      [issueComment({ body: authorizationBody({ headOid: "c".repeat(40) }) })],
      0,
    ],
    [
      [issueComment({ body: authorizationBody({ baseOid: "d".repeat(40) }) })],
      0,
    ],
    [[issueComment({ body: authorizationBody({ rationale: "Needed." }) })], 0],
    [[issueComment()], 42],
  ];
  for (const [comments, ghExit] of closedCases)
    it("should fail closed for invalid or unavailable authorization", async () => {
      const result = await runVerifier(comments, { ghExit });
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("");
    });

  it("should require an explicit one-off grant", async () => {
    const result = await runVerifier([
      issueComment({
        body: authorizationBody().replace(
          "I authorize this one-off black-zone publication.",
          "I reviewed this black-zone publication.",
        ),
      }),
    ]);
    expect(result.exitCode).not.toBe(0);
  });

  const duplicateLines = [
    [`Head OID: \`${headOid}\``, `Head OID: \`${headOid}\``],
    [`Head OID: \`${headOid}\``, `Head OID: \`${"c".repeat(40)}\``],
    [`Base OID: \`${baseOid}\``, `Base OID: \`${baseOid}\``],
    [`Base OID: \`${baseOid}\``, `Base OID: \`${"d".repeat(40)}\``],
    [
      "Authorization:",
      "Authorization: I authorize this one-off black-zone publication.",
    ],
    [
      "Authorization:",
      "Authorization: I revoke this one-off black-zone publication.",
    ],
    [
      "Indivisibility:",
      "Indivisibility: The files are indivisible because they share state; otherwise the build fails.",
    ],
    ["Indivisibility:", "Indivisibility: These files can be safely split."],
  ];
  for (const [prefix, extra] of duplicateLines)
    it("should reject duplicate or contradictory contract lines", async () => {
      const lines = authorizationBody().split("\n");
      const index = lines.findIndex((line) => line.startsWith(prefix ?? ""));
      lines.splice(index + 1, 0, extra ?? "");
      expect(
        (await runVerifier([issueComment({ body: lines.join("\n") })]))
          .exitCode,
      ).not.toBe(0);
    });

  for (const mutation of ["reordered", "extra-line"])
    it("should require exactly five ordered lines", async () => {
      const lines = authorizationBody().split("\n");
      if (mutation === "reordered")
        [lines[1], lines[2]] = [lines[2] ?? "", lines[1] ?? ""];
      else lines.push("Additional approval prose.");
      expect(
        (await runVerifier([issueComment({ body: lines.join("\n") })]))
          .exitCode,
      ).not.toBe(0);
    });
  for (const rationale of [
    "These files need to land together because they are related.",
    "These files need to land together; otherwise it would be inconvenient.",
    "This change is too large to split because it touches many files; otherwise review takes longer.",
  ])
    it("should require coupling and consequence rationale grammar", async () => {
      expect(
        (
          await runVerifier([
            issueComment({ body: authorizationBody({ rationale }) }),
          ])
        ).exitCode,
      ).not.toBe(0);
    });
  for (const options of [
    { liveHeadOid: "c".repeat(40) },
    { liveBaseOid: "d".repeat(40) },
  ])
    it("should fail when the live PR revision drifted", async () => {
      const result = await runVerifier([issueComment()], options);
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("");
    });
});

describe("black-zone publication contracts", () => {
  it("should allow draft publication before authorization", async () => {
    const workflow = await readFile(
      join(plugin, "skills/pr/references/create-update.md"),
      "utf8",
    );
    const loop = await readFile(
      join(plugin, "skills/pr/references/review-loop.md"),
      "utf8",
    );
    expect(workflow).not.toContain(
      "scripts/verify-black-zone-authorization.sh",
    );
    expect(loop).not.toContain("scripts/verify-black-zone-authorization.sh");
    expect(workflow.split(/\s+/).join(" ")).toContain(
      "as a draft without prior authorization",
    );
    expect(workflow).toContain("review approval remains blocked");
    expect(loop.toLowerCase().split(/\s+/).join(" ")).toContain(
      "dispatch review without a prior authorization receipt",
    );
  });
  it("should verify authorization fail-closed at review approval", async () => {
    const review = await readFile(
      join(plugin, "skills/pr/references/review-workflow.md"),
      "utf8",
    );
    const normalized = review.split(/\s+/).join(" ");
    expect(
      review.match(/scripts\/verify-black-zone-authorization\.sh/g),
    ).toHaveLength(1);
    expect(normalized).toContain("substantive verdict is `APPROVE`");
    expect(normalized).toContain("human `OWNER`");
    expect(normalized).toContain(
      "missing, malformed, deleted, or mutated comment",
    );
    expect(normalized).toContain("cap the event at `COMMENT`");
  });
  it("should use canonical cross-plugin references", async () => {
    const catalog = await readFile(
      join(repository, "plugins/governance/references/context-catalog.md"),
      "utf8",
    );
    const createUpdate = await readFile(
      join(plugin, "skills/pr/references/create-update.md"),
      "utf8",
    );
    const loop = await readFile(
      join(plugin, "skills/pr/references/review-loop.md"),
      "utf8",
    );
    expect(catalog).toContain("coding:standards/git/");
    expect(catalog).toContain("essential:templates/memory.md");
    expect(createUpdate).toContain("## Pull-request directions");
    expect(createUpdate).toContain("governance:standards/delegation/");
    expect(loop).toContain("governance:standards/delegation/");
  });
  it("should prevent repository files from reclassifying fixed PR size zones", async () => {
    const paths = [
      "standards/git/meta.md",
      "standards/git/scan.md",
      "standards/git/write.md",
      "standards/git/rules/GIT-PR-SIZE-04.md",
      "skills/pr/references/create-update.md",
      "skills/pr/references/review-workflow.md",
      "skills/pr/references/review-loop.md",
      "skills/pr/references/stacked-prs.md",
    ];
    const policy = (
      await Promise.all(
        paths.map((path) => readFile(join(plugin, path), "utf8")),
      )
    ).join("\n");
    const normalized = policy.split(/\s+/).join(" ");
    const thresholds = JSON.parse(
      await readFile(
        join(plugin, "skills/pr/assets/size-thresholds.json"),
        "utf8",
      ),
    ) as { zones: Array<Record<string, unknown>> };
    expect(policy).not.toContain("standard-overrides");
    expect(thresholds.zones).toContainEqual(
      expect.objectContaining({
        max_authored_net_loc: 2000,
        max_files_changed: 60,
        name: "red",
      }),
    );
    expect(policy).toContain("> 60 files");
    expect(policy).toContain("> 2000 authored net LOC");
    expect(normalized).toContain(
      "repository configuration cannot change these thresholds",
    );
  });
});
