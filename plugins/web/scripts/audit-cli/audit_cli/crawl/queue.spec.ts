import { CrawlQueue, normalizeUrl } from "./queue";

describe("crawl queue", () => {
  it.each([
    ["HTTPS://Example.COM/path/", "https://example.com/path"],
    ["https://example.com/", "https://example.com/"],
    ["https://example.com/a#section", "https://example.com/a"],
    ["https://example.com/a?x=1#section", "https://example.com/a?x=1"],
    ["https://example.com:443/a/", "https://example.com:443/a"],
    ["http://example.com:80/a/", "http://example.com:80/a"],
    ["https://example.com/a?x=1&x=2", "https://example.com/a?x=1&x=2"],
    ["/relative", ""],
    ["", ""],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  it("walks same-origin URLs breadth-first and deduplicates normalized links", () => {
    const queue = new CrawlQueue({ origin: "https://example.com" });

    expect(
      queue.enqueue_many([
        "https://example.com/first/",
        "https://example.com/second",
        "https://example.com/first#again",
        "https://other.example/out",
        "https://example.com:443/secure/",
      ]),
    ).toBe(2);
    expect(queue.pop()).toBe("https://example.com/first");
    expect(queue.has_pending()).toBe(true);
    expect(queue.enqueue("https://example.com/third")).toBe(true);
    expect(queue.pop()).toBe("https://example.com/second");
    expect(queue.pop()).toBe("https://example.com/third");
    expect(queue.pop()).toBeNull();
    expect(queue.has_pending()).toBe(false);
    expect(queue.visited()).toEqual(
      new Set([
        "https://example.com/first",
        "https://example.com/second",
        "https://example.com/third",
      ]),
    );
    expect(queue.cross_origin).toEqual([
      "https://other.example/out",
      "https://example.com:443/secure",
    ]);
  });

  it("tracks interaction fingerprints independently from URL visits", () => {
    const queue = new CrawlQueue({ origin: "https://example.com" });

    expect(queue.register_interaction("button\u0004Menu")).toBe(true);
    expect(queue.register_interaction("button\u0004Menu")).toBe(false);
    expect(queue.register_interaction("button\u0004Search")).toBe(true);
  });

  it("retains explicit default ports in queued URL identity", () => {
    const queue = new CrawlQueue({ origin: "http://example.com:80" });

    expect(queue.enqueue("http://example.com:80/landing/")).toBe(true);
    expect(queue.pop()).toBe("http://example.com:80/landing");
  });
});
