/** Return a canonical absolute URL, or an empty string for invalid input. */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  try {
    new URL(url);
    const match = /^([A-Za-z][A-Za-z\d+.-]*):\/\/([^/?#]+)([^#]*)/.exec(url);
    if (!match) return "";
    const scheme = (match[1] ?? "").toLowerCase();
    const authority = (match[2] ?? "").toLowerCase();
    const remainder = match[3] ?? "";
    const queryIndex = remainder.indexOf("?");
    const rawPath = queryIndex < 0 ? remainder : remainder.slice(0, queryIndex);
    const query = queryIndex < 0 ? "" : remainder.slice(queryIndex);
    const path =
      rawPath.length === 0
        ? "/"
        : rawPath === "/"
          ? "/"
          : rawPath.replace(/\/+$/, "");
    return `${scheme}://${authority}${path}${query}`;
  } catch {
    return "";
  }
}

/** Same-origin breadth-first queue with URL and interaction deduplication. */
export class CrawlQueue {
  readonly cross_origin: string[] = [];
  private readonly origin: string;
  private readonly queue: string[] = [];
  private readonly visited_urls = new Set<string>();
  private readonly interactions = new Set<string>();

  constructor({ origin }: { readonly origin: string }) {
    this.origin = origin;
  }

  enqueue(url: string): boolean {
    const normalized = normalizeUrl(url);
    if (!normalized) return false;
    if (!this.is_same_origin(normalized)) {
      if (!this.cross_origin.includes(normalized))
        this.cross_origin.push(normalized);
      return false;
    }
    if (this.visited_urls.has(normalized) || this.queue.includes(normalized))
      return false;
    this.queue.push(normalized);
    return true;
  }

  enqueue_many(urls: readonly string[]): number {
    let accepted = 0;
    for (const url of urls) if (this.enqueue(url)) accepted += 1;
    return accepted;
  }

  pop(): string | null {
    const url = this.queue.shift();
    if (url === undefined) return null;
    this.visited_urls.add(url);
    return url;
  }

  has_pending(): boolean {
    return this.queue.length > 0;
  }

  register_interaction(fingerprint: string): boolean {
    if (this.interactions.has(fingerprint)) return false;
    this.interactions.add(fingerprint);
    return true;
  }

  visited(): ReadonlySet<string> {
    return new Set(this.visited_urls);
  }

  private is_same_origin(url: string): boolean {
    const normalizedOrigin = normalizeUrl(this.origin);
    const normalizedUrl = normalizeUrl(url);
    const originMatch = /^([a-z][a-z\d+.-]*):\/\/([^/?#]+)/.exec(
      normalizedOrigin,
    );
    const urlMatch = /^([a-z][a-z\d+.-]*):\/\/([^/?#]+)/.exec(normalizedUrl);
    return (
      originMatch !== null &&
      urlMatch !== null &&
      originMatch[1] === urlMatch[1] &&
      originMatch[2] === urlMatch[2]
    );
  }
}
