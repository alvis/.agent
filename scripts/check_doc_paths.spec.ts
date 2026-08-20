import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  blockMentions,
  blockReferenceDefinitions,
  check,
  closedCodeSpans,
  contentBlocks,
  inlineLinkCandidates,
  maskSpans,
  mentions,
  selectedLinkCandidates,
} from "./check_doc_paths.ts";
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  writeFixture,
} from "./test-support.ts";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

interface FixtureCase {
  readonly name: string;
  readonly documents: Readonly<Record<string, string>>;
  readonly existing?: readonly string[];
  readonly expected: readonly string[];
}

async function createRepository(): Promise<string> {
  const root = await createTemporaryDirectory("doc-paths-");
  await mkdir(resolve(root, "plugins"), { recursive: true });
  return root;
}

async function runFixture(testCase: FixtureCase): Promise<void> {
  const root = await createRepository();
  try {
    for (const path of testCase.existing ?? []) await writeFixture(root, path, "x");
    for (const [path, content] of Object.entries(testCase.documents)) {
      await writeFixture(root, path, content);
    }
    expect(check(root)).toEqual(testCase.expected);
  } finally {
    await removeTemporaryDirectory(root);
  }
}

const fixtureCases: readonly FixtureCase[] = [
  { name: "resolves relative paths from the containing file", existing: ["plugins/alpha/references/target.md"], documents: { "plugins/alpha/references/doc.md": "[target](target.md) `references/target.md`" }, expected: [] },
  { name: "resolves paths from ancestors and the plugin root", existing: ["plugins/alpha/skills/demo/scripts/tool.py", "plugins/alpha/references/shared.md"], documents: { "plugins/alpha/skills/demo/references/doc.md": "`scripts/tool.py` `references/shared.md`" }, expected: [] },
  { name: "reports a missing target with its physical line", documents: { "plugins/alpha/references/doc.md": "fine\n[gone](../references/missing.md)\n" }, expected: ["plugins/alpha/references/doc.md:2 → ../references/missing.md"] },
  { name: "substitutes the owning plugin directory", existing: ["plugins/alpha/references/hook.md"], documents: { "plugins/alpha/hooks/ALLAGENT.md": "`{{PLUGIN_DIR}}/references/hook.md` `{{PLUGIN_DIR}}/references/gone.md`" }, expected: ["plugins/alpha/hooks/ALLAGENT.md:1 → {{PLUGIN_DIR}}/references/gone.md"] },
  { name: "skips fenced code", documents: { "plugins/alpha/doc.md": "```bash\n[x](missing/gone.md)\n```\n" }, expected: [] },
  { name: "skips runtime, placeholder, bare, and absolute mentions", documents: { "plugins/alpha/doc.md": "`.state/works/x/goal.md` `docs/a.md` `.claude/a.md` `state/a.md` `reviews/a.md` `.github/PULL_REQUEST_TEMPLATE.md` `plugins/<p>/skills/<name>/SKILL.md` `references/{{SLUG}}.md` `operations/{name}.ts` `SKILL.md` `/usr/tool.sh`" }, expected: [] },
  { name: "skips illustrative roots and example documents", documents: { "plugins/alpha/doc.md": "`services/user.ts`", "plugins/alpha/references/plan.template.md": "[x](missing/a.md)", "plugins/alpha/references/README.example.cli.md": "[x](missing/b.md)" }, expected: [] },
  { name: "skips relative paths into an illustrative tree", documents: { "plugins/alpha/rules/doc.md": "`../components/item.ts`" }, expected: [] },
  { name: "reports missing non-illustrative directories", documents: { "plugins/alpha/doc.md": "`renamed-dir/tool.py`" }, expected: ["plugins/alpha/doc.md:1 → renamed-dir/tool.py"] },
  ...["operations", "types", "utilities"].map((directory) => ({ name: `reports removed example root ${directory}`, documents: { "plugins/alpha/doc.md": `\`${directory}/missing.py\`` }, expected: [`plugins/alpha/doc.md:1 → ${directory}/missing.py`] })),
  ...["config/tool.toml", "config/pytest.ini", "scripts/check-docs", "plugins/alpha/unknown/"].map((path) => ({ name: `reports missing backticked path ${path}`, documents: { "guides/setup.md": `\`${path}\`` }, expected: [`guides/setup.md:1 → ${path}`] })),
  { name: "resolves extensionless files and directories", existing: ["scripts/check-docs", "plugins/alpha/active/item"], documents: { "guides/setup.md": "`scripts/check-docs` `plugins/alpha/active/`" }, expected: [] },
  { name: "skips generic slash syntax", documents: { "guides/setup.md": "`feat/work-id` `testing/write` `N/A`" }, expected: [] },
  { name: "skips bare artifact directory categories", documents: { "guides/setup.md": "`assets/` `references/`" }, expected: [] },
  { name: "checks this repository's github directory", existing: [".github/workflows/ci.yml"], documents: { "AGENTS.md": "`.github/workflows/ci.yml` `.github/workflows/gone.yml`" }, expected: ["AGENTS.md:1 → .github/workflows/gone.yml"] },
  { name: "honors the per-line ignore marker", documents: { "plugins/alpha/doc.md": "`fake/a.md` <!-- doc-path-gate: ignore -->\n`fake/b.md`" }, expected: ["plugins/alpha/doc.md:2 → fake/b.md"] },
  { name: "treats inline link labels as display prose", existing: ["plugins/alpha/references/target.md"], documents: { "plugins/alpha/doc.md": "[\`inner/module.py\`](references/target.md)" }, expected: [] },
  ...[["[full text][full]", "full", "\"title\""], ["[collapsed][]", "collapsed", "'title'"], ["[shortcut]", "shortcut", "(title)"]].map(([usage, label, title]) => ({ name: `resolves ${usage} reference links`, existing: ["plugins/alpha/references/target.md"], documents: { "plugins/alpha/doc.md": `${usage}\n[${label}]: references/target.md ${title}\n[missing]\n[missing]: references/missing.md ${title}\n` }, expected: ["plugins/alpha/doc.md:4 → references/missing.md"] })),
  { name: "keeps an unbound path-shaped code label as a claim", documents: { "plugins/alpha/doc.md": "[\`missing/display.py\`]" }, expected: ["plugins/alpha/doc.md:1 → missing/display.py"] },
  ...["\"double quoted\"", "'single quoted'", "(parenthesized)"].map((title) => ({ name: `parses inline title ${title}`, existing: ["plugins/alpha/references/target.md"], documents: { "plugins/alpha/doc.md": `[ok](references/target.md ${title}) [bad](references/missing.md ${title})` }, expected: ["plugins/alpha/doc.md:1 → references/missing.md"] })),
  { name: "supports nested brackets in link text", existing: ["plugins/alpha/references/target.md"], documents: { "plugins/alpha/doc.md": "[valid [nested] text](references/target.md)\ntext\n[missing [nested] text](references/missing.md)" }, expected: ["plugins/alpha/doc.md:3 → references/missing.md"] },
  { name: "supports escaped brackets in link text", existing: ["plugins/alpha/references/target.md"], documents: { "plugins/alpha/doc.md": "[valid \\] text](references/target.md)\ntext\n[missing \\] text](references/missing.md)" }, expected: ["plugins/alpha/doc.md:3 → references/missing.md"] },
  { name: "ignores brackets inside closed code spans", existing: ["plugins/alpha/references/target.md"], documents: { "plugins/alpha/doc.md": "[label \`[\` text](references/target.md) [label \`]\` text](references/missing.md)" }, expected: ["plugins/alpha/doc.md:1 → references/missing.md"] },
  { name: "treats link-shaped text in a closed code span as inert", existing: ["plugins/alpha/references/existing.md"], documents: { "plugins/alpha/doc.md": "[\`[inner](references/missing.md)\`](references/existing.md)" }, expected: [] },
  { name: "does not let an escaped backtick hide a link", documents: { "plugins/alpha/doc.md": "\\\`[inner](references/missing.md)\`" }, expected: ["plugins/alpha/doc.md:1 → references/missing.md"] },
  { name: "selects a missing valid inner link over its outer link", existing: ["plugins/alpha/references/outer.md"], documents: { "plugins/alpha/doc.md": "[outer [inner](references/missing.md)](references/outer.md)" }, expected: ["plugins/alpha/doc.md:1 → references/missing.md"] },
  { name: "suppresses an invalid outer link when its inner link resolves", existing: ["plugins/alpha/references/inner.md"], documents: { "plugins/alpha/doc.md": "[outer [inner](references/inner.md)](references/missing.md)" }, expected: [] },
  { name: "validates an image target nested in link text", existing: ["plugins/alpha/references/existing.md"], documents: { "plugins/alpha/doc.md": "[outer ![img](references/missing.png)](references/existing.md)" }, expected: ["plugins/alpha/doc.md:1 → references/missing.png"] },
  { name: "validates an outer image target containing a link", existing: ["plugins/alpha/references/existing.md"], documents: { "plugins/alpha/doc.md": "![outer [inner](references/existing.md)](references/missing.png)" }, expected: ["plugins/alpha/doc.md:1 → references/missing.png"] },
  ...[["references/target(guide).md", "references/missing(guide).md"], ["references/target\\(guide\\).md", "references/missing\\(guide\\).md"]].map(([valid, missing]) => ({ name: `supports balanced destination ${valid}`, existing: ["plugins/alpha/references/target(guide).md"], documents: { "plugins/alpha/doc.md": `[ok](${valid}) [bad](${missing})` }, expected: ["plugins/alpha/doc.md:1 → references/missing(guide).md"] })),
  { name: "rejects a bare destination that escapes a space", documents: { "plugins/alpha/doc.md": "[bad](references/missing\\ file.md)" }, expected: [] },
  { name: "uses the final unescaped angle closing bracket", existing: ["plugins/alpha/references/target>file.md"], documents: { "plugins/alpha/doc.md": "[ok](<references/target\\>file.md>) [bad](<references/missing\\>file.md>)" }, expected: ["plugins/alpha/doc.md:1 → references/missing>file.md"] },
  { name: "rejects an angle destination with an internal opener", documents: { "plugins/alpha/doc.md": "[bad](<references/missing<file.md>)" }, expected: [] },
  { name: "allows destination and title across one line ending", existing: ["plugins/alpha/references/target.md"], documents: { "plugins/alpha/doc.md": "[ok](references/target.md\n \"title\")\n[bad](references/missing.md\n \"title\")" }, expected: ["plugins/alpha/doc.md:3 → references/missing.md"] },
  ...["\"first\n\nsecond\"", "'first\n\nsecond'", "(first\n\nsecond)"].map((title) => ({ name: `rejects blank line in title ${title[0]}`, documents: { "plugins/alpha/doc.md": `[bad](references/missing.md ${title})` }, expected: [] })),
  { name: "preserves the physical line after a continued link", existing: ["plugins/alpha/references/target.md"], documents: { "plugins/alpha/doc.md": "[ok](references/target.md\n \"title\") \`references/missing.md\`" }, expected: ["plugins/alpha/doc.md:2 → references/missing.md"] },
  { name: "ignores a continued destination on a marked line", documents: { "plugins/alpha/doc.md": "[ignored](\n references/missing.md) <!-- doc-path-gate: ignore -->" }, expected: [] },
  { name: "supports spaces in angle destinations", existing: ["plugins/alpha/references/target file.md"], documents: { "plugins/alpha/doc.md": "[ok](<references/target file.md>) [bad](<references/missing file.md>)" }, expected: ["plugins/alpha/doc.md:1 → references/missing file.md"] },
  { name: "accepts a reference destination on the next line", existing: ["plugins/alpha/references/target.md"], documents: { "plugins/alpha/doc.md": "[ok]:\n  references/target.md\n[bad]:\n  references/missing.md" }, expected: ["plugins/alpha/doc.md:4 → references/missing.md"] },
  { name: "resolves against the owning plugin standards", existing: ["plugins/alpha/standards/testing/write.md"], documents: { "plugins/alpha/skills/demo/references/doc.md": "\`testing/write.md\` \`standards/testing/write.md\`" }, expected: [] },
  { name: "checks root documents and strips anchors", existing: ["scripts/tool.py"], documents: { "AGENTS.md": "[tool](scripts/tool.py#usage)", "README.md": "[gone](scripts/gone.py)" }, expected: ["README.md:1 → scripts/gone.py"] },
  { name: "checks markdown outside plugins", existing: ["guides/target.md"], documents: { "guides/setup.md": "[ok](target.md) [bad](missing/gone.md)" }, expected: ["guides/setup.md:1 → missing/gone.md"] },
  ...["templates", "examples", "scripts"].map((segment) => ({ name: `reports forbidden references/${segment}`, documents: { [`plugins/alpha/references/nested/${segment}/artifact.md`]: "x" }, expected: [`plugins/alpha/references/nested/${segment} → forbidden path segment nested under references`] })),
  { name: "reports a forbidden file under references", documents: { "plugins/alpha/references/scripts": "x" }, expected: ["plugins/alpha/references/scripts → forbidden path segment nested under references"] },
  { name: "does not hide forbidden nesting in excluded documents", documents: { "plugins/alpha/references/scripts/plan.template.md": "[x](missing/a.md) <!-- doc-path-gate: ignore -->" }, expected: ["plugins/alpha/references/scripts → forbidden path segment nested under references"] },
  { name: "ignores external links and pure anchors", documents: { "plugins/alpha/doc.md": "[a](https://example.com/x.md) [b](mailto:x@y.z) [c](#section)" }, expected: [] },
  { name: "matches external schemes case-insensitively", documents: { "plugins/alpha/doc.md": "[a](HtTpS://example.com/x.md) [b](MAILTO:x@y.z) [c](Git+SSH://example.com/x.md)" }, expected: [] },
  { name: "normalizes an escaped external scheme separator", documents: { "plugins/alpha/doc.md": "[a](https\\://example.com/x.md)" }, expected: [] },
];

describe("fn:check", () => {
  it.each(fixtureCases)("should $name", runFixture);

  it("should scan untracked Markdown and exclude git-ignored trees", async () => {
    const root = await createRepository();
    try {
      expect(spawnSync("git", ["init", "--quiet"], { cwd: root }).status).toBe(0);
      await writeFixture(root, ".gitignore", ".venv/\ncache/\n");
      await writeFixture(root, ".venv/ignored.md", "`missing/venv.md`");
      await writeFixture(root, "cache/ignored.md", "`missing/cache.md`");
      await writeFixture(root, "guides/untracked.md", "`missing/untracked.md`");
      expect(check(root)).toEqual(["guides/untracked.md:1 → missing/untracked.md"]);
    } finally { await removeTemporaryDirectory(root); }
  });

  it("should keep this repository free of unresolved documentation paths", () => {
    expect(check(repositoryRoot)).toEqual([]);
  });
});

describe("parser complexity contracts", () => {
  it("should mask six thousand spans without changing line identity", () => {
    const count = 6_000;
    const text = "x\n".repeat(count);
    const spans = Array.from({ length: count }, (_, index) => [index * 2, index * 2 + 1] as const);
    const masked = maskSpans(text, spans);
    expect(masked).toBe(" \n".repeat(count));
    expect(masked.match(/\n/g)).toHaveLength(count);
  });

  it("should select six thousand dense links", () => {
    const count = 6_000;
    const text = Array.from({ length: count }, (_, index) => `[link-${index}](references/target.md)`).join(" ");
    expect(selectedLinkCandidates(text, new Set())).toHaveLength(count);
  });

  it("should attribute six thousand multiline link destinations", () => {
    const count = 6_000;
    const text = Array.from({ length: count }, (_, index) => `[link-${index}](references/target.md)`).join("\n");
    const candidates = inlineLinkCandidates(text);
    expect(candidates).toHaveLength(count);
    expect(candidates[0]?.destinationLine).toBe(0);
    expect(candidates.at(-1)?.destinationLine).toBe(count - 1);
  });

  it("should scan dense closed code spans and retain outside claims", () => {
    const dense = Array.from({ length: 6_000 }, (_, index) => `\`[hidden-${index}](references/hidden.md)\``).join(" ");
    const text = `${dense} ` + "\\`[escaped](references/escaped.md) [outside](references/outside.md) `missing/outside.md` `[unclosed](references/unclosed.md)";
    expect(mentions(text, new Set(), []).sort()).toEqual([["missing/outside.md", 0], ["references/escaped.md", 0], ["references/outside.md", 0], ["references/unclosed.md", 0]]);
  });

  it("should reject six thousand malformed destinations", () => {
    expect(inlineLinkCandidates("[](x".repeat(6_000))).toEqual([]);
  });

  it("should split six thousand alternating content blocks", () => {
    const lines = Array.from({ length: 6_000 }, () => ["content", ""]).flat();
    const blocks = contentBlocks(lines);
    expect(blocks).toHaveLength(6_000);
    expect(blocks[0]).toEqual([0, ["content"]]);
    expect(blocks.at(-1)).toEqual([lines.length - 2, ["content"]]);
  });

  it("should parse each large reference definition from its own line", () => {
    const count = 6_000;
    const lines = Array.from({ length: count }, (_, index) => `[label-${index}]: references/target.md`);
    const definitions = blockReferenceDefinitions(lines);
    expect(definitions).toHaveLength(count);
    expect(blockMentions(lines, new Set(definitions.map(({ label }) => label)), definitions)).toHaveLength(count);
  });

  it("should expose closed code spans for parser composition", () => {
    expect(closedCodeSpans("`one` text ``two``", 18)).toEqual([[0, 5], [11, 18]]);
  });
});
