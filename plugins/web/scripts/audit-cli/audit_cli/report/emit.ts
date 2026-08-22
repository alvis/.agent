import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Report } from "../types";

/**
 * writes report.json and ensures its crop directory exists
 * @param report report payload
 * @param out_dir output directory
 * @returns emitted report path
 */
export function writeReport(
  report: Report | Readonly<Record<string, unknown>>,
  out_dir: string,
): string {
  mkdirSync(resolve(out_dir, "crops"), { recursive: true });
  const target = resolve(out_dir, "report.json");
  writeFileSync(
    target,
    JSON.stringify(reportToDict(report), null, 2),
    "utf8",
  );
  return target;
}

/**
 * returns a recursively pruned JSON-safe report object
 * @param report report payload
 * @returns copied report without nullish values
 */
export function reportToDict(
  report: Report | Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const pruned = pruneNone(report);
  if (isRecord(pruned)) return pruned;
  throw new TypeError("report pruning yielded a non-dict top-level value");
}

/**
 * copies a crop into the report crop directory
 * @param source source path
 * @param out_dir output directory
 * @param options target naming options
 * @returns copied crop path
 */
export function copyCrop(
  source: string,
  out_dir: string,
  options: { readonly name: string },
): string {
  const cropsDir = resolve(out_dir, "crops");
  mkdirSync(cropsDir, { recursive: true });
  const target = resolve(cropsDir, options.name);
  copyFileSync(source, target);
  return target;
}

/**
 * parses a previously emitted report object
 * @param path report path
 * @returns parsed report mapping
 */
export function loadReport(path: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(parsed))
    throw new Error(`report.json at ${path} is not an object`);
  return parsed;
}

function pruneNone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(pruneNone);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined && item !== null)
        .map(([key, item]) => [key, pruneNone(item)]),
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
