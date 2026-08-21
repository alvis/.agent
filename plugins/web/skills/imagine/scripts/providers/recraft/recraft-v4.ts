import OpenAI from "openai@6";

import {
  ImagineError,
  ImageProvider,
  file_part,
  register_provider,
} from "../base";

import type { Args, GenerateOptions, ModelParam } from "../base";
export const V4_SIZES: Record<string, string> = {
  "1:1": "1024x1024",
  "2:1": "1536x768",
  "1:2": "768x1536",
  "3:2": "1280x832",
  "2:3": "832x1280",
  "4:3": "1216x896",
  "3:4": "896x1216",
  "5:4": "1152x896",
  "4:5": "896x1152",
  "16:9": "1344x768",
  "9:16": "768x1344",
  "6:10": "832x1344",
  "14:10": "1280x896",
  "10:14": "896x1280",
};
export const V4_PRO_SIZES: Record<string, string> = {
  "1:1": "2048x2048",
  "2:1": "3072x1536",
  "1:2": "1536x3072",
  "3:2": "2560x1664",
  "2:3": "1664x2560",
  "4:3": "2432x1792",
  "3:4": "1792x2432",
  "16:9": "2688x1536",
  "9:16": "1536x2688",
};
export const V3_V2_SIZES = new Set([
  "1024x1024",
  "1365x1024",
  "1024x1365",
  "1536x1024",
  "1024x1536",
  "1820x1024",
  "1024x1820",
  "1024x2048",
  "2048x1024",
  "1434x1024",
  "1024x1434",
  "1024x1280",
  "1280x1024",
  "1024x1707",
  "1707x1024",
]);
export const V3_STYLES = [
  "any",
  "realistic_image",
  "digital_illustration",
  "vector_illustration",
  "icon",
];
export const V2_STYLES = [
  "realistic_image",
  "digital_illustration",
  "vector_illustration",
  "icon",
  "realistic_image/b_and_w",
  "realistic_image/hard_flash",
  "realistic_image/hdr",
  "realistic_image/natural_light",
  "realistic_image/studio_portrait",
  "realistic_image/enterprise",
  "realistic_image/motion_blur",
  "digital_illustration/pixel_art",
  "digital_illustration/hand_drawn",
  "digital_illustration/grain",
  "digital_illustration/infantile_sketch",
  "digital_illustration/2d_art_poster",
  "digital_illustration/handmade_3d",
  "digital_illustration/hand_drawn_outline",
  "digital_illustration/engraving_color",
  "digital_illustration/2d_art_poster_2",
];
export const ALL_MODELS = [
  "recraftv4",
  "recraftv4_vector",
  "recraftv4_pro",
  "recraftv4_pro_vector",
  "recraftv3",
  "recraftv3_vector",
  "recraftv2",
  "recraftv2_vector",
];
export const V4_MODELS = new Set(
    ALL_MODELS.filter((x) => x.startsWith("recraftv4")),
  ),
  V4_PRO_MODELS = new Set(
    ALL_MODELS.filter((x) => x.startsWith("recraftv4_pro")),
  ),
  V3_MODELS = new Set(["recraftv3", "recraftv3_vector"]),
  V2_MODELS = new Set(["recraftv2", "recraftv2_vector"]),
  VECTOR_MODELS = new Set(ALL_MODELS.filter((x) => x.includes("_vector")));
export const MODEL_PARAMS: Record<string, ModelParam> = {
  model: { default: "recraftv4", choices: ALL_MODELS },
  size: { default: "1024x1024" },
  n: { default: 1, type: "int", range: [1, 6] },
  output_format: { default: null, choices: ["png", "jpeg", "webp", "svg"] },
  recraft_style: {
    default: null,
    choices: [...new Set([...V3_STYLES, ...V2_STYLES])].sort(),
  },
  style_id: { default: null },
  strength: { default: null, edit_only: true },
  negative_prompt: { default: null },
};
export function _is_aspect_ratio(value: string): boolean {
  return /^\d+:\d+$/.test(value);
}
export function _resolve_size(size: string, model: string): string {
  let map: Record<string, string> = {},
    valid: Set<string>,
    label: string;
  if (V4_PRO_MODELS.has(model)) {
    map = V4_PRO_SIZES;
    valid = new Set(Object.values(map));
    label = "V4 Pro";
  } else if (V4_MODELS.has(model)) {
    map = V4_SIZES;
    valid = new Set(Object.values(map));
    label = "V4";
  } else {
    valid = V3_V2_SIZES;
    label = "V3/V2";
  }
  if (_is_aspect_ratio(size)) {
    if (!map[size])
      throw new ImagineError(
        `Aspect ratio '${size}' is not valid for ${label} models. Allowed ratios: ${Object.keys(map).sort().join(", ") || "(none)"}`,
      );
    return map[size];
  }
  if (!valid.has(size))
    throw new ImagineError(
      `Size '${size}' is not valid for ${label} models. Allowed sizes: ${[...valid].sort().join(", ")}`,
    );
  return size;
}
type RecraftClient = {
  images: { generate(data: Args): Promise<unknown> };
  post(path: string, options: { body: FormData }): Promise<unknown>;
};
export async function _create_client(): Promise<RecraftClient> {
  return new OpenAI({
    baseURL: "https://external.api.recraft.ai/v1",
    apiKey: process.env.RECRAFT_API_TOKEN,
  }) as RecraftClient;
}
export class RecraftProvider extends ImageProvider {
  readonly name = "recraft";
  readonly env_var = "RECRAFT_API_TOKEN";
  readonly MODEL_PARAMS = MODEL_PARAMS;
  validate(args: Args): void {
    super.validate(args);
    const model = String(args.model || "recraftv4"),
      style = args.recraft_style as string | undefined;
    if (style && args.style_id)
      throw new ImagineError(
        "--recraft-style and --style-id are mutually exclusive.",
      );
    if (style && V4_MODELS.has(model))
      throw new ImagineError(
        `--recraft-style is only supported with V2/V3 models, not '${model}'.`,
      );
    if (args.negative_prompt && V4_MODELS.has(model))
      throw new ImagineError(
        `--negative-prompt is only supported with V2/V3 models, not '${model}'.`,
      );
    if (style && V3_MODELS.has(model) && !V3_STYLES.includes(style))
      throw new ImagineError(
        `--recraft-style '${style}' is not valid for V3 models. Allowed: ${V3_STYLES.join(", ")}`,
      );
    if (style && V2_MODELS.has(model) && !V2_STYLES.includes(style))
      throw new ImagineError(
        `--recraft-style '${style}' is not valid for V2 models. Allowed: ${V2_STYLES.join(", ")}`,
      );
    _resolve_size(String(args.size || "1024x1024"), model);
  }
  _get_model(args: Args): string {
    return String(args.model || "recraftv4");
  }
  _get_output_format(args: Args): string {
    return String(
      args.output_format ||
        (VECTOR_MODELS.has(this._get_model(args)) ? "svg" : "png"),
    );
  }
  override effective_output_format(args: Args): string {
    return this._get_output_format(args);
  }
  _build_extra_body(args: Args): Args {
    const extra: Args = {};
    if (args.recraft_style) extra.style = args.recraft_style;
    if (args.style_id) extra.style_id = args.style_id;
    if (args.negative_prompt) extra.negative_prompt = args.negative_prompt;
    return extra;
  }
  _build_payload(prompt: string, args: Args): Args {
    const model = this._get_model(args),
      payload: Args = {
        model,
        prompt,
        n: args.n || 1,
        size: _resolve_size(String(args.size || "1024x1024"), model),
        response_format: "b64_json",
      },
      extra = this._build_extra_body(args);
    if (Object.keys(extra).length) payload.extra_body = extra;
    return payload;
  }
  async _create_custom_style(
    api: RecraftClient,
    references: string[],
    base_style = "digital_illustration",
  ): Promise<string> {
    const form = new FormData();
    form.set("style", base_style);
    for (const reference of references)
      form.append("file", file_part(reference));
    const response = await api.post("/styles", { body: form });
    if (
      !is_record(response) ||
      typeof response.id !== "string" ||
      !response.id.trim()
    )
      throw new ImagineError("Invalid Recraft custom-style response.");
    return response.id;
  }
  async generate(
    prompt: string,
    args: Args,
    options: GenerateOptions = {},
  ): Promise<string[]> {
    return this.#call(prompt, args, options);
  }
  async async_generate(
    prompt: string,
    args: Args,
    options: GenerateOptions = {},
  ): Promise<string[]> {
    return this.#call(prompt, args, options);
  }
  async #call(
    prompt: string,
    args: Args,
    options: GenerateOptions,
  ): Promise<string[]> {
    const api = await _create_client();
    if (options.images?.length) {
      const endpoint = options.mask
          ? "/images/inpaint"
          : "/images/imageToImage",
        form = new FormData(),
        model = this._get_model(args);
      form.set("prompt", prompt);
      form.set("model", model);
      form.set("n", String(args.n || 1));
      form.set("response_format", "b64_json");
      form.set("size", _resolve_size(String(args.size || "1024x1024"), model));
      form.set("image", file_part(options.images[0]));
      if (options.mask) form.set("mask", file_part(options.mask));
      if (args.strength != null && !options.mask)
        form.set("strength", String(args.strength));
      const extra = this._build_extra_body(args);
      if (extra.style) form.set("style", String(extra.style));
      if (extra.style_id) form.set("style_id", String(extra.style_id));
      process.stderr.write(
        `Calling Recraft API (${options.mask ? "inpainting" : "image-to-image"}).\n`,
      );
      const started = performance.now();
      const response = await api.post(endpoint, { body: form });
      process.stderr.write(
        `${options.mask ? "Inpainting" : "Image-to-image"} completed in ${((performance.now() - started) / 1000).toFixed(1)}s.\n`,
      );
      return response_images(response, "edit");
    }
    const references = options.references ?? [],
      payload = this._build_payload(prompt, args);
    if (references.length) {
      const model = this._get_model(args);
      if (V4_MODELS.has(model))
        throw new ImagineError(
          `Custom style references are only supported with V3 models. Current model: ${model}`,
        );
      process.stderr.write(
        `Creating custom style from ${references.length} reference image(s)...\n`,
      );
      const styleId = await this._create_custom_style(
        api,
        references,
        String(args.recraft_style || "digital_illustration"),
      );
      process.stderr.write(`Custom style created: ${styleId}\n`);
      const extra = { ...((payload.extra_body as Args | undefined) ?? {}) };
      delete extra.style;
      extra.style_id = styleId;
      payload.extra_body = extra;
    }
    process.stderr.write(
      references.length
        ? "Calling Recraft API (generation with custom style).\n"
        : "Calling Recraft API (generation). This can take up to a minute.\n",
    );
    const started = performance.now();
    const result = await api.images.generate(payload);
    process.stderr.write(
      `Generation completed in ${((performance.now() - started) / 1000).toFixed(1)}s.\n`,
    );
    return response_images(result, "generation");
  }
  dry_run_payload(
    prompt: string,
    args: Args,
    options: GenerateOptions = {},
  ): Args {
    const model = this._get_model(args),
      payload: Args = {
        provider: "recraft",
        model,
        prompt,
        n: args.n || 1,
        size: _resolve_size(String(args.size || "1024x1024"), model),
        output_format: this._get_output_format(args),
      };
    if (args.recraft_style) payload.recraft_style = args.recraft_style;
    if (args.style_id) payload.style_id = args.style_id;
    if (args.negative_prompt) payload.negative_prompt = args.negative_prompt;
    if (options.images?.length && options.mask) {
      payload.endpoint = "/v1/images/inpaint";
      payload.image = options.images;
      payload.mask = options.mask;
    } else if (options.images?.length) {
      payload.endpoint = "/v1/images/imageToImage";
      payload.image = options.images;
      if (args.strength) payload.strength = args.strength;
    } else payload.endpoint = "/v1/images/generations";
    if (options.references?.length) payload.references = options.references;
    return payload;
  }
}

function is_record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function is_image_data(value: unknown): value is { b64_json: string } {
  return (
    is_record(value) &&
    typeof value.b64_json === "string" &&
    Boolean(value.b64_json.trim())
  );
}

function response_images(response: unknown, operation: string): string[] {
  if (
    !is_record(response) ||
    !Array.isArray(response.data) ||
    response.data.length === 0 ||
    !response.data.every(is_image_data)
  )
    throw new ImagineError(`Invalid Recraft ${operation} response.`);
  return response.data.map((item) => item.b64_json);
}

register_provider(RecraftProvider);
