import { basename } from "node:path";

export type Args = Record<string, unknown>;
export type ModelParam = {
  default?: unknown;
  choices?: readonly unknown[];
  type?: "int";
  range?: readonly [number, number];
  help?: string;
  edit_only?: boolean;
};

export type GenerateOptions = {
  images?: string[] | null;
  mask?: string | null;
  references?: string[] | null;
};

export class ImagineError extends Error {
  readonly exit_code: number;

  constructor(message: string, exit_code = 1, options?: ErrorOptions) {
    super(message, options);
    this.name = "ImagineError";
    this.exit_code = exit_code;
  }
}

export abstract class ImageProvider {
  abstract readonly name: string;
  abstract readonly env_var: string;
  abstract readonly MODEL_PARAMS: Record<string, ModelParam>;

  ensure_api_key(dry_run: boolean): void {
    if (process.env[this.env_var]) {
      process.stderr.write(`${this.env_var} is set.\n`);
      return;
    }
    if (dry_run) {
      process.stderr.write(
        `Warning: ${this.env_var} is not set; dry-run only.\n`,
      );
      return;
    }
    throw new ImagineError(
      `${this.env_var} is not set. Export it before running.`,
    );
  }

  validate(args: Args): void {
    for (const [name, spec] of Object.entries(this.MODEL_PARAMS)) {
      const value = args[name];
      if (value == null) continue;
      if (spec.choices && !spec.choices.includes(value)) {
        throw new ImagineError(
          `--${name.replaceAll("_", "-")} must be one of: ${spec.choices.join(", ")}`,
        );
      }
      if (spec.type === "int" && spec.range) {
        const parsed = Number(value);
        if (!Number.isInteger(parsed))
          throw new ImagineError(
            `--${name.replaceAll("_", "-")} must be an integer`,
          );
        const [low, high] = spec.range;
        if (parsed < low || parsed > high)
          throw new ImagineError(
            `--${name.replaceAll("_", "-")} must be between ${low} and ${high}`,
          );
      }
    }
  }

  effective_output_format(args: Args): string | null {
    return typeof args.output_format === "string" ? args.output_format : null;
  }

  abstract generate(
    prompt: string,
    args: Args,
    options?: GenerateOptions,
  ): Promise<string[]>;
  abstract async_generate(
    prompt: string,
    args: Args,
    options?: GenerateOptions,
  ): Promise<string[]>;
  abstract dry_run_payload(
    prompt: string,
    args: Args,
    options?: GenerateOptions,
  ): Record<string, unknown>;
}

export const PROVIDER_REGISTRY: Record<string, new () => ImageProvider> =
  Object.create(null) as Record<string, new () => ImageProvider>;
export function register_provider<T extends new () => ImageProvider>(
  provider: T,
): T {
  PROVIDER_REGISTRY[new provider().name] = provider;
  return provider;
}
export function get_provider(name: string): ImageProvider {
  const Provider = Object.hasOwn(PROVIDER_REGISTRY, name)
    ? PROVIDER_REGISTRY[name]
    : undefined;
  if (!Provider)
    throw new ImagineError(
      `Unknown provider '${name}'. Available: ${Object.keys(PROVIDER_REGISTRY).sort().join(", ") || "(none)"}`,
    );
  return new Provider();
}

export function file_part(path: string, type = "image/png"): File {
  return new File([Bun.file(path)], basename(path), { type });
}
