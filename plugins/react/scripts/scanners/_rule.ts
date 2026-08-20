import { basename, extname } from "node:path";

export interface Match {
  readonly path: string;
  readonly lineno: number;
  readonly line: string;
}
export interface Rule {
  readonly id: string;
  readonly label: string;
  readonly order: number;
  readonly appliesTo: (path: string) => boolean;
  readonly ruleRefs?: readonly string[];
  readonly scan: (params: {
    readonly path: string;
    readonly lines: readonly string[];
    readonly matches: Match[];
  }) => void;
}
export const tsOnly = (path: string): boolean =>
  [".ts", ".tsx"].includes(extname(path).toLowerCase());
export const indexFiles = (path: string): boolean =>
  ["index.ts", "index.tsx"].includes(basename(path));
