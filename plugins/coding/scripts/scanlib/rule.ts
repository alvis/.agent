import { sourceFiles } from "./predicates.ts";

export interface Match {
  readonly path: string;
  readonly lineno: number;
  readonly line: string;
}

export interface ScanParams {
  readonly path: string;
  readonly lines: readonly string[];
  readonly matches: Match[];
}

export interface Rule {
  readonly id: string;
  readonly label: string;
  readonly scan: (params: ScanParams) => void;
  readonly order: number;
  readonly appliesTo?: (path: string) => boolean;
  readonly honorNoTests?: boolean;
  readonly ruleRefs?: readonly string[];
}

export function appliesTo(rule: Rule, path: string): boolean {
  return (rule.appliesTo ?? sourceFiles)(path);
}
