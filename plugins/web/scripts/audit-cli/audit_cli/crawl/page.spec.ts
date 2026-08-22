import { BrowserDriverError } from "../drive/browser";
import {
  type ViewportSpec,
  _probe_home_logo_behavior,
  _probe_modal_backdrop,
  auditPage,
} from "./page";
import { CrawlQueue } from "./queue";

const SUCCESS = { stdout: "", stderr: "", exitCode: 0 };

class FakeDriver {
  calls: unknown[][] = [];
  fail_wait = false;
  eval_value = "false";
  resize(width: number, height: number) {
    this.calls.push(["resize", width, height]);
    return SUCCESS;
  }
  navigate(url: string) {
    this.calls.push(["navigate", url]);
    return SUCCESS;
  }
  wait_for_fn(expression: string, options?: { timeout_ms?: number }) {
    this.calls.push(["wait_for_fn", expression, options?.timeout_ms]);
    if (this.fail_wait && expression.includes("scrollY"))
      throw new BrowserDriverError("scroll did not return to top");
    return SUCCESS;
  }
  snapshot() {
    this.calls.push(["snapshot"]);
    return { refs: { e4: { name: "Open navigation menu", role: "button" } } };
  }
  get_url() {
    this.calls.push(["get_url"]);
    return "http://127.0.0.1:3200/";
  }
  click(uid: number) {
    this.calls.push(["click", uid]);
    return SUCCESS;
  }
  hover(target: number | string) {
    this.calls.push(["hover", target]);
    return SUCCESS;
  }
  evaluate(_expression: string) {
    this.calls.push(["evaluate", _expression]);
    return {
      stdout: `[{"result":{"result":"${this.eval_value}"},"success":true}]`,
      stderr: "",
      exitCode: 0,
    };
  }
  press(_key: string) {
    this.calls.push(["press", _key]);
    return SUCCESS;
  }
  reload() {
    this.calls.push(["reload"]);
    return SUCCESS;
  }
}

const viewport: ViewportSpec = {
  label: "Mobile 390x844",
  kind: "mobile",
  width: 390,
  height: 844,
};

describe("page audit stateful probes", () => {
  it("reports missing modal backdrop blur", () => {
    const driver = new FakeDriver();
    expect(
      _probe_modal_backdrop(driver as never, { selector_hint: "modal@e4" }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "DES-MODA-04" }),
      ]),
    );
  });

  it("accepts a visible blurred modal backdrop", () => {
    const driver = new FakeDriver();
    driver.eval_value = "true";
    expect(
      _probe_modal_backdrop(driver as never, { selector_hint: "modal@e4" }),
    ).toEqual([]);
  });

  it("reports a home logo that fails to return to the top", () => {
    const driver = new FakeDriver();
    driver.fail_wait = true;
    driver.eval_value = "true";
    expect(
      _probe_home_logo_behavior(driver as never, {
        current_url: "http://127.0.0.1:3200/",
        selector_hint: "header-home-link",
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "DES-NAVI-04" }),
      ]),
    );
  });

  it("clears hover before the follow-up audit", async () => {
    const driver = new FakeDriver();
    const queue = new CrawlQueue({ origin: "http://127.0.0.1:3200" });
    const inject = vi
      .fn()
      .mockReturnValue({ categories: { text: { issues: [] } } });
    const result = await auditPage(
      driver as never,
      { host: "127.0.0.1", port: 0, scripts_dir: "" } as never,
      queue,
      "http://127.0.0.1:3200/",
      [viewport],
      {
        all_pages: false,
        same_origin_host: "127.0.0.1:3200",
        audit_runner: inject as never,
      },
    );
    expect(result).toBeDefined();
    expect(inject).toHaveBeenCalledTimes(2);
    const click = driver.calls.findIndex((call) => call[0] === "click");
    const hover = driver.calls.findIndex(
      (call) => call[0] === "hover" && call[1] === "body",
    );
    expect(hover).toBeGreaterThan(click);
  });

  it("skips hover and preserves quick-scope structural results", async () => {
    const driver = new FakeDriver();
    const queue = new CrawlQueue({ origin: "http://127.0.0.1:3200" });
    const inject = vi.fn().mockReturnValue({
      categories: { text: { issues: [] } },
    });

    const result = await auditPage(
      driver as never,
      { host: "127.0.0.1", port: 0, scripts_dir: "" } as never,
      queue,
      "http://127.0.0.1:3200/",
      [viewport],
      { scope: "quick", audit_runner: inject as never },
    );

    expect(result).toMatchObject({
      url: "http://127.0.0.1:3200/",
      anchor_urls: [],
      bonus_urls: [],
      hover_findings: [],
      modal_findings: [],
    });
    expect(result.viewport_reports).toHaveProperty("Mobile 390x844");
    expect(inject).toHaveBeenCalledTimes(2);
    expect(
      driver.calls.some((call) => call[0] === "hover" && call[1] !== "body"),
    ).toBe(false);
  });

  it("fails immediately when baseline injection is rejected", async () => {
    const driver = new FakeDriver();
    const queue = new CrawlQueue({ origin: "http://127.0.0.1:3200" });
    const injectionFailure = new BrowserDriverError(
      "baseline injection failed",
    );
    const inject = vi.fn().mockRejectedValue(injectionFailure);

    await expect(
      auditPage(
        driver as never,
        { host: "127.0.0.1", port: 0, scripts_dir: "" } as never,
        queue,
        "http://127.0.0.1:3200/",
        [viewport],
        { audit_runner: inject as never },
      ),
    ).rejects.toThrow("baseline injection failed");
    expect(inject).toHaveBeenCalledTimes(1);
    expect(driver.calls).not.toEqual(
      expect.arrayContaining([
        expect.arrayContaining(["evaluate"]),
        expect.arrayContaining(["click"]),
        expect.arrayContaining(["snapshot"]),
      ]),
    );
  });

  it("fails immediately when follow-up injection is rejected", async () => {
    const driver = new FakeDriver();
    const queue = new CrawlQueue({ origin: "http://127.0.0.1:3200" });
    const followUpFailure = new BrowserDriverError(
      "follow-up injection failed",
    );
    let rejectedAt = -1;
    const inject = vi
      .fn()
      .mockImplementationOnce(() => SUCCESS as never)
      .mockImplementationOnce(() => {
        rejectedAt = driver.calls.length;
        return Promise.reject(followUpFailure) as never;
      });
    await expect(
      auditPage(
        driver as never,
        { host: "127.0.0.1", port: 0, scripts_dir: "" } as never,
        queue,
        "http://127.0.0.1:3200/",
        [viewport],
        { scope: "quick", audit_runner: inject as never },
      ),
    ).rejects.toThrow("follow-up injection failed");
    expect(inject).toHaveBeenCalledTimes(2);
    expect(rejectedAt).toBeGreaterThan(0);
    expect(driver.calls.slice(rejectedAt)).toEqual([]);
  });
});
