import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  parse,
  resolve,
} from "node:path";
import { ImagineError } from "./providers/base";
import { PROMPT_FIELDS } from "./prompt";

import type { Args, GenerateOptions, ImageProvider } from "./providers/base";
import type { downscale_image } from "./sharp-image";

/** names every output path input for one JSONL job */
export interface JobOutputPathOptions {
  out_dir: string;
  output_format: string;
  idx: number;
  prompt: string;
  n: number;
  explicit_out?: string | null;
}
/** controls path resolution at the external file/URL boundary */
export interface ResolvePathOptions {
  dry_run?: boolean;
  label?: string;
}
/** owns one temporary download directory and its cleanup operation */
export interface TempDownloadContext {
  path: string;
  cleanup(): void;
}
/** controls image resizing and encoding */
export interface DownscaleImageOptions {
  max_dim: number;
  output_format: string;
}
/** controls decoded output writes and optional derived images */
export interface DecodeWriteOptions {
  force: boolean;
  downscale_max_dim?: number | null;
  downscale_suffix: string;
  output_format: string;
}
/** controls retry count, labeling, and provider image inputs */
export interface GenerateRetryOptions extends GenerateOptions {
  attempts: number;
  job_label: string;
}
/** validated external JSONL job consumed by batch generation */
export interface ImagineJob extends Args {
  prompt: string;
  fields?: Partial<Record<string, string | null>>;
  image?: string;
  images?: string[];
  reference?: string;
  references?: string[];
  mask?: string;
  out?: string;
}

export const DEFAULT_DOWNSCALE_SUFFIX = "-web";
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_BATCH_JOBS = 500;

export function _die(message: string, code = 1): never {
  throw new ImagineError(message, code);
}
export function _warn(message: string): void {
  process.stderr.write(`Warning: ${message}\n`);
}
export function _normalize_output_format(format?: string | null): string {
  if (!format) return "png";
  const normalized = format.toLowerCase();
  if (!["png", "jpeg", "jpg", "webp", "svg"].includes(normalized))
    _die("output-format must be png, jpeg, jpg, webp, or svg.");
  return normalized === "jpg" ? "jpeg" : normalized;
}
export function _build_output_paths(
  out: string,
  format: string,
  count: number,
  out_dir?: string | null,
): string[] {
  const extension = `.${format}`;
  if (out_dir) {
    mkdirSync(out_dir, { recursive: true });
    return Array.from({ length: count }, (_, i) =>
      join(out_dir, `image_${i + 1}${extension}`),
    );
  }
  if (existsSync(out) && statSync(out).isDirectory())
    return Array.from({ length: count }, (_, i) =>
      join(out, `image_${i + 1}${extension}`),
    );
  let path = out;
  if (!extname(path)) path += extension;
  else if (extname(path).slice(1).toLowerCase() !== format)
    _warn(
      `Output extension ${extname(path)} does not match output-format ${format}.`,
    );
  if (count === 1) return [path];
  const parts = parse(path);
  return Array.from({ length: count }, (_, i) =>
    join(parts.dir, `${parts.name}-${i + 1}${parts.ext}`),
  );
}
export function _slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "job"
  );
}
export function _job_output_paths(options: JobOutputPathOptions): string[] {
  mkdirSync(options.out_dir, { recursive: true });
  const extension = `.${options.output_format}`;
  let name = options.explicit_out
    ? basename(options.explicit_out)
    : `${String(options.idx).padStart(3, "0")}-${_slugify(options.prompt.slice(0, 80))}${extension}`;
  if (!extname(name)) name += extension;
  else if (extname(name).slice(1).toLowerCase() !== options.output_format)
    _warn(
      `Job ${options.idx}: output extension ${extname(name)} does not match output-format ${options.output_format}.`,
    );
  const base = join(options.out_dir, name);
  if (options.n === 1) return [base];
  const parts = parse(base);
  return Array.from({ length: options.n }, (_, i) =>
    join(parts.dir, `${parts.name}-${i + 1}${parts.ext}`),
  );
}
export function _is_url(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}
export async function _download_to_temp(
  url: string,
  temp_dir: string,
): Promise<string> {
  process.stderr.write(`Downloading ${url} ...\n`);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "user-agent": "imagine-cli/1.0" },
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const exception = error as Error;
    _die(`Failed to download ${url}: ${exception.message}`);
  }
  if (!response.ok) _die(`Failed to download ${url}: HTTP ${response.status}`);
  const sourceName = basename(new URL(url).pathname) || "download";
  let destination = join(temp_dir, sourceName),
    counter = 0;
  while (existsSync(destination)) {
    counter += 1;
    const p = parse(sourceName);
    destination = join(temp_dir, `${p.name}_${counter}${p.ext}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  writeFileSync(destination, bytes);
  if (bytes.byteLength > MAX_IMAGE_BYTES)
    _warn(`Downloaded image exceeds 50MB limit: ${url}`);
  process.stderr.write(`Downloaded to ${destination}\n`);
  return destination;
}
export function _temp_download_context(): TempDownloadContext {
  const path = mkdtempSync(join(tmpdir(), "imagine_dl_"));
  return {
    path,
    cleanup: () => rmSync(path, { recursive: true, force: true }),
  };
}
export async function _resolve_paths(
  values: string[] | null | undefined,
  temp_dir: string,
  options: ResolvePathOptions = {},
): Promise<string[] | null> {
  if (!values?.length) return null;
  const label = options.label ?? "image";
  const paths: string[] = [];
  for (const raw of values) {
    if (_is_url(raw))
      paths.push(
        options.dry_run
          ? normalize(`<${label}:${raw}>`)
          : await _download_to_temp(raw, temp_dir),
      );
    else {
      if (!options.dry_run && !existsSync(raw))
        _die(
          `${label[0].toUpperCase()}${label.slice(1)} file not found: ${raw}`,
        );
      if (!options.dry_run && statSync(raw).size > MAX_IMAGE_BYTES)
        _warn(
          `${label[0].toUpperCase()}${label.slice(1)} exceeds 50MB limit: ${raw}`,
        );
      paths.push(raw);
    }
  }
  return paths;
}
export async function _resolve_single_path(
  value: string | null | undefined,
  temp_dir: string,
  options: ResolvePathOptions = {},
): Promise<string | null> {
  return value == null
    ? null
    : ((await _resolve_paths([value], temp_dir, options))?.[0] ?? null);
}
export function _derive_downscale_path(path: string, suffix: string): string {
  const normalized = suffix && !/^[-_]/.test(suffix) ? `-${suffix}` : suffix;
  const p = parse(path);
  return join(p.dir, `${p.name}${normalized}${p.ext}`);
}
export async function _downscale_image_bytes(
  bytes: Uint8Array,
  options: DownscaleImageOptions,
): Promise<Uint8Array> {
  if (options.max_dim < 1) _die("--downscale-max-dim must be >= 1");
  let downscale: typeof downscale_image;
  try {
    ({ downscale_image: downscale } = await import("./sharp-image"));
  } catch (cause) {
    throw new ImagineError(
      "Failed to load image processing. Run with Bun auto-install enabled for sharp@0.34.",
      1,
      { cause },
    );
  }
  return downscale(bytes, options.max_dim, options.output_format);
}
export async function _decode_write_and_downscale(
  images: string[],
  outputs: string[],
  options: DecodeWriteOptions,
): Promise<void> {
  for (const [index, encoded] of images.entries()) {
    const output = outputs[index];
    if (!output) break;
    if (existsSync(output) && !options.force)
      _die(`Output already exists: ${output} (use --force to overwrite)`);
    mkdirSync(dirname(resolve(output)), { recursive: true });
    const bytes = Uint8Array.from(Buffer.from(encoded, "base64"));
    writeFileSync(output, bytes);
    process.stdout.write(`Wrote ${output}\n`);
    if (options.output_format === "svg" || options.downscale_max_dim == null)
      continue;
    const derived = _derive_downscale_path(output, options.downscale_suffix);
    if (existsSync(derived) && !options.force)
      _die(`Output already exists: ${derived} (use --force to overwrite)`);
    writeFileSync(
      derived,
      await _downscale_image_bytes(bytes, {
        max_dim: options.downscale_max_dim,
        output_format: options.output_format,
      }),
    );
    process.stdout.write(`Wrote ${derived}\n`);
  }
}
export function _print_request(data: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(sort_json(data), null, 2)}\n`);
}
export function _normalize_job(job: unknown, idx: number): ImagineJob {
  if (typeof job === "string") {
    if (!job.trim()) _die(`Empty prompt at job ${idx}`);
    return { prompt: job.trim() };
  }
  if (is_record(job)) return validate_job_object(job, idx);
  return _die(`Invalid job at index ${idx}: expected string or object.`);
}
export function _read_jobs_jsonl(path: string): ImagineJob[] {
  if (!existsSync(path)) _die(`Input file not found: ${path}`);
  const jobs: ImagineJob[] = [];
  for (const [i, raw] of readFileSync(path, "utf8").split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    try {
      jobs.push(
        _normalize_job(line.startsWith("{") ? JSON.parse(line) : line, i + 1),
      );
    } catch (error) {
      if (error instanceof SyntaxError)
        _die(`Invalid JSON on line ${i + 1}: ${error.message}`);
      throw error;
    }
  }
  if (!jobs.length) _die("No jobs found in input file.");
  if (jobs.length > MAX_BATCH_JOBS)
    _die(`Too many jobs (${jobs.length}). Max is ${MAX_BATCH_JOBS}.`);
  return jobs;
}
export function _merge_non_null(dst: Args, src: Args): Args {
  return {
    ...dst,
    ...Object.fromEntries(
      Object.entries(src).filter(([, value]) => value != null),
    ),
  };
}
export function _extract_retry_after_seconds(error: unknown): number | null {
  const value =
    (error as { retry_after?: unknown; retry_after_seconds?: unknown })
      .retry_after ??
    (error as { retry_after_seconds?: unknown }).retry_after_seconds;
  if (typeof value === "number" && value >= 0) return value;
  const match = String((error as Error).message ?? error).match(
    /retry[- ]after[:= ]+([0-9]+(?:\.[0-9]+)?)/i,
  );
  return match ? Number(match[1]) : null;
}
export function _is_rate_limit_error(error: unknown): boolean {
  const text =
    `${(error as Error).name ?? ""} ${(error as Error).message ?? error}`.toLowerCase();
  return /ratelimit|rate_limit|429|rate limit|too many requests/.test(text);
}
export function _is_transient_error(error: unknown): boolean {
  const text =
    `${(error as Error).name ?? ""} ${(error as Error).message ?? error}`.toLowerCase();
  return (
    _is_rate_limit_error(error) ||
    /timeout|timedout|timed out|tempor|connection reset/.test(text)
  );
}
export async function _generate_one_with_retries(
  provider: ImageProvider,
  prompt: string,
  args: Args,
  options: GenerateRetryOptions,
): Promise<string[]> {
  let last: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await provider.async_generate(prompt, args, options);
    } catch (error) {
      last = error;
      if (!_is_transient_error(error) || attempt === options.attempts)
        throw error;
      const seconds =
        _extract_retry_after_seconds(error) ?? Math.min(60, 2 ** attempt);
      process.stderr.write(
        `${options.job_label} attempt ${attempt}/${options.attempts} failed (${(error as Error).name}); retrying in ${seconds.toFixed(1)}s\n`,
      );
      await Bun.sleep(seconds * 1000);
    }
  }
  throw last;
}

function is_record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validate_job_object(
  job: Record<string, unknown>,
  idx: number,
): ImagineJob {
  const allowed = new Set([
    "prompt",
    "fields",
    "image",
    "images",
    "reference",
    "references",
    "mask",
    "out",
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
    "negative_prompt",
    ...PROMPT_FIELDS,
  ]);
  const unknown = Object.keys(job).find((key) => !allowed.has(key));
  if (unknown) _die(`Unknown key '${unknown}' for job ${idx}.`);
  if (typeof job.prompt !== "string" || !job.prompt.trim())
    _die(`Missing prompt for job ${idx}`);

  if (job.fields !== undefined) {
    if (!is_record(job.fields))
      _die(`Invalid fields for job ${idx}: expected object.`);
    for (const [key, value] of Object.entries(job.fields)) {
      if (typeof value !== "string" && value !== null)
        _die(`Invalid fields.${key} for job ${idx}: expected string or null.`);
      if (!(PROMPT_FIELDS as readonly string[]).includes(key))
        _die(`Unknown fields key '${key}' for job ${idx}.`);
    }
  }

  for (const key of PROMPT_FIELDS)
    if (
      job[key] !== undefined &&
      job[key] !== null &&
      typeof job[key] !== "string"
    )
      _die(`Invalid ${key} for job ${idx}: expected string or null.`);

  for (const key of ["image", "reference"]) {
    const singular = job[key],
      plural = job[`${key}s`];
    if (singular !== undefined && typeof singular !== "string")
      _die(`Invalid ${key} for job ${idx}: expected string.`);
    if (
      plural !== undefined &&
      (!Array.isArray(plural) ||
        plural.some((value) => typeof value !== "string"))
    )
      _die(`Invalid ${key}s for job ${idx}: expected string array.`);
  }

  for (const key of [
    "mask",
    "out",
    "model",
    "size",
    "quality",
    "background",
    "output_format",
    "moderation",
    "aspect_ratio",
    "resolution",
    "recraft_style",
    "style_id",
    "negative_prompt",
  ])
    if (
      job[key] !== undefined &&
      job[key] !== null &&
      typeof job[key] !== "string"
    )
      _die(`Invalid ${key} for job ${idx}: expected string or null.`);

  for (const key of ["n", "output_compression"])
    if (job[key] !== undefined && !Number.isInteger(job[key]))
      _die(`Invalid ${key} for job ${idx}: expected integer.`);

  if (
    job.strength !== undefined &&
    job.strength !== null &&
    typeof job.strength !== "number"
  )
    _die(`Invalid strength for job ${idx}: expected number or null.`);

  return job as ImagineJob;
}

function sort_json(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort_json);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sort_json(entry)]),
    );
  return value;
}
