import {
  AI_GROUNDED_RULES,
  CONFIDENCE_THRESHOLD,
  buildFindingFromIssue,
  flagFinding,
  mergeAiVerdict,
  shouldFlagForAi,
} from "./flag_ai";
import type { Finding } from "../types";

function finding(rule_id = "DES-GENERIC-00"): Finding {
  return {
    rule_id,
    severity: "p1",
    selector: ".btn",
    evidence: {},
    recommendation: {
      action: "fix it",
      code_suggestion: "",
      rule_ref: rule_id,
    },
    needs_ai_review: false,
  };
}

describe("AI flag routing", () => {
  it("flags every AI-grounded rule and populates prompt and hypothesis", () => {
    for (const rule_id of AI_GROUNDED_RULES) {
      const flagged = flagFinding(finding(rule_id), {});
      expect(flagged).toMatchObject({ needs_ai_review: true });
      expect(flagged.ai_prompt).toEqual(expect.any(String));
      expect(flagged.hypothesis).toEqual(expect.any(String));
    }
  });

  it("flags confidence below threshold but not confidence above it", () => {
    expect(
      flagFinding(finding(), { confidence: CONFIDENCE_THRESHOLD - 0.01 })
        .needs_ai_review,
    ).toBe(true);
    expect(flagFinding(finding(), { confidence: 0.95 })).toMatchObject({
      needs_ai_review: false,
      ai_prompt: null,
    });
  });

  it("flags text over a background image", () => {
    expect(
      shouldFlagForAi(finding(), { has_text_over_background_image: true }),
    ).toBe(true);
  });

  it("normalizes browser issue fields and severity aliases", () => {
    expect(
      buildFindingFromIssue({
        ruleId: "DES-NAVI-01",
        severity: "critical",
        selector: ".menu",
        evidence: { domValue: "opaque", cropPath: "crop.png" },
        recommendation: {
          action: "fix",
          codeSuggestion: "use focus",
          ruleRef: "RULE-1",
        },
      }),
    ).toMatchObject({
      rule_id: "DES-NAVI-01",
      severity: "p0",
      selector: ".menu",
      evidence: {
        dom_value: "opaque",
        crop_path: "crop.png",
        triggered_by: null,
      },
      recommendation: {
        action: "fix",
        code_suggestion: "use focus",
        rule_ref: "RULE-1",
      },
      needs_ai_review: false,
    });
  });

  it("attaches a normalized AI verdict without mutating the finding", () => {
    const original = finding();
    const reviewed = mergeAiVerdict(original, {
      passed: true,
      confidence: "0.8",
      rationale: "accepted",
    });

    expect(original).not.toHaveProperty("ai_verdict");
    expect(reviewed.ai_verdict).toEqual({
      passed: true,
      confidence: 0.8,
      rationale: "accepted",
    });
  });

  it.each([
    [null, false, false],
    [0.71, false, false],
    [0.69, false, true],
    [null, true, true],
  ])("matches the combined flag matrix", (confidence, heuristic, expected) => {
    expect(
      shouldFlagForAi(finding(), {
        confidence: confidence as number | null,
        has_text_over_background_image: heuristic as boolean,
      }),
    ).toBe(expected);
  });
});
