import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  claudeTargets,
  discoverSkills,
  run,
  runClaudeValidation,
  validatePolicy,
} from "./quick_validate.ts";

class TestGlob {
  public constructor(private readonly pattern: string) {}

  public *scanSync(options: {
    cwd: string;
    absolute?: boolean;
    onlyFiles?: boolean;
    dot?: boolean;
  }): Generator<string> {
    const visit = function* (directory: string): Generator<string> {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) yield* visit(path);
        else yield path;
      }
    };
    for (const path of visit(options.cwd)) {
      const relativePath = path.slice(options.cwd.length + 1);
      if (
        this.pattern === "*/.claude-plugin/plugin.json" &&
        !/^[^/]+\/\.claude-plugin\/plugin\.json$/.test(relativePath)
      )
        continue;
      yield options.absolute ? path : relativePath;
    }
  }
}

const bunRuntime = {
  Glob: TestGlob,
  spawnSync: vi.fn(),
};
vi.stubGlobal("Bun", bunRuntime);

beforeEach(() => {
  bunRuntime.spawnSync = vi.fn();
});

const repositoryRoot = resolve(fileURLToPath(new URL("../../../../..", import.meta.url)));
let roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), "quick-validate-"));
  roots.push(root);
  return root;
}

function write(path: string, text = ""): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return path;
}

function skill(
  root: string,
  name: string,
  description: string,
  body: string,
  intelligence = "medium",
): string {
  return write(
    resolve(root, "skills", name, "SKILL.md"),
    `---\nname: ${name}\ndescription: "${description}"\nrequirements:\n  intelligence: ${intelligence}\n---\n\n${body}\n`,
  );
}

function rawSkill(root: string, frontmatter: string): string {
  return write(
    resolve(root, "skills/shared/SKILL.md"),
    `---\n${frontmatter}\n---\n\n# Shared\n\n## Workflow\n\nDo the work.\n`,
  );
}

function errors(path: string, portable = false): unknown[] {
  return validatePolicy(path, { portable }).errors;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

describe("skill discovery and basic policy", () => {
  it("discovers skills from plugins directory", async () => {
    const root = await temporaryRoot();
    const first = skill(
      resolve(root, "plugins/one"),
      "first",
      "Use when creating a focused reusable capability for a known workflow.",
      "# First\n\n## Workflow\n\nDo the work.",
    );
    const second = skill(
      resolve(root, "plugins/two"),
      "second",
      "Use when maintaining a focused reusable capability for an existing workflow.",
      "# Second\n\n## Workflow\n\nDo the work.",
    );
    expect(discoverSkills(resolve(root, "plugins"))).toEqual([first, second]);
  });

  it("accepts minimal skill without ceremony", async () => {
    const root = await temporaryRoot();
    const path = skill(
      root,
      "minimal",
      "Use when a concise reusable workflow needs clear boundaries and verification.",
      "# Minimal\n\n## Boundaries\n\nStay scoped.\n\n## Inputs\n\nA target.\n\n## Workflow\n\nPerform it.\n\n## Verification\n\nCheck the result.\n\n## Completion\n\nReport it.",
    );
    const report = validatePolicy(path);
    expect(report.errors).toEqual([]);
    expect(
      report.warnings
        .map((issue) => issue.message)
        .join("\n")
        .toLowerCase(),
    ).not.toMatch(/diagram|subagent|coherence mandate/);
  });
});

const validRequirementForms = [
  "requirements:\n  intelligence: medium",
  "requirements: {intelligence: medium}",
  "requirements:\n  {intelligence: medium}",
  "requirements:\n  {\n    intelligence: medium\n  }",
];

describe("requirements intelligence", () => {
  it.each(validRequirementForms)(
    "accepts requirements intelligence mapping form %#",
    async (requirements) => {
      const root = await temporaryRoot();
      expect(
        errors(
          rawSkill(
            root,
            `name: shared\ndescription: "Use when accepting portable intelligence across valid YAML mapping forms."\n${requirements}`,
          ),
        ),
      ).toEqual([]);
    },
  );

  it("accepts whole-document flow frontmatter", async () => {
    const root = await temporaryRoot();
    expect(errors(rawSkill(root, "{name: shared, requirements: {intelligence: medium}}"))).toEqual(
      [],
    );
  });

  const nodeReferences = [
    [
      "metadata",
      "{name: shared, requirements: {intelligence: medium}, metadata: &legacy {intelligence: high}}",
    ],
    ["metadata", "{name: shared, requirements: {intelligence: medium}, metadata: *legacy}"],
    ["requirements", "{name: shared, requirements: &required {intelligence: medium}}"],
    ["requirements", "{name: shared, requirements: *required}"],
  ] as const;
  it.each(nodeReferences)(
    "rejects %s node references in whole-document flow frontmatter",
    async (mapping, frontmatter) => {
      const root = await temporaryRoot();
      expect(errors(rawSkill(root, frontmatter))).toEqual([
        {
          message: `Shared skill ${mapping} must not use YAML node properties or aliases; use a plain mapping.`,
          line: 2,
        },
      ]);
    },
  );

  it("rejects inherited skill intelligence", async () => {
    const root = await temporaryRoot();
    expect(
      errors(
        skill(
          root,
          "inherited",
          "Use when a shared workflow needs a concrete portable intelligence requirement.",
          "# Inherited\n\n## Workflow\n\nDo the work.",
          "inherit",
        ),
      ),
    ).toEqual([
      {
        message:
          "Shared skills must declare a concrete requirements.intelligence; inherit is agent-only.",
        line: 5,
      },
    ]);
  });

  it("rejects missing skill intelligence", async () => {
    const root = await temporaryRoot();
    expect(
      errors(
        rawSkill(
          root,
          'name: shared\ndescription: "Use when validating a missing portable intelligence requirement."',
        ),
      ),
    ).toEqual([{ message: "Shared skills must declare exactly one requirements.intelligence." }]);
  });

  it("rejects unknown skill intelligence", async () => {
    const root = await temporaryRoot();
    expect(
      errors(
        skill(
          root,
          "unknown",
          "Use when validating an unknown portable intelligence requirement.",
          "# Unknown\n\n## Workflow\n\nDo the work.",
          "extreme",
        ),
      ),
    ).toEqual([
      {
        message:
          "Shared skill requirements.intelligence must name a concrete level from Essential's intelligence mapping.",
        line: 5,
      },
    ]);
  });

  it("rejects nested skill intelligence", async () => {
    const root = await temporaryRoot();
    expect(
      errors(
        rawSkill(
          root,
          'name: shared\ndescription: "Use when validating a nested portable intelligence requirement."\nmetadata:\n  nested:\n    intelligence: high',
        ),
      ),
    ).toEqual([{ message: "Shared skills must declare exactly one requirements.intelligence." }]);
  });

  const legacyForms = [
    ["metadata:\n  intelligence: medium", 5],
    ["requirements:\n  intelligence: medium\nmetadata:\n  intelligence: medium", 7],
    ["requirements:\n  intelligence: medium\nmetadata: {intelligence: high}", 6],
    ["requirements:\n  intelligence: medium\nmetadata:\n  {intelligence: high}", 7],
    ["requirements:\n  intelligence: medium\nmetadata:\n  {\n    intelligence: high\n  }", 8],
  ] as const;
  it.each(legacyForms)("rejects legacy metadata intelligence form %#", async (form, line) => {
    const root = await temporaryRoot();
    expect(
      errors(
        rawSkill(
          root,
          `name: shared\ndescription: "Use when validating removal of the legacy shared intelligence metadata path."\n${form}`,
        ),
      ),
    ).toEqual([
      {
        message:
          "Shared skills must not declare metadata.intelligence; use requirements.intelligence.",
        line,
      },
    ]);
  });

  it.each(
    validRequirementForms.map((_, index) => [
      [
        "metadata:\n  category: portable",
        "metadata: {category: portable}",
        "metadata:\n  {category: portable}",
        "metadata:\n  {\n    category: portable\n  }",
      ][index],
    ]),
  )("allows unrelated metadata form %#", async ([metadata]) => {
    const root = await temporaryRoot();
    expect(
      errors(
        rawSkill(
          root,
          `name: shared\ndescription: "Use when preserving unrelated metadata across valid YAML mapping forms."\nrequirements:\n  intelligence: medium\n${metadata}`,
        ),
      ),
    ).toEqual([]);
  });

  it.each(["metadata: &legacy {intelligence: high}", "metadata: *legacy"])(
    "rejects unsupported metadata node reference %#",
    async (metadata) => {
      const root = await temporaryRoot();
      expect(
        errors(
          rawSkill(
            root,
            `name: shared\ndescription: "Use when rejecting metadata node references that can hide legacy intelligence."\nrequirements:\n  intelligence: medium\n${metadata}`,
          ),
        ),
      ).toEqual([
        {
          message:
            "Shared skill metadata must not use YAML node properties or aliases; use a plain mapping.",
          line: 6,
        },
      ]);
    },
  );

  it.each(["requirements: &required {intelligence: medium}", "requirements: *required"])(
    "rejects unsupported requirements node reference %#",
    async (requirements) => {
      const root = await temporaryRoot();
      expect(
        errors(
          rawSkill(
            root,
            `name: shared\ndescription: "Use when rejecting requirements node references that obscure concrete intelligence."\n${requirements}`,
          ),
        ),
      ).toEqual([
        {
          message:
            "Shared skill requirements must not use YAML node properties or aliases; use a plain mapping.",
          line: 4,
        },
      ]);
    },
  );
});

const mergeCases = [
  ["metadata", "requirements:\n  intelligence: medium\nmetadata:\n  <<: *legacy", 7],
  ["metadata", "requirements:\n  intelligence: medium\nmetadata: {<<: *legacy}", 6],
  ["requirements", "requirements:\n  intelligence: medium\n  <<: *required", 6],
  ["requirements", "requirements: {intelligence: medium, <<: *required}", 4],
] as const;
const nonScalarCases = [
  [
    "metadata",
    "requirements:\n  intelligence: medium\nmetadata: {key: &legacy intelligence, *legacy: high}",
    6,
  ],
  ["metadata", "requirements:\n  intelligence: medium\nmetadata:\n  ? intelligence\n  : high", 7],
  [
    "requirements",
    "requirements: {intelligence: medium, key: &legacy intelligence, *legacy: high}",
    4,
  ],
  ["requirements", "requirements:\n  intelligence: medium\n  ? intelligence\n  : high", 6],
] as const;

describe("adversarial YAML keys", () => {
  it.each(mergeCases)(
    "rejects YAML merge key in %s mapping",
    async (mapping, frontmatter, line) => {
      const root = await temporaryRoot();
      expect(
        errors(
          rawSkill(
            root,
            `name: shared\ndescription: "Use when rejecting YAML merge keys that can obscure portable intelligence."\n${frontmatter}`,
          ),
        ),
      ).toEqual([
        {
          message: `Shared skill ${mapping} must not use YAML merge keys; use a plain mapping.`,
          line,
        },
      ]);
    },
  );
  it.each(nonScalarCases)(
    "rejects non-scalar key in %s mapping",
    async (mapping, frontmatter, line) => {
      const root = await temporaryRoot();
      expect(
        errors(
          rawSkill(
            root,
            `name: shared\ndescription: "Use when rejecting aliased or complex keys that can obscure portable intelligence."\n${frontmatter}`,
          ),
        ),
      ).toEqual([
        {
          message: `Shared skill ${mapping} must use direct scalar keys; aliases and complex keys are unsupported.`,
          line,
        },
      ]);
    },
  );
  it.each(["'intelligence'", '"intelligence"'])(
    "accepts quoted requirements intelligence key %s",
    async (key) => {
      const root = await temporaryRoot();
      const path = skill(
        root,
        "quoted-requirement",
        "Use when accepting a direct quoted scalar key for portable intelligence.",
        "# Quoted requirement\n\n## Workflow\n\nDo the work.",
      );
      write(path, readFileSync(path, "utf8").replace("  intelligence: medium", `  ${key}: medium`));
      expect(errors(path)).toEqual([]);
    },
  );
  it.each(["'intelligence'", '"intelligence"'])(
    "rejects quoted metadata intelligence key %s",
    async (key) => {
      const root = await temporaryRoot();
      expect(
        errors(
          rawSkill(
            root,
            `name: shared\ndescription: "Use when rejecting a direct quoted legacy intelligence key."\nrequirements:\n  intelligence: medium\nmetadata:\n  ${key}: high`,
          ),
        ),
      ).toEqual([
        {
          message:
            "Shared skills must not declare metadata.intelligence; use requirements.intelligence.",
          line: 7,
        },
      ]);
    },
  );
});

const modelKeys = [
  "model",
  "model ",
  "'model'",
  '"model"',
  '"mod\\u0065l"',
  "effort",
  "model_reasoning_effort",
  "model-reasoning-effort",
  "modelReasoningEffort",
  "reasoning_effort",
  "reasoning-effort",
];
const allowedToolsMessage =
  "Shared skills must not declare allowed-tools: Codex does not support this field; shared skills inherit runtime capabilities.";

describe("cross-harness root fields", () => {
  it.each(modelKeys)("rejects model selection field %s", async (key) => {
    const root = await temporaryRoot();
    expect(
      errors(
        rawSkill(
          root,
          `name: shared\ndescription: "Use when validating harness-neutral shared skill metadata across runtimes."\n${key}: provider-specific\nmetadata:\n  intelligence: medium`,
        ),
      ),
    ).toEqual([
      {
        message:
          "Shared skills must not declare model or effort fields; use requirements.intelligence.",
        line: 4,
      },
    ]);
  });
  it("reports allowed-tools failure by shared skill path", async () => {
    const root = await temporaryRoot();
    const path = rawSkill(
      root,
      'name: shared\ndescription: "Use when validating shared skill metadata across supported runtime harnesses."\nallowed-tools: Read, Write',
    );
    expect(Object.fromEntries([[path, errors(path)]])).toEqual({
      [path]: [{ message: allowedToolsMessage, line: 4 }],
    });
  });
  it.each(["allowed-tools :", "'allowed-tools':", '"allowed-tools":'])(
    "rejects allowed-tools YAML variant %s",
    async (key) => {
      const root = await temporaryRoot();
      expect(
        errors(
          rawSkill(
            root,
            `name: shared\ndescription: "Use when validating shared skill metadata across supported runtime harnesses."\n${key} Read`,
          ),
        ),
      ).toEqual([{ message: allowedToolsMessage, line: 4 }]);
    },
  );
});

const semanticAllowedTools = [
  [
    'name: shared\ndescription: "Use when validating shared skill metadata across supported runtime harnesses."\n"allowed\\u002dtools": Read',
    4,
  ],
  [
    'name: shared\ndescription: "Use when validating shared skill metadata across supported runtime harnesses."\n"allowed\\x2dtools": Read',
    4,
  ],
  [
    'name: shared\ndescription: "Use when validating shared skill metadata across supported runtime harnesses."\n"allowed\\U0000002dtools": Read',
    4,
  ],
  ["{name: shared, description: cross-harness metadata, allowed-tools: Read}", 2],
  ['{"allowed-tools":Read}', 2],
  ["{? allowed-tools}", 2],
  ["{allowed-tools}", 2],
  ['{name: shared,\n description: cross-harness metadata,\n "allowed\\u002dtools": Read}', 4],
  [
    'name: shared\ndescription: "Use when validating shared skill metadata across supported runtime harnesses."\n? allowed-tools\n: Read',
    4,
  ],
] as const;
const complexRoot = [
  ["name: &forbidden allowed-tools\n? *forbidden\n: Read", 3],
  ["? |-\n  allowed-tools\n: Read", 2],
  ['? "allowed-\\\n  tools"\n: Read', 2],
  ["{name: &forbidden allowed-tools, ? *forbidden}", 2],
  ['{"allowed-\\\n  tools": Read}', 2],
] as const;
const unsupportedRoot = [
  ["!!map {allowed-tools: Read}", 2],
  ["&catalog {allowed-tools: Read}", 2],
  ["  name: shared\n  allowed-tools: Read", 2],
  ["defaults: &defaults {allowed-tools: Read}\n<<: *defaults", 3],
  ["defaults: &defaults {allowed-tools: Read}\n!!merge inherited: *defaults", 3],
  ["defaults: &defaults {allowed-tools: Read}\n!<tag:yaml.org,2002:merge> inherited: *defaults", 3],
  ["{defaults: &defaults {allowed-tools: Read}, <<: *defaults}", 2],
] as const;

describe("semantic and unsupported root mapping syntax", () => {
  it.each(semanticAllowedTools)(
    "rejects semantic allowed-tools mapping key %#",
    async (frontmatter, line) => {
      const root = await temporaryRoot();
      expect(errors(rawSkill(root, frontmatter))).toEqual([{ message: allowedToolsMessage, line }]);
    },
  );
  it.each(complexRoot)(
    "rejects unsupported complex root mapping key %#",
    async (frontmatter, line) => {
      const root = await temporaryRoot();
      expect(errors(rawSkill(root, frontmatter))).toEqual([
        {
          message:
            "Shared skill frontmatter uses an unsupported complex root mapping key; use a plain or quoted scalar key.",
          line,
        },
      ]);
    },
  );
  it.each(unsupportedRoot)(
    "rejects unsupported root mapping syntax %#",
    async (frontmatter, line) => {
      const root = await temporaryRoot();
      expect(errors(rawSkill(root, frontmatter))).toEqual([
        {
          message:
            "Shared skill frontmatter must use a plain, unwrapped root mapping without merge keys.",
          line,
        },
      ]);
    },
  );
  it.each([
    'name: shared\ndescription: "Use when validating nested skill metadata handling."\nmetadata:\n  allowed-tools: Read',
    'name: shared\ndescription: "Use when validating nested skill metadata handling."\nmetadata: {allowed-tools: Read}',
    "{name: shared, metadata: {allowed-tools: Read}}",
    "allowed-tools",
    "allowed-tools:not-a-mapping",
    "{allowed-tools:Read}",
  ])("ignores allowed-tools outside root mapping keys %#", async (frontmatter) => {
    const root = await temporaryRoot();
    expect(errors(rawSkill(root, frontmatter))).toEqual([
      { message: "Shared skills must declare exactly one requirements.intelligence." },
    ]);
  });
});

describe("body and Markdown references", () => {
  it("reports placeholders, long body, and missing local reference", async () => {
    const root = await temporaryRoot();
    const path = skill(
      root,
      "broken",
      "Use when checking a deliberately invalid repository policy fixture.",
      `# Broken\n\nSee [missing](references/missing.md).\n\n[TODO]\n${Array(501).fill("line").join("\n")}`,
    );
    const messages = errors(path)
      .map((item) => (item as { message: string }).message)
      .join("\n");
    expect(messages).toContain("Unresolved local reference");
    expect(messages).toContain("Placeholder");
    expect(messages).toContain("500 lines");
  });
  it("skips link examples and checks real files", async () => {
    const root = await temporaryRoot();
    write(resolve(root, "skills/links/references/present.md"), "present");
    const path = skill(
      root,
      "links",
      "Use when validating conservative local Markdown destination handling in skill policy checks.",
      "# Links\n\nExamples: [label](url), [label](…), and [section](#anchor).\n\nRead [present](references/present.md) and [missing](references/missing.md).",
    );
    expect(errors(path).map((item) => (item as { message: string }).message)).toEqual([
      "Unresolved local reference: references/missing.md",
    ]);
  });
  it("rejects existing reference outside portable skill root", async () => {
    const root = await temporaryRoot();
    write(resolve(root, "skills/shared.md"), "shared");
    const path = skill(
      root,
      "portable",
      "Use when validating that portable skills keep every required reference inside their root.",
      "# Portable\n\nRead [shared](../shared.md).",
    );
    expect(errors(path)).toEqual([]);
    expect(errors(path, true).map((x) => (x as { message: string }).message)).toEqual([
      "Reference escapes skill root in SKILL.md: ../shared.md",
    ]);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(run(["--policy-only", "--portable", dirname(path)])).toBe(1);
  });
  it("rejects angle-wrapped reference outside portable skill root", async () => {
    const root = await temporaryRoot();
    write(resolve(root, "skills/shared file.md"), "shared");
    const path = skill(
      root,
      "portable-angle",
      "Use when validating portable skills that use angle-wrapped Markdown destinations containing spaces.",
      "# Portable\n\nRead [shared](<../shared file.md>).",
    );
    expect(errors(path, true).map((x) => (x as { message: string }).message)).toEqual([
      "Reference escapes skill root in SKILL.md: <../shared file.md>",
    ]);
  });
  it("skips angle-wrapped URLs and placeholder destinations", async () => {
    const root = await temporaryRoot();
    const path = skill(
      root,
      "link-examples",
      "Use when validating external URLs and illustrative destinations in Markdown link examples.",
      "# Examples\n\nBrowse [docs](<https://example.com/skill guide>) and replace [example]([path/to/file.md]).",
    );
    expect(errors(path, true)).toEqual([]);
  });
  it("rejects absolute reference without suffix", async () => {
    const root = await temporaryRoot();
    const shared = write(resolve(root, "shared"), "shared");
    const path = skill(
      root,
      "portable",
      "Use when validating that absolute Markdown destinations cannot escape a portable skill root.",
      `# Portable\n\nRead [shared](${shared}).`,
    );
    expect(errors(path, true).map((x) => (x as { message: string }).message)).toEqual([
      `Reference escapes skill root in SKILL.md: ${shared}`,
    ]);
  });
  it("checks links in supporting references", async () => {
    const root = await temporaryRoot();
    const path = skill(
      root,
      "portable",
      "Use when validating root-relative links throughout a portable skill's supporting references.",
      "# Portable\n\nRead [guide](references/guide.md).",
    );
    write(resolve(dirname(path), "references/guide.md"), "Read [missing](references/missing.md).");
    expect(errors(path, true).map((x) => (x as { message: string }).message)).toEqual([
      "Unresolved local reference in references/guide.md: references/missing.md",
    ]);
  });
  it("checks Markdown reference definitions", async () => {
    const root = await temporaryRoot();
    write(resolve(root, "skills/shared.md"), "shared");
    write(resolve(root, "skills/shared file.md"), "shared");
    const path = skill(
      root,
      "portable-definitions",
      "Use when validating portable handling of local, external, and illustrative Markdown reference definitions.",
      "# Portable\n\nRead the [guide][guide].\n\n[guide]: references/guide.md\n[shared]: ../shared.md\n[external]: https://example.com/shared.md\n[example]: [path/to/file.md]",
    );
    write(
      resolve(dirname(path), "references/guide.md"),
      "[shared]: <../shared file.md>\n[external]: https://example.com/shared.md\n[example]: [path/to/file.md]\n",
    );
    expect(errors(path, true).map((x) => (x as { message: string }).message)).toEqual([
      "Reference escapes skill root in SKILL.md: ../shared.md",
      "Reference escapes skill root in references/guide.md: <../shared file.md>",
    ]);
  });
});

describe("Claude targets and subprocess behavior", () => {
  it("uses marketplace root once", async () => {
    const root = await temporaryRoot();
    write(resolve(root, ".claude-plugin/marketplace.json"), "{}");
    for (const name of ["one", "two"])
      write(resolve(root, `plugins/${name}/.claude-plugin/plugin.json`), "{}");
    expect(claudeTargets(root)).toEqual([root]);
  });
  it("CLI runs official validator once for marketplace", async () => {
    const root = await temporaryRoot();
    write(resolve(root, ".claude-plugin/marketplace.json"), "{}");
    for (const name of ["one", "two"]) {
      write(resolve(root, `plugins/${name}/.claude-plugin/plugin.json`), "{}");
      skill(
        resolve(root, `plugins/${name}`),
        name,
        "Use when testing official validation execution for every discovered plugin target.",
        `# ${name}\n\n## Workflow\n\nValidate it.`,
      );
    }
    const spawn = vi.spyOn(bunRuntime, "spawnSync").mockReturnValue({
      exitCode: 0,
      stdout: Buffer.from("marketplace ok"),
      stderr: Buffer.from(""),
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(run([root])).toBe(0);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn.mock.calls[0]?.[0]).toEqual(["claude", "plugin", "validate", "--strict", root]);
  });
  it("CLI validates containing plugin for skill directory", async () => {
    const root = await temporaryRoot();
    const plugin = resolve(root, "plugin");
    write(resolve(plugin, ".claude-plugin/plugin.json"), "{}");
    const path = skill(
      plugin,
      "portable",
      "Use when testing containing-plugin resolution from a documented skill-directory target.",
      "# Portable\n\n## Workflow\n\nValidate it.",
    );
    const spawn = vi
      .spyOn(bunRuntime, "spawnSync")
      .mockReturnValue({ exitCode: 0, stdout: Buffer.from("plugin ok"), stderr: Buffer.from("") });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(run([dirname(path)])).toBe(0);
    expect(spawn.mock.calls[0]?.[0]).toEqual(["claude", "plugin", "validate", "--strict", plugin]);
  });
  it("should structure thrown launch errors and continue", () => {
    const spawn = vi
      .spyOn(bunRuntime, "spawnSync")
      .mockImplementationOnce(() => {
        throw new Error("ENOENT: claude not found");
      })
      .mockReturnValueOnce({ exitCode: 0, stdout: Buffer.from("ok"), stderr: Buffer.from("") });
    const [status, results] = runClaudeValidation(["/plugin/one", "/plugin/two"]);
    expect(status).toBe(1);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(results[0]).toEqual({
      path: "/plugin/one",
      status: "fail",
      output: "Unable to launch Claude validator: ENOENT: claude not found",
    });
    expect(results[1]).toMatchObject({ status: "pass" });
  });
  it("structures timed-out Claude and continues", () => {
    const spawn = vi
      .spyOn(bunRuntime, "spawnSync")
      .mockReturnValueOnce({ exitCode: null, stdout: Buffer.from(""), stderr: Buffer.from("") })
      .mockReturnValueOnce({ exitCode: 0, stdout: Buffer.from("ok"), stderr: Buffer.from("") });
    const [status, results] = runClaudeValidation(["/plugin/one", "/plugin/two"]);
    expect(status).toBe(1);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(results[0]?.output).toContain("timed out");
    expect(results[1]).toMatchObject({ status: "pass" });
  });
});

it("this repository passes the skill policy gate", () => {
  const failures = Object.fromEntries(
    discoverSkills(repositoryRoot)
      .map((path) => [path, errors(path)])
      .filter(([, issues]) => issues.length > 0),
  );
  expect(failures).toEqual({});
});
