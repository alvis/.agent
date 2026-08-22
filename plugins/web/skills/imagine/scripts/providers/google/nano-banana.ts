import { GoogleGenAI } from "@google/genai@1";

import { ImageProvider, ImagineError, register_provider } from "../base";

import type { Args, GenerateOptions, ModelParam } from "../base";
export const MODEL_PARAMS: Record<string, ModelParam> = {
  model: {
    default: "gemini-3.1-flash-image-preview",
    choices: ["gemini-3.1-flash-image-preview"],
  },
  aspect_ratio: {
    default: "1:1",
    choices: [
      "1:1",
      "2:3",
      "3:2",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "1:4",
      "4:1",
      "1:8",
      "8:1",
      "21:9",
    ],
  },
  resolution: { default: "1K", choices: ["512px", "1K", "2K", "4K"] },
  n: { default: 1, type: "int", range: [1, 10] },
  output_format: { default: "png", choices: ["png", "jpeg", "webp"] },
};
export const SIZE_MAP: Record<string, [string, string]> = {
  "1024x1024": ["1:1", "1K"],
  "1536x1024": ["3:2", "1K"],
  "1024x1536": ["2:3", "1K"],
  auto: ["1:1", "1K"],
};
type GooglePart = { inlineData?: { data?: string } };
type GoogleResponse = {
  candidates?: { content?: { parts?: GooglePart[] } }[];
};
type GoogleClient = {
  models: {
    generateContent(request: Args): Promise<GoogleResponse>;
  };
};
type GoogleContent = {
  inlineData?: { data: string; mimeType: string };
  text?: string;
};
export async function _create_client(): Promise<GoogleClient> {
  return new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
  }) as GoogleClient;
}
export async function _convert_format(
  image_bytes: Uint8Array,
  target_format: string,
): Promise<Uint8Array> {
  if (target_format === "png") return image_bytes;
  const { convert_image_format } = await import("../../sharp-image");
  return convert_image_format(image_bytes, target_format);
}
export async function _extract_images_from_response(
  response: GoogleResponse,
  output_format: string,
): Promise<string[]> {
  if (!response?.candidates?.length)
    throw new ImagineError("No candidates in Google API response.");
  const images: string[] = [];
  for (const candidate of response.candidates)
    for (const part of candidate.content?.parts ?? [])
      if (part.inlineData?.data) {
        const raw = Uint8Array.from(
          Buffer.from(part.inlineData.data, "base64"),
        );
        images.push(
          Buffer.from(await _convert_format(raw, output_format)).toString(
            "base64",
          ),
        );
      }
  return images;
}
export class NanoBananaProvider extends ImageProvider {
  readonly name = "google";
  readonly env_var = "GOOGLE_API_KEY";
  readonly MODEL_PARAMS = MODEL_PARAMS;
  _build_config(args: Args): Args {
    let ratio = args.aspect_ratio || "1:1",
      resolution = args.resolution || "1K";
    if (typeof args.size === "string" && SIZE_MAP[args.size])
      [ratio, resolution] = SIZE_MAP[args.size];
    return {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: ratio, imageSize: resolution },
    };
  }
  async _build_contents(
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<GoogleContent[]> {
    if (options.mask)
      process.stderr.write(
        "Warning: Google provider does not support mask-based editing. Use --provider openai for mask support. Proceeding without mask.\n",
      );
    const contents: GoogleContent[] = [];
    for (const path of [
      ...(options.references ?? []),
      ...(options.images ?? []),
    ])
      contents.push({
        inlineData: {
          data: Buffer.from(await Bun.file(path).arrayBuffer()).toString(
            "base64",
          ),
          mimeType: Bun.file(path).type || "image/png",
        },
      });
    contents.push({ text: prompt });
    return contents;
  }
  private async call(
    prompt: string,
    args: Args,
    options: GenerateOptions,
  ): Promise<string[]> {
    const client = await _create_client();
    const contents = await this._build_contents(prompt, options);
    const n = Number(args.n || 1);
    const outputFormat = String(args.output_format || "png");
    const request = () =>
      client.models.generateContent({
        model: args.model || MODEL_PARAMS.model.default,
        contents,
        config: this._build_config(args),
      });
    // A single call propagates the raw provider error so its rate-limit
    // classification reaches the shared retry helper; batched calls tolerate
    // partial failure instead.
    if (n === 1) {
      const response = await request();
      return _extract_images_from_response(response, outputFormat);
    }
    const responses = await Promise.allSettled(
      Array.from({ length: n }, request),
    );
    const images: string[] = [];
    for (const [i, result] of responses.entries()) {
      if (result.status === "rejected") {
        process.stderr.write(
          `Warning: Concurrent call ${i + 1}/${n} failed: ${result.reason}\n`,
        );
        continue;
      }
      images.push(
        ...(await _extract_images_from_response(result.value, outputFormat)),
      );
    }
    if (!images.length)
      throw new ImagineError("All concurrent generation calls failed.");
    return images;
  }
  generate(
    prompt: string,
    args: Args,
    options: GenerateOptions = {},
  ): Promise<string[]> {
    return this.call(prompt, args, options);
  }
  async_generate(
    prompt: string,
    args: Args,
    options: GenerateOptions = {},
  ): Promise<string[]> {
    return this.call(prompt, args, options);
  }
  dry_run_payload(
    prompt: string,
    args: Args,
    options: GenerateOptions = {},
  ): Args {
    let ratio = args.aspect_ratio || "1:1",
      resolution = args.resolution || "1K";
    if (typeof args.size === "string" && SIZE_MAP[args.size])
      [ratio, resolution] = SIZE_MAP[args.size];
    const payload: Args = {
      provider: "google",
      endpoint: "models.generate_content",
      model: args.model || MODEL_PARAMS.model.default,
      prompt,
      aspect_ratio: ratio,
      resolution,
      response_modalities: ["IMAGE"],
    };
    if (options.references?.length) payload.references = options.references;
    if (options.images?.length) payload.images = options.images;
    if (options.mask) {
      payload.mask = options.mask;
      payload.mask_warning = "Google provider does not support masks; ignored";
    }
    const n = Number(args.n || 1);
    if (n > 1) {
      payload.n = n;
      payload.note = `Will make ${n} concurrent API calls`;
    }
    return payload;
  }
}
register_provider(NanoBananaProvider);
