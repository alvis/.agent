#!/usr/bin/env bun
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
export const DISCOVER_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const ASSETS_ROOT = join(DISCOVER_ROOT, "assets", "html");
const VENDOR_ROOT = join(ASSETS_ROOT, "vendor");
const EXAMPLES_ROOT = join(DISCOVER_ROOT, "examples", "html");
const TEMPLATES_ROOT = join(DISCOVER_ROOT, "templates", "html");
const EXAMPLES_SRC_ROOT = join(DISCOVER_ROOT, "examples", "src");
const TEMPLATES_SRC_ROOT = join(DISCOVER_ROOT, "templates", "src");
const DISCOVERY_CSS = join(ASSETS_ROOT, "discovery.css");
const DISCOVERY_JS = join(ASSETS_ROOT, "discovery.js");
export const TAILWIND_CDN_URL =
  "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";
export const TAILWIND_CACHE = join(VENDOR_ROOT, "tailwind-browser.cache.js");
export const MERMAID_CDN_URL =
  "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
export const MERMAID_CACHE = join(VENDOR_ROOT, "mermaid.cache.js");
export const MERMAID_MARKER_ATTR = "data-mermaid";
const DYNAMIC_IMPORT_RE = /\bimport\s*\(/;
export const MERMAID_BUNDLE_SIGNATURE = "flowchart-v2";
const MERMAID_BUNDLE_TAIL = 'globalThis["mermaid"] =';
const MERMAID_BUNDLE_TAIL_WINDOW = 4096;
const MERMAID_BUNDLE_MIN_BYTES = 1_000_000;
const SECTIONS_MARKER = "<!-- {{SECTIONS}} -->";
const INCLUDE_RE =
  /^[^\S\n]*<!-- \{\{INCLUDE:[^\S\n]*(?<path>[^\s{}]+)[^\S\n]*\}\} -->[^\S\n]*(?:\n|$)/gm;
const RAW_FFFD = "\ufffd";
const ESCAPED_FFFD = "\\uFFFD";
const GENERATED_BANNER =
  "GENERATED — do not edit; edit sources under plugins/essential/skills/discover/assets/ and rebuild with scripts/build-artifact.ts";
const SELECTION_STYLE = `<style>
      ::selection {
        background: var(--ui-accent-soft);
        color: var(--ui-accent-ink);
      }
    </style>`;
const BOARD_THEME_BLOCK_RE =
  /<style[^>]*\bdata-board-theme\b[^>]*>([\s\S]*?)<\/style>/gi;

export class BuildError extends Error {}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
async function read(path: string, label: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    throw new BuildError(`Missing ${label}: ${path}`);
  }
}

export function patchFffd(text: string): string {
  return text.replaceAll(RAW_FFFD, ESCAPED_FFFD);
}

function acceptMermaidRuntime(text: string, origin = "downloaded"): void {
  const detail = `the ${origin} Mermaid runtime (${text.length} bytes)`;
  if (text.length < MERMAID_BUNDLE_MIN_BYTES)
    throw new BuildError(
      `${detail} is far below the ${MERMAID_BUNDLE_MIN_BYTES} byte floor, so it is not the bundle; re-fetch it with --refresh-mermaid`,
    );
  if (!text.includes(MERMAID_BUNDLE_SIGNATURE))
    throw new BuildError(
      `${detail} does not contain '${MERMAID_BUNDLE_SIGNATURE}', so it is not the expected bundle; re-fetch it with --refresh-mermaid`,
    );
  if (!text.slice(-MERMAID_BUNDLE_TAIL_WINDOW).includes(MERMAID_BUNDLE_TAIL))
    throw new BuildError(
      `${detail} does not end by publishing the global ('${MERMAID_BUNDLE_TAIL}' is absent from its last ${MERMAID_BUNDLE_TAIL_WINDOW} bytes), so the body is truncated or the release changed how it exports; re-fetch it with --refresh-mermaid`,
    );
  if (DYNAMIC_IMPORT_RE.test(text))
    throw new BuildError(
      `${detail} contains a dynamic import(), so some diagram types would load over the network and silently render empty in a self-contained board; pin a UMD build that bundles every grammar`,
    );
}

async function getVendorRuntime(
  label: string,
  url: string,
  cache: string,
  options: {
    accept?: (text: string, origin?: string) => void;
    refresh?: boolean;
    offline?: boolean;
  } = {},
): Promise<string> {
  const checked = (text: string, origin: string): string => {
    options.accept?.(text, origin);
    return text;
  };
  if (options.offline) {
    if (await exists(cache))
      return checked(await readFile(cache, "utf8"), "cached");
    throw new BuildError(
      `no cached ${label} runtime; run once with network or without --offline`,
    );
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok)
      throw new Error(`${response.status} ${response.statusText}`);
    const patched = checked(patchFffd(await response.text()), "downloaded");
    if (patched.includes(RAW_FFFD))
      throw new BuildError(
        `U+FFFD survived patching the downloaded ${label} runtime`,
      );
    await mkdir(VENDOR_ROOT, { recursive: true });
    await writeFile(cache, patched, "utf8");
    return patched;
  } catch (error) {
    if (!options.refresh && (await exists(cache))) {
      console.error(
        `warning: could not fetch latest ${label} (${String(error)}); falling back to cached runtime ${cache}`,
      );
      return checked(await readFile(cache, "utf8"), "cached");
    }
    throw new BuildError(
      `could not fetch ${label} runtime from ${url}: ${String(error)}`,
    );
  }
}
export const getTailwindRuntime = (
  options: { refresh?: boolean; offline?: boolean } = {},
) => getVendorRuntime("Tailwind", TAILWIND_CDN_URL, TAILWIND_CACHE, options);
export const getMermaidRuntime = (
  options: { refresh?: boolean; offline?: boolean } = {},
) =>
  getVendorRuntime("Mermaid", MERMAID_CDN_URL, MERMAID_CACHE, {
    ...options,
    accept: acceptMermaidRuntime,
  });

export async function resolveSource(source: string): Promise<string> {
  const candidate = resolve(source);
  if (await isDirectory(candidate)) {
    if (!(await exists(join(candidate, "page.html"))))
      throw new BuildError(`directory source missing page.html: ${candidate}`);
    return candidate;
  }
  if (await exists(candidate)) return candidate;
  const stem = source.endsWith(".html") ? source.slice(0, -5) : source;
  for (const directory of [
    join(EXAMPLES_SRC_ROOT, stem),
    join(TEMPLATES_SRC_ROOT, stem),
  ])
    if (await exists(join(directory, "page.html"))) return directory;
  for (const file of [
    join(EXAMPLES_ROOT, `${stem}.html`),
    join(TEMPLATES_ROOT, `${stem}.html`),
  ])
    if (await exists(file)) return file;
  throw new BuildError(
    `No board source found for '${source}' (looked in ${EXAMPLES_SRC_ROOT}, ${TEMPLATES_SRC_ROOT}, ${EXAMPLES_ROOT} and ${TEMPLATES_ROOT})`,
  );
}

async function resolveIncludes(
  text: string,
  sourceDir: string,
): Promise<string> {
  const runRoot = resolve(sourceDir, "..");
  let result = "";
  let offset = 0;
  for (const match of text.matchAll(INCLUDE_RE)) {
    const include = match.groups?.path ?? "";
    const target = resolve(runRoot, include);
    if (
      relative(runRoot, target).startsWith("..") ||
      isAbsolute(relative(runRoot, target))
    )
      throw new BuildError(
        `include path '${include}' in ${join(sourceDir, "page.html")} escapes the run root ${runRoot}`,
      );
    if (!(await exists(target)))
      throw new BuildError(
        `missing include '${include}' for ${sourceDir}: ${target}`,
      );
    const partial = await readFile(target, "utf8");
    if (INCLUDE_RE.test(partial))
      throw new BuildError(
        `include ${target} itself includes another partial; keep shared sources one level deep`,
      );
    result += text.slice(offset, match.index) + partial;
    offset = (match.index ?? 0) + match[0].length;
  }
  return result + text.slice(offset);
}
export async function composeDirectory(sourceDir: string): Promise<string> {
  const page = join(sourceDir, "page.html");
  if (!(await exists(page)))
    throw new BuildError(`directory source missing page.html: ${page}`);
  const shell = await readFile(page, "utf8");
  const sectionsDir = join(sourceDir, "sections");
  const files = (await exists(sectionsDir))
    ? (await readdir(sectionsDir))
        .filter((file) => file.endsWith(".html"))
        .sort()
    : [];
  if (!files.length)
    throw new BuildError(
      `directory source needs at least one sections/*.html file: ${sectionsDir}`,
    );
  const marker = new RegExp(
    `^[^\\S\\n]*${SECTIONS_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\S\\n]*(?:\\n|$)`,
    "gm",
  );
  const matches = shell.match(marker) ?? [];
  if (matches.length !== 1)
    throw new BuildError(
      `page.html must contain exactly one '${SECTIONS_MARKER}' marker line; found ${matches.length}`,
    );
  const sections = (
    await Promise.all(
      files.map((file) => readFile(join(sectionsDir, file), "utf8")),
    )
  ).join("");
  return resolveIncludes(shell.replace(marker, sections), sourceDir);
}

function inlineScript(body: string): string {
  return `<script>\n${body.replaceAll("</script", "<\\/script")}\n</script>`;
}
function inlineStyle(body: string): string {
  if (body.includes("</style"))
    throw new BuildError("stylesheet contains a </style break-out sequence");
  return `<style>\n${body}\n</style>`;
}
export async function build(
  sourcePath: string,
  options: {
    artifact: boolean;
    runtime?: string;
    mermaid?: string;
    offline?: boolean;
  },
): Promise<string> {
  let html = await ((await isDirectory(sourcePath))
    ? composeDirectory(sourcePath)
    : read(sourcePath, "board source"));
  const runtime =
    options.runtime ?? (await getTailwindRuntime({ offline: options.offline }));
  const css = await read(DISCOVERY_CSS, "discovery.css");
  const js = await read(DISCOVERY_JS, "discovery.js");
  const hasMermaid = html.includes(MERMAID_MARKER_ATTR);
  let mermaid = options.mermaid;
  if (hasMermaid) {
    mermaid ??= await getMermaidRuntime({ offline: options.offline });
    acceptMermaidRuntime(
      mermaid,
      options.mermaid === undefined ? "downloaded" : "supplied",
    );
  }
  const theme = html.match(BOARD_THEME_BLOCK_RE)?.[0]?.trim() ?? "";
  html = html.replace(BOARD_THEME_BLOCK_RE, "");
  const cssStyle = inlineStyle(css);
  const runtimeScript = inlineScript(runtime);
  const mermaidScript = mermaid ? inlineScript(mermaid) : "";
  const jsBlock = inlineScript(js);
  let output: string;
  if (options.artifact) {
    const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const themeStyle = html.match(
      /<style\s+type="text\/tailwindcss">[\s\S]*?<\/style>/,
    )?.[0];
    const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/)?.[1];
    const missingParts = [
      ["<title>", title],
      ['<style type="text/tailwindcss">', themeStyle],
      ["<body>", body],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);
    if (missingParts.length)
      throw new BuildError(
        `Fragment source missing: ${missingParts.join(", ")}`,
      );
    output =
      [
        `<!-- ${GENERATED_BANNER} -->`,
        `<title>${title!.trim()}</title>`,
        themeStyle!,
        SELECTION_STYLE,
        cssStyle,
        ...(theme ? [theme] : []),
        runtimeScript,
        body!.trim(),
        ...(mermaidScript ? [mermaidScript] : []),
        jsBlock,
      ].join("\n") + "\n";
  } else {
    let headCount = 0;
    html = html.replace(/\s*<\/head>/i, () => {
      headCount += 1;
      return `\n    ${cssStyle}${theme ? `\n    ${theme}` : ""}\n    ${runtimeScript}\n  </head>`;
    });
    if (headCount !== 1)
      throw new BuildError(
        "Could not locate </head> to inject discovery.css and the Tailwind runtime",
      );
    let bodyCount = 0;
    html = html.replace(/\s*<\/body>/i, () => {
      bodyCount += 1;
      return `${mermaidScript ? `    ${mermaidScript}\n` : ""}    ${jsBlock}\n  </body>`;
    });
    if (bodyCount !== 1)
      throw new BuildError("Could not locate </body> to append discovery.js");
    output = `<!-- ${GENERATED_BANNER} -->\n${html}`;
  }
  return output;
}

export function emitPageDefault(sourceDir: string): string {
  const parent = resolve(sourceDir, "..");
  const name = basename(sourceDir);
  if (parent === resolve(EXAMPLES_SRC_ROOT))
    return join(EXAMPLES_ROOT, `${name}.html`);
  if (parent === resolve(TEMPLATES_SRC_ROOT))
    return join(TEMPLATES_ROOT, `${name}.html`);
  throw new BuildError(
    "--emit-page needs an explicit PATH for a directory source outside examples/src/ or templates/src/",
  );
}
export async function main(argv = Bun.argv.slice(2)): Promise<number> {
  let artifact = false,
    offline = false,
    refreshTailwind = false,
    refreshMermaid = false,
    out: string | undefined,
    emitPage: string | true | undefined,
    source: string | undefined;
  const usage =
    "usage: build-artifact.ts [-h] [--artifact] [-o OUT] [--refresh-tailwind] [--refresh-mermaid] [--offline] [--emit-page [PATH]] [source]";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      console.log(
        `${usage}\n\nCompile a Discover review-surface board into a self-contained HTML artifact.`,
      );
      return 0;
    } else if (arg === "--artifact") artifact = true;
    else if (arg === "--offline") offline = true;
    else if (arg === "--refresh-tailwind") refreshTailwind = true;
    else if (arg === "--refresh-mermaid") refreshMermaid = true;
    else if (arg === "-o" || arg === "--out" || arg.startsWith("--out=")) {
      out = arg.startsWith("--out=")
        ? arg.slice("--out=".length)
        : argv[++index];
      if (!out) {
        console.error(
          `${usage}\nbuild-artifact.ts: error: argument ${arg}: expected one argument`,
        );
        return 2;
      }
    } else if (arg === "--emit-page" || arg.startsWith("--emit-page=")) {
      if (arg.startsWith("--emit-page=")) {
        emitPage = arg.slice("--emit-page=".length);
        continue;
      }
      emitPage =
        argv[index + 1] && !argv[index + 1].startsWith("-")
          ? argv[++index]
          : true;
    } else if (arg.startsWith("-")) {
      console.error(
        `${usage}\nbuild-artifact.ts: error: unrecognized arguments: ${arg}`,
      );
      return 2;
    } else if (!source) source = arg;
    else {
      console.error(
        `${usage}\nbuild-artifact.ts: error: unrecognized arguments: ${arg}`,
      );
      return 2;
    }
  }
  try {
    let runtime: string | undefined;
    let mermaid: string | undefined;
    if (refreshTailwind) {
      runtime = await getTailwindRuntime({ refresh: true });
      console.error(`refreshed Tailwind runtime -> ${TAILWIND_CACHE}`);
    }
    if (refreshMermaid) {
      mermaid = await getMermaidRuntime({ refresh: true });
      console.error(`refreshed Mermaid runtime -> ${MERMAID_CACHE}`);
    }
    if ((refreshTailwind || refreshMermaid) && !source) return 0;
    if (!source) {
      console.error(
        `${usage}\nbuild-artifact.ts: error: a board source is required (or use --refresh-tailwind / --refresh-mermaid)`,
      );
      return 2;
    }
    const sourcePath = await resolveSource(source);
    if (emitPage !== undefined) {
      if (!(await isDirectory(sourcePath)))
        throw new BuildError(
          "--emit-page is only valid for a directory (modular) source",
        );
      const target =
        emitPage === true ? emitPageDefault(sourcePath) : resolve(emitPage);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await composeDirectory(sourcePath), "utf8");
      console.log(target);
      return 0;
    }
    runtime ??= await getTailwindRuntime({ offline });
    const output = await build(sourcePath, {
      artifact,
      runtime,
      mermaid,
      offline,
    });
    const suffix = artifact ? ".artifact.html" : ".html";
    const target = resolve(
      out ??
        join(
          tmpdir(),
          "essential-discover-dist",
          `${basename(sourcePath, extname(sourcePath))}${suffix}`,
        ),
    );
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, output, "utf8");
    console.log(target);
    return 0;
  } catch (error) {
    console.error(
      `build failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}
if (import.meta.main) process.exit(await main());
