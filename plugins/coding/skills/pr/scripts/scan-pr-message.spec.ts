import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EMOJI_RANGES, isEmojiPrefix } from "./scan-pr-message.ts";

const scripts = fileURLToPath(new URL(".", import.meta.url));
const scanner = join(scripts, "scan-pr-message.ts");
const template = join(scripts, "../templates/message.md");
const scannerUsage =
  "usage: scan-pr-message.ts [-h] --body-file BODY_FILE [--template TEMPLATE]\n" +
  "                          --zone {green,yellow,red,black}\n" +
  "                          --archetype {rfc,code-spec,contract,domain-model,implementation,integration,feature-flag,migration,ui,mechanical-refactor,cleanup,observability}\n" +
  "                          --head-oid HEAD_OID --base-oid BASE_OID\n" +
  "                          [--allow-pending-reviewers]\n" +
  "                          [--generated-file GENERATED_FILE]";
const archetypeChoices =
  "'rfc', 'code-spec', 'contract', 'domain-model', 'implementation', 'integration', 'feature-flag', 'migration', 'ui', 'mechanical-refactor', 'cleanup', 'observability'";
const headOid = "1".repeat(40),
  baseOid = "2".repeat(40);
// The complete 159-input grammar matrix launches a real Bun subprocess per input.
const SUBPROCESS_GRAMMAR_MATRIX_TIMEOUT_MS = 15_000;
const requiredTemplate =
  "📌\n\n{{summary}}\n\n## 🎯 Goal\n\n{{goal}}\n\n## ✅ Requirements\n\n{{requirements}}\n\n## 🧵 Context\n\n{{context}}\n\n";
const requiredBody =
  "📌\n\nSpecific summary.\n\n## 🎯 Goal\n\nMake repository PR intent explicit.\n\n## ✅ Requirements\n\n- Readers can identify the PR's observable behavior.\n\n## 🧵 Context\n\nRepository authors need a stable contract.\n\n";
type Result = {
  valid: boolean;
  violations: Array<{ message: string; rule_id: string }>;
};

function message(...sections: Array<[string, string]>): string {
  const rendered = [
    "📌",
    "",
    "Separate observable standards from operating directions.",
    "",
    "## 🎯 Goal",
    "",
    "Make PR intent explicit to authors and reviewers.",
    "",
    "## ✅ Requirements",
    "",
    "- Render each required PR contract section in the published message.",
    "",
    "## 🧵 Context",
    "",
    "Authors need PR messages whose intent and behavior are explicit.",
  ];
  const bundled: Record<string, string> = {
    "## Risk": "## ⚠️ Risk",
    "## Test plan": "## 🧭 Test Plan",
  };
  for (const [heading, body] of sections)
    rendered.push("", bundled[heading] ?? heading, "", body);
  return `${rendered.join("\n")}\n`;
}
const verification = (): [string, string] => [
  "## 🧪 Verification",
  "- [x] Run the PR message scanner.",
];
async function run(
  body: string,
  options: {
    allowPendingReviewers?: boolean;
    archetype?: string;
    generated?: string[];
    headOid?: string;
    environment?: NodeJS.ProcessEnv;
    templateBody?: string;
    zone?: string;
  } = {},
): Promise<{ code: number; result: Result; stderr: string }> {
  const root = await mkdtemp(join(tmpdir(), "pr-message-test-"));
  try {
    const bodyFile = join(root, "body.md");
    await writeFile(bodyFile, body);
    const templateArgs: string[] = [];
    if (options.templateBody !== undefined) {
      const path = join(root, "template.md");
      await writeFile(path, options.templateBody);
      templateArgs.push("--template", path);
    }
    const completed = spawnSync(
      "bun",
      [
        "run",
        scanner,
        "--body-file",
        bodyFile,
        "--zone",
        options.zone ?? "green",
        "--archetype",
        options.archetype ?? "mechanical-refactor",
        "--head-oid",
        options.headOid ?? headOid,
        "--base-oid",
        baseOid,
        ...(options.allowPendingReviewers === false
          ? []
          : ["--allow-pending-reviewers"]),
        ...templateArgs,
        ...(options.generated ?? []).flatMap((path) => [
          "--generated-file",
          path,
        ]),
      ],
      { encoding: "utf8", env: { ...process.env, ...options.environment } },
    );
    return {
      code: completed.status ?? 1,
      result: JSON.parse(completed.stdout),
      stderr: completed.stderr,
    };
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

function runScannerCli(args: string[], input?: Buffer) {
  return spawnSync("bun", ["run", scanner, ...args], {
    encoding: "utf8",
    input,
  });
}

function expectMissingFileTrace(stderr: string, value: string) {
  expect(stderr).toContain(
    `ENOENT: no such file or directory, open '${value}'`,
  );
  expect(stderr).toContain(`path: "${value}"`);
  expect(stderr).toContain('code: "ENOENT"');
  expect(stderr).toMatch(/\bat readUtf8 \([^\n]+\)/);
  expect(stderr).toMatch(/\bat main \([^\n]+\)/);
}

describe("PR message scanner", () => {
  it.each([
    "--body-file",
    "--template",
    "--zone",
    "--archetype",
    "--head-oid",
    "--base-oid",
    "--generated-file",
  ])("does not let help consume a missing %s value", (option) => {
    const completed = runScannerCli([option, "--help"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toMatch(
      new RegExp(
        `scan-pr-message\\.ts: error: argument ${option.replaceAll("-", "\\-")}: expected one argument\\n$`,
      ),
    );
  });

  it.each(["--body-file", "--template"])(
    "accepts an explicit empty %s value before failing the filesystem read",
    (option) => {
      const args = [
        `${option}=`,
        ...(option === "--body-file" ? [] : ["--body-file=-"]),
        "--zone=green",
        "--archetype=mechanical-refactor",
        `--head-oid=${headOid}`,
        `--base-oid=${baseOid}`,
      ];
      const completed = runScannerCli(
        args,
        Buffer.from(message(verification())),
      );
      expect(completed.status).toBe(1);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).not.toContain("expected one argument");
    },
  );

  it.each(["body", "template"])(
    "fails closed with empty stdout for malformed UTF-8 in the %s file",
    async (source) => {
      const root = await mkdtemp(join(tmpdir(), "pr-message-utf8-"));
      try {
        const bodyPath = join(root, "body.md");
        const templatePath = join(root, "template.md");
        await writeFile(bodyPath, message(verification()));
        await writeFile(templatePath, await readFile(template));
        await writeFile(
          source === "body" ? bodyPath : templatePath,
          Buffer.from([0x66, 0x6f, 0x80, 0x6f]),
        );
        const completed = runScannerCli([
          "--body-file",
          bodyPath,
          "--template",
          templatePath,
          "--zone",
          "green",
          "--archetype",
          "mechanical-refactor",
          "--head-oid",
          headOid,
          "--base-oid",
          baseOid,
        ]);
        expect(completed.status).toBe(1);
        expect(completed.stdout).toBe("");
        expect(completed.stderr).toContain("invalid start byte");
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    },
  );

  it("matches a literal closing bracket with the valid []] glob", async () => {
    const scanned = await run(
      message(
        [
          "## 🏭 Generated Files",
          "`sdk/[]].ts` is generated from `schema/openapi.yaml`.",
        ],
        verification(),
      ),
      { generated: ["sdk/].ts"] },
    );
    expect(scanned).toMatchObject({ code: 0, result: { valid: true } });
  });

  it("honors fnmatch character-class boundaries", async () => {
    const scanned = await run(
      message(
        [
          "## 🏭 Generated Files",
          "`sdk/file[0-2].ts` is generated from `schema/openapi.yaml`.",
        ],
        verification(),
      ),
      { generated: ["sdk/file0.ts", "sdk/file2.ts", "sdk/file3.ts"] },
    );
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(({ message }) =>
        message.includes("sdk/file3.ts"),
      ),
    ).toBe(true);
    expect(
      scanned.result.violations.every(
        ({ message }) =>
          !message.includes("sdk/file0.ts") &&
          !message.includes("sdk/file2.ts"),
      ),
    ).toBe(true);
  });

  it.each([
    "--body-file",
    "--template",
    "--zone",
    "--archetype",
    "--head-oid",
    "--base-oid",
    "--generated-file",
  ])("rejects %s followed by -h as a missing value", (option) => {
    const completed = runScannerCli([option, "-h"]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(
      `${scannerUsage}\nscan-pr-message.ts: error: argument ${option}: expected one argument\n`,
    );
  });

  it.each([
    "--body-file",
    "--template",
    "--zone",
    "--archetype",
    "--head-oid",
    "--base-oid",
    "--generated-file",
  ])(
    "rejects %s followed by an unknown short option as a missing value",
    (option) => {
      const completed = runScannerCli([option, "-x"]);
      expect(completed.status).toBe(2);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe(
        `${scannerUsage}\nscan-pr-message.ts: error: argument ${option}: expected one argument\n`,
      );
    },
  );

  it("accepts an empty generated-file value before scanning", () => {
    const completed = runScannerCli(
      [
        "--body-file=-",
        "--zone=green",
        "--archetype=mechanical-refactor",
        `--head-oid=${headOid}`,
        `--base-oid=${baseOid}`,
        "--generated-file=",
      ],
      Buffer.from(message(verification())),
    );
    expect(completed.status).toBe(1);
    expect(completed.stderr).toBe("");
    expect(JSON.parse(completed.stdout)).toMatchObject({ valid: false });
  });

  it("accepts unambiguous long-option abbreviations", () => {
    const completed = runScannerCli(
      [
        "--body-f=-",
        `--temp=${template}`,
        "--z=green",
        "--arc=mechanical-refactor",
        `--head=${headOid}`,
        `--base=${baseOid}`,
        "--allow",
      ],
      Buffer.from(message(verification())),
    );
    expect(completed.status, completed.stderr).toBe(0);
    expect(completed.stderr).toBe("");
    expect(JSON.parse(completed.stdout)).toMatchObject({ valid: true });
  });

  it.each([
    ["--b", "ambiguous option: --b could match --body-file, --base-oid"],
    [
      "--a",
      "ambiguous option: --a could match --archetype, --allow-pending-reviewers",
    ],
    ["--unknown", "unrecognized arguments: --unknown"],
  ])("rejects ambiguous or unknown abbreviation %s", (option, error) => {
    const completed = runScannerCli([
      "--body-file=-",
      "--zone=green",
      "--archetype=mechanical-refactor",
      `--head-oid=${headOid}`,
      `--base-oid=${baseOid}`,
      option,
    ]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(
      `${scannerUsage}\nscan-pr-message.ts: error: ${error}\n`,
    );
  });

  it("treats a descending astral range as never matching without throwing", async () => {
    const scanned = await run(
      message(
        [
          "## 🏭 Generated Files",
          "`sdk/[🙏-😀].ts` is generated from `schema/openapi.yaml`.",
        ],
        verification(),
      ),
      { generated: ["sdk/😀.ts"] },
    );
    expect(scanned.code).toBe(1);
    expect(scanned.stderr).toBe("");
    expect(
      scanned.result.violations.some(({ message }) =>
        message.includes("sdk/😀.ts"),
      ),
    ).toBe(true);
  });

  it("matches ascending astral ranges by Unicode code point at both boundaries", async () => {
    const scanned = await run(
      message(
        [
          "## 🏭 Generated Files",
          "`sdk/[😀-🙏].ts` is generated from `schema/openapi.yaml`.",
        ],
        verification(),
      ),
      { generated: ["sdk/😀.ts", "sdk/😁.ts", "sdk/🙏.ts", "sdk/🗿.ts"] },
    );
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(({ message }) =>
        message.includes("sdk/🗿.ts"),
      ),
    ).toBe(true);
    expect(
      scanned.result.violations.every(
        ({ message }) =>
          !message.includes("sdk/😀.ts") &&
          !message.includes("sdk/😁.ts") &&
          !message.includes("sdk/🙏.ts"),
      ),
    ).toBe(true);
  });

  it.each(
    [
      "--body-file",
      "--template",
      "--zone",
      "--archetype",
      "--head-oid",
      "--base-oid",
      "--generated-file",
    ].flatMap((option) => ["-1", "-.5"].map((value) => [option, value])),
  )("accepts separated negative-number-shaped %s value %s", (option, value) => {
    const values: Record<string, string> = {
      "--body-file": "-",
      "--zone": "green",
      "--archetype": "mechanical-refactor",
      "--head-oid": headOid,
      "--base-oid": baseOid,
    };
    if (option === "--template" || option === "--generated-file")
      values[option] = value;
    else values[option] = value;
    const args = Object.entries(values).flatMap(([name, item]) => [name, item]);
    const completed = runScannerCli(args, Buffer.from(message(verification())));
    if (option === "--body-file" || option === "--template") {
      expect(completed.status).toBe(1);
      expect(completed.stdout).toBe("");
      expectMissingFileTrace(completed.stderr, value);
    } else if (option === "--zone" || option === "--archetype") {
      const choices =
        option === "--zone"
          ? "'green', 'yellow', 'red', 'black'"
          : archetypeChoices;
      expect(completed.status).toBe(2);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe(
        `${scannerUsage}\nscan-pr-message.ts: error: argument ${option}: invalid choice: '${value}' (choose from ${choices})\n`,
      );
    } else if (option === "--head-oid" || option === "--base-oid") {
      expect(completed.status).toBe(2);
      expect(completed.stdout).toBe("");
      expect(completed.stderr).toBe(
        `${scannerUsage}\nscan-pr-message.ts: error: argument ${option}: must be a lowercase 40-character Git OID\n`,
      );
    } else {
      expect(completed.status).toBe(1);
      expect(completed.stderr).toBe("");
      expect(completed.stdout).toBe(
        `{"template": ${JSON.stringify(template)}, "valid": false, "violations": [{"message": "missing required section: ## \\ud83c\\udfed Generated Files", "rule_id": "GIT-PR-TYPE-05"}]}\n`,
      );
    }
  });

  it.each([
    "--body-file",
    "--template",
    "--zone",
    "--archetype",
    "--head-oid",
    "--base-oid",
    "--generated-file",
  ])("rejects near-miss negative token as a missing %s value", (option) => {
    const completed = runScannerCli([option, "-1."]);
    expect(completed.status).toBe(2);
    expect(completed.stdout).toBe("");
    expect(completed.stderr).toBe(
      `${scannerUsage}\nscan-pr-message.ts: error: argument ${option}: expected one argument\n`,
    );
  });

  it.each(["-0", "-01"])(
    "accepts signed integer boundary %s as a body path",
    (value) => {
      const completed = runScannerCli([
        "--body-file",
        value,
        "--zone=green",
        "--archetype=mechanical-refactor",
        `--head-oid=${headOid}`,
        `--base-oid=${baseOid}`,
      ]);
      expect(completed.status).toBe(1);
      expect(completed.stdout).toBe("");
      expectMissingFileTrace(completed.stderr, value);
    },
  );

  it("matches uppercase RISK independently of a Turkish locale", async () => {
    const custom =
      requiredTemplate +
      "## ⚠️ RISK [ Optional ]\n\n{{risk}}\n\n## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n## 🧪 Verification\n\n{{verification}}\n";
    const body =
      requiredBody +
      "## ⚠️ RISK [ Optional ]\n\nA stale cache can survive deployment.\n\n## 🧭 Test Plan [ Optional ]\n\nExercise cache expiry.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n- [ ] Reviewer slot 1 assigned\n- [ ] Reviewer slot 1 reviewed `" +
      headOid +
      "` against `" +
      baseOid +
      "`\n- [ ] Reviewer slot 1 approved `" +
      headOid +
      "` against `" +
      baseOid +
      "`\n";
    expect(
      await run(body, {
        templateBody: custom,
        zone: "yellow",
        environment: { LC_ALL: "tr_TR.UTF-8", LANG: "tr_TR.UTF-8" },
      }),
    ).toMatchObject({ code: 0, result: { valid: true } });
  });

  it("matches the long-s Riſk heading by Python casefold semantics", async () => {
    const custom =
      requiredTemplate +
      "## ⚠️ Riſk [ Optional ]\n\n{{risk}}\n\n## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n## 🧪 Verification\n\n{{verification}}\n";
    const body =
      requiredBody +
      "## ⚠️ Riſk [ Optional ]\n\nA stale cache can survive deployment.\n\n## 🧭 Test Plan [ Optional ]\n\nExercise cache expiry.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n- [ ] Reviewer slot 1 assigned\n- [ ] Reviewer slot 1 reviewed `" +
      headOid +
      "` against `" +
      baseOid +
      "`\n- [ ] Reviewer slot 1 approved `" +
      headOid +
      "` against `" +
      baseOid +
      "`\n";
    expect(
      await run(body, { templateBody: custom, zone: "yellow" }),
    ).toMatchObject({ code: 0, result: { valid: true } });
  });

  it("casefolds long-s in the special Summary lookup", async () => {
    const custom =
      "## 📌 ſummary\n\n{{summary}}\n\n" +
      requiredTemplate +
      "## 🧪 Verification\n\n{{verification}}\n";
    const body =
      "## 📌 ſummary\n\nConcrete repository summary.\n\n" +
      requiredBody +
      "## 🧪 Verification\n\n- [x] Run the scanner.\n";
    expect(await run(body, { templateBody: custom })).toMatchObject({
      code: 0,
      result: { valid: true },
    });
  });

  it.each(["Ｒｉｓｋ", "Ｓｕｍｍａｒｙ"])(
    "does not NFKC-normalize compatibility heading %s",
    async (name) => {
      if (name === "Ｒｉｓｋ") {
        const custom =
          requiredTemplate +
          `## ⚠️ ${name} [ Optional ]\n\n{{risk}}\n\n## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n## 🧪 Verification\n\n{{verification}}\n`;
        const body =
          requiredBody +
          `## ⚠️ ${name} [ Optional ]\n\nSpecific compatibility text.\n\n## 🧭 Test Plan [ Optional ]\n\nExercise the boundary.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n`;
        const scanned = await run(body, {
          templateBody: custom,
          zone: "yellow",
        });
        expect(scanned.code).toBe(1);
        expect(
          scanned.result.violations.some(({ message }) =>
            message.includes("missing required section: ## ⚠️ Risk"),
          ),
        ).toBe(true);
      } else {
        const custom =
          `## 📌 ${name}\n\n{{summary}}\n\n` +
          requiredTemplate +
          "## 🧪 Verification\n\n{{verification}}\n";
        const body =
          `## 📌 ${name}\n\nCompatibility text.\n\n` +
          requiredBody +
          "## 🧪 Verification\n\n- [x] Run the scanner.\n";
        const scanned = await run(body, { templateBody: custom });
        expect(scanned.code).toBe(1);
        expect(
          scanned.result.violations.some(({ message }) =>
            message.includes("rendered body has no summary"),
          ),
        ).toBe(true);
      }
    },
  );
  it("accepts a green message conforming to the bundled template", async () => {
    const scanned = await run(message(verification()));
    expect(scanned).toMatchObject({
      code: 0,
      stderr: "",
      result: { valid: true, violations: [] },
    });
  });
  it("requires a goal and behavioral requirements", async () => {
    const missing = await run(
      message(verification()).replace(
        "\n## 🎯 Goal\n\nMake PR intent explicit to authors and reviewers.\n",
        "",
      ),
    );
    const generic = await run(
      message(verification()).replace(
        "- Render each required PR contract section in the published message.",
        "- Pass the tests.\n- Follow the standards.\n- Keep CI green.",
      ),
    );
    expect(
      missing.result.violations.some(({ message }) =>
        message.includes("missing required section: ## 🎯 Goal"),
      ),
    ).toBe(true);
    expect(
      generic.result.violations.some(({ message }) =>
        message.includes("generic process gates"),
      ),
    ).toBe(true);
  });
  it("does not reject mixed behavioral and process requirements as process-only", async () => {
    const scanned = await run(
      message(verification()).replace(
        "- Render each required PR contract section in the published message.",
        "- Users can view order history, and tests pass.",
      ),
    );
    expect(scanned).toMatchObject({ code: 0, result: { valid: true } });
  });
  it("binds the test fixture to the bundled template", async () => {
    expect(await readFile(template, "utf8")).toContain("## 🧪 Verification");
  });
  it("rejects the full process-only requirement grammar", async () => {
    for (const subject of [
      "tests",
      "CI",
      "checks",
      "build",
      "pytest",
      "compilation",
      "pipeline",
    ])
      for (const qualifier of [
        "",
        "unit ",
        "integration ",
        "repository local ",
        "unit and integration ",
      ])
        for (const outcome of ["pass", "succeed"]) {
          const requirement = `- All ${qualifier}${subject} must ${outcome}.`;
          const scanned = await run(
            message(verification()).replace(
              "- Render each required PR contract section in the published message.",
              requirement,
            ),
          );
          expect(scanned.code, requirement).toBe(1);
          expect(
            scanned.result.violations.some(({ message }) =>
              message.includes("generic process gates"),
            ),
            requirement,
          ).toBe(true);
        }
  });
  it(
    "rejects the full process-state grammar",
    async () => {
      const phrases = [
        ["", ["is", "stays", "remains"]],
        ["must ", ["be", "stay", "remain"]],
        ["should ", ["be", "stay", "remain"]],
        ["shall ", ["be", "stay", "remain"]],
      ] as const;
      const requirements: string[] = [];
      for (const subject of [
        "tests",
        "CI",
        "checks",
        "build",
        "pytest",
        "linting",
      ]) {
        for (const [modal, states] of phrases)
          for (const state of states)
            for (const outcome of ["green", "clean"])
              requirements.push(`- ${subject} ${modal}${state} ${outcome}.`);
        requirements.push(`- No ${subject} fail.`, `- ${subject} do not fail.`);
      }
      for (const qualifier of ["", "unit ", "integration "])
        requirements.push(`- There are no ${qualifier}test failures.`);
      for (const requirement of requirements) {
        const scanned = await run(
          message(verification()).replace(
            "- Render each required PR contract section in the published message.",
            requirement,
          ),
        );
        expect(scanned.code, requirement).toBe(1);
        expect(
          scanned.result.violations.some(({ message }) =>
            message.includes("generic process gates"),
          ),
          requirement,
        ).toBe(true);
      }
    },
    SUBPROCESS_GRAMMAR_MATRIX_TIMEOUT_MS,
  );
  it("does not mistake Markdown list markers for behavioral evidence", async () => {
    for (const marker of ["-", "*", "+", "1.", "2)"]) {
      const scanned = await run(
        message(verification()).replace(
          "- Render each required PR contract section in the published message.",
          `${marker} All tests must pass.`,
        ),
      );
      expect(scanned.code, marker).toBe(1);
      expect(
        scanned.result.violations.some(({ message }) =>
          message.includes("generic process gates"),
        ),
        marker,
      ).toBe(true);
    }
  });
  it.each(["## Risk", "## ⚠️ Risk [ Optional ]"])(
    "rejects invalid final heading %s",
    async (heading) => {
      const scanned = await run(
        message(
          ["## Risk", "A concrete failure mode."],
          verification(),
        ).replace("## ⚠️ Risk", heading),
      );
      expect(scanned.code).toBe(1);
      expect(
        scanned.result.violations.some(({ message }) =>
          message.includes("not owned by the selected template"),
        ),
      ).toBe(true);
    },
  );
  it.each([
    ["📌\n\n{{summary_paragraph}}\n", "unresolved placeholders"],
    ["📌\n\nSummary.\n\n<!-- author guidance -->\n", "guidance comments"],
    [
      message(["## Unknown", "extra"], verification()),
      "not owned by the selected template",
    ],
    [message(verification(), ["## Risk", "Specific risk."]), "out of order"],
  ])(
    "reports GIT-PR-02 for template-shape violation",
    async (body, fragment) => {
      const scanned = await run(body);
      expect(scanned.code).toBe(1);
      expect(
        scanned.result.violations.some(
          ({ rule_id }) => rule_id === "GIT-PR-02",
        ),
      ).toBe(true);
      expect(
        scanned.result.violations.some(({ message }) =>
          message.includes(fragment),
        ),
      ).toBe(true);
    },
  );
  it.each([
    ["yellow", [verification()], "GIT-PR-SIZE-02"],
    [
      "red",
      [
        ["## Risk", "A stale reference can bypass the standard."],
        ["## Test plan", "Run contract and path tests."],
        verification(),
      ],
      "GIT-PR-SIZE-03",
    ],
    ["black", [verification()], "GIT-PR-SIZE-04"],
  ] as const)(
    "reports owning rule for %s zone",
    async (zone, sections, rule) => {
      const scanned = await run(
        message(...(sections as Array<[string, string]>)),
        { zone },
      );
      expect(scanned.code).toBe(1);
      expect(
        scanned.result.violations.some(({ rule_id }) => rule_id === rule),
      ).toBe(true);
    },
  );
  it.each([
    ["migration", "GIT-PR-TYPE-03"],
    ["feature-flag", "GIT-PR-STACK-04"],
    ["ui", "GIT-PR-02"],
  ])("reports owning rule for %s archetype", async (archetype, rule) => {
    const scanned = await run(message(verification()), { archetype });
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(({ rule_id }) => rule_id === rule),
    ).toBe(true);
  });
  it("requires generated evidence to name every generated path", async () => {
    const scanned = await run(
      message(
        ["## 🏭 Generated Files", "Generated output is included."],
        verification(),
      ),
      { generated: ["sdk/generated.ts"] },
    );
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(
        ({ rule_id }) => rule_id === "GIT-PR-TYPE-05",
      ),
    ).toBe(true);
  });
  it("requires generated globs to match every supplied path", async () => {
    const scanned = await run(
      message(
        [
          "## 🏭 Generated Files",
          "`sdk/*.ts` is generated from `schema/openapi.yaml`.",
        ],
        verification(),
      ),
      { generated: ["sdk/client.ts", "docs/client.md"] },
    );
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(({ message }) =>
        message.includes("docs/client.md"),
      ),
    ).toBe(true);
    expect(
      scanned.result.violations.every(
        ({ message }) => !message.includes("sdk/client.ts"),
      ),
    ).toBe(true);
  });
  it("lets a repository template control preamble and order", async () => {
    const custom =
      "<!-- repository guidance remains verbatim -->\nRepository PR\n\n" +
      requiredTemplate +
      "## ⚠️ Risk [ Optional ]\n\n{{risk}}\n\n## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n## 🧪 Verification\n\n{{verification}}\n";
    const body =
      "<!-- repository guidance remains verbatim -->\nRepository PR\n\n" +
      requiredBody +
      "## ⚠️ Risk [ Optional ]\n\nA stale consumer can load the old authority.\n\n## 🧭 Test Plan [ Optional ]\n\nRun contract and path tests.\n\n## 🧪 Verification\n\n- [x] Run the selected-template scanner.\n- [ ] Reviewer slot 1 assigned\n- [ ] Reviewer slot 1 reviewed `" +
      headOid +
      "` against `" +
      baseOid +
      "`\n- [ ] Reviewer slot 1 approved `" +
      headOid +
      "` against `" +
      baseOid +
      "`\n";
    expect(
      await run(body, { templateBody: custom, zone: "yellow" }),
    ).toMatchObject({ code: 0, result: { valid: true } });
  });
  it("requires repository templates to retain bundled headings and emoji", async () => {
    const custom =
      "Repository PR\n\n{{summary}}\n\n## Risk\n\n{{risk}}\n\n## 🧪 Verification\n\n{{verification}}\n";
    const scanned = await run(
      "Repository PR\n\nSpecific summary.\n\n## Risk\n\nSpecific risk.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n",
      { templateBody: custom },
    );
    const messages = new Set(
      scanned.result.violations.map(({ message }) => message),
    );
    expect(scanned.code).toBe(1);
    expect(messages).toContain("section lacks an emoji prefix: ## Risk");
    expect(
      [...messages].filter((item) =>
        item.startsWith("missing required section:"),
      ),
    ).toHaveLength(3);
  });
  it("allows a mandatory custom section", async () => {
    const custom =
      requiredTemplate +
      "## 🔐 Security\n\n{{security}}\n\n## 🧪 Verification\n\n{{verification}}\n";
    const body =
      requiredBody +
      "## 🔐 Security\n\nAuthorize access before returning records.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n";
    expect(await run(body, { templateBody: custom })).toMatchObject({
      code: 0,
      result: { valid: true },
    });
  });
  it("rejects every ASCII punctuation prefix as non-emoji", async () => {
    const punctuation = `!\"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~`;
    const headings = [...punctuation].map(
      (prefix, index) => `## ${prefix} Notes ${index} [ Optional ]`,
    );
    const custom =
      requiredTemplate +
      headings
        .map((heading, index) => `${heading}\n\n{{notes_${index}}}`)
        .join("\n\n") +
      "\n\n## 🧪 Verification\n\n{{verification}}\n";
    const body =
      requiredBody +
      headings.map((heading) => `${heading}\n\nSpecific notes.`).join("\n\n") +
      "\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n";
    const messages = new Set(
      (await run(body, { templateBody: custom })).result.violations.map(
        ({ message }) => message,
      ),
    );
    expect(
      headings.every((heading) =>
        messages.has(`section lacks an emoji prefix: ${heading}`),
      ),
    ).toBe(true);
  });
  it("accepts every declared emoji range and keycap", () => {
    for (const [start, end] of EMOJI_RANGES)
      for (let point = start; point <= end; point++)
        expect(isEmojiPrefix(String.fromCodePoint(point))).toBe(true);
    for (const base of "#*0123456789")
      expect(isEmojiPrefix(`${base}️⃣`)).toBe(true);
  });
  it("rejects non-emoji Unicode symbols", () => {
    for (const character of "⌘あ♙☇")
      expect(isEmojiPrefix(character)).toBe(false);
  });
  it("gives every bundled heading a valid emoji", async () => {
    const headings = (await readFile(template, "utf8"))
      .split("\n")
      .filter((line) => line.startsWith("## "));
    expect(
      headings.every((heading) =>
        isEmojiPrefix(heading.slice(3).split(/\s+/, 1)[0]!),
      ),
    ).toBe(true);
  });
  it("scans a keycap emoji as one prefix", async () => {
    const heading = "## 1️⃣ Steps [ Optional ]";
    const custom =
      requiredTemplate +
      `${heading}\n\n{{steps}}\n\n## 🧪 Verification\n\n{{verification}}\n`;
    const body =
      requiredBody +
      `${heading}\n\nDescribe the review sequence.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n`;
    expect(await run(body, { templateBody: custom })).toMatchObject({
      code: 0,
      result: { valid: true },
    });
  });
  it("allows empty optional repository sections", async () => {
    const custom =
      "<!-- keep this comment -->\nRepository PR\n\n" +
      requiredTemplate +
      "## 📝 Optional Notes [ Optional ]\n\n{{notes}}\n\n## 🧪 Verification\n\n{{verification}}\n";
    const body =
      "<!-- keep this comment -->\nRepository PR\n\n" +
      requiredBody +
      "## 📝 Optional Notes [ Optional ]\n\nNone.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n";
    expect(await run(body, { templateBody: custom })).toMatchObject({
      code: 0,
      result: { valid: true },
    });
  });
  it("allows optional placeholders to remain verbatim", async () => {
    const custom =
      "<!-- keep this comment -->\nRepository PR\n\n" +
      requiredTemplate +
      "## 📝 Optional Notes [ Optional ]\n\n{{optional_notes}}\n\n## 🧪 Verification\n\n{{verification}}\n";
    const body =
      "<!-- keep this comment -->\nRepository PR\n\n" +
      requiredBody +
      "## 📝 Optional Notes [ Optional ]\n\n{{optional_notes}}\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n";
    expect(await run(body, { templateBody: custom })).toMatchObject({
      code: 0,
      result: { valid: true },
    });
  });
  it("does not accept a bare placeholder as required risk evidence", async () => {
    const custom =
      "Repository PR\n\n" +
      requiredTemplate +
      "## ⚠️ Risk [ Optional ]\n\n{{risk}}\n\n## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n## 🧪 Verification\n\n{{verification}}\n";
    const body =
      "Repository PR\n\n" +
      requiredBody +
      "## ⚠️ Risk [ Optional ]\n\n{{risk}}\n\n## 🧭 Test Plan [ Optional ]\n\nSpecific test plan.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n";
    const scanned = await run(body, { templateBody: custom, zone: "yellow" });
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(({ message }) =>
        message.includes("missing specific evidence: ## ⚠️ Risk [ Optional ]"),
      ),
    ).toBe(true);
  });
  it("does not accept a formatted placeholder as summary evidence", async () => {
    const custom =
      "## 📌 Summary\n\n**Summary:** {{summary}}\n\n## 🎯 Goal\n\n{{goal}}\n\n## ✅ Requirements\n\n{{requirements}}\n\n## 🧪 Verification\n\n{{verification}}\n";
    const body =
      "## 📌 Summary\n\n**Summary:** {{summary}}\n\n## 🎯 Goal\n\nMake intent explicit.\n\n## ✅ Requirements\n\n- Readers can identify observable behavior.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n";
    const scanned = await run(body, { templateBody: custom });
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(({ message }) =>
        message.includes("missing specific evidence: ## 📌 Summary"),
      ),
    ).toBe(true);
  });
  it("accepts summary evidence supplied by a repository section", async () => {
    const custom =
      "## 📌 Summary\n\n{{summary}}\n\n" +
      requiredTemplate +
      "## 🧪 Verification\n\n{{verification}}\n";
    const body =
      "## 📌 Summary\n\nDescribe the selected repository contract.\n\n" +
      requiredBody +
      "## 🧪 Verification\n\n- [x] Run the scanner.\n";
    expect(await run(body, { templateBody: custom })).toMatchObject({
      code: 0,
      result: { valid: true },
    });
  });
  it("falls back to concrete preamble when the summary section is optional", async () => {
    const custom =
      "Repository PR\n\n{{summary}}\n\n## 📌 Summary [ Optional ]\n\n{{section_summary}}\n\n" +
      requiredTemplate +
      "## 🧪 Verification\n\n{{verification}}\n";
    const body =
      "Repository PR\n\nConcrete preamble summary.\n\n" +
      requiredBody +
      "## 🧪 Verification\n\n- [x] Run the scanner.\n";
    expect(await run(body, { templateBody: custom })).toMatchObject({
      code: 0,
      result: { valid: true },
    });
  });
  it("does not let a preserved placeholder mask process-only requirements", async () => {
    const custom =
      "Repository PR\n\n{{summary}}\n\n## 🎯 Goal\n\n{{goal}}\n\n## ✅ Requirements\n\n{{requirements}}\n\nAll unit tests must pass.\n\n## 🧵 Context\n\n{{context}}\n\n## 🧪 Verification\n\n{{verification}}\n";
    const body =
      "Repository PR\n\nConcrete summary.\n\n## 🎯 Goal\n\nKeep the repository contract explicit.\n\n## ✅ Requirements\n\n{{requirements}}\n\nAll unit tests must pass.\n\n## 🧵 Context\n\nAuthors need deterministic evidence.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n";
    const scanned = await run(body, { templateBody: custom });
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(({ message }) =>
        message.includes("generic process gates"),
      ),
    ).toBe(true);
  });
  it("does not accept a list-formatted placeholder as risk evidence", async () => {
    const custom =
      "Repository PR\n\n" +
      requiredTemplate +
      "## ⚠️ Risk [ Optional ]\n\n- {{risk}}\n\n## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n## 🧪 Verification\n\n{{verification}}\n";
    const body =
      "Repository PR\n\n" +
      requiredBody +
      "## ⚠️ Risk [ Optional ]\n\n- {{risk}}\n\n## 🧭 Test Plan [ Optional ]\n\nSpecific test plan.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n";
    const scanned = await run(body, { templateBody: custom, zone: "yellow" });
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(({ message }) =>
        message.includes("missing specific evidence: ## ⚠️ Risk [ Optional ]"),
      ),
    ).toBe(true);
  });
  it.each([
    "**Risk:** {{risk}}\n**Mitigation:** {{mitigation}}",
    "**Risk:** {{risk}} **Mitigation:** {{mitigation}}",
  ])(
    "does not accept compound placeholders as risk evidence: %s",
    async (riskEvidence) => {
      const custom =
        "Repository PR\n\n" +
        requiredTemplate +
        `## ⚠️ Risk [ Optional ]\n\n${riskEvidence}\n\n## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n## 🧪 Verification\n\n{{verification}}\n`;
      const body =
        "Repository PR\n\n" +
        requiredBody +
        `## ⚠️ Risk [ Optional ]\n\n${riskEvidence}\n\n## 🧭 Test Plan [ Optional ]\n\nSpecific test plan.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n`;
      const scanned = await run(body, { templateBody: custom, zone: "yellow" });
      expect(scanned.code).toBe(1);
      expect(
        scanned.result.violations.some(({ message }) =>
          message.includes(
            "missing specific evidence: ## ⚠️ Risk [ Optional ]",
          ),
        ),
      ).toBe(true);
    },
  );
  it("accepts a placeholder accompanied by specific risk prose", async () => {
    const custom =
      "Repository PR\n\n" +
      requiredTemplate +
      "## ⚠️ Risk [ Optional ]\n\n{{risk}}\n\n## 🧭 Test Plan [ Optional ]\n\n{{test_plan}}\n\n## 🧪 Verification\n\n{{verification}}\n";
    const body =
      "Repository PR\n\n" +
      requiredBody +
      "## ⚠️ Risk [ Optional ]\n\n{{risk}} remains until the downstream cache expires.\n\n## 🧭 Test Plan [ Optional ]\n\nExercise the cache boundary.\n\n## 🧪 Verification\n\n- [x] Run the scanner.\n- [ ] Reviewer slot 1 assigned\n- [ ] Reviewer slot 1 reviewed `" +
      headOid +
      "` against `" +
      baseOid +
      "`\n- [ ] Reviewer slot 1 approved `" +
      headOid +
      "` against `" +
      baseOid +
      "`\n";
    expect(
      await run(body, { templateBody: custom, zone: "yellow" }),
    ).toMatchObject({ code: 0, result: { valid: true } });
  });
  it("requires repository-template comments to remain verbatim", async () => {
    const custom =
      "<!-- repository guidance -->\nRepository PR\n\n" +
      requiredTemplate +
      "## 🧪 Verification\n\n{{verification}}\n";
    const body =
      "Repository PR\n\n" +
      requiredBody +
      "## 🧪 Verification\n\n- [x] Run the scanner.\n";
    const scanned = await run(body, { templateBody: custom });
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(({ message }) =>
        message.includes("comments verbatim"),
      ),
    ).toBe(true);
  });
  it("accepts a complete red-zone message", async () => {
    const reviewerEvidence = [
      "- [x] Run the PR message scanner.",
      ...[1, 2].flatMap((slot) => [
        `- [ ] Reviewer slot ${slot} assigned`,
        `- [ ] Reviewer slot ${slot} reviewed \`${headOid}\` against \`${baseOid}\``,
        `- [ ] Reviewer slot ${slot} approved \`${headOid}\` against \`${baseOid}\``,
      ]),
    ].join("\n");
    const body = message(
      ["## Risk", "A stale consumer can retain the former authority."],
      ["## Test plan", "Run scanner, contract, and documentation tests."],
      [
        "## 📐 Why This Size",
        "Rules, consumers, and tests move together because they share one authority.",
      ],
      ["## 🧪 Verification", reviewerEvidence],
    );
    const scanned = await run(body, { zone: "red" });
    expect(scanned, JSON.stringify(scanned.result.violations)).toMatchObject({
      code: 0,
      result: { valid: true },
    });
  });
  it("requires two reviewer triplets for a red-zone message", async () => {
    const reviewerEvidence = [
      "- [x] Run the PR message scanner.",
      "- [ ] Reviewer slot 1 assigned",
      `- [ ] Reviewer slot 1 reviewed \`${headOid}\` against \`${baseOid}\``,
      `- [ ] Reviewer slot 1 approved \`${headOid}\` against \`${baseOid}\``,
    ].join("\n");
    const body = message(
      ["## Risk", "A stale consumer can retain the former authority."],
      ["## Test plan", "Run scanner, contract, and documentation tests."],
      [
        "## 📐 Why This Size",
        "Rules, consumers, and tests move together because they share one authority.",
      ],
      ["## 🧪 Verification", reviewerEvidence],
    );
    const scanned = await run(body, { zone: "red" });
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(({ message }) =>
        message.includes("2 confirmed reviewer evidence triplet"),
      ),
    ).toBe(true);
  });
  it("binds reviewer evidence to the active revision", async () => {
    const reviewerEvidence = [
      "- [x] Run the PR message scanner.",
      "- [ ] Reviewer slot 1 assigned",
      `- [ ] Reviewer slot 1 reviewed \`${headOid}\` against \`${baseOid}\``,
      `- [ ] Reviewer slot 1 approved \`${headOid}\` against \`${baseOid}\``,
    ].join("\n");
    const body = message(
      ["## Risk", "A stale review could be credited to new code."],
      ["## Test plan", "Scan against the active revision."],
      ["## 🧪 Verification", reviewerEvidence],
    );
    const scanned = await run(body, {
      headOid: "3".repeat(40),
      zone: "yellow",
    });
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(({ message }) =>
        message.includes("active revision"),
      ),
    ).toBe(true);
  });
  it("requires checked reviewer triplets when pending reviewers are disallowed", async () => {
    const evidence = (checked: boolean) =>
      [
        "- [x] Run the PR message scanner.",
        `- [${checked ? "x" : " "}] Reviewer slot 1 assigned`,
        `- [${checked ? "x" : " "}] Reviewer slot 1 reviewed \`${headOid}\` against \`${baseOid}\``,
        `- [${checked ? "x" : " "}] Reviewer slot 1 approved \`${headOid}\` against \`${baseOid}\``,
      ].join("\n");
    const sections = (checked: boolean) =>
      message(
        ["## Risk", "A large surface can hide defects."],
        ["## Test plan", "Require an independent review."],
        ["## 🧪 Verification", evidence(checked)],
      );
    const pending = await run(sections(false), {
      allowPendingReviewers: false,
      zone: "yellow",
    });
    expect(pending.code).toBe(1);
    expect(
      pending.result.violations.some(({ message }) =>
        message.includes("confirmed reviewer evidence"),
      ),
    ).toBe(true);
    expect(
      await run(sections(true), {
        allowPendingReviewers: false,
        zone: "yellow",
      }),
    ).toMatchObject({ code: 0, result: { valid: true } });
  });
  it("treats placeholders inside inline and fenced code as literal content", async () => {
    const body = message(
      [
        "## 🛠️ Implementation",
        "Use `{{inline_value}}` or:\n```yaml\nvalue: {{fenced_value}}\n```",
      ],
      verification(),
    );
    expect(await run(body)).toMatchObject({ code: 0, result: { valid: true } });
  });
  it("rejects an indented unknown heading", async () => {
    const scanned = await run(
      message(["  ## Unknown", "Extra section."], verification()),
    );
    expect(scanned.code).toBe(1);
    expect(
      scanned.result.violations.some(({ message }) =>
        message.includes("not owned"),
      ),
    ).toBe(true);
  });
  it.each(["None.", "N/A."])(
    "rejects punctuated generic required evidence: %s",
    async (generic) => {
      const reviewerEvidence = [
        "- [x] Run the PR message scanner.",
        "- [ ] Reviewer slot 1 assigned",
        `- [ ] Reviewer slot 1 reviewed \`${headOid}\` against \`${baseOid}\``,
        `- [ ] Reviewer slot 1 approved \`${headOid}\` against \`${baseOid}\``,
      ].join("\n");
      const scanned = await run(
        message(
          ["## Risk", generic],
          ["## Test plan", "Exercise the named risk."],
          ["## 🧪 Verification", reviewerEvidence],
        ),
        { zone: "yellow" },
      );
      expect(scanned.code).toBe(1);
      expect(
        scanned.result.violations.some(({ message }) =>
          message.includes("missing specific evidence: ## ⚠️ Risk"),
        ),
      ).toBe(true);
    },
  );
  it("matches supplied generated paths against unquoted globs", async () => {
    const body = message(
      [
        "## 🏭 Generated Files",
        "sdk/*.ts is generated from schema/openapi.yaml.",
      ],
      verification(),
    );
    expect(await run(body, { generated: ["sdk/client.ts"] })).toMatchObject({
      code: 0,
      result: { valid: true },
    });
  });
  it("treats a fenced heading as message content rather than a template section", async () => {
    const body = message(
      ["## 🛠️ Implementation", "```markdown\n## Example heading\n```"],
      verification(),
    );
    expect(await run(body)).toMatchObject({ code: 0, result: { valid: true } });
  });
});
