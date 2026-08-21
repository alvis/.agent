import { mkdtemp, readFile, stat, writeFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sharpHarness = vi.hoisted(() => {
  const chain = {
    resize: vi.fn(),
    flatten: vi.fn(),
    toFormat: vi.fn(),
    toBuffer: vi.fn(),
  };
  return { entry: vi.fn(), chain };
});

vi.mock("sharp@0.34", () => ({ default: sharpHarness.entry }), {
  virtual: true,
});

import { ImagineError } from "./providers/base";
import type { Args, ImageProvider } from "./providers/base";
import {
  _build_output_paths,
  _derive_downscale_path,
  _download_to_temp,
  _downscale_image_bytes,
  _extract_retry_after_seconds,
  _generate_one_with_retries,
  _is_rate_limit_error,
  _is_transient_error,
  _is_url,
  _job_output_paths,
  _merge_non_null,
  _normalize_job,
  _normalize_output_format,
  _read_jobs_jsonl,
  _resolve_paths,
  _resolve_single_path,
  _slugify,
  _temp_download_context,
} from "./helpers";

const roots: string[] = [];

function makeRoot(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix)).then((root) => {
    roots.push(root);
    return root;
  });
}

afterEach(async () => {
  vi.unstubAllGlobals();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

describe("Imagine helper contracts", () => {
  beforeEach(() => {
    vi.stubGlobal("Bun", {
      sleep: async () => undefined,
      file: (path: string) => new Blob([readFileSync(path)]),
    });
    sharpHarness.chain.resize.mockReset().mockReturnValue(sharpHarness.chain);
    sharpHarness.chain.flatten.mockReset().mockReturnValue(sharpHarness.chain);
    sharpHarness.chain.toFormat.mockReset().mockReturnValue(sharpHarness.chain);
    sharpHarness.chain.toBuffer
      .mockReset()
      .mockResolvedValue(Uint8Array.from([9, 8]));
    sharpHarness.entry.mockReset().mockReturnValue(sharpHarness.chain);
  });

  it("normalizes formats, slugs, and output paths", async () => {
    const root = await makeRoot("imagine-helper-");
    expect(_normalize_output_format()).toBe("png");
    expect(_normalize_output_format("JPG")).toBe("jpeg");
    expect(() => _normalize_output_format("bmp")).toThrow(ImagineError);
    expect(_slugify("  A strange / prompt!!! ")).toBe("a-strange-prompt");
    expect(_slugify("---")).toBe("job");
    expect(_build_output_paths(join(root, "out"), "png", 2)).toEqual([
      join(root, "out-1.png"),
      join(root, "out-2.png"),
    ]);
    expect(_build_output_paths(join(root, "images"), "webp", 2, root)).toEqual([
      join(root, "image_1.webp"),
      join(root, "image_2.webp"),
    ]);
  });

  it("normalizes batch job names and JSONL comments", async () => {
    const root = await makeRoot("imagine-jobs-");
    const path = join(root, "jobs.jsonl");
    await writeFile(
      path,
      '# ignored\n  first prompt  \n{"prompt":"second","n":2}\n',
    );

    expect(_normalize_job("  prompt  ", 1)).toEqual({ prompt: "prompt" });
    expect(_normalize_job({ prompt: "object", n: 2 }, 2)).toMatchObject({
      prompt: "object",
      n: 2,
    });
    expect(_read_jobs_jsonl(path)).toEqual([
      { prompt: "first prompt" },
      { prompt: "second", n: 2 },
    ]);
    expect(() => _normalize_job("", 3)).toThrow("Empty prompt at job 3");
    expect(() => _normalize_job(null, 4)).toThrow("Invalid job at index 4");
  });

  it.each([
    [null, "Invalid job at index 7"],
    [42, "Invalid job at index 7"],
    [true, "Invalid job at index 7"],
    [[], "Invalid job at index 7"],
  ] as const)("rejects non-string job values: %j", (job, message) => {
    expect(() => _normalize_job(job, 7)).toThrow(message);
  });

  it.each([
    [{ prompt: "ok", fields: [] }, "Invalid fields for job 8"],
    [{ prompt: "ok", fields: { tone: 3 } }, "Invalid fields.tone for job 8"],
    [{ prompt: "ok", image: 3 }, "Invalid image for job 8"],
    [{ prompt: "ok", images: ["ok", 3] }, "Invalid images for job 8"],
    [{ prompt: "ok", n: 1.5 }, "Invalid n for job 8"],
    [{ prompt: "ok", strength: "0.5" }, "Invalid strength for job 8"],
  ] as const)("rejects malformed job fields: %j", (job, message) => {
    expect(() => _normalize_job(job, 8)).toThrow(message);
  });

  it.each([
    [{ prompt: "ok", typo: "value" }, /Unknown.*typo/i],
    [{ prompt: "ok", styl: "value" }, /Unknown.*styl/i],
    [{ prompt: "ok", scene: 42 }, /Invalid scene.*string or null/i],
    [{ prompt: "ok", text: false }, /Invalid text.*string or null/i],
  ] as const)(
    "rejects unknown or invalid top-level job fields: %j",
    (job, message) => {
      expect(() => _normalize_job(job, 9)).toThrow(message);
    },
  );

  it("rejects malformed or empty JSONL input", async () => {
    const root = await makeRoot("imagine-jsonl-");
    const malformed = join(root, "malformed.jsonl");
    const empty = join(root, "empty.jsonl");
    await writeFile(malformed, '{"prompt":\n');
    await writeFile(empty, "# comments only\n\n");

    expect(() => _read_jobs_jsonl(join(root, "missing.jsonl"))).toThrow(
      "Input file not found",
    );
    expect(() => _read_jobs_jsonl(malformed)).toThrow("Invalid JSON on line 1");
    expect(() => _read_jobs_jsonl(empty)).toThrow("No jobs found");
  });

  it("rejects invalid object shapes read from JSONL", async () => {
    const root = await makeRoot("imagine-jsonl-shape-");
    const path = join(root, "invalid-shape.jsonl");
    await writeFile(path, '{"prompt":"ok","images":["good",4]}\n');

    expect(() => _read_jobs_jsonl(path)).toThrow("Invalid images for job 1");
  });

  it("builds indexed job outputs and merges only non-null overrides", async () => {
    const root = await makeRoot("imagine-output-");
    expect(
      _job_output_paths({
        out_dir: root,
        output_format: "png",
        idx: 3,
        prompt: "A calm blue lake",
        n: 2,
      }),
    ).toEqual([
      join(root, "003-a-calm-blue-lake-1.png"),
      join(root, "003-a-calm-blue-lake-2.png"),
    ]);
    expect(
      _merge_non_null(
        { prompt: "base", n: 1, style: "x" },
        { n: 2, style: null },
      ),
    ).toEqual({ prompt: "base", n: 2, style: "x" });
    expect(_derive_downscale_path(join(root, "image.png"), "web")).toBe(
      join(root, "image-web.png"),
    );
  });

  it("resolves local paths and dry-run URLs without network access", async () => {
    const root = await makeRoot("imagine-paths-");
    const image = join(root, "opaque.bin");
    await writeFile(image, Buffer.from([1, 2, 3]));

    expect(_is_url("https://example.test/image.png")).toBe(true);
    expect(_is_url("file:///tmp/image.png")).toBe(false);
    expect(await _resolve_paths([image], root)).toEqual([image]);
    expect(
      await _resolve_paths(["https://example.test/image.png"], root, {
        dry_run: true,
      }),
      // Python's legacy Path(f"<image:{url}>") renders the second slash away.
    ).toEqual(["<image:https:/example.test/image.png>"]);
    expect(await _resolve_single_path(null, root)).toBeNull();
    await expect(_resolve_paths([join(root, "missing")], root)).rejects.toThrow(
      "Image file not found",
    );
  });

  it("downloads opaque bytes with collision-safe names and cleans temp contexts", async () => {
    const root = await makeRoot("imagine-download-");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(Uint8Array.from([7, 8]), { status: 200 }),
      );
    try {
      const first = await _download_to_temp(
        "https://example.test/photo.png?x=1",
        root,
      );
      const second = await _download_to_temp(
        "https://example.test/photo.png",
        root,
      );
      expect(await readFile(first)).toEqual(Buffer.from([7, 8]));
      expect(second).toBe(join(root, "photo_1.png"));
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.test/photo.png?x=1",
        expect.objectContaining({
          headers: { "user-agent": "imagine-cli/1.0" },
        }),
      );
    } finally {
      fetchMock.mockRestore();
    }

    const context = _temp_download_context();
    expect((await stat(context.path)).isDirectory()).toBe(true);
    context.cleanup();
    await expect(stat(context.path)).rejects.toThrow();
  });

  it("classifies retry metadata and transient failures", () => {
    expect(_extract_retry_after_seconds({ retry_after: 2.5 })).toBe(2.5);
    expect(_extract_retry_after_seconds({ retry_after_seconds: 0 })).toBe(0);
    expect(_extract_retry_after_seconds(new Error("Retry-After: 4.5"))).toBe(
      4.5,
    );
    expect(_extract_retry_after_seconds(new Error("permanent"))).toBeNull();
    expect(_is_rate_limit_error(new Error("HTTP 429"))).toBe(true);
    expect(_is_transient_error(new Error("connection reset by peer"))).toBe(
      true,
    );
    expect(_is_transient_error(new Error("invalid prompt"))).toBe(false);
  });

  it("downscales through the sharp chain with normalized JPEG options", async () => {
    const output = await _downscale_image_bytes(Uint8Array.from([1]), {
      max_dim: 32,
      output_format: "jpg",
    });

    expect(output).toBeInstanceOf(Uint8Array);
    expect(output.byteLength).toBe(2);
    expect(sharpHarness.entry).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(sharpHarness.chain.resize).toHaveBeenCalledWith({
      width: 32,
      height: 32,
      fit: "inside",
      withoutEnlargement: true,
    });
    expect(sharpHarness.chain.flatten).toHaveBeenCalledWith({
      background: "#fff",
    });
    expect(sharpHarness.chain.toFormat).toHaveBeenCalledWith("jpeg");
  });

  it("classifies invalid downscale dimensions before invoking sharp", async () => {
    await expect(
      _downscale_image_bytes(Uint8Array.from([1]), {
        max_dim: 0,
        output_format: "png",
      }),
    ).rejects.toMatchObject({
      name: "ImagineError",
      message: "--downscale-max-dim must be >= 1",
    });
    expect(sharpHarness.entry).not.toHaveBeenCalled();
  });

  it("wraps sharp pipeline failures with the original cause", async () => {
    const cause = new Error("decoder rejected opaque bytes");
    sharpHarness.chain.toBuffer.mockRejectedValueOnce(cause);

    await expect(
      _downscale_image_bytes(Uint8Array.from([1]), {
        max_dim: 32,
        output_format: "png",
      }),
    ).rejects.toMatchObject({
      name: "ImagineError",
      message: "Downscaling image failed.",
      cause,
    });
  });

  it("wraps unexpected sharp constructor failures with their cause", async () => {
    const cause = new TypeError("unexpected sharp failure");
    sharpHarness.entry.mockImplementationOnce(() => {
      throw cause;
    });

    await expect(
      _downscale_image_bytes(Uint8Array.from([1]), {
        max_dim: 32,
        output_format: "png",
      }),
    ).rejects.toMatchObject({
      name: "ImagineError",
      message: "Downscaling image failed.",
      cause,
    });
  });

  // vi.doMock stays runtime-scoped: a hoisted vi.mock("./sharp-image") would
  // replace the real module for every sibling case in this file.
  it("surfaces a failed sharp-image acquisition as a controlled ImagineError naming sharp@0.34", async () => {
    vi.doMock("./sharp-image", () => {
      throw new Error("Cannot find package 'sharp@0.34'");
    });
    const pending = _downscale_image_bytes(Uint8Array.from([1]), {
      max_dim: 32,
      output_format: "png",
    });
    try {
      await expect(pending).rejects.toBeInstanceOf(ImagineError);
      // The loader's own failure rides along as `cause`; the runner replaces
      // factory-thrown errors, so only its presence and type are contractual.
      await expect(pending).rejects.toMatchObject({
        name: "ImagineError",
        exit_code: 1,
        cause: expect.any(Error),
      });
      await expect(pending).rejects.toThrow(/Failed to load image processing/);
      await expect(pending).rejects.toThrow(
        /Run with Bun auto-install enabled/,
      );
      await expect(pending).rejects.toThrow(/sharp@0\.34/);
      expect(sharpHarness.entry).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("./sharp-image");
    }
  });

  it("keeps dependency-acquisition and image-processing failures observably distinct", async () => {
    vi.doMock("./sharp-image", () => {
      throw new Error("Cannot find package 'sharp@0.34'");
    });
    let acquisitionMessage = "";
    try {
      acquisitionMessage = await _downscale_image_bytes(Uint8Array.from([1]), {
        max_dim: 32,
        output_format: "png",
      }).then(
        () => "",
        (error: unknown) => (error instanceof Error ? error.message : ""),
      );
    } finally {
      vi.doUnmock("./sharp-image");
    }

    const processingCause = new Error("decoder rejected opaque bytes");
    sharpHarness.chain.toBuffer.mockRejectedValueOnce(processingCause);
    const processingMessage = await _downscale_image_bytes(
      Uint8Array.from([1]),
      { max_dim: 32, output_format: "png" },
    ).then(
      () => "",
      (error: unknown) => (error instanceof Error ? error.message : ""),
    );

    expect(acquisitionMessage).toContain("sharp@0.34");
    expect(acquisitionMessage).not.toContain("Downscaling image failed.");
    expect(processingMessage).toBe("Downscaling image failed.");
    expect(processingMessage).not.toContain("sharp@0.34");
  });

  it("retries transient provider failures in order and stops on permanent errors", async () => {
    const calls: string[] = [];
    const provider = {
      async_generate: vi
        .fn<ImageProvider["async_generate"]>()
        .mockImplementationOnce(async () => {
          calls.push("first");
          throw Object.assign(new Error("rate limit"), { retry_after: 0 });
        })
        .mockImplementationOnce(async () => {
          calls.push("second");
          return ["opaque-result"];
        }),
    } as Pick<ImageProvider, "async_generate">;

    await expect(
      _generate_one_with_retries(
        provider as ImageProvider,
        "prompt",
        {} as Args,
        {
          attempts: 3,
          job_label: "[job 1/1]",
        },
      ),
    ).resolves.toEqual(["opaque-result"]);
    expect(calls).toEqual(["first", "second"]);
  });
});
