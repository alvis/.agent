import { CliExit, buildParser, checkAgentBrowser } from "./cli";

describe("audit CLI CDP URL plumbing", () => {
  it("parses --cdp-url", () => {
    const args = buildParser().parseArgs([
      "audit",
      "https://example.com",
      "--cdp-url",
      "http://127.0.0.1:9222",
    ]);
    expect(args.cdp_url).toBe("http://127.0.0.1:9222");
  });

  it("defaults cdp_url to None", () => {
    const args = buildParser().parseArgs(["audit", "https://example.com"]);
    expect(args.cdp_url).toBeNull();
  });

  it("reports a missing agent-browser binary with exit code 2", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let failure: unknown;
    try {
      checkAgentBrowser("definitely-not-an-installed-binary");
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(CliExit);
    expect(failure).toMatchObject({ exitCode: 2 });
  });

  it("reports a non-zero agent-browser version check with exit code 2", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let failure: unknown;
    try {
      checkAgentBrowser("false");
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(CliExit);
    expect(failure).toMatchObject({ exitCode: 2 });
    vi.restoreAllMocks();
  });

  it("passes a successful agent-browser version check", () => {
    const stderr = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expect(() => checkAgentBrowser("true")).not.toThrow();
    expect(stderr).not.toHaveBeenCalled();
    stderr.mockRestore();
  });
});
