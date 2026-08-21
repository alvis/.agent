#!/usr/bin/env bun
import {
  _augment_prompt,
  _augment_prompt_fields,
  _fields_from_args,
  _read_prompt,
  PROMPT_FIELDS,
} from "./prompt";
import {
  DEFAULT_DOWNSCALE_SUFFIX,
  _build_output_paths,
  _decode_write_and_downscale,
  _derive_downscale_path,
  _generate_one_with_retries,
  _job_output_paths,
  _merge_non_null,
  _normalize_output_format,
  _print_request,
  _read_jobs_jsonl,
  _resolve_paths,
  _resolve_single_path,
  _temp_download_context,
} from "./helpers";
import {
  get_provider,
  ImagineError,
  PROVIDER_REGISTRY,
} from "./providers/base";

import type { ImagineJob } from "./helpers";
import type { Args, ImageProvider } from "./providers/base";

export const DEFAULT_PROVIDER = "google",
  DEFAULT_CONCURRENCY = 5;
const PROVIDER_NAMES = ["google", "openai", "recraft"] as const;
const booleans = new Set(["force", "dry_run", "augment", "fail_fast"]),
  repeatable = new Set(["image", "reference"]),
  integers = new Set([
    "n",
    "concurrency",
    "max_attempts",
    "output_compression",
    "downscale_max_dim",
  ]);
export function parse_args(argv: string[]): Args {
  const providerIndex = argv.findIndex(
      (value) => value === "--provider" || value.startsWith("--provider="),
    ),
    selectedProvider =
      providerIndex < 0
        ? DEFAULT_PROVIDER
        : argv[providerIndex].includes("=")
          ? argv[providerIndex].split("=", 2)[1]
          : argv[providerIndex + 1],
    providerParams = new Set(
      selectedProvider && Object.hasOwn(PROVIDER_REGISTRY, selectedProvider)
        ? Object.keys(new PROVIDER_REGISTRY[selectedProvider]().MODEL_PARAMS)
        : [],
    ),
    shared = new Set([
      "provider",
      "prompt",
      "prompt_file",
      "out",
      "out_dir",
      "force",
      "dry_run",
      "augment",
      "use_case",
      "scene",
      "subject",
      "style",
      "composition",
      "lighting",
      "palette",
      "materials",
      "text",
      "constraints",
      "negative",
      "downscale_max_dim",
      "downscale_suffix",
      "image",
      "mask",
      "reference",
      "input",
      "concurrency",
      "max_attempts",
      "fail_fast",
    ]),
    unknownArgs: string[] = [],
    provided: { key: string; tokens: string[] }[] = [];
  const args: Args = {
    provider: DEFAULT_PROVIDER,
    out: "output.png",
    augment: true,
    downscale_suffix: DEFAULT_DOWNSCALE_SUFFIX,
    concurrency: DEFAULT_CONCURRENCY,
    max_attempts: 3,
  };
  let command: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("-")) {
      if (!command) {
        command = token;
        continue;
      }
      throw parse_error(`unrecognized arguments: ${token}`, command);
    }
    if (token === "--no-augment") {
      provided.push({ key: "augment", tokens: [token] });
      args.augment = false;
      continue;
    }
    if (token.startsWith("--no-augment="))
      throw parse_error(
        `argument --no-augment: ignored explicit argument '${token.split("=", 2)[1]}'`,
        command,
      );
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    const [flag, inline] = token.replace(/^--/, "").split("=", 2),
      key = flag.replaceAll("-", "_");
    if (!shared.has(key) && !providerParams.has(key)) {
      unknownArgs.push(token);
      if (inline == null && argv[index + 1] && !argv[index + 1].startsWith("-"))
        unknownArgs.push(argv[++index]);
      continue;
    }
    if (booleans.has(key)) {
      if (inline != null)
        throw parse_error(
          `argument --${flag}: ignored explicit argument '${inline}'`,
          command,
        );
      provided.push({ key, tokens: [token] });
      args[key] = true;
      continue;
    }
    const value = inline ?? argv[++index];
    if (value == null || value.startsWith("--"))
      throw parse_error(`argument --${flag}: expected one argument`, command);
    const parsed = integers.has(key) ? Number(value) : value;
    if (integers.has(key) && !Number.isInteger(parsed))
      throw parse_error(
        `argument --${flag}: invalid int value: '${value}'`,
        command,
      );
    provided.push({
      key,
      tokens: inline == null ? [token, value] : [token],
    });
    if (repeatable.has(key)) {
      const old = (args[key] as unknown[] | undefined) ?? [];
      args[key] = [...old, parsed];
    } else args[key] = parsed;
  }
  args.command = command;
  const inapplicable =
    command === "generate-batch"
      ? new Set(["image", "mask", "reference"])
      : command === "generate" || command === "edit"
        ? new Set(["input", "concurrency", "max_attempts", "fail_fast"])
        : new Set<string>();
  for (const option of provided)
    if (inapplicable.has(option.key)) unknownArgs.push(...option.tokens);
  if (unknownArgs.length) args.__unknown_args = unknownArgs;
  return args;
}
export function _job_image_list(job: Args, key: string): string[] | null {
  const plural = key.endsWith("s") ? key : `${key}s`,
    singular = key.endsWith("s") ? key.slice(0, -1) : key,
    value = job[plural] || job[singular];
  if (value == null) return null;
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.map(String) : null;
}
export async function _generate(
  args: Args,
  provider: ImageProvider,
): Promise<void> {
  const prompt = _read_prompt(
      args.prompt as string,
      args.prompt_file as string,
    ),
    temp = _temp_download_context();
  try {
    const images = await _resolve_paths(
        args.image as string[] | undefined,
        temp.path,
        { dry_run: Boolean(args.dry_run), label: "image" },
      ),
      mask = await _resolve_single_path(args.mask as string, temp.path, {
        dry_run: Boolean(args.dry_run),
        label: "mask",
      }),
      references = await _resolve_paths(
        args.reference as string[] | undefined,
        temp.path,
        { dry_run: Boolean(args.dry_run), label: "reference" },
      );
    if (mask && !args.dry_run && !mask.toLowerCase().endsWith(".png"))
      process.stderr.write(
        `Warning: Mask should be a PNG with an alpha channel: ${mask}\n`,
      );
    const augmented = _augment_prompt(args, prompt, { references }),
      format = _normalize_output_format(provider.effective_output_format(args)),
      outputs = _build_output_paths(
        String(args.out),
        format,
        Number(args.n || 1),
        args.out_dir as string,
      );
    if (args.dry_run) {
      const payload = provider.dry_run_payload(augmented, args, {
        images,
        mask,
        references,
      });
      payload.outputs = outputs;
      _print_request(payload);
      return;
    }
    await _decode_write_and_downscale(
      await provider.generate(augmented, args, { images, mask, references }),
      outputs,
      {
        force: Boolean(args.force),
        downscale_max_dim: args.downscale_max_dim as number,
        downscale_suffix: String(args.downscale_suffix),
        output_format: format,
      },
    );
  } finally {
    temp.cleanup();
  }
}
export async function _run_generate_batch(
  args: Args,
  provider: ImageProvider,
): Promise<number> {
  const jobs = _read_jobs_jsonl(String(args.input)),
    temp = _temp_download_context(),
    base = _fields_from_args(args),
    outDir = String(args.out_dir);
  try {
    let cursor = 0,
      failed = false,
      stopDispatch = false,
      firstFailure: unknown;
    const run = async (job: ImagineJob, index: number): Promise<void> => {
      const prompt = job.prompt.trim(),
        fields = _merge_non_null(
          _merge_non_null(base, job.fields ?? {}),
          Object.fromEntries(PROMPT_FIELDS.map((k) => [k, job[k]])),
        ),
        jobArgs = {
          ...args,
          ...Object.fromEntries(
            [
              "model",
              "n",
              "size",
              "quality",
              "background",
              "output_format",
              "output_compression",
              "moderation",
              "aspect_ratio",
              "resolution",
              "recraft_style",
              "style_id",
              "strength",
            ]
              .filter((k) => job[k] != null)
              .map((k) => [k, job[k]]),
          ),
        };
      validate(jobArgs, provider);
      const images = await _resolve_paths(
          _job_image_list(job, "image"),
          temp.path,
          { dry_run: Boolean(args.dry_run), label: "image" },
        ),
        mask = await _resolve_single_path(job.mask, temp.path, {
          dry_run: Boolean(args.dry_run),
          label: "mask",
        }),
        references = await _resolve_paths(
          _job_image_list(job, "reference"),
          temp.path,
          { dry_run: Boolean(args.dry_run), label: "reference" },
        ),
        augmented = _augment_prompt_fields(
          args.augment !== false,
          prompt,
          fields,
          { references },
        ),
        format = _normalize_output_format(
          provider.effective_output_format(jobArgs),
        ),
        outputs = _job_output_paths({
          out_dir: outDir,
          output_format: format,
          idx: index,
          prompt,
          n: Number(jobArgs.n || 1),
          explicit_out: job.out,
        });
      if (args.dry_run) {
        const payload = provider.dry_run_payload(augmented, jobArgs, {
          images,
          mask,
          references,
        });
        payload.job = index;
        payload.outputs = outputs;
        payload.outputs_downscaled =
          args.downscale_max_dim == null || format === "svg"
            ? null
            : outputs.map((p) =>
                _derive_downscale_path(p, String(args.downscale_suffix)),
              );
        _print_request(payload);
        return;
      }
      if (stopDispatch) return;
      process.stderr.write(`[job ${index}/${jobs.length}] starting\n`);
      const startedAtMs = performance.now();
      let encoded: string[];
      try {
        encoded = await _generate_one_with_retries(
          provider,
          augmented,
          jobArgs,
          {
            attempts: Number(args.max_attempts),
            job_label: `[job ${index}/${jobs.length}]`,
            images,
            mask,
            references,
          },
        );
      } catch (error) {
        if (args.fail_fast) {
          stopDispatch = true;
          firstFailure ??= error;
        }
        throw error;
      }
      process.stderr.write(
        `[job ${index}/${jobs.length}] completed in ${((performance.now() - startedAtMs) / 1000).toFixed(1)}s\n`,
      );
      await _decode_write_and_downscale(encoded, outputs, {
        force: Boolean(args.force),
        downscale_max_dim: args.downscale_max_dim as number,
        downscale_suffix: String(args.downscale_suffix),
        output_format: format,
      });
    };
    if (args.dry_run) {
      for (const [job, index] of jobs.map(
        (job, index) => [job, index + 1] as const,
      ))
        await run(job, index);
      return 0;
    }
    const worker = async (): Promise<void> => {
      while (!stopDispatch && cursor < jobs.length) {
        const index = cursor++;
        try {
          await run(jobs[index], index + 1);
        } catch (error) {
          failed = true;
          process.stderr.write(
            `[job ${index + 1}/${jobs.length}] failed: ${(error as Error).message}\n`,
          );
          if (args.fail_fast) {
            stopDispatch = true;
            firstFailure ??= error;
          }
        }
      }
    };
    const workers: Promise<void>[] = [];
    for (
      let index = 0;
      index < Math.min(Number(args.concurrency), jobs.length) && !stopDispatch;
      index += 1
    ) {
      workers.push(worker());
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await Promise.all(workers);
    if (firstFailure) throw firstFailure;
    return failed ? 1 : 0;
  } finally {
    temp.cleanup();
  }
}
export async function main(argv = process.argv.slice(2)): Promise<number> {
  const selectedProvider = selected_provider(argv),
    hasCommand = argv.some((value) =>
      ["generate", "generate-batch", "edit"].includes(value),
    ),
    genericHelp =
      argv.some((value) => value === "--help" || value === "-h") && !hasCommand;
  if (!genericHelp && PROVIDER_NAMES.some((name) => name === selectedProvider))
    await load_provider(selectedProvider);
  const args = parse_args(argv);
  if (
    !Object.hasOwn(PROVIDER_REGISTRY, String(args.provider)) &&
    !(
      genericHelp &&
      PROVIDER_NAMES.some((name) => name === String(args.provider))
    )
  )
    throw new ImagineError(
      `usage: image-gen.ts [--provider {google,openai,recraft}]\nimage-gen.ts: error: argument --provider: invalid choice: '${args.provider}' (choose from 'google', 'openai', 'recraft')`,
      2,
    );
  if (Array.isArray(args.__unknown_args))
    throw parse_error(
      `unrecognized arguments: ${args.__unknown_args.join(" ")}`,
      String(args.command || "") || undefined,
    );
  if (args.help) {
    const command = args.command ? String(args.command) : undefined,
      provider = Object.hasOwn(PROVIDER_REGISTRY, String(args.provider))
        ? new PROVIDER_REGISTRY[String(args.provider)]()
        : null,
      providerFlags = provider
        ? Object.keys(provider.MODEL_PARAMS)
            .map((name) => `--${name.replaceAll("_", "-")}`)
            .join(" ")
        : "";
    process.stdout.write(
      `${usage(command)}\n\nGenerate or edit images via the Image API\n\nProviders: ${[...PROVIDER_NAMES].sort().join(", ")}\n${command ? `Options: --prompt --prompt-file --out --out-dir --force --dry-run --augment --no-augment ${providerFlags}\n` : "Commands: generate, generate-batch, edit\n"}`,
    );
    return 0;
  }
  const provider = get_provider(String(args.provider));
  apply_defaults(args, provider);
  validate(args, provider);
  provider.ensure_api_key(Boolean(args.dry_run));
  if (args.command === "generate-batch")
    return _run_generate_batch(args, provider);
  await _generate(args, provider);
  return 0;
}

function selected_provider(argv: string[]): string {
  const index = argv.findIndex(
    (value) => value === "--provider" || value.startsWith("--provider="),
  );
  if (index < 0) return DEFAULT_PROVIDER;
  return argv[index].includes("=")
    ? argv[index].split("=", 2)[1]
    : (argv[index + 1] ?? "");
}

async function load_provider(name: string): Promise<void> {
  if (Object.hasOwn(PROVIDER_REGISTRY, name)) return;
  try {
    if (name === "google") await import("./providers/google/nano-banana");
    else if (name === "openai") await import("./providers/openai/gpt-image");
    else if (name === "recraft") await import("./providers/recraft/recraft-v4");
  } catch (cause) {
    const dependency =
      name === "google"
        ? "@google/genai@1"
        : name === "openai" || name === "recraft"
          ? "openai@6"
          : name;
    throw new ImagineError(
      `Failed to load provider '${name}'. Run with Bun auto-install enabled for ${dependency}.`,
      1,
      { cause },
    );
  }
}

function usage(command?: string): string {
  if (!command)
    return "usage: image-gen.ts [-h] [--provider {google,openai,recraft}]\n                    {generate,generate-batch,edit} ...";
  const commandOptions =
    command === "generate-batch"
      ? "--input INPUT --out-dir OUT_DIR [--concurrency CONCURRENCY] [--max-attempts MAX_ATTEMPTS] [--fail-fast]"
      : "[--image IMAGE] [--mask MASK] [--reference REFERENCE]";
  return `usage: image-gen.ts ${command} [-h] [--prompt PROMPT] [--prompt-file PROMPT_FILE]\n                            [--out OUT] [--out-dir OUT_DIR] [--force] [--dry-run]\n                            ${commandOptions}`;
}

function parse_error(message: string, command?: string): ImagineError {
  const scope = command ? `image-gen.ts ${command}` : "image-gen.ts";
  return new ImagineError(`${usage(command)}\n${scope}: error: ${message}`, 2);
}

function apply_defaults(args: Args, provider: ImageProvider): void {
  for (const [name, spec] of Object.entries(provider.MODEL_PARAMS))
    if (args[name] == null) args[name] = spec.default;
}

function validate(args: Args, provider: ImageProvider): void {
  const known = new Set([
    "provider",
    "command",
    "help",
    "__unknown_args",
    "prompt",
    "prompt_file",
    "out",
    "out_dir",
    "force",
    "dry_run",
    "augment",
    "downscale_max_dim",
    "downscale_suffix",
    "image",
    "mask",
    "reference",
    "input",
    "concurrency",
    "max_attempts",
    "fail_fast",
    ...PROMPT_FIELDS,
    ...Object.keys(provider.MODEL_PARAMS),
  ]);
  const unknown = Object.keys(args).find((key) => !known.has(key));
  if (unknown)
    throw new ImagineError(
      `unrecognized arguments: --${unknown.replaceAll("_", "-")}`,
    );
  if (Array.isArray(args.__unknown_args))
    throw parse_error(
      `unrecognized arguments: ${args.__unknown_args.join(" ")}`,
      String(args.command || "") || undefined,
    );
  if (!args.command)
    throw parse_error("the following arguments are required: command");
  if (!["generate", "generate-batch", "edit"].includes(String(args.command)))
    throw parse_error(
      `argument command: invalid choice: '${args.command}' (choose from 'generate', 'generate-batch', 'edit')`,
    );
  if (args.command === "edit" && !(args.image as string[] | undefined)?.length)
    throw parse_error(
      "the following arguments are required: --image",
      String(args.command),
    );
  if (args.command === "generate-batch" && !args.input)
    throw parse_error(
      "the following arguments are required: --input",
      String(args.command),
    );
  if (args.command === "generate-batch" && !args.out_dir)
    throw new ImagineError("generate-batch requires --out-dir");
  const n = Number(args.n ?? 1),
    concurrency = Number(args.concurrency ?? 1),
    attempts = Number(args.max_attempts ?? 3);
  if (n < 1 || n > 10) throw new ImagineError("--n must be between 1 and 10");
  if (concurrency < 1 || concurrency > 25)
    throw new ImagineError("--concurrency must be between 1 and 25");
  if (attempts < 1 || attempts > 10)
    throw new ImagineError("--max-attempts must be between 1 and 10");
  if (
    args.output_compression != null &&
    (Number(args.output_compression) < 0 ||
      Number(args.output_compression) > 100)
  )
    throw new ImagineError("--output-compression must be between 0 and 100");
  if (args.downscale_max_dim != null && Number(args.downscale_max_dim) < 1)
    throw new ImagineError("--downscale-max-dim must be >= 1");
  for (const [name, spec] of Object.entries(provider.MODEL_PARAMS)) {
    const value = args[name];
    if (value == null) continue;
    if (spec.choices && !spec.choices.includes(value))
      throw parse_error(
        `argument --${name.replaceAll("_", "-")}: invalid choice: '${value}' (choose from ${spec.choices.map((choice) => `'${choice}'`).join(", ")})`,
        String(args.command),
      );
    if (spec.type === "int" && !Number.isInteger(value))
      throw parse_error(
        `argument --${name.replaceAll("_", "-")}: invalid int value: '${value}'`,
        String(args.command),
      );
  }
  provider.validate(args);
}

if (import.meta.main)
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      const exception = error as Error;
      process.stderr.write(
        `${error instanceof ImagineError && error.exit_code === 2 ? exception.message : `Error: ${exception.message}`}\n`,
      );
      process.exit(error instanceof ImagineError ? error.exit_code : 1);
    });
