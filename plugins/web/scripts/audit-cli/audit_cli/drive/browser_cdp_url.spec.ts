import { spawnSync } from "node:child_process";

import { BrowserDriver } from "./browser";

const spawnSyncMock = vi.mocked(spawnSync);

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

describe("BrowserDriver external CDP sessions", () => {
  beforeEach(() => spawnSyncMock.mockReset());

  it("opens and closes a driver-owned session", () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: "",
      stderr: "",
    } as ReturnType<typeof spawnSync>);
    const driver = new BrowserDriver();
    driver.navigate("https://example.com");
    expect(driver.created_session).toBe(true);
    driver.close();
    expect(spawnSyncMock).toHaveBeenCalledTimes(2);
    expect(spawnSyncMock.mock.calls[0]?.[0]).toBe("agent-browser");
    expect(spawnSyncMock.mock.calls[0]?.[1]).toContain("batch");
    expect(spawnSyncMock.mock.calls[0]?.[2]).toMatchObject({
      input: expect.stringContaining("open"),
    });
    expect(spawnSyncMock.mock.calls[0]?.[2]).toMatchObject({
      input: expect.stringContaining("https://example.com"),
    });
    expect(spawnSyncMock.mock.calls[1]?.[2]).toMatchObject({
      input: expect.stringContaining("close"),
    });
    driver.close();
    expect(spawnSyncMock).toHaveBeenCalledTimes(2);
  });

  it("parses structured URLs and falls back to raw stdout", () => {
    spawnSyncMock
      .mockReturnValueOnce({
        status: 0,
        stdout: '[{"result":{"url":"https://example.com/"},"success":true}]',
        stderr: "",
      } as ReturnType<typeof spawnSync>)
      .mockReturnValueOnce({
        status: 0,
        stdout: "https://example.com/raw\n",
        stderr: "",
      } as ReturnType<typeof spawnSync>);
    const driver = new BrowserDriver();

    expect(driver.get_url()).toBe("https://example.com/");
    expect(driver.get_url()).toBe("https://example.com/raw");
  });

  it("connects to an external CDP session without opening or closing it", () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: "",
      stderr: "",
    } as ReturnType<typeof spawnSync>);
    const driver = new BrowserDriver({ cdp_url: "http://127.0.0.1:9222" });
    driver.navigate("https://example.com");
    expect(driver.created_session).toBe(false);
    driver.close();
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    const input = spawnSyncMock.mock.calls[0]?.[2];
    expect(input).toMatchObject({ input: expect.stringContaining("connect") });
    expect(input).toMatchObject({
      input: expect.stringContaining("http://127.0.0.1:9222"),
    });
    expect(input).not.toMatchObject({ input: expect.stringContaining("open") });
    expect(input).not.toMatchObject({
      input: expect.stringContaining("close"),
    });
  });

  it("skips closing an external session that was never navigated", () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: "",
      stderr: "",
    } as ReturnType<typeof spawnSync>);
    const driver = new BrowserDriver({ cdp_url: "http://127.0.0.1:9222" });

    driver.close();

    expect(spawnSyncMock).not.toHaveBeenCalled();
  });
});
