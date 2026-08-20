import { createHash } from "node:crypto";

import type { InteractionCandidate, InteractionPlan } from "../types";

const INTERACTIVE_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
  "treeitem",
]);
const SOCIAL_HOST_DENYLIST = new Set([
  "x.com",
  "twitter.com",
  "instagram.com",
  "facebook.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "github.com",
  "reddit.com",
  "pinterest.com",
  "threads.net",
  "mastodon.social",
  "discord.gg",
  "t.me",
]);
const FRAMEWORK_OVERLAY_NAMES = new Set([
  "open next.js dev tools",
  "close next.js dev tools",
]);

type NodeRecord = Readonly<Record<string, unknown>>;

export class DiscoverOptions {
  readonly all_pages: boolean;
  readonly same_origin_host: string | null;

  constructor(
    options: {
      readonly all_pages?: boolean;
      readonly same_origin_host?: string | null;
    } = {},
  ) {
    this.all_pages = options.all_pages ?? false;
    this.same_origin_host = options.same_origin_host ?? null;
  }
}

export function discoverInteractions(
  snapshot: Readonly<Record<string, unknown>>,
  options = new DiscoverOptions(),
): InteractionPlan {
  const nodes =
    coerceNodes(snapshot.nodes).length > 0
      ? coerceNodes(snapshot.nodes)
      : coerceNodes(snapshot.refs);
  const seen = new Set<string>();
  const candidates: InteractionCandidate[] = [];
  const cross_origin: string[] = [];
  const dropped_social: string[] = [];

  for (const node of nodes) {
    const role = String(node.role ?? "").toLowerCase();
    if (!INTERACTIVE_ROLES.has(role) || isFrameworkOverlayControl(node))
      continue;
    const url = node.url;
    if (role === "link" && typeof url === "string" && url) {
      const bucket = classifyLink(url, options.same_origin_host);
      if (bucket === "social") {
        dropped_social.push(url);
        continue;
      }
      if (bucket === "cross-origin") {
        cross_origin.push(url);
        if (!options.all_pages) continue;
      }
      if (bucket === "same-origin" && !options.all_pages) continue;
    } else if (role === "link" && !options.all_pages) continue;

    if (typeof node.uid !== "number" || !Number.isInteger(node.uid)) continue;
    const name = String(node.name ?? "");
    const expanded = typeof node.expanded === "boolean" ? node.expanded : null;
    const fingerprint = fingerprintFor(
      role,
      name,
      expanded,
      coerceAncestors(node.ancestors),
    );
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    candidates.push({ uid: node.uid, role, name, fingerprint, expanded });
  }
  return {
    candidates,
    cross_origin_candidates: [...new Set(cross_origin)],
    dropped_social: [...new Set(dropped_social)],
  };
}

export function discoverHoverTargets(
  snapshot: Readonly<Record<string, unknown>>,
): readonly number[] {
  const primary = coerceNodes(snapshot.nodes);
  const nodes = primary.length > 0 ? primary : coerceNodes(snapshot.refs);
  const seen = new Set<number>();
  const ordered: number[] = [];
  for (const node of nodes) {
    const role = String(node.role ?? "").toLowerCase();
    if (!INTERACTIVE_ROLES.has(role) || isFrameworkOverlayControl(node))
      continue;
    if (
      typeof node.uid !== "number" ||
      !Number.isInteger(node.uid) ||
      seen.has(node.uid)
    )
      continue;
    seen.add(node.uid);
    ordered.push(node.uid);
  }
  return ordered;
}

function coerceNodes(value: unknown): NodeRecord[] {
  if (Array.isArray(value))
    return value.filter((item): item is NodeRecord => isRecord(item));
  if (!isRecord(value)) return [];
  const nodes: NodeRecord[] = [];
  for (const [ref, item] of Object.entries(value)) {
    if (!isRecord(item)) continue;
    const match = /^e(\d+)$/.exec(ref.trim());
    if (match) nodes.push({ uid: Number(match[1]), ...item });
  }
  return nodes;
}

function coerceAncestors(
  value: unknown,
): ReadonlyArray<readonly [string, string]> {
  if (!Array.isArray(value)) return [];
  const ancestors: Array<readonly [string, string]> = [];
  for (const item of value) {
    if (isRecord(item))
      ancestors.push([String(item.role ?? ""), String(item.name ?? "")]);
    else if (Array.isArray(item) && item.length >= 2)
      ancestors.push([String(item[0]), String(item[1])]);
  }
  return ancestors;
}

function fingerprintFor(
  role: string,
  name: string,
  expanded: boolean | null,
  ancestors: ReadonlyArray<readonly [string, string]>,
): string {
  const payload = [
    role.trim().toLowerCase(),
    name.trim().toLowerCase(),
    `exp=${expanded === true ? "1" : expanded === false ? "0" : "-"}`,
    ancestors.map(([r, n]) => `${r}:${n}`).join(">"),
  ].join("|");
  return createHash("sha1").update(payload, "utf8").digest("hex");
}

function classifyLink(
  url: string,
  same_origin_host: string | null,
): "same-origin" | "social" | "cross-origin" {
  let host = "";
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    /* Relative URLs are same-origin. */
  }
  if (!host) return "same-origin";
  const socialHost = host.replace(/^www\./, "");
  if (
    [...SOCIAL_HOST_DENYLIST].some(
      (denied) => socialHost === denied || socialHost.endsWith(`.${denied}`),
    )
  )
    return "social";
  return same_origin_host && host === same_origin_host.toLowerCase()
    ? "same-origin"
    : "cross-origin";
}

function isFrameworkOverlayControl(node: NodeRecord): boolean {
  return (
    String(node.role ?? "")
      .trim()
      .toLowerCase() === "button" &&
    FRAMEWORK_OVERLAY_NAMES.has(
      String(node.name ?? "")
        .trim()
        .toLowerCase(),
    )
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
