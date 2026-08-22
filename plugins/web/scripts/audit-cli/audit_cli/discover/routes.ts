import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

import type { Route } from "../types";

export const DYNAMIC_PLACEHOLDER = "sample-slug";
export const DYNAMIC_WARNING = "dynamic route — supply real id via --seeds";
const SCRIPT_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);

export function discoverSourceRoutes(project_path: string): Route[] {
  const routes: Route[] = [];
  if (
    hasMarker(project_path, [
      "next.config.js",
      "next.config.mjs",
      "next.config.ts",
      "next.config.cjs",
    ])
  )
    routes.push(...walkNextjs(project_path));
  if (
    hasMarker(project_path, [
      "vite.config.js",
      "vite.config.ts",
      "vite.config.mjs",
    ]) &&
    pkgHasDep(project_path, "react-router-dom")
  )
    routes.push(...walkViteReactRouter(project_path));
  if (
    hasMarker(project_path, [
      "remix.config.js",
      "remix.config.cjs",
      "remix.config.mjs",
    ]) ||
    pkgHasDep(project_path, "@remix-run/react")
  )
    routes.push(...walkRemix(project_path));
  if (
    hasMarker(project_path, ["svelte.config.js", "svelte.config.ts"]) &&
    pkgHasDep(project_path, "@sveltejs/kit")
  )
    routes.push(...walkSveltekit(project_path));
  if (
    hasMarker(project_path, [
      "astro.config.mjs",
      "astro.config.js",
      "astro.config.ts",
    ])
  )
    routes.push(
      ...walkPages(
        project_path,
        join("src", "pages"),
        new Set([".astro", ".md", ".mdx", ".html"]),
        "astro",
      ),
    );
  if (hasMarker(project_path, ["nuxt.config.js", "nuxt.config.ts"]))
    routes.push(...walkNuxt(project_path));
  if (routes.length === 0 && isFile(join(project_path, "index.html")))
    routes.push(...walkStaticHtml(project_path));
  const seen = new Set<string>();
  return routes.filter(
    (route) => !seen.has(route.path) && Boolean(seen.add(route.path)),
  );
}

function walkNextjs(root: string): Route[] {
  const routes: Route[] = [];
  for (const app of [join(root, "app"), join(root, "src", "app")]) {
    for (const page of walkFiles(app).filter(
      (path) =>
        /^page\.[^.]+$/.test(path.split(sep).at(-1) ?? "") &&
        SCRIPT_EXTENSIONS.has(extname(path)),
    )) {
      const parts = relative(app, page).split(sep).slice(0, -1);
      const path = routePath(
        parts.filter((part) => !(part.startsWith("(") && part.endsWith(")"))),
      );
      routes.push(makeRoute(path, page, "nextjs", hasDynamic(parts)));
    }
  }
  for (const pages of [join(root, "pages"), join(root, "src", "pages")]) {
    for (const page of walkFiles(pages).filter((path) =>
      SCRIPT_EXTENSIONS.has(extname(path)),
    )) {
      const rel = relative(pages, page).split(sep);
      const name = rel.at(-1) ?? "";
      if (name.startsWith("_") || name.startsWith("api") || rel.includes("api"))
        continue;
      const parts = withoutExtension(rel);
      if (parts.at(-1) === "index") parts.pop();
      routes.push(
        makeRoute(routePath(parts), page, "nextjs-pages", hasDynamic(parts)),
      );
    }
  }
  return routes;
}

function walkViteReactRouter(root: string): Route[] {
  const routes: Route[] = [];
  for (const source of walkFiles(join(root, "src")).filter((path) =>
    SCRIPT_EXTENSIONS.has(extname(path)),
  )) {
    const text = readFileSync(source, "utf8");
    for (const pattern of [
      /<Route\s+[^>]*path\s*=\s*["']([^"']+)["']/g,
      /path\s*:\s*["']([^"']+)["']/g,
    ]) {
      for (const match of text.matchAll(pattern)) {
        const raw = match[1] ?? "";
        if (pattern.source.startsWith("path") && !raw.startsWith("/")) continue;
        routes.push(
          makeRoute(
            normaliseRouterPath(raw),
            source,
            "vite-rr",
            raw.includes(":") || raw.includes("*"),
          ),
        );
      }
    }
  }
  return routes;
}

function walkRemix(root: string): Route[] {
  const base = join(root, "app", "routes");
  return walkFiles(base)
    .filter((path) => SCRIPT_EXTENSIONS.has(extname(path)))
    .map((source) => {
      const parts = withoutExtension(relative(base, source).split(sep))
        .join("/")
        .replaceAll(".", "/")
        .split("/");
      if (parts.at(-1) === "index") parts.pop();
      const dynamic = parts.some((part) => part.startsWith("$"));
      return makeRoute(
        routePath(
          parts.map((part) =>
            part.startsWith("$") ? `[${part.slice(1)}]` : part,
          ),
        ),
        source,
        "remix",
        dynamic,
      );
    });
}

function walkSveltekit(root: string): Route[] {
  const base = join(root, "src", "routes");
  return walkFiles(base)
    .filter(
      (path) =>
        path.endsWith(`${sep}+page.svelte`) ||
        path === join(base, "+page.svelte"),
    )
    .map((page) => {
      const parts = relative(base, page).split(sep).slice(0, -1);
      return makeRoute(
        routePath(parts),
        page,
        "sveltekit",
        parts.some((part) => /\[[^\]]+\]/.test(part)),
      );
    });
}

function walkPages(
  root: string,
  directory: string,
  extensions: ReadonlySet<string>,
  framework: string,
): Route[] {
  const base = join(root, directory);
  return walkFiles(base)
    .filter((path) => extensions.has(extname(path)))
    .map((source) => {
      const parts = withoutExtension(relative(base, source).split(sep));
      if (parts.at(-1) === "index") parts.pop();
      return makeRoute(
        routePath(parts),
        source,
        framework,
        hasDynamic(parts),
      );
    });
}

function walkNuxt(root: string): Route[] {
  const base = join(root, "pages");
  return walkFiles(base)
    .filter((path) => path.endsWith(".vue"))
    .map((source) => {
      const parts = withoutExtension(relative(base, source).split(sep));
      if (parts.at(-1) === "index") parts.pop();
      return makeRoute(
        routePath(parts),
        source,
        "nuxt",
        parts.some((part) => part.startsWith("_") || hasDynamic([part])),
      );
    });
}

function walkStaticHtml(root: string): Route[] {
  return walkFiles(root)
    .filter((path) => path.endsWith(".html"))
    .map((source) => {
      const parts = withoutExtension(relative(root, source).split(sep));
      if (parts.at(-1) === "index") parts.pop();
      return makeRoute(routePath(parts), source, "static", false, false);
    });
}

function walkFiles(root: string): string[] {
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true }).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile() || (entry.isSymbolicLink() && isFile(path)))
      files.push(path);
  }
  return files;
}

function makeRoute(
  path: string,
  source_file: string,
  framework: string,
  dynamic: boolean,
  include_null = true,
): Route {
  return include_null
    ? {
        path,
        source_file,
        framework,
        warning: dynamic ? DYNAMIC_WARNING : null,
      }
    : { path, source_file, framework };
}
function routePath(parts: readonly string[]): string {
  return (
    `/${parts.map(substituteDynamic).join("/")}`.replace(/\/$/, "") || "/"
  );
}
function substituteDynamic(part: string): string {
  return part.startsWith("[") && part.endsWith("]")
    ? DYNAMIC_PLACEHOLDER
    : part;
}
function hasDynamic(parts: readonly string[]): boolean {
  return parts.some((part) => part.startsWith("[") && part.endsWith("]"));
}
function withoutExtension(parts: string[]): string[] {
  const copy = [...parts];
  const last = copy.pop();
  if (last !== undefined) copy.push(last.slice(0, -extname(last).length));
  return copy;
}
function normaliseRouterPath(raw: string): string {
  const path = raw
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)\??/g, DYNAMIC_PLACEHOLDER)
    .replaceAll("*", DYNAMIC_PLACEHOLDER);
  return `/${path}`.replace(/^\/\//, "/").replace(/\/$/, "") || "/";
}
function hasMarker(root: string, names: readonly string[]): boolean {
  return names.some((name) => isFile(join(root, name)));
}
function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}
function pkgHasDep(root: string, dependency: string): boolean {
  const pkg = join(root, "package.json");
  return isFile(pkg) && readFileSync(pkg, "utf8").includes(`"${dependency}"`);
}
