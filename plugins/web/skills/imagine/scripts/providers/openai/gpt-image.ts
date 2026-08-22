import OpenAI from "openai@6";

import {
  ImagineError,
  ImageProvider,
  file_part,
  register_provider,
} from "../base";

import type { Args, GenerateOptions, ModelParam } from "../base";

export const MODEL_PARAMS: Record<string, ModelParam> = {
  model: {
    default: "gpt-image-1.5",
    choices: ["gpt-image-1.5", "gpt-image-1-mini"],
    help: "OpenAI image model",
  },
  size: {
    default: "1024x1024",
    choices: ["1024x1024", "1536x1024", "1024x1536", "auto"],
  },
  quality: { default: "auto", choices: ["low", "medium", "high", "auto"] },
  background: { default: null, choices: ["transparent", "opaque", "auto"] },
  output_format: { default: "png", choices: ["png", "jpeg", "webp"] },
  output_compression: { default: null, type: "int", range: [0, 100] },
  input_fidelity: { default: null, choices: ["low", "high"], edit_only: true },
  moderation: { default: null, choices: ["auto", "low"] },
  n: { default: 1, type: "int", range: [1, 10] },
};
export function _normalize_output_format(format?: string | null): string {
  const value = (format || "png").toLowerCase();
  if (!["png", "jpeg", "jpg", "webp"].includes(value))
    throw new ImagineError("output-format must be png, jpeg, jpg, or webp.");
  return value === "jpg" ? "jpeg" : value;
}
export function _validate_transparency(
  background: unknown,
  format: string,
): void {
  if (background === "transparent" && !["png", "webp"].includes(format))
    throw new ImagineError(
      "transparent background requires output-format png or webp.",
    );
}

type ImageResult = { data: { b64_json: string }[] };
type OpenAIClient = {
  images: {
    generate(data: Args): Promise<ImageResult>;
    edit(data: Args): Promise<ImageResult>;
  };
};
export async function _create_client(): Promise<OpenAIClient> {
  return new OpenAI() as OpenAIClient;
}

export class GPTImageProvider extends ImageProvider {
  readonly name = "openai";
  readonly env_var = "OPENAI_API_KEY";
  readonly MODEL_PARAMS = MODEL_PARAMS;
  _build_payload(prompt: string, args: Args): Args {
    const payload: Args = {
      model: args.model || MODEL_PARAMS.model.default,
      prompt,
      n: args.n || 1,
      size: args.size || MODEL_PARAMS.size.default,
      quality: args.quality || MODEL_PARAMS.quality.default,
    };
    for (const key of [
      "background",
      "output_format",
      "output_compression",
      "moderation",
    ])
      if (args[key] != null) payload[key] = args[key];
    const format = _normalize_output_format(
      payload.output_format as string | undefined,
    );
    if ("output_format" in payload) payload.output_format = format;
    _validate_transparency(payload.background, format);
    return payload;
  }
  _build_edit_payload(prompt: string, args: Args): Args {
    const payload = this._build_payload(prompt, args);
    if (args.input_fidelity != null)
      payload.input_fidelity = args.input_fidelity;
    return payload;
  }
  async generate(
    prompt: string,
    args: Args,
    options: GenerateOptions = {},
  ): Promise<string[]> {
    return this.call(prompt, args, options);
  }
  async async_generate(
    prompt: string,
    args: Args,
    options: GenerateOptions = {},
  ): Promise<string[]> {
    return this.call(prompt, args, options);
  }
  private async call(
    prompt: string,
    args: Args,
    options: GenerateOptions,
  ): Promise<string[]> {
    const client = await _create_client();
    const images = options.images ?? [],
      references = options.references ?? [],
      paths = [...images, ...references];
    let result: ImageResult;
    if (paths.length) {
      if (references.length && !images.length)
        process.stderr.write(
          "OpenAI: using edit endpoint for style reference support.\n",
        );
      process.stderr.write(
        `Calling OpenAI Image API (edit) with ${paths.length} image(s).\n`,
      );
      const request: Args = {
        ...this._build_edit_payload(prompt, args),
        image:
          paths.length === 1
            ? file_part(paths[0])
            : paths.map((path) => file_part(path)),
      };
      if (options.mask) request.mask = file_part(options.mask);
      const started = performance.now();
      result = await client.images.edit(request);
      process.stderr.write(
        `Edit completed in ${((performance.now() - started) / 1000).toFixed(1)}s.\n`,
      );
    } else {
      process.stderr.write(
        "Calling OpenAI Image API (generation). This can take up to a couple of minutes.\n",
      );
      const started = performance.now();
      result = await client.images.generate(this._build_payload(prompt, args));
      process.stderr.write(
        `Generation completed in ${((performance.now() - started) / 1000).toFixed(1)}s.\n`,
      );
    }
    return result.data.map((item: { b64_json: string }) => item.b64_json);
  }
  dry_run_payload(
    prompt: string,
    args: Args,
    options: GenerateOptions = {},
  ): Args {
    const paths = [...(options.images ?? []), ...(options.references ?? [])];
    const payload = paths.length
      ? this._build_edit_payload(prompt, args)
      : this._build_payload(prompt, args);
    payload.endpoint = paths.length
      ? "/v1/images/edits"
      : "/v1/images/generations";
    if (paths.length) payload.image = paths;
    if (options.references?.length) payload.references = options.references;
    if (options.mask) payload.mask = options.mask;
    payload.provider = "openai";
    return payload;
  }
}
register_provider(GPTImageProvider);
