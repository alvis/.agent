#!/usr/bin/env bun

import { readdir, stat } from "node:fs/promises";
import { join, normalize, sep } from "node:path";

const HOSTNAME = "127.0.0.1";
const MIN_EPHEMERAL_PORT = 49_152;
const MAX_EPHEMERAL_PORT = 65_535;
const MAX_BIND_ATTEMPTS = 10;
const DIRECTORY = import.meta.dir;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

function createErrorResponse(status: number, message: string): Response {
  return new Response(`${status} ${message}\n`, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

async function createDirectoryResponse(
  url: URL,
  pathname: string,
  directory: string,
): Promise<Response> {
  if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
    return Response.redirect(url, 301);
  }

  for (const indexName of ["index.html", "index.htm"]) {
    const index = Bun.file(join(directory, indexName));
    if (await index.exists()) return new Response(index);
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const links = entries
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const suffix = entry.isDirectory() ? "/" : "";
      const label = escapeHtml(`${entry.name}${suffix}`);
      const href =
        encodeURIComponent(entry.name).replaceAll("%2F", "/") + suffix;
      return `<li><a href="${href}">${label}</a></li>`;
    })
    .join("\n");
  const title = `Directory listing for ${pathname}`;
  const body = `<!DOCTYPE HTML>\n<html lang="en">\n<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>\n<body><h1>${escapeHtml(title)}</h1><hr><ul>\n${links}\n</ul><hr></body>\n</html>\n`;
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function serveRequest(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return createErrorResponse(501, "Unsupported method");
  }

  const url = new URL(request.url);
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return createErrorResponse(400, "Bad request");
  }

  const relativePath = normalize(`.${pathname}`);
  const path = join(DIRECTORY, relativePath);
  if (path !== DIRECTORY && !path.startsWith(`${DIRECTORY}${sep}`)) {
    return createErrorResponse(404, "File not found");
  }

  try {
    if ((await stat(path)).isDirectory()) {
      const response = await createDirectoryResponse(url, pathname, path);
      return request.method === "HEAD"
        ? new Response(null, {
            status: response.status,
            headers: response.headers,
          })
        : response;
    }
  } catch {
    return createErrorResponse(404, "File not found");
  }

  const file = Bun.file(path);
  return new Response(request.method === "HEAD" ? null : file, {
    headers: {
      "content-length": String(file.size),
      "content-type": file.type,
      "last-modified": new Date(file.lastModified).toUTCString(),
    },
  });
}

function randomPort(): number {
  return Math.floor(
    Math.random() * (MAX_EPHEMERAL_PORT - MIN_EPHEMERAL_PORT + 1) +
      MIN_EPHEMERAL_PORT,
  );
}

export function main(): number {
  for (let attempt = 0; attempt < MAX_BIND_ATTEMPTS; attempt += 1) {
    const port = randomPort();
    try {
      Bun.serve({ hostname: HOSTNAME, port, fetch: serveRequest });
    } catch {
      continue;
    }

    process.stdout.write(`SERVING_PORT:${port}\n`);
    return 0;
  }

  process.stderr.write(`Failed to bind after ${MAX_BIND_ATTEMPTS} attempts\n`);
  return 1;
}

if (import.meta.main) process.exitCode = main();
