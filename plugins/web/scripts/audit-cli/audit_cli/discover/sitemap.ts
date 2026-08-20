const USER_AGENT = "audit-cli/0.1 (+https://github.com/anthropic)";
const TIMEOUT_MS = 8_000;
const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
// Bound untrusted XML work while remaining well above normal sitemap documents.
const MAX_XML_LENGTH = 10_000_000;
const MAX_XML_DEPTH = 256;

export interface SitemapResult {
  readonly urls: readonly string[];
  readonly sitemaps_tried: readonly string[];
  readonly errors: readonly string[];
}

export async function fetchSitemapUrls(
  base_url: string,
): Promise<SitemapResult> {
  const base_host = hostOf(base_url);
  if (!base_host)
    return { urls: [], sitemaps_tried: [], errors: ["invalid base URL"] };
  const candidates = await collectSitemapCandidates(base_url);
  const urls: string[] = [];
  const errors: string[] = [];
  const tried: string[] = [];
  for (const sitemap of candidates) {
    tried.push(sitemap);
    const body = await fetchText(sitemap);
    if (body === null) continue;
    const parsed = parseXmlLocations(body);
    if (parsed === null) {
      errors.push(`parse error at ${sitemap}: malformed XML`);
      continue;
    }
    for (const url of parsed.urls)
      if (hostOf(url) === base_host) urls.push(url.trim());
    for (const nested_url of parsed.sitemaps) {
      if (tried.includes(nested_url)) continue;
      const nested = await fetchText(nested_url.trim());
      if (nested === null) continue;
      const nested_parsed = parseXmlLocations(nested);
      if (nested_parsed === null) {
        errors.push(`parse error at ${nested_url}: malformed XML`);
        continue;
      }
      for (const url of nested_parsed.urls)
        if (hostOf(url) === base_host) urls.push(url.trim());
    }
  }
  return { urls: [...new Set(urls)], sitemaps_tried: tried, errors };
}

async function collectSitemapCandidates(base_url: string): Promise<string[]> {
  const parsed = new URL(base_url);
  const root = parsed.origin;
  const candidates = [`${root}/sitemap.xml`];
  const robots = await fetchText(`${root}/robots.txt`);
  if (robots !== null) {
    for (const line of robots.split(/\r?\n/)) {
      if (!line.trim().toLowerCase().startsWith("sitemap:")) continue;
      const value = line.slice(line.indexOf(":") + 1).trim();
      if (value && !candidates.includes(value)) candidates.push(value);
    }
  }
  return candidates;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function parseXmlLocations(
  xml: string,
): { readonly urls: string[]; readonly sitemaps: string[] } | null {
  if (xml.length === 0 || xml.length > MAX_XML_LENGTH) return null;
  const urls: string[] = [];
  const sitemaps: string[] = [];
  const stack: XmlElement[] = [];
  const tokenPattern =
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<[^>]*>/g;
  let cursor = 0;
  let root: "urlset" | "sitemapindex" | null = null;
  let rootClosed = false;

  for (const match of xml.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index;
    const text = xml.slice(cursor, index);
    if (!appendXmlText(stack, text)) return null;
    cursor = index + token.length;

    if (token.startsWith("<!--") || token.startsWith("<?")) continue;
    if (token.startsWith("<![CDATA[")) {
      if (!appendXmlText(stack, token.slice(9, -3), false)) return null;
      continue;
    }
    if (token.startsWith("</")) {
      const closing = /^<\/([A-Za-z_][\w.:-]*)\s*>$/.exec(token);
      const current = stack.at(-1);
      if (!closing || current?.name !== closing[1]) return null;
      stack.pop();
      if (current.local === "loc") {
        const parent = stack.at(-1);
        const value = current.text.trim();
        if (
          current.namespace === SITEMAP_NAMESPACE &&
          parent?.namespace === SITEMAP_NAMESPACE &&
          value
        ) {
          if (parent.local === "url") urls.push(value);
          else if (parent.local === "sitemap") sitemaps.push(value);
        }
      }
      if (stack.length === 0) rootClosed = true;
      continue;
    }

    const opening = parseOpeningTag(token, stack.at(-1)?.namespaces);
    if (!opening || rootClosed || stack.length >= MAX_XML_DEPTH) return null;
    if (stack.at(-1)?.local === "loc") return null;
    if (stack.length === 0) {
      if (root !== null) return null;
      if (
        (opening.local !== "urlset" && opening.local !== "sitemapindex") ||
        opening.namespace !== SITEMAP_NAMESPACE
      )
        return null;
      root = opening.local;
    }
    if (opening.selfClosing) {
      if (stack.length === 0) rootClosed = true;
      continue;
    }
    stack.push(opening);
  }

  if (!appendXmlText(stack, xml.slice(cursor))) return null;
  if (root === null || !rootClosed || stack.length !== 0) return null;
  return root === "urlset" ? { urls, sitemaps: [] } : { urls: [], sitemaps };
}

interface XmlElement {
  readonly name: string;
  readonly local: string;
  readonly namespace: string;
  readonly namespaces: Readonly<Record<string, string>>;
  readonly selfClosing: boolean;
  text: string;
}

function parseOpeningTag(
  token: string,
  parentNamespaces: Readonly<Record<string, string>> | undefined,
): XmlElement | null {
  const opening = /^<([A-Za-z_][\w.:-]*)([\s\S]*?)(\/?)>$/.exec(token);
  if (!opening) return null;
  const name = opening[1] ?? "";
  const attributes = opening[2] ?? "";
  if (!attributesAreValid(attributes)) return null;
  const namespaces: Record<string, string> = { ...parentNamespaces };
  for (const declaration of attributes.matchAll(
    /\s+xmlns(?::([A-Za-z_][\w.-]*))?\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
  )) {
    namespaces[declaration[1] ?? ""] = declaration[2] ?? declaration[3] ?? "";
  }
  const separator = name.indexOf(":");
  const prefix = separator < 0 ? "" : name.slice(0, separator);
  const local = separator < 0 ? name : name.slice(separator + 1);
  return {
    name,
    local,
    namespace: namespaces[prefix] ?? "",
    namespaces,
    selfClosing: opening[3] === "/",
    text: "",
  };
}

function attributesAreValid(attributes: string): boolean {
  const attributePattern =
    /\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"[^"<]*"|'[^'<]*')/gy;
  const names = new Set<string>();
  let cursor = 0;
  while (cursor < attributes.length) {
    attributePattern.lastIndex = cursor;
    const match = attributePattern.exec(attributes);
    if (!match) return /^\s*$/.test(attributes.slice(cursor));
    const name = match[1] ?? "";
    if (names.has(name)) return false;
    names.add(name);
    if (!entitiesAreValid(match[0])) return false;
    cursor = attributePattern.lastIndex;
  }
  return true;
}

function appendXmlText(
  stack: XmlElement[],
  text: string,
  validateEntities = true,
): boolean {
  if ((validateEntities && text.includes("<")) || text.includes("]]>"))
    return false;
  if (validateEntities && !entitiesAreValid(text)) return false;
  const current = stack.at(-1);
  if (current?.local === "loc")
    current.text += validateEntities ? decodeXml(text) : text;
  else if (text.trim().length > 0 && stack.length === 0) return false;
  return true;
}

function entitiesAreValid(value: string): boolean {
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\dA-Fa-f]+);)/.test(value))
    return false;
  for (const reference of value.matchAll(/&#(x[\dA-Fa-f]+|\d+);/g)) {
    const raw = reference[1] ?? "";
    const codePoint = raw.startsWith("x")
      ? Number.parseInt(raw.slice(1), 16)
      : Number.parseInt(raw, 10);
    if (!isXmlCodePoint(codePoint)) return false;
  }
  return true;
}

function isXmlCodePoint(codePoint: number): boolean {
  return (
    codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  );
}

function decodeXml(value: string): string {
  return value.replace(
    /&(amp|lt|gt|quot|apos|#\d+|#x[\dA-Fa-f]+);/g,
    (_match, entity: string) => {
      if (entity === "amp") return "&";
      if (entity === "lt") return "<";
      if (entity === "gt") return ">";
      if (entity === "quot") return '"';
      if (entity === "apos") return "'";
      return String.fromCodePoint(
        entity.startsWith("#x")
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10),
      );
    },
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}
