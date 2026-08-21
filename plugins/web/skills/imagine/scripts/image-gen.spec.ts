import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sharpHarness = vi.hoisted(() => {
  const pipeline = {
    resize: vi.fn(),
    flatten: vi.fn(),
    toFormat: vi.fn(),
    toBuffer: vi.fn(),
  };
  return { entry: vi.fn(), pipeline };
});
const recraftHarness = vi.hoisted(() => ({ client: undefined as unknown }));

vi.mock("sharp@0.34", () => ({ default: sharpHarness.entry }), {
  virtual: true,
});
vi.mock("@google/genai@1", () => ({ GoogleGenAI: class {} }), {
  virtual: true,
});
vi.mock(
  "openai@6",
  () => ({
    default: class {
      constructor() {
        return recraftHarness.client;
      }
    },
  }),
  { virtual: true },
);

import {
  ImageProvider,
  PROVIDER_REGISTRY,
  register_provider,
} from "./providers/base";
import type { Args, GenerateOptions } from "./providers/base";
import { main, parse_args, _job_image_list } from "./image-gen";

const cli = new URL("./image-gen.ts", import.meta.url).pathname;
const cliPreload = new URL("./image-gen-test-support.ts", import.meta.url)
  .pathname;
const roots: string[] = [];

class TestProvider extends ImageProvider {
  readonly name = "test-image-gen";
  readonly env_var = "TEST_IMAGE_GEN_KEY";
  readonly MODEL_PARAMS = {
    model: { default: "test-model", choices: ["test-model"] },
    n: { default: 1, type: "int" as const, range: [1, 4] as const },
    output_format: { default: "png", choices: ["png"] },
  };
  static calls: string[] = [];
  static failures = new Map<string, number>();
  static onCall: ((prompt: string) => void) | undefined;
  static holdPrompts = new Set<string>();
  static holdResolvers = new Map<string, () => void>();
  static slowStarted = Promise.resolve();
  static slowSettled = Promise.resolve();
  static failureObserved = Promise.resolve();
  static releaseSlow: (() => void) | undefined;
  static resolveFailureObserved: (() => void) | undefined;
  static cleanupViolation = false;

  static prepareFailFastProbe(): void {
    TestProvider.slowStarted = new Promise((resolve) => {
      TestProvider.slowStartedResolve = resolve;
    });
    TestProvider.slowSettled = new Promise((resolve) => {
      TestProvider.slowSettledResolve = resolve;
    });
    TestProvider.failureObserved = new Promise((resolve) => {
      TestProvider.resolveFailureObserved = resolve;
    });
    TestProvider.cleanupViolation = false;
  }
  static slowStartedResolve: (() => void) | undefined;
  static slowSettledResolve: (() => void) | undefined;

  async generate(prompt: string): Promise<string[]> {
    TestProvider.calls.push(`generate:${prompt}`);
    return [Buffer.from(`generated:${prompt}`).toString("base64")];
  }
  async async_generate(
    prompt: string,
    _args: Args,
    options: GenerateOptions = {},
  ): Promise<string[]> {
    TestProvider.calls.push(`async:${prompt}`);
    if (TestProvider.onCall) TestProvider.onCall(prompt);
    if (TestProvider.holdPrompts.has(prompt)) {
      await new Promise<void>((resolve) => {
        TestProvider.holdResolvers.set(prompt, resolve);
      });
    }
    if (prompt.includes("slow")) {
      TestProvider.slowStartedResolve?.();
      await new Promise<void>((resolve) => {
        TestProvider.releaseSlow = resolve;
      });
      const imagePath = options.images?.[0];
      if (imagePath && !existsSync(imagePath))
        TestProvider.cleanupViolation = true;
      TestProvider.slowSettledResolve?.();
    }
    const remaining = TestProvider.failures.get(prompt) ?? 0;
    if (remaining > 0) {
      TestProvider.failures.set(prompt, remaining - 1);
      TestProvider.resolveFailureObserved?.();
      throw Object.assign(new Error("temporary failure"), { retry_after: 0 });
    }
    return [Buffer.from(`batch:${prompt}`).toString("base64")];
  }
  dry_run_payload(
    prompt: string,
    args: Args,
    options: GenerateOptions = {},
  ): Args {
    return {
      provider: this.name,
      prompt,
      model: args.model,
      images: options.images ?? null,
      references: options.references ?? null,
    };
  }
}

function registerTestProvider(): void {
  register_provider(TestProvider);
  TestProvider.calls = [];
  TestProvider.failures = new Map();
  TestProvider.releaseSlow = undefined;
  TestProvider.onCall = undefined;
  TestProvider.holdPrompts = new Set();
  TestProvider.holdResolvers = new Map();
  TestProvider.slowStartedResolve = undefined;
  TestProvider.slowSettledResolve = undefined;
  TestProvider.resolveFailureObserved = undefined;
  TestProvider.slowStarted = Promise.resolve();
  TestProvider.slowSettled = Promise.resolve();
  TestProvider.failureObserved = Promise.resolve();
  process.env.TEST_IMAGE_GEN_KEY = "opaque-key";
}

async function makeRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function runCli(
  args: readonly string[],
  cwd: string,
): ReturnType<typeof spawnSync> {
  return spawnSync("bun", ["--preload", cliPreload, cli, ...args], {
    cwd,
    env: { ...process.env, TEST_IMAGE_GEN_KEY: "opaque-key" },
    encoding: "utf8",
  });
}

function captureStderr(sink: string[] = []): {
  text(): string;
  reset(): void;
  restore(): void;
} {
  const spy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk: Uint8Array | string) => {
      sink.push(String(chunk));
      return true;
    });
  return {
    text: () => sink.filter((value) => !value.startsWith("provider:")).join(""),
    reset: () => sink.splice(0),
    restore: () => spy.mockRestore(),
  };
}

async function waitFor(
  predicate: () => boolean,
  description: string,
): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

afterEach(async () => {
  vi.unstubAllGlobals();
  delete PROVIDER_REGISTRY["test-image-gen"];
  delete process.env.TEST_IMAGE_GEN_KEY;
  delete process.env.RECRAFT_API_TOKEN;
  recraftHarness.client = undefined;
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

beforeEach(() => {
  vi.stubGlobal("Bun", { sleep: async () => undefined });
  sharpHarness.pipeline.resize
    .mockReset()
    .mockReturnValue(sharpHarness.pipeline);
  sharpHarness.pipeline.flatten
    .mockReset()
    .mockReturnValue(sharpHarness.pipeline);
  sharpHarness.pipeline.toFormat
    .mockReset()
    .mockReturnValue(sharpHarness.pipeline);
  sharpHarness.pipeline.toBuffer
    .mockReset()
    .mockResolvedValue(Uint8Array.from([6, 5, 4]));
  sharpHarness.entry.mockReset().mockReturnValue(sharpHarness.pipeline);
});

describe("image-gen CLI", () => {
  it("parses provider equals/repeated image flags and batch defaults", () => {
    expect(
      parse_args([
        "--provider=test-image-gen",
        "edit",
        "--image",
        "one.bin",
        "--image=two.bin",
        "--no-augment",
      ]),
    ).toMatchObject({
      provider: "test-image-gen",
      command: "edit",
      image: ["one.bin", "two.bin"],
      augment: false,
      concurrency: 5,
      max_attempts: 3,
    });
    expect(_job_image_list({ image: "one.bin" }, "image")).toEqual(["one.bin"]);
    expect(_job_image_list({ images: ["one.bin", 2] }, "image")).toEqual([
      "one.bin",
      "2",
    ]);
  });

  it.each([
    ["input", ["--input", "jobs.jsonl"]],
    ["concurrency", ["--concurrency", "2"]],
    ["max-attempts", ["--max-attempts", "2"]],
    ["fail-fast", ["--fail-fast"]],
  ] as const)("rejects batch-only --%s on generate", async (flag, option) => {
    registerTestProvider();
    const root = await makeRoot(`image-gen-generate-option-${flag}-`);
    await expect(
      main([
        "--provider",
        "test-image-gen",
        "generate",
        "--prompt",
        "opaque",
        "--dry-run",
        ...option,
      ]),
    ).rejects.toThrow(`unrecognized arguments: --${flag}`);
    expect(TestProvider.calls).toEqual([]);
  });

  it.each([
    ["image", ["--image", "image.bin"]],
    ["mask", ["--mask", "mask.bin"]],
    ["reference", ["--reference", "reference.bin"]],
  ] as const)(
    "rejects generate-only --%s on generate-batch",
    async (flag, option) => {
      registerTestProvider();
      const root = await makeRoot(`image-gen-batch-option-${flag}-`);
      await expect(
        main([
          "--provider",
          "test-image-gen",
          "generate-batch",
          "--input",
          join(root, "jobs.jsonl"),
          "--out-dir",
          join(root, "outputs"),
          "--dry-run",
          ...option,
        ]),
      ).rejects.toThrow(`unrecognized arguments: --${flag}`);
      expect(TestProvider.calls).toEqual([]);
    },
  );

  it.each([
    ["concurrency", "0", "--concurrency must be between 1 and 25"],
    ["concurrency", "1.5", "argument --concurrency: invalid int value: '1.5'"],
    ["max-attempts", "0", "--max-attempts must be between 1 and 10"],
    [
      "max-attempts",
      "1.5",
      "argument --max-attempts: invalid int value: '1.5'",
    ],
  ] as const)(
    "rejects invalid %s values before batch execution",
    async (flag, value, message) => {
      registerTestProvider();
      const root = await makeRoot(`image-gen-invalid-${flag}-${value}-`);
      await expect(
        main([
          "--provider",
          "test-image-gen",
          "generate-batch",
          "--input",
          join(root, "jobs.jsonl"),
          "--out-dir",
          join(root, "outputs"),
          `--${flag}`,
          value,
          "--dry-run",
        ]),
      ).rejects.toThrow(message);
      expect(TestProvider.calls).toEqual([]);
    },
  );

  it("rejects fractional downscale dimensions before generation", async () => {
    registerTestProvider();
    const root = await makeRoot("image-gen-invalid-downscale-");
    await expect(
      main([
        "--provider",
        "test-image-gen",
        "generate",
        "--prompt",
        "opaque",
        "--downscale-max-dim",
        "1.5",
      ]),
    ).rejects.toThrow("argument --downscale-max-dim: invalid int value: '1.5'");
    expect(TestProvider.calls).toEqual([]);
  });

  it("omits downscaled paths for vector SVG batch dry-runs", async () => {
    const root = await makeRoot("image-gen-vector-dry-run-");
    const input = join(root, "jobs.jsonl");
    await writeFile(input, '{"prompt":"opaque vector"}\n');
    process.env.RECRAFT_API_TOKEN = "opaque-token";
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    try {
      await expect(
        main([
          "--provider",
          "recraft",
          "generate-batch",
          "--input",
          input,
          "--out-dir",
          join(root, "outputs"),
          "--model",
          "recraftv4_vector",
          "--downscale-max-dim",
          "32",
          "--dry-run",
        ]),
      ).resolves.toBe(0);
      const payload = JSON.parse(
        stdout.mock.calls.map(([value]) => String(value)).join(""),
      ) as Args;
      expect(payload.outputs).toEqual([expect.stringMatching(/\.svg$/)]);
      expect(payload.outputs_downscaled).toBeNull();
    } finally {
      stdout.mockRestore();
    }
  });

  it("supports subprocess help, unknown flags, missing command, and provider selection", async () => {
    const root = await makeRoot("image-gen-cli-");
    const help = runCli(["--help"], root);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("generate-batch");

    const unknown = runCli(["generate", "--unknown"], root);
    expect(unknown.status).toBe(2);
    expect(unknown.stderr).toContain("unrecognized arguments");

    const missing = runCli([], root);
    expect(missing.status).toBe(2);
    expect(missing.stderr).toContain("required: command");

    const dryRun = runCli(
      ["--provider=recraft", "generate", "--prompt", "opaque", "--dry-run"],
      root,
    );
    expect(dryRun.status).toBe(0);
    expect(JSON.parse(dryRun.stdout)).toMatchObject({ provider: "recraft" });
  }, 15_000);

  it("prints generic help without preload or optional package resolution", async () => {
    const root = await makeRoot("image-gen-clean-help-");
    const emptyCache = await mkdtemp(join(tmpdir(), "image-gen-empty-cache-"));
    roots.push(emptyCache);
    const result = spawnSync("bun", ["--no-install", "run", cli, "--help"], {
      cwd: root,
      env: {
        ...process.env,
        BUN_CONFIG_NO_INSTALL: "1",
        BUN_INSTALL_CACHE_DIR: emptyCache,
      },
      encoding: "utf8",
      timeout: 15_000,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("generate-batch");
    expect(result.stderr).not.toContain("Cannot find package");
  }, 20_000);

  it("reports a controlled diagnostic when a selected provider SDK is missing", async () => {
    const root = await makeRoot("image-gen-missing-sdk-");
    const emptyCache = await mkdtemp(join(tmpdir(), "image-gen-empty-cache-"));
    roots.push(emptyCache);
    const result = spawnSync(
      "bun",
      [
        "--no-install",
        "run",
        cli,
        "--provider=google",
        "generate",
        "--prompt",
        "opaque",
        "--dry-run",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          BUN_CONFIG_NO_INSTALL: "1",
          BUN_INSTALL_CACHE_DIR: emptyCache,
        },
        encoding: "utf8",
        timeout: 15_000,
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Failed to load provider 'google'");
    expect(result.stderr).toContain("Run with Bun auto-install enabled");
  }, 20_000);

  it.each(["force", "dry-run", "fail-fast"] as const)(
    "rejects an explicit false value for --%s like Python argparse",
    async (flag) => {
      const root = await makeRoot(`image-gen-boolean-${flag}-`);
      const result = runCli(
        [
          "--provider=recraft",
          `--${flag}=false`,
          "generate",
          "--prompt",
          "opaque",
          "--dry-run",
        ],
        root,
      );

      expect(result.status).toBe(2);
      expect(result.stderr).toContain(
        `argument --${flag}: ignored explicit argument 'false'`,
      );
    },
    15_000,
  );

  it.each([
    [{ prompt: "ok", typo: "value" }, /Unknown.*typo/i],
    [{ prompt: "ok", scene: 42 }, /Invalid scene.*string or null/i],
  ] as const)(
    "rejects invalid JSONL job fields before provider generation: %j",
    async (job, message) => {
      registerTestProvider();
      const root = await makeRoot("image-gen-job-validation-");
      const input = join(root, "jobs.jsonl");
      await writeFile(input, `${JSON.stringify(job)}\n`);

      await expect(
        main([
          "--provider",
          "test-image-gen",
          "generate-batch",
          "--input",
          input,
          "--out-dir",
          join(root, "outputs"),
          "--max-attempts",
          "1",
        ]),
      ).rejects.toThrow(message);
      expect(TestProvider.calls).toEqual([]);
    },
  );

  it.each(["constructor", "toString"] as const)(
    "rejects inherited provider names in parser/batch paths: %s",
    async (provider) => {
      const root = await makeRoot(`image-gen-provider-${provider}-`);
      const input = join(root, "jobs.jsonl");
      await writeFile(input, '{"prompt":"opaque"}\n');
      const result = runCli(
        [
          `--provider=${provider}`,
          "generate-batch",
          "--input",
          input,
          "--out-dir",
          join(root, "outputs"),
          "--dry-run",
        ],
        root,
      );

      expect(result.status).toBe(2);
      expect(result.stderr).toContain(
        `argument --provider: invalid choice: '${provider}'`,
      );
    },
    15_000,
  );

  it("emits structured dry-run output with output paths and no generated files", async () => {
    registerTestProvider();
    const root = await makeRoot("image-gen-dry-run-");
    const out = join(root, "result.png");
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    try {
      await expect(
        main([
          "--provider",
          "test-image-gen",
          "generate",
          "--prompt",
          "opaque prompt",
          "--out",
          out,
          "--dry-run",
        ]),
      ).resolves.toBe(0);
      const payload = JSON.parse(
        write.mock.calls.map(([value]) => String(value)).join(""),
      ) as Args;
      expect(payload).toMatchObject({ provider: "test-image-gen" });
      expect(payload.outputs).toEqual([out]);
      await expect(stat(out)).rejects.toThrow();
    } finally {
      write.mockRestore();
    }
  });

  it("writes vector direct output as SVG without raster downscaling", async () => {
    const root = await makeRoot("image-gen-vector-direct-");
    const client = {
      images: {
        generate: vi.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from("<svg/>").toString("base64") }],
        }),
      },
      post: vi.fn(),
    };
    recraftHarness.client = client;
    process.env.RECRAFT_API_TOKEN = "opaque-token";
    const output = join(root, "vector");
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    try {
      await expect(
        main([
          "--provider",
          "recraft",
          "generate",
          "--model",
          "recraftv4_vector",
          "--prompt",
          "opaque vector",
          "--out",
          output,
          "--downscale-max-dim",
          "32",
        ]),
      ).resolves.toBe(0);
      expect(await stat(`${output}.svg`)).toBeTruthy();
      expect(client.images.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "recraftv4_vector",
          response_format: "b64_json",
        }),
      );
      expect(sharpHarness.entry).not.toHaveBeenCalled();
    } finally {
      stdout.mockRestore();
    }
  });

  it("uses SVG vector defaults and preserves explicit raster batch output", async () => {
    const root = await makeRoot("image-gen-vector-batch-");
    const input = join(root, "jobs.jsonl");
    const outDir = join(root, "outputs");
    await writeFile(
      input,
      [
        JSON.stringify({ prompt: "vector", model: "recraftv4_vector" }),
        JSON.stringify({
          prompt: "raster",
          model: "recraftv4_vector",
          output_format: "png",
        }),
      ].join("\n"),
    );
    const client = {
      images: {
        generate: vi.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from("<svg/>").toString("base64") }],
        }),
      },
      post: vi.fn(),
    };
    recraftHarness.client = client;
    process.env.RECRAFT_API_TOKEN = "opaque-token";
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    try {
      await expect(
        main([
          "--provider",
          "recraft",
          "generate-batch",
          "--input",
          input,
          "--out-dir",
          outDir,
          "--downscale-max-dim",
          "32",
        ]),
      ).resolves.toBe(0);
      expect(await stat(join(outDir, "001-vector.svg"))).toBeTruthy();
      expect(await stat(join(outDir, "002-raster.png"))).toBeTruthy();
      expect(client.images.generate).toHaveBeenCalledTimes(2);
      expect(sharpHarness.entry).toHaveBeenCalledTimes(1);
    } finally {
      stdout.mockRestore();
    }
  });

  it("generates opaque output through an injected provider and isolates runs", async () => {
    registerTestProvider();
    const root = await makeRoot("image-gen-generate-");
    const out = join(root, "nested", "result.png");
    await expect(
      main([
        "--provider",
        "test-image-gen",
        "generate",
        "--prompt",
        "opaque prompt",
        "--out",
        out,
      ]),
    ).resolves.toBe(0);
    expect(TestProvider.calls).toEqual([
      "generate:Primary request: opaque prompt",
    ]);
    expect((await stat(out)).size).toBeGreaterThan(0);
    const second = join(root, "second.png");
    await expect(
      main([
        "--provider",
        "test-image-gen",
        "generate",
        "--prompt",
        "second",
        "--out",
        second,
      ]),
    ).resolves.toBe(0);
    expect((await stat(second)).size).toBeGreaterThan(0);
  });

  it("runs JSONL batch jobs with overrides, retries, concurrency, and ordered outputs", async () => {
    registerTestProvider();
    const root = await makeRoot("image-gen-batch-");
    const input = join(root, "jobs.jsonl");
    const outDir = join(root, "outputs");
    await writeFile(
      input,
      [
        JSON.stringify({ prompt: "first", n: 1 }),
        JSON.stringify({ prompt: "second", n: 1, output_format: "png" }),
      ].join("\n"),
    );
    TestProvider.failures.set("Primary request: second", 1);

    await expect(
      main([
        "--provider",
        "test-image-gen",
        "generate-batch",
        "--input",
        input,
        "--out-dir",
        outDir,
        "--concurrency",
        "2",
        "--max-attempts",
        "2",
      ]),
    ).resolves.toBe(0);
    expect(TestProvider.calls).toEqual(
      expect.arrayContaining([
        "async:Primary request: first",
        "async:Primary request: second",
      ]),
    );
    expect((await stat(join(outDir, "001-first.png"))).size).toBeGreaterThan(0);
    expect((await stat(join(outDir, "002-second.png"))).size).toBeGreaterThan(
      0,
    );
  });

  it("announces each job before its provider call and starts jobs in ascending order", async () => {
    registerTestProvider();
    const root = await makeRoot("image-gen-start-order-");
    const input = join(root, "jobs.jsonl");
    const outDir = join(root, "outputs");
    await writeFile(
      input,
      [
        JSON.stringify({ prompt: "held" }),
        JSON.stringify({ prompt: "quick-a" }),
        JSON.stringify({ prompt: "quick-b" }),
      ].join("\n"),
    );
    TestProvider.holdPrompts.add("Primary request: held");
    const timeline: string[] = [];
    const stderr = captureStderr(timeline);
    TestProvider.onCall = (prompt) => {
      timeline.push(`provider:${prompt}`);
    };
    const outcome = main([
      "--provider",
      "test-image-gen",
      "generate-batch",
      "--input",
      input,
      "--out-dir",
      outDir,
      "--concurrency",
      "2",
    ]);
    outcome.catch(() => undefined);
    try {
      await waitFor(
        () =>
          timeline.some((event) => event.startsWith("[job 3/3] completed in")),
        "job 3 to complete while job 1 is held",
      );
      const release = TestProvider.holdResolvers.get("Primary request: held");
      expect(release).toBeDefined();
      release?.();
      await expect(outcome).resolves.toBe(0);

      const stderrText = stderr.text();
      expect(stderrText.match(/^\[job \d\/3\] starting$/gm)).toEqual([
        "[job 1/3] starting",
        "[job 2/3] starting",
        "[job 3/3] starting",
      ]);
      expect(
        [
          ...stderrText.matchAll(/^\[job (\d)\/3\] completed in (\d+\.\d)s$/gm),
        ].map(([, job]) => job),
      ).toEqual(["2", "3", "1"]);
      const events = timeline.flatMap((entry) =>
        entry.startsWith("provider:")
          ? [entry]
          : entry.split("\n").filter(Boolean),
      );
      for (const [index, prompt] of [
        ["1", "held"],
        ["2", "quick-a"],
        ["3", "quick-b"],
      ] as const) {
        const startAt = events.indexOf(`[job ${index}/3] starting`);
        expect(startAt).toBeGreaterThanOrEqual(0);
        expect(startAt).toBeLessThan(
          events.indexOf(`provider:Primary request: ${prompt}`),
        );
        expect(
          events.findIndex((event) =>
            event.startsWith(`[job ${index}/3] completed in `),
          ),
        ).toBeGreaterThan(startAt);
      }
      for (const name of ["001-held.png", "002-quick-a.png", "003-quick-b.png"])
        expect((await stat(join(outDir, name))).size).toBeGreaterThan(0);
    } finally {
      stderr.restore();
    }
  });

  it("reports seconds covering only the retry-wrapped provider call", async () => {
    registerTestProvider();
    const root = await makeRoot("image-gen-timing-");
    const input = join(root, "jobs.jsonl");
    const outDir = join(root, "outputs");
    await writeFile(input, '{"prompt":"timed"}\n');
    TestProvider.failures.set("Primary request: timed", 1);
    let clockMs = 5_000;
    const clock = vi
      .spyOn(performance, "now")
      .mockImplementation(() => clockMs);
    TestProvider.onCall = (prompt) => {
      clockMs += (TestProvider.failures.get(prompt) ?? 0) > 0 ? 200 : 300;
    };
    sharpHarness.pipeline.toBuffer.mockImplementation(async () => {
      clockMs += 9_000;
      return Uint8Array.from([6, 5, 4]);
    });
    const stderr = captureStderr();
    try {
      await expect(
        main([
          "--provider",
          "test-image-gen",
          "generate-batch",
          "--input",
          input,
          "--out-dir",
          outDir,
          "--max-attempts",
          "2",
          "--downscale-max-dim",
          "32",
        ]),
      ).resolves.toBe(0);

      expect(TestProvider.calls).toEqual([
        "async:Primary request: timed",
        "async:Primary request: timed",
      ]);
      const stderrText = stderr.text();
      expect(stderrText).toContain("[job 1/1] starting\n");
      expect(stderrText).toContain(
        "[job 1/1] attempt 1/2 failed (Error); retrying in 0.0s\n",
      );
      expect(stderrText).toContain("[job 1/1] completed in 0.5s\n");
      expect(stderrText.match(/completed in /g) ?? []).toHaveLength(1);
      expect((await stat(join(outDir, "001-timed.png"))).size).toBeGreaterThan(
        0,
      );
      expect(
        (await stat(join(outDir, "001-timed-web.png"))).size,
      ).toBeGreaterThan(0);
    } finally {
      stderr.restore();
      clock.mockRestore();
    }
  });

  it("waits for started work before cleanup and stops later dispatch on fail-fast", async () => {
    registerTestProvider();
    TestProvider.prepareFailFastProbe();
    TestProvider.failures.set("Primary request: fail", 1);
    const root = await makeRoot("image-gen-fail-fast-in-flight-");
    const input = join(root, "jobs.jsonl");
    const outDir = join(root, "outputs");
    await writeFile(
      input,
      [
        JSON.stringify({
          prompt: "slow",
          images: ["https://example.test/opaque.bin"],
        }),
        JSON.stringify({ prompt: "fail" }),
        JSON.stringify({ prompt: "later" }),
      ].join("\n"),
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(Uint8Array.from([1, 2, 3]), { status: 200 }),
      );
    try {
      const outcome = main([
        "--provider",
        "test-image-gen",
        "generate-batch",
        "--input",
        input,
        "--out-dir",
        outDir,
        "--concurrency",
        "3",
        "--max-attempts",
        "1",
        "--fail-fast",
      ]).catch((error: unknown) => error);

      await Promise.race([
        TestProvider.slowStarted,
        outcome.then((result) => {
          throw result instanceof Error
            ? result
            : new Error("batch ended before slow job started");
        }),
      ]);
      await TestProvider.failureObserved;
      TestProvider.releaseSlow?.();
      const error = await outcome;
      await TestProvider.slowSettled;

      expect(error).toBeInstanceOf(Error);
      expect(TestProvider.cleanupViolation).toBe(false);
      expect(TestProvider.calls).toEqual(
        expect.arrayContaining([
          "async:Primary request: slow",
          "async:Primary request: fail",
        ]),
      );
      expect(TestProvider.calls).not.toContain("async:Primary request: later");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("returns partial-failure status and honors fail-fast cancellation", async () => {
    registerTestProvider();
    const root = await makeRoot("image-gen-failure-");
    const input = join(root, "jobs.jsonl");
    await writeFile(input, '{"prompt":"bad"}\n{"prompt":"good"}\n');
    TestProvider.failures.set("Primary request: bad", 3);
    const stderr = captureStderr();

    try {
      await expect(
        main([
          "--provider",
          "test-image-gen",
          "generate-batch",
          "--input",
          input,
          "--out-dir",
          join(root, "partial"),
          "--max-attempts",
          "1",
        ]),
      ).resolves.toBe(1);
      const partialStderr = stderr.text();
      expect(partialStderr).toContain("[job 1/2] failed: temporary failure\n");
      expect(partialStderr).toContain("[job 2/2] starting\n");
      expect(partialStderr).toMatch(/^\[job 2\/2\] completed in \d+\.\ds$/m);
      expect(
        (await stat(join(root, "partial", "002-good.png"))).size,
      ).toBeGreaterThan(0);

      stderr.reset();
      await expect(
        main([
          "--provider",
          "test-image-gen",
          "generate-batch",
          "--input",
          input,
          "--out-dir",
          join(root, "fail-fast"),
          "--max-attempts",
          "1",
          "--fail-fast",
        ]),
      ).rejects.toThrow("temporary failure");
      expect(stderr.text()).toContain("[job 1/2] failed: temporary failure\n");
    } finally {
      stderr.restore();
    }
  });
});
