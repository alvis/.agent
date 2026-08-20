import { _collect_page_findings } from "./cli";

describe("page finding collection", () => {
  it("includes findings from triggered interaction reports", () => {
    const result = {
      url: "https://example.com",
      viewport_reports: {
        "Mobile 390x844": { categories: { text: { issues: [] } } },
      },
      triggered_reports: [
        [
          "menu-open",
          {
            categories: {
              text: {
                issues: [
                  {
                    ruleId: "contrast",
                    severity: "high",
                    selector: "a.mobile-nav-link.mobile-nav-link-active",
                    summary: "opaque summary",
                    details: "opaque details",
                    evidence: {
                      contrast: 1,
                      minimum: 4.5,
                    },
                  },
                ],
              },
            },
          },
        ],
      ],
    };

    const findings = _collect_page_findings(result);
    expect(findings.size).toBe(1);
    expect(
      findings.has("contrast\u0000a.mobile-nav-link.mobile-nav-link-active"),
    ).toBe(true);
  });

  it("ignores malformed report and issue containers while retaining valid findings", () => {
    const findings = _collect_page_findings({
      viewport_reports: {
        valid: {
          categories: {
            text: {
              issues: [
                {
                  ruleId: "valid",
                  severity: "low",
                  selector: ".target",
                  summary: "opaque",
                },
                null,
              ],
            },
            malformed: null,
          },
        },
        malformed: "not-a-report",
      },
      triggered_reports: [["bad-shape"], ["valid", null]],
    });

    expect(findings.size).toBe(1);
    expect(findings.has("valid\u0000.target")).toBe(true);
  });
});
