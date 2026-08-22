import { basename, extname } from "node:path";

export const SOURCE_SUFFIXES = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);
export const PY_SUFFIXES = new Set([".py"]);
export const RUST_SUFFIXES = new Set([".rs"]);
export const TS_SUFFIXES = new Set([".ts", ".tsx"]);

export function isSpecFile(path: string): boolean {
  return (
    SOURCE_SUFFIXES.has(extname(path).toLowerCase()) &&
    basename(path).includes(".spec.")
  );
}

export function isTestFile(path: string): boolean {
  const name = basename(path);
  return (
    isSpecFile(path) ||
    (extname(path).toLowerCase() === ".py" &&
      (name.startsWith("test_") || name.endsWith("_test.py")))
  );
}

export function sourceFiles(path: string): boolean {
  return SOURCE_SUFFIXES.has(extname(path).toLowerCase());
}

export function specFiles(path: string): boolean {
  return isSpecFile(path);
}

export function pythonFiles(path: string): boolean {
  return PY_SUFFIXES.has(extname(path).toLowerCase());
}

export function tsOnly(path: string): boolean {
  return TS_SUFFIXES.has(extname(path).toLowerCase());
}

export function indexFiles(path: string): boolean {
  return ["index.ts", "index.tsx"].includes(basename(path));
}
