import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  computeCategoryScore,
  computeOverallScore,
  determineRisk,
  normalizeSeverity,
  penaltyForOccurrences,
} from "./aggregate";

type Category = { readonly issues: ReadonlyArray<Record<string, unknown>> };
type Fixture = { readonly categories: Record<string, Category> };
type CategoryScore = { readonly score: number };
type Summary = {
  readonly byCategory: Record<string, CategoryScore>;
  readonly overallScore: number;
  readonly bySeverity: Record<string, number>;
  readonly risk: string;
};
type JsReport = { readonly summary: Summary };

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/audit-cli/fixtures/findings_sample.json",
);
const jsAggregatorPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../skills/audit/scripts/design-audit-aggregator.js",
);

function requireExecutable(name: string): string {
  try {
    return execFileSync("which", [name], { encoding: "utf8" }).trim();
  } catch {
    throw new Error(`${name} is required for aggregator parity tests`);
  }
}

const node = requireExecutable("node");

function runJsBaseline(categories: Record<string, Category>): JsReport {
  const runner = `
const globals = { window: {} };
Object.assign(globalThis, globals);
const vm = require('vm');
const fs = require('fs');
const src = fs.readFileSync(${JSON.stringify(jsAggregatorPath)}, 'utf-8');
vm.runInThisContext(src);

const categories = ${JSON.stringify(categories)};
for (const [key, value] of Object.entries(categories)) {
    const fnMap = {
        text: 'runWcagTextAudit',
        structure: 'runSemanticStructureAudit',
        interaction: 'runInteractionAudit',
        mobile: 'runMobileLayoutAudit',
        visual: 'runVisualLayoutAudit',
        tokens: 'runDesignTokensAudit',
        typography: 'runTypographyAudit',
        spatial: 'runSpatialLayoutAudit',
        css: 'runUnusedCssAudit'
    };
    globalThis.window[fnMap[key]] = () => ({issues: value.issues, stats: {}});
}

const report = globalThis.window.runDesignAudit({
    categories: Object.keys(categories),
    viewport: 'desktop',
    viewportLabel: 'Desktop 1440x900'
});
process.stdout.write(JSON.stringify(report));
`;

  const output = execFileSync(node, ["-e", runner], {
    encoding: "utf8",
  });
  return JSON.parse(output) as JsReport;
}

describe("aggregate scoring parity", () => {
  it("handles empty, unknown, repeated, and missing-severity categories", () => {
    expect(computeCategoryScore([])).toBe(100);
    expect(normalizeSeverity("not-a-severity")).toBe("medium");
    expect(normalizeSeverity(undefined)).toBe("medium");
    expect(computeCategoryScore([{}])).toBe(92);
    expect(
      computeCategoryScore([
        { ruleId: "same", severity: "critical" },
        { ruleId: "same", severity: "low" },
      ]),
    ).toBe(76);
    expect(penaltyForOccurrences("critical", 20)).toBe(24);
  });

  it("rounds overall scores with the Python-compatible boundary rule", () => {
    expect(computeOverallScore({})).toBe(100);
    expect(computeOverallScore({ first: 80, second: 81 })).toBe(80);
    expect(computeOverallScore({ first: 80, second: 82 })).toBe(81);
  });

  it.each([
    [{}, "LOW"],
    [{ low: 4 }, "MEDIUM"],
    [{ medium: 1 }, "MEDIUM"],
    [{ medium: 6 }, "HIGH"],
    [{ high: 1 }, "HIGH"],
    [{ high: 4 }, "CRITICAL"],
    [{ critical: 1 }, "CRITICAL"],
  ] as const)("applies risk threshold %j", (counts, expected) => {
    expect(determineRisk(counts)).toBe(expected);
  });

  it("matches the canonical fixture scores and risk ladder", () => {
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;
    const categories = fixture.categories;
    const jsReport = runJsBaseline(categories);
    const scores = Object.fromEntries(
      Object.entries(categories).map(([key, category]) => [
        key,
        computeCategoryScore(category.issues),
      ]),
    );

    expect(scores).toEqual({ text: 76, structure: 86, interaction: 84 });
    expect(Object.keys(scores)).toEqual(["text", "structure", "interaction"]);
    expect(computeOverallScore(scores)).toBe(82);
    expect(determineRisk({ critical: 1, high: 1, medium: 2, low: 1 })).toBe(
      "CRITICAL",
    );

    const jsByCategory = jsReport.summary.byCategory;
    for (const [key, score] of Object.entries(scores)) {
      expect(jsByCategory[key]?.score).toBe(score);
    }
    expect(computeOverallScore(scores)).toBe(jsReport.summary.overallScore);
    expect(determineRisk(jsReport.summary.bySeverity)).toBe(
      jsReport.summary.risk,
    );
  });
});
