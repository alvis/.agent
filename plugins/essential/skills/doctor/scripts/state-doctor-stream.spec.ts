import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scripts = fileURLToPath(new URL(".", import.meta.url));
const essential = fileURLToPath(new URL("../../..", import.meta.url));
const doctor = join(scripts, "state-doctor");
const doctorSkill = join(essential, "skills/doctor/SKILL.md");
const header =
  "| ID | Mark | Status | Task | Depends on | Required | Acceptance | Owner | Evidence / next action |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n";

type Finding = {
  check: string;
  fix?: string;
  message: string;
  severity: "error" | "info" | "warning";
  work?: string;
};
type Run = { code: number; findings: Finding[]; stderr: string };

function row(
  taskId: string,
  mark = "-",
  status = "planned",
  depends = "—",
  required = "yes",
  evidence = "Pending.",
): string {
  return `| ${taskId} | ${mark} | ${status} | Do ${taskId}. [targets: none] | ${depends} | ${required} | Done when done. | PM | ${evidence} |\n`;
}

function run(args: string[]): Run {
  const result = spawnSync(doctor, [...args, "--json"], { encoding: "utf8" });
  return {
    code: result.status ?? 1,
    findings: JSON.parse(result.stdout).findings as Finding[],
    stderr: result.stderr,
  };
}

class Workspace {
  readonly workDir: string;
  private constructor(readonly root: string) {
    this.workDir = join(root, ".state/works/demo");
  }
  static async create(): Promise<Workspace> {
    const value = new Workspace(
      await mkdtemp(join(tmpdir(), "state-doctor-stream-")),
    );
    await mkdir(join(value.workDir, "state"), { recursive: true });
    await value.writeCharter();
    return value;
  }
  async remove(): Promise<void> {
    await rm(this.root, { force: true, recursive: true });
  }
  async writeCharter(provenance = "approved"): Promise<void> {
    const path = join(this.workDir, "goal.md");
    if (provenance === "-") {
      await unlink(path).catch(() => undefined);
      return;
    }
    await writeFile(
      path,
      `# Charter\n\n- Charter: \`${provenance}\`\n- Charter revision: \`1\`\n\n## Goal\n\nDemonstrate the doctor.\n`,
    );
  }
  async writeState(
    rows: string,
    metadata = "",
    lifecycle = "working",
  ): Promise<void> {
    await writeFile(
      join(this.workDir, "state.md"),
      `# Work state\n\n- State role: \`root\`\n- Work ID: \`demo\`\n- Lifecycle status: \`${lifecycle}\`\n- State revision: \`3\`\n${metadata}\n## Tasks\n\n${header}${rows}`,
    );
  }
  run(...args: string[]): Run {
    return run(["--work-dir", this.workDir, ...args]);
  }
}

const checks = (findings: Finding[]): Set<string> =>
  new Set(findings.map(({ check }) => check));
const selected = (findings: Finding[], check: string): Finding[] =>
  findings.filter((finding) => finding.check === check);
const dateDaysAgo = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const statusLine = (date: string, payload: string): string =>
  `- ${date}T09:00:00Z PM@pm rev:1 status demo: ${payload}`;

async function writeJournal(
  workspace: Workspace,
  lines: string[],
  name = "journal.md",
): Promise<void> {
  await writeFile(
    join(workspace.workDir, "state", name),
    `# Journal\n\n${lines.join("\n")}\n`,
  );
}
function overviewRow({
  workId = "demo",
  phase = "working",
  blockedOn = "-",
  progress = "2026-07-30 (7d)",
  nextAction = "Ship it.",
  location = "/Users/dev/tree",
} = {}): string {
  return `| Work ID | Phase | Blocked on | Last progress | Headline | Next action | Location | Links |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| ${workId} | ${phase} | ${blockedOn} | ${progress} | Demo. | ${nextAction} | ${location} | - |\n`;
}
async function writeOverview(
  root: string,
  body: string,
  siblings = true,
): Promise<void> {
  const state = join(root, ".state");
  await writeFile(join(state, "overview.md"), body);
  if (siblings)
    await Promise.all(
      ["environment.md", "traps.md"].map((name) =>
        writeFile(join(state, name), `# ${name}\n`),
      ),
    );
}
function runStateDir(root: string): Run {
  return run(["--state-dir", join(root, ".state")]);
}
async function writeEffectiveAdr(
  root: string,
  name = "0001-choice.md",
  body = "",
): Promise<string> {
  const architecture = join(root, "docs/architecture");
  const decisions = join(architecture, "decisions");
  await mkdir(decisions, { recursive: true });
  const number = /^\d{4}/.exec(name)?.[0] ?? "0001";
  const path = join(decisions, name);
  await writeFile(
    path,
    `# ADR-${number}: Choice\n\n- Status: \`Accepted\`\n\n${body}`,
  );
  await writeFile(
    join(architecture, "README.md"),
    `# Architecture\n\n| Document | Status |\n| --- | --- |\n| [ADR](decisions/${name}) | Accepted |\n`,
  );
  return path;
}

describe("state-doctor stream and lifecycle tail parity", () => {
  let workspace: Workspace;
  beforeEach(async () => {
    workspace = await Workspace.create();
  });
  afterEach(async () => {
    await workspace.remove();
  });

  it("reports expired and conflicting leases", async () => {
    await workspace.writeState(row("AAA"));
    await writeFile(
      join(workspace.workDir, "lease.json"),
      JSON.stringify({
        work_id: "demo",
        token: "t",
        expires_at_epoch: Math.floor(Date.now() / 1000) - 60,
        state_revision: 9,
      }),
    );
    const findings = selected(workspace.run().findings, "lease");
    expect(new Set(findings.map(({ severity }) => severity))).toEqual(
      new Set(["warning", "error"]),
    );
  });
  it("treats unparseable state as informational and nonfatal", async () => {
    await writeFile(
      join(workspace.workDir, "state.md"),
      "totally free-form notes\n",
    );
    const result = workspace.run("--strict");
    expect(result.code).toBe(0);
    expect(selected(result.findings, "layout")[0]?.severity).toBe("info");
    expect(
      result.findings.filter(({ severity }) => severity === "error"),
    ).toEqual([]);
    expect(
      new Set(
        result.findings
          .filter(({ severity }) => severity === "warning")
          .map(({ check }) => check),
      ),
    ).toEqual(new Set(["state-metadata"]));
  });
  it("exits nonzero in strict mode only", async () => {
    await workspace.writeState(row("AAA", "✓", "working"));
    expect(workspace.run().code).toBe(0);
    expect(workspace.run("--strict").code).toBe(1);
  });
  it("reports overview phase drift", async () => {
    await workspace.writeState(row("AAA"));
    await writeFile(
      join(workspace.root, ".state/overview.md"),
      "# Overview\n\n| Work ID | Lifecycle | Headline |\n| --- | --- | --- |\n| demo | completed | Demo. |\n",
    );
    expect(checks(runStateDir(workspace.root).findings)).toContain("overview");
  });
  it("only treats Streams rows as live overview rows", async () => {
    await workspace.writeState(row("AAA"));
    await writeFile(
      join(workspace.root, ".state/overview.md"),
      "# Overview\n\n## Awaiting you\n\n| Question | Stream | Waiting since |\n| --- | --- | --- |\n| Accept ADR-0008? | `demo` | 2026-07-22 |\n\n## Streams\n\n| Work ID | Phase | Headline |\n| --- | --- | --- |\n| demo | completed | Demo. |\n\n## Recently landed\n\n| Work ID | Landed | Locator |\n| --- | --- | --- |\n| gone-for-good | 2026-07-28 | PR #71 |\n",
    );
    const findings = selected(runStateDir(workspace.root).findings, "overview");
    expect(findings.map(({ work }) => work)).toEqual(["demo"]);
    expect(findings[0]?.message).toContain("completed");
  });
  it("warns once for every unparseable task row batch", async () => {
    await workspace.writeState(
      row("AAA") + "| BBB | - | planned | truncated row |\n| CCC | broken |\n",
    );
    const warnings = selected(workspace.run().findings, "layout").filter(
      ({ severity }) => severity === "warning",
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain("2 task row(s) unparseable");
  });
  it("offers journal compaction past 500 events", async () => {
    await workspace.writeState(row("AAA"));
    await writeJournal(
      workspace,
      Array.from(
        { length: 510 },
        (_, index) =>
          `- 2026-07-24T00:00:00Z PM@pm rev:1 status AAA: tick ${index}`,
      ),
    );
    expect(
      selected(workspace.run().findings, "journal").some(({ message }) =>
        message.includes("compacting"),
      ),
    ).toBe(true);
  });
  it("reports Written under drift as information", async () => {
    await workspace.writeState(row("AAA"), "- Written under: `00000000`\n");
    const findings = selected(workspace.run().findings, "written-under");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: "info" });
    expect(findings[0]?.message).toContain("written under contract 00000000");
  });

  it("still checks ADRs when state is absent", async () => {
    await writeEffectiveAdr(workspace.root);
    await rm(join(workspace.root, ".state"), { recursive: true });
    expect(runStateDir(workspace.root)).toMatchObject({
      code: 0,
      findings: [],
    });
  });
  it("validates ADR filenames and duplicate numeric identities", async () => {
    await writeEffectiveAdr(workspace.root);
    const decisions = join(workspace.root, "docs/architecture/decisions");
    await writeFile(
      join(decisions, "choice.md"),
      "# Invalid\n\n- Status: `Accepted`\n",
    );
    const archived = join(decisions, "superseded");
    await mkdir(archived);
    await writeFile(
      join(archived, "0001-old-choice.md"),
      "> **Status:** Superseded\n>\n> **Superseded by:** [ADR](../choice.md)\n>\n> **What changed:** Replaced.\n",
    );
    const findings = runStateDir(workspace.root).findings;
    expect(
      findings.some(
        ({ check, message }) =>
          check === "adr-layout" && message.includes("filename must use"),
      ),
    ).toBe(true);
    expect(
      findings.some(({ message }) =>
        message.includes("ADR numeric identity 0001 is duplicated"),
      ),
    ).toBe(true);
  });
  it("ignores ADR-like content inside HTML comments", async () => {
    await writeEffectiveAdr(
      workspace.root,
      "0001-choice.md",
      "<!-- - Status: Superseded; TODO <fill this> -->\n",
    );
    expect(
      selected(runStateDir(workspace.root).findings, "adr-integrity"),
    ).toEqual([]);
  });
  it("reports nested ADR files as layout errors", async () => {
    await writeEffectiveAdr(workspace.root);
    const nested = join(workspace.root, "docs/architecture/decisions/archive");
    await mkdir(nested);
    await writeFile(
      join(nested, "0002-nested.md"),
      "# Nested\n\n- Status: `Accepted`\n",
    );
    expect(checks(runStateDir(workspace.root).findings)).toContain(
      "adr-layout",
    );
  });
  it("does not let narrative ADR links satisfy the index", async () => {
    await writeEffectiveAdr(workspace.root);
    await writeFile(
      join(workspace.root, "docs/architecture/README.md"),
      "See [the choice](decisions/0001-choice.md).\n\n| Document | Status |\n| --- | --- |\n",
    );
    expect(checks(runStateDir(workspace.root).findings)).toContain("adr-index");
  });
  it("rejects absolute successor links", async () => {
    await writeEffectiveAdr(workspace.root, "0002-new-choice.md");
    const archived = join(
      workspace.root,
      "docs/architecture/decisions/superseded",
    );
    await mkdir(archived);
    await writeFile(
      join(archived, "0001-old-choice.md"),
      "> **Status:** Superseded\n>\n> **Superseded by:** [ADR](/docs/architecture/decisions/0002-new-choice.md)\n>\n> **What changed:** Replaced.\n",
    );
    expect(
      selected(runStateDir(workspace.root).findings, "adr-superseded").some(
        ({ message }) => message.includes("portable relative path"),
      ),
    ).toBe(true);
  });
  it("rejects placeholder archive summaries", async () => {
    await writeEffectiveAdr(workspace.root, "0002-new-choice.md");
    const archived = join(
      workspace.root,
      "docs/architecture/decisions/superseded",
    );
    await mkdir(archived);
    await writeFile(
      join(archived, "0001-old-choice.md"),
      "> **Status:** Superseded\n>\n> **Superseded by:** [ADR](../0002-new-choice.md)\n>\n> **What changed:** <State whether the decision changed>.\n",
    );
    expect(
      selected(runStateDir(workspace.root).findings, "adr-superseded").some(
        ({ message }) => message.includes("What changed"),
      ),
    ).toBe(true);
  });

  it("detects overview monolith content and missing siblings", async () => {
    await workspace.writeState(row("AAA"));
    await writeOverview(
      workspace.root,
      `# State overview\n\nThe tree carries three jj workspaces and one orphaned checkout.\n\n## Environment\n\nBranch protection is absent on main.\n\n## Streams\n\n${overviewRow()}`,
      false,
    );
    const findings = selected(
      runStateDir(workspace.root).findings,
      "overview-monolith",
    );
    const messages = findings.map(({ message }) => message).join(" ");
    for (const text of [
      "environment.md is missing",
      "traps.md is missing",
      "'Environment' is not one of",
      "preamble line(s)",
    ])
      expect(messages).toContain(text);
    expect(
      findings.every(
        ({ severity, fix }) => severity === "warning" && Boolean(fix),
      ),
    ).toBe(true);
  });
  it("accepts canonical overview sections", async () => {
    await workspace.writeState(row("AAA"));
    await writeOverview(
      workspace.root,
      `# State overview\n\n- Updated: \`2026-08-06\`\n\n## Goal\n\nShip.\n\n## Requirements\n\nNone.\n\n## Awaiting you\n\n## Streams\n\n${overviewRow()}\n## Recently landed\n`,
    );
    await writeJournal(workspace, [statusLine("2026-07-30", "working")]);
    expect(checks(runStateDir(workspace.root).findings)).not.toContain(
      "overview-monolith",
    );
  });
  it.each([
    ["initialized", "phase `planned`"],
    ["active", "phase `working`"],
    ["blocked", "`Blocked on:"],
    ["retiring", "phase `completed`"],
  ])(
    "reports retired lifecycle %s as informational drift",
    async (lifecycle, replacement) => {
      await workspace.writeState(
        row("AAA", "✓", "done", "—", "yes", "Merged in PR #42."),
        "",
        lifecycle,
      );
      const result = workspace.run("--strict");
      const findings = selected(result.findings, "lifecycle-vocabulary");
      expect(result.code).toBe(0);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ severity: "info" });
      expect(findings[0]?.message).toContain(replacement);
    },
  );
  it.each([
    ["- Blocked on:\n", "present but empty"],
    ["- Blocked on: ``\n", "present but empty"],
    ["- Blocked on: `-`\n", "names no blocker"],
    ["- Blocked on: `none`\n", "names no blocker"],
    ["- Blocked on: `tbd`\n", "names no blocker"],
    ["- Blocked on: `running`\n", "retired motion vocabulary"],
    ["- Blocked on: `idle 9d`\n", "retired motion vocabulary"],
    ["- Blocked on: `waiting: operator`\n", "retired motion vocabulary"],
  ])("validates Blocked on value %#", async (metadata, expected) => {
    await workspace.writeState(row("AAA"), metadata);
    const findings = selected(workspace.run().findings, "blocked-on");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: "warning" });
    expect(findings[0]?.message).toContain(expected);
  });
  it("accepts a named blocker", async () => {
    await workspace.writeState(
      row("AAA"),
      "- Blocked on: `an operator ruling`\n",
    );
    expect(checks(workspace.run().findings)).not.toContain("blocked-on");
  });
  it("distinguishes absent Blocked on from stale unknown", async () => {
    const stale = dateDaysAgo(9);
    await workspace.writeState(row("AAA"));
    await writeJournal(workspace, [statusLine(stale, "working")]);
    expect(checks(workspace.run().findings)).not.toContain("blocked-on");
    await workspace.writeState(row("AAA"), "- Blocked on: `unknown`\n");
    const findings = selected(workspace.run().findings, "blocked-on");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(stale);
    expect(findings[0]?.message).toContain("7-day window");
  });
  it("allows fresh unknown blockers but rejects none", async () => {
    const today = dateDaysAgo(0);
    await workspace.writeState(row("AAA"), "- Blocked on: `unknown`\n");
    await writeJournal(workspace, [statusLine(today, "working")]);
    expect(checks(workspace.run().findings)).not.toContain("blocked-on");
    await workspace.writeState(row("AAA"), "- Blocked on: `none`\n");
    expect(checks(workspace.run().findings)).toContain("blocked-on");
  });
  it("reports an undatable unknown blocker", async () => {
    await workspace.writeState(row("AAA"), "- Blocked on: `unknown`\n");
    let findings = selected(workspace.run().findings, "blocked-on");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("no derivable last progress");
    await writeJournal(workspace, [statusLine(dateDaysAgo(0), "working")]);
    findings = selected(workspace.run().findings, "blocked-on");
    expect(findings).toEqual([]);
  });
  it("reports packed Blocked on metadata", async () => {
    await workspace.writeState(
      row("AAA"),
      "- Blocked on: `operator` · Owner: `PM`\n",
    );
    const findings = selected(workspace.run().findings, "blocked-on");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(
      "does not parse as a single-value metadata field",
    );
    expect(findings[0]?.fix).toBeTruthy();
  });
  it("detects both migrations into Blocked on", async () => {
    await workspace.writeState(row("AAA"), "", "blocked");
    expect(
      selected(workspace.run().findings, "lifecycle-vocabulary")[0]?.message,
    ).toContain("`Blocked on:");
    await workspace.writeState(row("AAA"), "- Motion: `waiting: operator`\n");
    expect(
      selected(workspace.run().findings, "motion-vocabulary")[0]?.message,
    ).toContain("`waiting: X` → `Blocked on: X`");
    await writeFile(
      join(workspace.workDir, "state.md"),
      `# Work state\n\n- Work ID: \`demo\`\n- Phase: \`working\` · Motion: \`idle 14d\`\n\n## Tasks\n\n${header}${row("AAA")}`,
    );
    expect(checks(workspace.run().findings)).toContain("motion-vocabulary");
  });

  it("requires Last progress and journal backing", async () => {
    await workspace.writeState(row("AAA"));
    await writeJournal(workspace, [statusLine("2026-07-30", "working")]);
    await writeOverview(
      workspace.root,
      "# State overview\n\n## Streams\n\n| Work ID | Phase | Headline |\n| --- | --- | --- |\n| demo | working | Demo. |\n",
    );
    expect(
      selected(runStateDir(workspace.root).findings, "last-progress")[0]
        ?.message,
    ).toContain("no `Last progress` column");
    await writeOverview(
      workspace.root,
      `# State overview\n\n## Streams\n\n${overviewRow({ progress: "2026-08-06 (0d)" })}`,
    );
    expect(
      selected(runStateDir(workspace.root).findings, "last-progress")[0]
        ?.message,
    ).toContain("does not match the journal evidence dated 2026-07-30");
  });
  it("rejects a Last progress value without a date", async () => {
    await workspace.writeState(row("AAA"));
    await writeJournal(workspace, [statusLine("2026-07-30", "working")]);
    await writeOverview(
      workspace.root,
      `# State overview\n\n## Streams\n\n${overviewRow({ progress: "recent" })}`,
    );
    expect(
      selected(runStateDir(workspace.root).findings, "last-progress").some(
        ({ message }) => message.includes("carries no date"),
      ),
    ).toBe(true);
  });
  it("does not treat a backfilled journal tail as progress", async () => {
    await workspace.writeState(row("AAA"));
    await writeJournal(workspace, [
      statusLine("2026-07-20", "working"),
      statusLine("2026-08-06", "initialized"),
    ]);
    expect(
      selected(workspace.run().findings, "journal-freshness")[0]?.message,
    ).toContain("a phase the stream has already left");
  });
  it("reports a journal stub older than state", async () => {
    await workspace.writeState(
      row("AAA", "✓", "done", "—", "yes", "Merged."),
      "- Merge evidence: `PR #42 merged 2026-07-28`\n",
      "completed",
    );
    await writeJournal(workspace, [statusLine("2026-07-27", "reviewing")]);
    const finding = selected(workspace.run().findings, "journal-freshness")[0];
    expect(finding?.message).toContain("the journal is a stub");
    expect(finding?.fix).toContain("(from state.md)");
  });
  it("requires state fallbacks to be marked", async () => {
    await workspace.writeState(
      row("AAA", "✓", "done", "—", "yes", "Merged."),
      "- Merge evidence: `PR #42 merged 2026-07-28`\n",
      "completed",
    );
    await writeJournal(workspace, [statusLine("2026-07-27", "reviewing")]);
    await writeOverview(
      workspace.root,
      `# State overview\n\n## Streams\n\n${overviewRow({ phase: "completed", progress: "2026-07-28 (9d)" })}`,
    );
    expect(
      selected(runStateDir(workspace.root).findings, "last-progress")[0]
        ?.message,
    ).toContain("does not say so");
    await writeOverview(
      workspace.root,
      `# State overview\n\n## Streams\n\n${overviewRow({ phase: "completed", progress: "2026-07-28 (from state.md)" })}`,
    );
    expect(checks(runStateDir(workspace.root).findings)).not.toContain(
      "last-progress",
    );
  });
  it("follows a segmented journal to its newest-numbered segment", async () => {
    await workspace.writeState(row("AAA"));
    await writeJournal(workspace, [statusLine("2026-08-06", "working")]);
    await writeJournal(
      workspace,
      [statusLine("2026-08-04", "working")],
      "07-journal-late.md",
    );
    const segment = selected(workspace.run().findings, "journal-segments")[0];
    expect(segment?.message).toContain("07-journal-late.md ends at 2026-08-04");
    expect(segment?.message).toContain("false freshness");
    await writeOverview(
      workspace.root,
      `# State overview\n\n## Streams\n\n${overviewRow({ progress: "2026-08-06 (0d)" })}`,
    );
    expect(
      selected(runStateDir(workspace.root).findings, "last-progress").some(
        ({ message }) => message.includes("2026-08-04"),
      ),
    ).toBe(true);
  });
  it.each([
    ["../trees/demo", "warning", "neither an absolute path nor `-`"],
    ["/Users/dev/tree ⚠ inferred", "error", "manufactures a fact"],
  ])("validates overview location %s", async (location, severity, message) => {
    await workspace.writeState(row("AAA"));
    await writeJournal(workspace, [statusLine("2026-07-30", "working")]);
    await writeOverview(
      workspace.root,
      `# State overview\n\n## Streams\n\n${overviewRow({ location })}`,
    );
    const findings = selected(runStateDir(workspace.root).findings, "location");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity });
    expect(findings[0]?.message).toContain(message);
  });
  it("accepts a dash location", async () => {
    await workspace.writeState(row("AAA"));
    await writeJournal(workspace, [statusLine("2026-07-30", "working")]);
    await writeOverview(
      workspace.root,
      `# State overview\n\n## Streams\n\n${overviewRow({ location: "-" })}`,
    );
    expect(checks(runStateDir(workspace.root).findings)).not.toContain(
      "location",
    );
  });
  it("reports exact Next action budget overflow", async () => {
    await workspace.writeState(row("AAA"));
    await writeJournal(workspace, [statusLine("2026-07-30", "working")]);
    await writeOverview(
      workspace.root,
      `# State overview\n\n## Streams\n\n${overviewRow({ nextAction: "x".repeat(260) })}`,
    );
    expect(
      selected(runStateDir(workspace.root).findings, "overview-budget")[0]
        ?.message,
    ).toContain("260 chars, over the 200-char budget by 60");
  });
  it("requires overdue completed streams to leave works", async () => {
    await workspace.writeState(
      row("AAA", "✓", "done", "—", "yes", "Merged."),
      "- Merge evidence: `PR #42 merged`\n",
      "completed",
    );
    await writeJournal(workspace, [statusLine(dateDaysAgo(9), "completed")]);
    const finding = selected(workspace.run().findings, "retention")[0];
    expect(finding?.message).toContain("past the 3-day window");
    expect(finding?.fix).toContain(
      "Move works/<work-id>/ to .state/archive/<work-id>/ first, then drop the overview row",
    );
  });
  it("leaves recently completed streams alone", async () => {
    await workspace.writeState(
      row("AAA", "✓", "done", "—", "yes", "Merged."),
      "- Merge evidence: `PR #42 merged`\n",
      "completed",
    );
    await writeJournal(workspace, [statusLine(dateDaysAgo(1), "completed")]);
    expect(checks(workspace.run().findings)).not.toContain("retention");
  });

  it.each([
    ["20260727-feat-trading-venue-routing-v5cfxb", "carries a date prefix"],
    ["feat-trading-venue-routing", "carries a type prefix"],
    ["markets-and-symbols-v5cfxb", "random suffix"],
    [
      "a-work-id-that-runs-past-the-thirty-two-byte-bound",
      "over the 32-byte bound",
    ],
    ["Markets_And_Symbols", "not a plain lowercase-hyphen slug"],
  ])(
    "reports nonconforming work ID %s without renaming",
    async (workId, problem) => {
      const root = await mkdtemp(join(tmpdir(), "state-doctor-id-"));
      try {
        const workDir = join(root, ".state/works", workId);
        await mkdir(join(workDir, "state"), { recursive: true });
        await writeFile(
          join(workDir, "goal.md"),
          "# Charter\n\n- Charter: `approved`\n",
        );
        await writeFile(
          join(workDir, "state.md"),
          `# Work state\n\n- Work ID: \`${workId}\`\n- Lifecycle status: \`working\`\n`,
        );
        const findings = selected(runStateDir(root).findings, "work-id-naming");
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ severity: "info" });
        expect(findings[0]?.message).toContain(problem);
        expect(findings[0]?.message).toContain("never renamed");
      } finally {
        await rm(root, { recursive: true });
      }
    },
  );
  it("accepts a conforming work ID", async () => {
    await workspace.writeState(row("AAA"));
    expect(checks(workspace.run().findings)).not.toContain("work-id-naming");
  });
  it("distinguishes charter provenance drift from missing charter", async () => {
    await workspace.writeState(row("AAA"));
    await workspace.writeCharter("reconstructed");
    expect(checks(workspace.run().findings)).not.toContain(
      "charter-provenance",
    );
    await writeFile(
      join(workspace.workDir, "goal.md"),
      "# Charter\n\n- Charter revision: `1`\n",
    );
    let findings = selected(workspace.run().findings, "charter-provenance");
    expect(findings[0]).toMatchObject({ severity: "warning" });
    expect(findings[0]?.message).toContain("approved | reconstructed | absent");
    await workspace.writeCharter("-");
    const result = workspace.run("--strict");
    findings = selected(result.findings, "charter-provenance");
    expect(result.code).toBe(1);
    expect(findings[0]).toMatchObject({ severity: "error" });
    expect(findings[0]?.message).toContain("no goal.md");
    expect(findings[0]?.fix).toContain("reconstructed");
  });
  it("warns for unknown charter provenance", async () => {
    await workspace.writeState(row("AAA"));
    await workspace.writeCharter("assumed");
    expect(
      selected(workspace.run().findings, "charter-provenance"),
    ).toMatchObject([{ severity: "warning" }]);
  });
  it("rejects unowned completion debt", async () => {
    await workspace.writeState(
      row("AAA", "✓", "done", "—", "yes", "Merged."),
      "- Merge evidence: `PR #42 merged`\n",
      "completed",
    );
    const path = join(workspace.workDir, "state.md");
    await writeFile(
      path,
      `${await readFile(path, "utf8")}\n## Completion receipt\n\n- Merge evidence: PR #42 merged.\n- Outlives me:\n  - \`U1\` unresolved coverage gap. owner: -\n  - \`U3\` deferred backfill. owner: Raj\n`,
    );
    const result = workspace.run("--strict");
    const finding = selected(result.findings, "outlives-me")[0];
    expect(result.code).toBe(1);
    expect(finding).toMatchObject({ severity: "error" });
    expect(finding?.message).toContain("`U1`");
    expect(finding?.fix).toContain(".state/backlog.md");
  });
  it("accepts owned debt and ignores debt on live streams", async () => {
    const receipt =
      "\n## Completion receipt\n\n- Merge evidence: PR #42 merged.\n- Outlives me:\n  - `U3` deferred backfill. owner: Raj\n";
    await workspace.writeState(
      row("AAA", "✓", "done", "—", "yes", "Merged."),
      "- Merge evidence: `PR #42 merged`\n",
      "completed",
    );
    let path = join(workspace.workDir, "state.md");
    await writeFile(path, `${await readFile(path, "utf8")}${receipt}`);
    expect(checks(workspace.run().findings)).not.toContain("outlives-me");
    await workspace.writeState(row("AAA"));
    path = join(workspace.workDir, "state.md");
    await writeFile(
      path,
      `${await readFile(path, "utf8")}\n## Completion receipt\n\n- Outlives me: \`U1\` gap. owner: -\n`,
    );
    expect(checks(workspace.run().findings)).not.toContain("outlives-me");
  });
  it("finds legacy unowned debt outside receipts", async () => {
    await workspace.writeState(
      row("AAA", "✓", "done", "—", "yes", "Merged."),
      "- Merge evidence: `PR #42 merged`\n- Note: three deferred follow-ups, owned by nobody yet\n",
      "completed",
    );
    expect(
      selected(workspace.run().findings, "outlives-me")[0]?.message,
    ).toContain("deferred follow-ups");
  });
  it("rejects completed without merge evidence", async () => {
    await workspace.writeState(
      row("AAA", "✓", "done", "—", "yes", "Landed as 4f9a2b1."),
      "",
      "completed",
    );
    const result = workspace.run("--strict");
    const finding = selected(result.findings, "merge-evidence")[0];
    expect(result.code).toBe(1);
    expect(finding).toMatchObject({ severity: "error" });
    expect(finding?.message).toContain(
      "a bare commit hash is not merge evidence",
    );
    expect(finding?.fix).toContain("reviewing");
  });
  it.each([
    "Merged in PR #42.",
    "Branch observed merged into main.",
    "See /pull/42.",
  ])("accepts merge evidence: %s", async (evidence) => {
    await workspace.writeState(
      row("AAA", "✓", "done", "—", "yes", evidence),
      "",
      "completed",
    );
    expect(checks(workspace.run().findings)).not.toContain("merge-evidence");
  });
  it("conditions absent charter severity on phase", async () => {
    await workspace.writeCharter("absent");
    await workspace.writeState(row("AAA"), "", "planned");
    expect(
      selected(workspace.run().findings, "charter-provenance")[0],
    ).toMatchObject({ severity: "info" });
    for (const phase of ["working", "reviewing"]) {
      await workspace.writeState(row("AAA"), "", phase);
      const finding = selected(
        workspace.run().findings,
        "charter-provenance",
      )[0];
      expect(finding).toMatchObject({ severity: "warning" });
      expect(finding?.message).toContain("no recorded success criteria");
    }
  });
  it("holds completed streams with a named blocker", async () => {
    await workspace.writeState(
      row("AAA", "✓", "done", "—", "yes", "Merged."),
      "- Merge evidence: `PR #42 merged`\n- Blocked on: `an operator ruling on D4`\n",
      "completed",
    );
    await writeJournal(workspace, [statusLine(dateDaysAgo(9), "completed")]);
    const finding = selected(workspace.run().findings, "retention")[0];
    expect(finding).toMatchObject({ severity: "info" });
    expect(finding?.message).toContain("an operator ruling on D4");
    expect(finding?.message).toContain("9d ago");
    expect(finding?.message).toContain("Awaiting you");
  });
  it.each(["", "- Blocked on: `unknown`\n"])(
    "warns overdue completed streams without a named blocker",
    async (blocker) => {
      await workspace.writeState(
        row("AAA", "✓", "done", "—", "yes", "Merged."),
        `- Merge evidence: \`PR #42 merged\`\n${blocker}`,
        "completed",
      );
      await writeJournal(workspace, [statusLine(dateDaysAgo(9), "completed")]);
      const findings = selected(workspace.run().findings, "retention");
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ severity: "warning" });
      expect(findings[0]?.message).toContain("past the 3-day window");
    },
  );
  it("reports packed phase metadata instead of false-clearing gated checks", async () => {
    await writeFile(
      join(workspace.workDir, "state.md"),
      `# Work state\n\n- Work ID: \`demo\`\n- Phase: \`completed\` · Blocked on: \`an operator ruling\`\n\n## Tasks\n\n${header}${row("AAA")}`,
    );
    const findings = workspace.run().findings;
    const unreadable = selected(findings, "state-metadata");
    expect(unreadable).toHaveLength(1);
    expect(unreadable[0]).toMatchObject({ severity: "warning" });
    expect(unreadable[0]?.message).toContain(
      "does not parse as a single-value metadata field",
    );
    expect(unreadable[0]?.message).toContain("reports a clean zero");
    for (const silenced of [
      "retention",
      "merge-evidence",
      "blocked-on",
      "outlives-me",
    ]) {
      expect(unreadable[0]?.message).toContain(silenced);
      expect(checks(findings)).not.toContain(silenced);
    }
  });
  it("distinguishes absent phase from unparseable phase", async () => {
    await writeFile(
      join(workspace.workDir, "state.md"),
      `# Work state\n\n- Work ID: \`demo\`\n\n## Tasks\n\n${header}${row("AAA")}`,
    );
    const findings = selected(workspace.run().findings, "state-metadata");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(
      "neither `Phase` nor `Lifecycle status`",
    );
  });
  it("accepts readable lifecycle and Phase fields", async () => {
    await workspace.writeState(row("AAA"), "- Blocked on: `an operator`\n");
    expect(checks(workspace.run().findings)).not.toContain("state-metadata");
    await writeFile(
      join(workspace.workDir, "state.md"),
      `# Work state\n\n- Work ID: \`demo\`\n- Phase: \`working\`\n- Blocked on: \`an operator\`\n\n## Tasks\n\n${header}${row("AAA")}`,
    );
    expect(checks(workspace.run().findings)).not.toContain("state-metadata");
  });
});

function migrationTableCheckIds(skillText: string): Set<string> {
  const section =
    skillText.split("## Structure migration", 2)[1]?.split(/\r?\n/) ?? [];
  const ids = new Set<string>();
  let delimiter = false;
  let rows = false;
  for (const line of section) {
    if (/^\|\s*-{3,}/.test(line)) {
      delimiter = true;
      continue;
    }
    if (!line.startsWith("|")) {
      if (rows) break;
      continue;
    }
    if (delimiter) {
      rows = true;
      const match = /^\|\s*`([a-z0-9-]+)`/.exec(line);
      if (match) ids.add(match[1]);
    }
  }
  return ids;
}
function unemittableCheckIds(
  skillText: string,
  doctorText: string,
): Set<string> {
  const emitted = new Set(
    [
      ...doctorText.matchAll(
        /report\.(?:info|warning|error)\(\s*[^,()]+,\s*"([a-z0-9][a-z0-9-]*)"/g,
      ),
    ].map((match) => match[1]),
  );
  return new Set(
    [...migrationTableCheckIds(skillText)].filter((id) => !emitted.has(id)),
  );
}

describe("doctor skill migration table extraction", () => {
  it("maps every migration offer to an emitted check", async () => {
    const [skillText, doctorText] = await Promise.all([
      readFile(doctorSkill, "utf8"),
      readFile(doctor, "utf8"),
    ]);
    const ids = migrationTableCheckIds(skillText);
    expect(ids.size).toBeGreaterThan(1);
    expect(ids).not.toContain("check");
    expect(unemittableCheckIds(skillText, doctorText)).toEqual(new Set());
  });
  it("catches an ID no check emits", async () => {
    const doctorText = await readFile(doctor, "utf8");
    const fabricated =
      "## Structure migration\n\n| `check` | Offer |\n| --- | --- |\n| `retention` | A real one. |\n| `no-such-check` | An offer for a finding nobody emits. |\n";
    expect(migrationTableCheckIds(fabricated)).toEqual(
      new Set(["retention", "no-such-check"]),
    );
    expect(unemittableCheckIds(fabricated, doctorText)).toEqual(
      new Set(["no-such-check"]),
    );
  });
});
