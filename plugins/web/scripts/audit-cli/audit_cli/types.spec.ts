import type {
  Area,
  Evidence,
  Finding,
  InteractionCandidate,
  InteractionPlan,
  PageAuditResult,
  Route,
  Viewport,
} from "./types";

describe("audit contract types", () => {
  it("preserves nullable evidence defaults and serializes only supplied values", () => {
    const evidence: Evidence = {};
    expect(evidence).toEqual({});
    expect(evidence.dom_value).toBeUndefined();
    expect(evidence.crop_path).toBeUndefined();
    expect(evidence.triggered_by).toBeUndefined();
    expect(JSON.stringify(evidence)).toBe("{}");
  });

  it("initializes collection defaults on mutable and plan records", () => {
    const result: PageAuditResult = {
      url: "https://example.com",
      viewport_reports: {},
      anchor_urls: [],
      bonus_urls: [],
      triggered_reports: [],
      hover_findings: [],
      modal_findings: [],
    };
    const plan: InteractionPlan = {
      candidates: [],
      cross_origin_candidates: [],
      dropped_social: [],
    };

    expect(result).toMatchObject({
      url: "https://example.com",
      viewport_reports: {},
      anchor_urls: [],
      bonus_urls: [],
      triggered_reports: [],
      hover_findings: [],
      modal_findings: [],
    });
    expect(plan).toEqual({
      candidates: [],
      cross_origin_candidates: [],
      dropped_social: [],
    });
  });

  it("keeps nested contract records JSON-serializable with explicit fields", () => {
    const finding: Finding = {
      rule_id: "DES-NAVI-01",
      severity: "p1",
      selector: "nav",
      evidence: {},
      recommendation: {
        action: "add a visible focus state",
        code_suggestion: "",
        rule_ref: "DES-NAVI-01",
      },
      needs_ai_review: false,
    };
    const candidate: InteractionCandidate = {
      uid: 4,
      role: "button",
      name: "Menu",
      fingerprint: "button\u0004Menu",
    };
    const records = [
      { name: "hero", selector: "#hero" } satisfies Area,
      {
        path: "/",
        source_file: "app/page.tsx",
        framework: "next",
      } satisfies Route,
      { label: "desktop", width: 1440, height: 900 } satisfies Viewport,
      candidate,
      finding,
    ];

    expect(JSON.parse(JSON.stringify(records))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "hero" }),
        expect.objectContaining({ path: "/" }),
        expect.objectContaining({ label: "desktop", width: 1440, height: 900 }),
        expect.objectContaining({ uid: 4 }),
        expect.objectContaining({ rule_id: "DES-NAVI-01" }),
      ]),
    );
  });
});
