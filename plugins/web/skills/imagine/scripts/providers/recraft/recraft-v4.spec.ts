import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let mockedClient: unknown;
vi.mock(
  "openai@6",
  () => ({
    default: class {
      constructor() {
        return mockedClient;
      }
    },
  }),
  { virtual: true },
);

import {
  ALL_MODELS,
  RecraftProvider,
  V3_STYLES,
  V4_PRO_SIZES,
  V4_SIZES,
  V3_V2_SIZES,
  VECTOR_MODELS,
  _resolve_size,
} from "./recraft-v4";
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
  mockedClient = undefined;
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

describe("Recraft provider contracts", () => {
  it("resolves model-specific sizes and vector output defaults", () => {
    expect(ALL_MODELS).toHaveLength(8);
    expect(_resolve_size("16:9", "recraftv4")).toBe(V4_SIZES["16:9"]);
    expect(_resolve_size("1:1", "recraftv4_pro")).toBe(V4_PRO_SIZES["1:1"]);
    expect(_resolve_size("1024x1024", "recraftv3")).toBe("1024x1024");
    expect(() => _resolve_size("16:9", "recraftv3")).toThrow(
      "Aspect ratio '16:9' is not valid for V3/V2 models",
    );
    expect(() => _resolve_size("1024x1024", "recraftv4_pro")).toThrow(
      "Size '1024x1024' is not valid for V4 Pro models",
    );

    const provider = new RecraftProvider();
    expect(provider._get_output_format({ model: "recraftv4_vector" })).toBe(
      "svg",
    );
    expect(
      provider.dry_run_payload("vector prompt", {
        model: "recraftv4_vector",
      }),
    ).toMatchObject({ model: "recraftv4_vector", output_format: "svg" });
    expect(
      provider.dry_run_payload("vector prompt", {
        model: "recraftv4_vector",
        output_format: "png",
      }),
    ).toMatchObject({ model: "recraftv4_vector", output_format: "png" });
    expect(provider._get_output_format({ model: "recraftv4" })).toBe("png");
    expect(VECTOR_MODELS.has("recraftv3_vector")).toBe(true);
  });

  it("validates style, style-id, negative, model, size, and count constraints", () => {
    const provider = new RecraftProvider();
    expect(() =>
      provider.validate({
        model: "recraftv3",
        recraft_style: V3_STYLES[0],
        size: "1024x1024",
      }),
    ).not.toThrow();
    expect(() =>
      provider.validate({ model: "recraftv4", recraft_style: "any" }),
    ).toThrow("only supported with V2/V3 models");
    expect(() =>
      provider.validate({ model: "recraftv4", negative_prompt: "opaque" }),
    ).toThrow("negative-prompt is only supported");
    expect(() =>
      provider.validate({
        model: "recraftv3",
        recraft_style: "any",
        style_id: "id",
      }),
    ).toThrow("mutually exclusive");
    expect(() =>
      provider.validate({
        model: "recraftv3",
        recraft_style: "digital_illustration/pixel_art",
      }),
    ).toThrow("not valid for V3 models");
    expect(() => provider.validate({ model: "recraftv4", n: 7 })).toThrow(
      "--n must be between 1 and 6",
    );
  });

  it("filters generation payloads and emits edit/inpaint dry-run contracts", () => {
    const provider = new RecraftProvider();
    expect(
      provider._build_payload("opaque prompt", {
        model: "recraftv4",
        size: "16:9",
        n: 2,
        recraft_style: null,
        negative_prompt: "avoid",
      }),
    ).toEqual({
      model: "recraftv4",
      prompt: "opaque prompt",
      n: 2,
      size: V4_SIZES["16:9"],
      response_format: "b64_json",
      extra_body: { negative_prompt: "avoid" },
    });
    expect(
      provider.dry_run_payload("prompt", { model: "recraftv4" }),
    ).toMatchObject({
      endpoint: "/v1/images/generations",
      output_format: "png",
    });
    expect(
      provider.dry_run_payload(
        "prompt",
        { model: "recraftv4", strength: 0.5 },
        {
          images: ["image.bin"],
        },
      ),
    ).toMatchObject({ endpoint: "/v1/images/imageToImage", strength: 0.5 });
    expect(
      provider.dry_run_payload(
        "prompt",
        { model: "recraftv4" },
        {
          images: ["image.bin"],
          mask: "mask.bin",
        },
      ),
    ).toMatchObject({
      endpoint: "/v1/images/inpaint",
      image: ["image.bin"],
      mask: "mask.bin",
    });
  });

  it("calls generation and ordered image-to-image multipart fields with output counts", async () => {
    const root = await mkdtemp(join(tmpdir(), "recraft-provider-"));
    roots.push(root);
    const image = join(root, "image.bin");
    const mask = join(root, "mask.bin");
    await writeFile(image, Uint8Array.from([1, 2]));
    await writeFile(mask, Uint8Array.from([3]));
    const client = {
      images: {
        generate: vi.fn().mockResolvedValue({
          data: [{ b64_json: "generated-1" }, { b64_json: "generated-2" }],
        }),
      },
      post: vi.fn(),
    };
    mockedClient = client;
    const provider = new RecraftProvider();

    await expect(
      provider.generate("generate", { model: "recraftv4", n: 2 }),
    ).resolves.toEqual(["generated-1", "generated-2"]);
    expect(client.images.generate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "recraftv4", n: 2 }),
    );

    client.post.mockResolvedValue({ data: [{ b64_json: "edited" }] });
    await expect(
      provider.generate(
        "edit",
        { model: "recraftv4", strength: 0.4 },
        { images: [image], mask },
      ),
    ).resolves.toEqual(["edited"]);
    expect(client.post).toHaveBeenCalledWith(
      "/images/inpaint",
      expect.objectContaining({ body: expect.any(FormData) }),
    );
    const form = client.post.mock.calls[0]?.[1].body as FormData;
    expect(form.get("prompt")).toBe("edit");
    expect(form.get("model")).toBe("recraftv4");
    expect(form.get("image")).toBeInstanceOf(File);
    expect(form.get("mask")).toBeInstanceOf(File);
    expect(form.get("strength")).toBeNull();
  });

  it("creates a custom style from ordered references and uses the returned style id", async () => {
    const root = await mkdtemp(join(tmpdir(), "recraft-style-"));
    roots.push(root);
    const first = join(root, "first.bin");
    const second = join(root, "second.bin");
    await writeFile(first, Uint8Array.from([1]));
    await writeFile(second, Uint8Array.from([2]));
    const client = {
      images: {
        generate: vi.fn().mockResolvedValue({ data: [{ b64_json: "styled" }] }),
      },
      post: vi.fn().mockResolvedValue({ id: "custom-style-id" }),
    };
    mockedClient = client;
    const provider = new RecraftProvider();

    await expect(
      provider.generate(
        "styled prompt",
        { model: "recraftv3", recraft_style: "icon" },
        {
          references: [first, second],
        },
      ),
    ).resolves.toEqual(["styled"]);
    const styleForm = client.post.mock.calls[0]?.[1].body as FormData;
    expect(client.post.mock.calls[0]?.[0]).toBe("/styles");
    expect(styleForm.get("style")).toBe("icon");
    expect(styleForm.getAll("file").map((file) => (file as File).name)).toEqual(
      ["first.bin", "second.bin"],
    );
    expect(client.images.generate).toHaveBeenCalledWith(
      expect.objectContaining({ extra_body: { style_id: "custom-style-id" } }),
    );
    await expect(
      provider.generate(
        "prompt",
        { model: "recraftv4" },
        { references: [first] },
      ),
    ).rejects.toThrow(
      "Custom style references are only supported with V3 models",
    );
  });

  it.each([
    ["missing id", {}],
    ["blank id", { id: "   " }],
    ["non-string id", { id: 42 }],
  ] as const)(
    "rejects a malformed custom-style response (%s) before generation",
    async (_label, styleResponse) => {
      const root = await mkdtemp(join(tmpdir(), "recraft-style-invalid-"));
      roots.push(root);
      const reference = join(root, "reference.bin");
      await writeFile(reference, Uint8Array.from([1]));
      const client = {
        images: { generate: vi.fn() },
        post: vi.fn().mockResolvedValue(styleResponse),
      };
      mockedClient = client;

      await expect(
        new RecraftProvider().generate(
          "styled prompt",
          { model: "recraftv3", recraft_style: "icon" },
          { references: [reference] },
        ),
      ).rejects.toMatchObject({
        name: "ImagineError",
        message: "Invalid Recraft custom-style response.",
      });
      expect(client.post).toHaveBeenCalledTimes(1);
      expect(client.images.generate).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["missing data", {}],
    ["non-array data", { data: {} }],
    ["empty data", { data: [] }],
    ["missing b64_json", { data: [{}] }],
    ["blank b64_json", { data: [{ b64_json: "" }] }],
    ["non-string b64_json", { data: [{ b64_json: 7 }] }],
  ] as const)(
    "rejects malformed generation responses (%s) without follow-up calls",
    async (_label, response) => {
      const client = {
        images: { generate: vi.fn().mockResolvedValue(response) },
        post: vi.fn(),
      };
      mockedClient = client;

      await expect(
        new RecraftProvider().generate("prompt", { model: "recraftv4" }),
      ).rejects.toMatchObject({
        name: "ImagineError",
        message: "Invalid Recraft generation response.",
      });
      expect(client.images.generate).toHaveBeenCalledTimes(1);
      expect(client.post).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["missing data", {}],
    ["non-array data", { data: {} }],
    ["empty data", { data: [] }],
    ["missing b64_json", { data: [{}] }],
    ["blank b64_json", { data: [{ b64_json: "" }] }],
    ["non-string b64_json", { data: [{ b64_json: 7 }] }],
  ] as const)(
    "rejects malformed edit responses (%s) without generation calls",
    async (_label, response) => {
      const root = await mkdtemp(join(tmpdir(), "recraft-edit-invalid-"));
      roots.push(root);
      const image = join(root, "image.bin");
      await writeFile(image, Uint8Array.from([1]));
      const client = {
        images: { generate: vi.fn() },
        post: vi.fn().mockResolvedValue(response),
      };
      mockedClient = client;

      await expect(
        new RecraftProvider().generate(
          "edit prompt",
          { model: "recraftv4" },
          { images: [image] },
        ),
      ).rejects.toMatchObject({
        name: "ImagineError",
        message: "Invalid Recraft edit response.",
      });
      expect(client.post).toHaveBeenCalledTimes(1);
      expect(client.images.generate).not.toHaveBeenCalled();
    },
  );

  it("propagates provider failures without fabricating output", async () => {
    const client = {
      images: {
        generate: vi.fn().mockRejectedValue(new Error("service unavailable")),
      },
      post: vi.fn(),
    };
    mockedClient = client;
    await expect(new RecraftProvider().generate("prompt", {})).rejects.toThrow(
      "service unavailable",
    );
  });

  it("announces inpainting and image-to-image calls on stderr with timed completions", async () => {
    const root = await mkdtemp(join(tmpdir(), "recraft-progress-"));
    roots.push(root);
    const image = join(root, "image.bin");
    const mask = join(root, "mask.bin");
    await writeFile(image, Uint8Array.from([1]));
    await writeFile(mask, Uint8Array.from([2]));
    const client = {
      images: { generate: vi.fn() },
      post: vi.fn().mockResolvedValue({ data: [{ b64_json: "edited" }] }),
    };
    mockedClient = client;
    const stderr = capture_stderr();
    const provider = new RecraftProvider();

    await expect(
      provider.generate(
        "edit prompt",
        { model: "recraftv4" },
        { images: [image], mask },
      ),
    ).resolves.toEqual(["edited"]);
    expect(client.post.mock.calls[0]?.[0]).toBe("/images/inpaint");
    let lines = stderr_lines(stderr);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("Calling Recraft API (inpainting).\n");
    expect(lines[1]).toMatch(/^Inpainting completed in \d+\.\d+s\.\n$/);

    stderr.mockClear();
    await expect(
      provider.generate(
        "edit prompt",
        { model: "recraftv4" },
        { images: [image] },
      ),
    ).resolves.toEqual(["edited"]);
    expect(client.post.mock.calls[1]?.[0]).toBe("/images/imageToImage");
    lines = stderr_lines(stderr);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("Calling Recraft API (image-to-image).\n");
    expect(lines[1]).toMatch(/^Image-to-image completed in \d+\.\d+s\.\n$/);
  });

  it("reports custom-style creation and distinguishes styled from plain generation announcements", async () => {
    const root = await mkdtemp(join(tmpdir(), "recraft-style-progress-"));
    roots.push(root);
    const reference = join(root, "reference.bin");
    await writeFile(reference, Uint8Array.from([1]));
    const client = {
      images: {
        generate: vi
          .fn()
          .mockResolvedValue({ data: [{ b64_json: "generated" }] }),
      },
      post: vi.fn().mockResolvedValue({ id: "custom-style-id" }),
    };
    mockedClient = client;
    const stderr = capture_stderr();
    const provider = new RecraftProvider();

    await expect(
      provider.generate(
        "styled prompt",
        { model: "recraftv3", recraft_style: "icon" },
        { references: [reference] },
      ),
    ).resolves.toEqual(["generated"]);
    let lines = stderr_lines(stderr);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(
      "Creating custom style from 1 reference image(s)...\n",
    );
    expect(lines[1]).toBe("Custom style created: custom-style-id\n");
    expect(lines[2]).toBe(
      "Calling Recraft API (generation with custom style).\n",
    );
    expect(lines[3]).toMatch(/^Generation completed in \d+\.\d+s\.\n$/);

    stderr.mockClear();
    await expect(
      provider.generate("plain prompt", { model: "recraftv4" }),
    ).resolves.toEqual(["generated"]);
    lines = stderr_lines(stderr);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "Calling Recraft API (generation). This can take up to a minute.\n",
    );
    expect(lines[1]).toMatch(/^Generation completed in \d+\.\d+s\.\n$/);
  });
});
