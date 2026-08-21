import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sharpHarness = vi.hoisted(() => {
  const pipeline = {
    flatten: vi.fn(),
    toFormat: vi.fn(),
    toBuffer: vi.fn(),
  };
  return { entry: vi.fn(), pipeline };
});

let mockedGoogleClient: unknown;
let googleConstructorError: unknown;
vi.mock(
  "@google/genai@1",
  () => ({
    GoogleGenAI: class {
      constructor() {
        if (googleConstructorError) throw googleConstructorError;
        return mockedGoogleClient;
      }
    },
  }),
  { virtual: true },
);
vi.mock("sharp@0.34", () => ({ default: sharpHarness.entry }), {
  virtual: true,
});

import {
  MODEL_PARAMS,
  NanoBananaProvider,
  _convert_format,
  _extract_images_from_response,
} from "./nano-banana";
import { ImagineError } from "../base";
import {
  _generate_one_with_retries,
  _is_rate_limit_error,
  _is_transient_error,
} from "../../helpers";

const roots: string[] = [];

function fakeBun(path: string): Blob {
  return new Blob([readFileSync(path)], { type: "image/png" });
}

beforeEach(() => {
  vi.stubGlobal("Bun", { file: fakeBun });
  googleConstructorError = undefined;
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

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

describe("Google Nano Banana provider", () => {
  it("exposes model defaults and maps OpenAI sizes into config and dry-run payloads", () => {
    const provider = new NanoBananaProvider();
    expect(MODEL_PARAMS.model.default).toBe("gemini-3.1-flash-image-preview");
    expect(provider._build_config({ size: "1536x1024" })).toEqual({
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "3:2", imageSize: "1K" },
    });
    expect(
      provider.dry_run_payload("opaque prompt", {
        size: "1024x1536",
        n: 2,
        model: null,
      }),
    ).toMatchObject({
      provider: "google",
      endpoint: "models.generate_content",
      aspect_ratio: "2:3",
      resolution: "1K",
      n: 2,
    });
  });

  it("builds ordered reference, edit, and prompt contents with file parts", async () => {
    const root = await mkdtemp(join(tmpdir(), "google-provider-"));
    roots.push(root);
    const reference = join(root, "reference.bin");
    const image = join(root, "image.bin");
    await writeFile(reference, Uint8Array.from([1, 2]));
    await writeFile(image, Uint8Array.from([3, 4, 5]));

    const provider = new NanoBananaProvider();
    const contents = await provider._build_contents("opaque prompt", {
      references: [reference],
      images: [image],
      mask: join(root, "mask.bin"),
    });

    expect(contents).toHaveLength(3);
    expect(contents[0]).toMatchObject({
      inlineData: { data: expect.any(String) },
    });
    expect(contents[1]).toMatchObject({
      inlineData: { data: expect.any(String) },
    });
    expect(contents[2]).toEqual({ text: "opaque prompt" });
    expect(
      Buffer.from(String(contents[0]?.inlineData?.data), "base64"),
    ).toHaveLength(2);
    expect(
      Buffer.from(String(contents[1]?.inlineData?.data), "base64"),
    ).toHaveLength(3);
  });

  it("extracts response images and preserves png base64 while classifying failures", async () => {
    const encoded = Buffer.from([9, 8, 7]).toString("base64");
    await expect(
      _extract_images_from_response(
        {
          candidates: [
            { content: { parts: [{ inlineData: { data: encoded } }] } },
          ],
        },
        "png",
      ),
    ).resolves.toEqual([encoded]);
    await expect(_extract_images_from_response({}, "png")).rejects.toThrow(
      "No candidates in Google API response",
    );
    const cause = new Error("sharp conversion failed");
    sharpHarness.entry.mockImplementationOnce(() => {
      throw cause;
    });
    await expect(
      _convert_format(Uint8Array.from([1]), "jpeg"),
    ).rejects.toMatchObject({
      message: "Converting image format failed.",
      cause,
    });
  });

  it("uses the mocked client, returns generated counts, and reports all-call failure", async () => {
    const client = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [
                  { inlineData: { data: Buffer.from([1]).toString("base64") } },
                ],
              },
            },
          ],
        }),
      },
    };
    mockedGoogleClient = client;
    const provider = new NanoBananaProvider();

    await expect(
      provider.generate("opaque prompt", { n: 2 }),
    ).resolves.toHaveLength(2);
    expect(client.models.generateContent).toHaveBeenCalledTimes(2);
    expect(client.models.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.1-flash-image-preview" }),
    );

    client.models.generateContent.mockRejectedValue(
      new Error("provider unavailable"),
    );
    await expect(provider.generate("opaque prompt", { n: 2 })).rejects.toThrow(
      "All concurrent generation calls failed",
    );
  });

  it("warns about failed concurrent calls only when more than one call is made", async () => {
    const client = {
      models: {
        generateContent: vi
          .fn()
          .mockRejectedValue(new Error("provider unavailable")),
      },
    };
    mockedGoogleClient = client;
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const provider = new NanoBananaProvider();

    await expect(provider.generate("opaque prompt", {})).rejects.toThrow(
      "provider unavailable",
    );
    expect(stderr).not.toHaveBeenCalledWith(
      expect.stringContaining("Warning: Concurrent call"),
    );

    await expect(provider.generate("opaque prompt", { n: 2 })).rejects.toThrow(
      "All concurrent generation calls failed",
    );
    expect(stderr).toHaveBeenCalledWith(
      "Warning: Concurrent call 1/2 failed: Error: provider unavailable\n",
    );
  });

  it("surfaces the provider's own failure on the default n=1 path without wrapping", async () => {
    const failure = new Error("429 RESOURCE_EXHAUSTED: quota exceeded");
    const client = {
      models: { generateContent: vi.fn().mockRejectedValue(failure) },
    };
    mockedGoogleClient = client;
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const provider = new NanoBananaProvider();

    await expect(provider.generate("opaque prompt", {})).rejects.toBe(failure);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("keeps rate-limit classification and engages the shared retry helper at default n", async () => {
    const encoded = Buffer.from([3]).toString("base64");
    const failure = Object.assign(new Error("429 Too Many Requests"), {
      retry_after: 0,
    });
    const client = {
      models: {
        generateContent: vi
          .fn()
          .mockRejectedValueOnce(failure)
          .mockResolvedValueOnce({
            candidates: [
              { content: { parts: [{ inlineData: { data: encoded } }] } },
            ],
          }),
      },
    };
    mockedGoogleClient = client;
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const sleeps: number[] = [];
    vi.stubGlobal("Bun", {
      file: fakeBun,
      sleep: (ms: number) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });
    const provider = new NanoBananaProvider();

    expect(_is_rate_limit_error(failure)).toBe(true);
    expect(_is_transient_error(failure)).toBe(true);

    await expect(
      _generate_one_with_retries(
        provider,
        "opaque prompt",
        {},
        {
          attempts: 2,
          job_label: "[job 1/1]",
        },
      ),
    ).resolves.toEqual([encoded]);
    expect(client.models.generateContent).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([0]);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("[job 1/1] attempt 1/2 failed"),
    );
  });

  it("keeps partial successes across concurrent calls while warning per failure", async () => {
    const encoded = Buffer.from([5]).toString("base64");
    let calls = 0;
    const client = {
      models: {
        generateContent: vi.fn(() =>
          ++calls === 1
            ? Promise.reject(new Error("call one failed"))
            : Promise.resolve({
                candidates: [
                  { content: { parts: [{ inlineData: { data: encoded } }] } },
                ],
              }),
        ),
      },
    };
    mockedGoogleClient = client;
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const provider = new NanoBananaProvider();

    await expect(provider.generate("opaque prompt", { n: 2 })).resolves.toEqual(
      [encoded],
    );
    expect(client.models.generateContent).toHaveBeenCalledTimes(2);
    expect(stderr).toHaveBeenCalledWith(
      "Warning: Concurrent call 1/2 failed: Error: call one failed\n",
    );
  });

  it("propagates raw client-construction failures instead of an install diagnostic", async () => {
    const failure = new Error("constructor exploded");
    googleConstructorError = failure;
    await expect(
      new NanoBananaProvider().generate("opaque prompt", {}),
    ).rejects.toBe(failure);
  });
});
