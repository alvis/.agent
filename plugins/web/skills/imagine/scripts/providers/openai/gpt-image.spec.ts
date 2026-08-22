import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let mockedOpenAIClient: unknown;
vi.mock(
  "openai@6",
  () => ({
    default: class {
      constructor() {
        return mockedOpenAIClient;
      }
    },
  }),
  { virtual: true },
);

import {
  GPTImageProvider,
  MODEL_PARAMS,
  _normalize_output_format,
  _validate_transparency,
} from "./gpt-image";
import { ImagineError } from "../base";

const roots: string[] = [];

function capture_stderr() {
  return vi.spyOn(process.stderr, "write").mockImplementation(() => true);
}

function stderr_lines(spy: ReturnType<typeof capture_stderr>): string[] {
  return spy.mock.calls.map(([chunk]) => String(chunk));
}

beforeEach(() => {
  vi.stubGlobal("Bun", {
    file: (path: string) =>
      new Blob([readFileSync(path)], { type: "image/png" }),
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

describe("OpenAI GPT Image provider", () => {
  it("normalizes formats and enforces transparent-background compatibility", () => {
    const provider = new GPTImageProvider();
    expect(MODEL_PARAMS.model.default).toBe("gpt-image-1.5");
    expect(_normalize_output_format("JPG")).toBe("jpeg");
    expect(() => _normalize_output_format("bmp")).toThrow(
      "output-format must be png, jpeg, jpg, or webp",
    );
    expect(() => _validate_transparency("transparent", "jpeg")).toThrow(
      ImagineError,
    );
    expect(() => provider.validate({ output_compression: 101 })).toThrow(
      "--output-compression must be between 0 and 100",
    );
  });

  it("filters generation payload parameters and selects generation dry-run endpoint", () => {
    const provider = new GPTImageProvider();
    expect(
      provider._build_payload("opaque prompt", {
        model: null,
        n: 2,
        size: null,
        quality: "high",
        background: null,
        output_format: "jpg",
        ignored: "not forwarded",
      }),
    ).toEqual({
      model: "gpt-image-1.5",
      prompt: "opaque prompt",
      n: 2,
      size: "1024x1024",
      quality: "high",
      output_format: "jpeg",
    });
    expect(provider.dry_run_payload("opaque prompt", {})).toMatchObject({
      provider: "openai",
      endpoint: "/v1/images/generations",
    });
  });

  it("uses mocked generate and edit clients with image, reference, and mask file parts", async () => {
    const root = await mkdtemp(join(tmpdir(), "openai-provider-"));
    roots.push(root);
    const image = join(root, "image.bin");
    const reference = join(root, "reference.bin");
    const mask = join(root, "mask.bin");
    await writeFile(image, Uint8Array.from([1]));
    await writeFile(reference, Uint8Array.from([2, 3]));
    await writeFile(mask, Uint8Array.from([4]));

    const client = {
      images: {
        generate: vi
          .fn()
          .mockResolvedValue({ data: [{ b64_json: "opaque-generated" }] }),
        edit: vi
          .fn()
          .mockResolvedValue({ data: [{ b64_json: "opaque-edited" }] }),
      },
    };
    mockedOpenAIClient = client;
    const provider = new GPTImageProvider();

    await expect(provider.generate("generate", {})).resolves.toEqual([
      "opaque-generated",
    ]);
    expect(client.images.generate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-image-1.5", prompt: "generate" }),
    );

    await expect(
      provider.generate(
        "edit",
        { input_fidelity: "high" },
        {
          images: [image],
          references: [reference],
          mask,
        },
      ),
    ).resolves.toEqual(["opaque-edited"]);
    const request = client.images.edit.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(request).toMatchObject({
      input_fidelity: "high",
      mask: expect.any(File),
    });
    expect(request.image).toEqual(expect.arrayContaining([expect.any(File)]));
    expect((request.image as File[]).map((part) => part.name)).toEqual([
      "image.bin",
      "reference.bin",
    ]);
  });

  it("routes references to edit and preserves structural dry-run paths", async () => {
    const provider = new GPTImageProvider();
    const payload = provider.dry_run_payload(
      "opaque prompt",
      { output_format: "webp" },
      {
        references: ["reference.bin"],
        mask: "mask.bin",
      },
    );
    expect(payload).toMatchObject({
      provider: "openai",
      endpoint: "/v1/images/edits",
      image: ["reference.bin"],
      references: ["reference.bin"],
      mask: "mask.bin",
    });
  });

  it("announces the edit call on stderr with a references-only hint and timed completion", async () => {
    const root = await mkdtemp(join(tmpdir(), "openai-provider-edit-"));
    roots.push(root);
    const reference = join(root, "reference.bin");
    await writeFile(reference, Uint8Array.from([1, 2]));
    const client = {
      images: {
        generate: vi.fn(),
        edit: vi
          .fn()
          .mockResolvedValue({ data: [{ b64_json: "opaque-edited" }] }),
      },
    };
    mockedOpenAIClient = client;
    const stderr = capture_stderr();

    await expect(
      new GPTImageProvider().generate(
        "opaque prompt",
        {},
        {
          references: [reference],
        },
      ),
    ).resolves.toEqual(["opaque-edited"]);

    const lines = stderr_lines(stderr);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      "OpenAI: using edit endpoint for style reference support.\n",
    );
    expect(lines[1]).toBe("Calling OpenAI Image API (edit) with 1 image(s).\n");
    expect(lines[2]).toMatch(/^Edit completed in \d+\.\d+s\.\n$/);
    expect(client.images.generate).not.toHaveBeenCalled();
  });

  it("counts images plus references in the edit announcement without the references-only hint", async () => {
    const root = await mkdtemp(join(tmpdir(), "openai-provider-count-"));
    roots.push(root);
    const image = join(root, "image.bin");
    const reference = join(root, "reference.bin");
    await writeFile(image, Uint8Array.from([1]));
    await writeFile(reference, Uint8Array.from([2]));
    const client = {
      images: {
        generate: vi.fn(),
        edit: vi.fn().mockResolvedValue({ data: [{ b64_json: "edited" }] }),
      },
    };
    mockedOpenAIClient = client;
    const stderr = capture_stderr();

    await expect(
      new GPTImageProvider().generate(
        "opaque prompt",
        {},
        {
          images: [image],
          references: [reference],
        },
      ),
    ).resolves.toEqual(["edited"]);

    const lines = stderr_lines(stderr);
    expect(lines[0]).toBe("Calling OpenAI Image API (edit) with 2 image(s).\n");
    expect(lines[1]).toMatch(/^Edit completed in \d+\.\d+s\.\n$/);
    expect(lines).toHaveLength(2);
  });

  it("announces the generation call on stderr with a timed completion", async () => {
    const client = {
      images: {
        generate: vi
          .fn()
          .mockResolvedValue({ data: [{ b64_json: "opaque-generated" }] }),
        edit: vi.fn(),
      },
    };
    mockedOpenAIClient = client;
    const stderr = capture_stderr();

    await expect(
      new GPTImageProvider().generate("opaque prompt", {}),
    ).resolves.toEqual(["opaque-generated"]);

    const lines = stderr_lines(stderr);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "Calling OpenAI Image API (generation). This can take up to a couple of minutes.\n",
    );
    expect(lines[1]).toMatch(/^Generation completed in \d+\.\d+s\.\n$/);
    expect(client.images.edit).not.toHaveBeenCalled();
  });
});
