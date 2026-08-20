import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const plugin = resolve(here, "../..");
const direction = resolve(here, "subagent-handover.md");
const fields = ["Goal", "Requirements", "Boundary", "Directions", "Context"];

function document(path: string): string {
  return readFileSync(path, "utf8");
}
function blocks(source: string): string[] {
  return [...source.matchAll(/```text\n([\s\S]*?)```/g)].map(
    (match) => match[1]!,
  );
}
function dedent(source: string): string {
  const lines = source.replace(/^\n+|\n+$/g, "").split("\n");
  const widths = lines
    .filter((line) => line.trim())
    .map((line) => /^\s*/.exec(line)![0].length);
  const width = Math.min(...widths);
  return lines.map((line) => line.slice(width)).join("\n");
}
function topLevelFields(prompt: string): string[] {
  const normalized = dedent(prompt).replace(/```[\s\S]*?```/g, "");
  const index = normalized.indexOf("Context:");
  expect(index).toBeGreaterThanOrEqual(0);
  return [
    ...[...normalized.slice(0, index).matchAll(/^([A-Z][A-Za-z ]+):/gm)].map(
      (match) => match[1]!,
    ),
    "Context",
  ];
}
function firstLine(prompt: string): string {
  return dedent(prompt).trim().split("\n")[0]!;
}
function markdownFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    return entry.isDirectory()
      ? markdownFiles(path)
      : path.endsWith(".md")
        ? [path]
        : [];
  });
}

describe("subagent handover contract", () => {
  it("owns the canonical field names and order", () => {
    const source = document(direction);
    const prompt = blocks(source)[0]!;
    expect(source).toContain("[naming.md](../naming.md)");
    expect(firstLine(prompt)).toBe("<stable-reference>");
    expect(topLevelFields(prompt)).toEqual(fields);
  });

  it("covers extensible context items and compressed paths", () => {
    const source = document(direction);
    const [, shared, subsection] = blocks(source);
    for (const phrase of [
      "authors may add subsections",
      "`Decisions` and `Recent work` may each contain multiple",
      "Each item summary contains 1–19 words",
      "Omit an empty Context subsection",
      "Items without a shared container carry absolute paths",
    ])
      expect(source).toContain(phrase);
    expect(shared).toContain("Path: /absolute/path/to/work");
    expect(shared!.match(/decisions\//g)).toHaveLength(2);
    expect(shared!.match(/state\//g)).toHaveLength(1);
    expect(shared!.match(/reviews\//g)).toHaveLength(1);
    expect(subsection).toContain("Path: /absolute/path/to/work/decisions");
    expect(subsection).toContain("— event-model.md");
    expect(subsection).toContain("— import-identifiers.md");
    expect(subsection).toContain("— /another/path/journal.md");
    for (const [, summary] of source.matchAll(/^- (.*?) — /gm)) {
      const count = summary!.match(/\b[\w'-]+\b/g)?.length ?? 0;
      expect(count, summary).toBeGreaterThanOrEqual(1);
      expect(count, summary).toBeLessThanOrEqual(19);
    }
  });

  it("is referenced by generic authorities and dispatching skills", () => {
    for (const relative of [
      "README.md",
      "references/orchestration.md",
      "references/team-lifecycle.md",
      "references/scripted-execution.md",
      "hooks/MAINAGENT.md",
      "hooks/SUBAGENT.md",
      "skills/takeover/SKILL.md",
      "skills/handoff/SKILL.md",
      "skills/handover/references/decision-consultation.md",
      "skills/deep-research/SKILL.md",
      "skills/deep-research/references/claim-verification.md",
      "skills/autoresearch/SKILL.md",
      "skills/autoresearch/references/loop-workflow.md",
      "skills/autoresearch/references/eval-backends.md",
    ])
      expect(document(resolve(plugin, relative)), relative).toContain(
        "subagent-handover.md",
      );
  });

  it("keeps autoresearch first prompts on the canonical shape", () => {
    const loop = document(
      resolve(plugin, "skills/autoresearch/references/loop-workflow.md"),
    );
    const evaluator = document(
      resolve(plugin, "skills/autoresearch/references/eval-backends.md"),
    );
    const prompts = [...loop.matchAll(/^    >>>\n([\s\S]*?)^    <<<$/gm)].map(
      (match) => match[1]!,
    );
    expect(prompts).toHaveLength(3);
    for (const prompt of [...prompts, blocks(evaluator)[0]!])
      expect(topLevelFields(prompt)).toEqual(fields);
  });

  it("keeps shipped first prompts within item and shared-path rules", () => {
    const workflow = document(
      resolve(plugin, "references/scripted-execution.md"),
    );
    const loop = document(
      resolve(plugin, "skills/autoresearch/references/loop-workflow.md"),
    );
    const evaluator = document(
      resolve(plugin, "skills/autoresearch/references/eval-backends.md"),
    );
    const workflowPrompts = [
      ...workflow.matchAll(/agent\(`([\s\S]*?)`, \{/g),
    ].map((match) => match[1]!);
    const rolePrompts = [
      ...loop.matchAll(/^    >>>\n([\s\S]*?)^    <<</gm),
    ].map((match) => match[1]!);
    expect(workflowPrompts).toHaveLength(2);
    for (const prompt of [
      ...workflowPrompts,
      ...rolePrompts,
      blocks(evaluator)[0]!,
    ]) {
      expect(["${args.work_id}", "<work-id>"]).toContain(firstLine(prompt));
      expect(topLevelFields(prompt)).toEqual(fields);
      const context = dedent(prompt).split("Context:", 2)[1] ?? "";
      const items = [...context.matchAll(/^- (.*?) — (.+)$/gm)];
      for (const [, summary] of items) {
        expect(summary).not.toContain("${");
        const count = summary!.match(/\b[\w'-]+\b/g)?.length ?? 0;
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(19);
      }
      if (items.length >= 2) {
        expect(context).toMatch(/^Path: (?:\/|<absolute )/m);
        for (const item of items)
          expect(item[2]).not.toMatch(/^(?:\/|<absolute )/);
      }
    }
  });

  it("uses one scripted-execution intelligence option contract", () => {
    const adapter = document(
      resolve(plugin, "references/scripted-execution.md"),
    );
    const loop = document(
      resolve(plugin, "skills/autoresearch/references/loop-workflow.md"),
    );
    expect(adapter).toContain("agent(task, opts?)");
    expect(adapter).toContain("`intelligence` (a concrete mapping level");
    expect(adapter).toContain(
      "adapter applies only that level's native model and effort projection",
    );
    expect(loop).not.toContain("export default async function");
    expect(loop).toContain(
      "const { brief, run_dir, baseline_score, resume_state, seed } = args;",
    );
    expect(loop).not.toContain("agent({ intelligence");
    expect(loop.match(/\{ intelligence:/g)).toHaveLength(4);
    expect(loop).toContain("slots.map((slot) =>\n      () => agent(");
    expect(loop).toContain("candidates.map((c) =>\n          () => agent(");
    expect(loop).toContain(".map((t) => () => agent(");
  });

  it("removes legacy prompt shapes and uses runtime hook paths", () => {
    for (const path of markdownFiles(plugin)) {
      if (path === direction) continue;
      for (const phrase of [
        "mission capsule",
        "continuation capsule",
        "The first message names the objective",
      ])
        expect(document(path), `${phrase} remains in ${path}`).not.toContain(
          phrase,
        );
    }
    for (const name of ["MAINAGENT.md", "SUBAGENT.md"])
      expect(document(resolve(plugin, "hooks", name))).toContain(
        "{{PLUGIN_DIR}}/references/directions/subagent-handover.md",
      );
  });
});
