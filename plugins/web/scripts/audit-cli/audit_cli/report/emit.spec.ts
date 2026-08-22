import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { copyCrop, loadReport, reportToDict, writeReport } from "./emit";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function sampleReport(): Record<string, unknown> {
  const finding = {
    rule_id: "DES-CONS-01",
    severity: "p1",
    selector: ".hero h1",
    evidence: { dom_value: "opaque-dom-value", crop_path: "crops/hero.png" },
    recommendation: {
      action: "opaque remediation",
      code_suggestion: "opaque suggestion",
      rule_ref: "DES-CONS-01",
    },
    needs_ai_review: true,
    ai_prompt: "opaque prompt",
    hypothesis: "opaque hypothesis",
    ai_verdict: undefined,
  };
  return {
    contract_version: "3.0",
    target: "https://example.com/",
    generated_at: "2026-04-15T00:00:00Z",
    overall_score: 82,
    risk: "MEDIUM",
    pages: [
      {
        url: "https://example.com/",
        title: "Home",
        viewports: [{ label: "desktop", width: 1440, height: 900 }],
        areas: [],
        findings: [finding],
      },
    ],
    findings: [finding],
    recurring_elements: [],
    cross_origin_candidates: ["https://partner.com/login"],
    warnings: [],
  };
}

describe("report emission", () => {
  it("writes report.json and creates the crops directory", () => {
    const out = mkdtempSync(resolve(tmpdir(), "audit-emit-"));
    roots.push(out);
    const target = writeReport(sampleReport(), out);
    expect(target).toBe(resolve(out, "report.json"));
    const raw = JSON.parse(readFileSync(target, "utf8")) as Record<string, any>;
    expect({
      contract_version: raw.contract_version,
      overall_score: raw.overall_score,
      risk: raw.risk,
      page_url: raw.pages[0]?.url,
      needs_ai_review: raw.findings[0]?.needs_ai_review,
      ai_prompt: raw.findings[0]?.ai_prompt,
    }).toEqual({
      contract_version: "3.0",
      overall_score: 82,
      risk: "MEDIUM",
      page_url: "https://example.com/",
      needs_ai_review: true,
      ai_prompt: "opaque prompt",
    });
    expect(readdirSync(out)).toContain("crops");
  });

  it("prunes undefined values recursively", () => {
    const payload = reportToDict(sampleReport()) as Record<string, any>;
    expect(payload.findings[0]).not.toHaveProperty("ai_verdict");
    expect(payload.pages[0].findings[0]).not.toHaveProperty("ai_verdict");
    expect(
      reportToDict({ nested: [null, undefined, { value: null, keep: 1 }] }),
    ).toEqual({
      nested: [null, undefined, { keep: 1 }],
    });
  });

  it("copies crops and loads object reports", () => {
    const out = mkdtempSync(resolve(tmpdir(), "audit-emit-crop-"));
    roots.push(out);
    const source = resolve(out, "source.png");
    writeFileSync(source, "opaque fixture bytes");

    const target = copyCrop(source, out, { name: "hero.png" });
    expect(readFileSync(target, "utf8")).toBe("opaque fixture bytes");
    const reportPath = resolve(out, "loaded.json");
    writeFileSync(reportPath, '{"status":"ok"}');
    expect(loadReport(reportPath)).toEqual({ status: "ok" });
  });

  it("rejects a loaded non-object report", () => {
    const out = mkdtempSync(resolve(tmpdir(), "audit-emit-invalid-"));
    roots.push(out);
    const path = resolve(out, "invalid.json");
    writeFileSync(path, "[]");

    expect(() => loadReport(path)).toThrow();
  });
});
