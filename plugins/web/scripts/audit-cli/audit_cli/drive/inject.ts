import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, resolve, sep } from "node:path";

import { BrowserDriverError, type BrowserDriver } from "./browser";

const SCRIPT_ORDER = [
  "wcag-text-audit.js",
  "semantic-structure-audit.js",
  "interaction-audit.js",
  "mobile-layout-audit.js",
  "visual-layout-audit.js",
  "design-tokens-audit.js",
  "typography-audit.js",
  "spatial-layout-audit.js",
  "unused-css-audit.js",
  "modal-audit.js",
  "design-audit-aggregator.js",
] as const;

const GLOBALS: Readonly<Record<string, string>> = {
  "wcag-text-audit": "runWcagTextAudit",
  "semantic-structure-audit": "runSemanticStructureAudit",
  "interaction-audit": "runInteractionAudit",
  "mobile-layout-audit": "runMobileLayoutAudit",
  "visual-layout-audit": "runVisualLayoutAudit",
  "design-tokens-audit": "runDesignTokensAudit",
  "typography-audit": "runTypographyAudit",
  "spatial-layout-audit": "runSpatialLayoutAudit",
  "unused-css-audit": "runUnusedCssAudit",
  "modal-audit": "runModalAudit",
  "design-audit-aggregator": "runDesignAudit",
};

export class AuditServer {
  readonly host = "127.0.0.1";
  readonly scripts_dir: string;
  readonly #server: Server;
  readonly port: number;
  #closed = false;

  constructor(server: Server, port: number, scriptsDir: string) {
    this.#server = server;
    this.port = port;
    this.scripts_dir = scriptsDir;
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    await new Promise<void>((resolveClose, rejectClose) => {
      this.#server.close((error) =>
        error === undefined ? resolveClose() : rejectClose(error),
      );
      this.#server.closeAllConnections();
    });
  }
}

export async function serveAuditScripts(
  scriptsDir: string,
): Promise<AuditServer> {
  const root = resolve(scriptsDir);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url ?? "/", "http://localhost").pathname,
      );
      const asset = resolve(root, `.${pathname}`);
      if (!asset.startsWith(`${root}${sep}`)) {
        response.writeHead(404).end();
        return;
      }
      const metadata = await stat(asset);
      if (!metadata.isFile()) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        "content-length": metadata.size,
        "content-type":
          extname(asset) === ".js"
            ? "text/javascript; charset=utf-8"
            : "application/octet-stream",
      });
      createReadStream(asset).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new BrowserDriverError(
      "audit script server did not bind a TCP address",
    );
  }
  return new AuditServer(server, address.port, root);
}

export async function injectAndRun(
  driver: Pick<BrowserDriver, "evaluate" | "wait_for_fn">,
  server: Pick<AuditServer, "host" | "port">,
  options: { readonly viewport_label: string; readonly viewport_kind: string },
): Promise<Readonly<Record<string, unknown>>> {
  const baseUrl = `http://${server.host}:${server.port}`;
  for (const scriptName of SCRIPT_ORDER) {
    driver.evaluate(injectScriptSnippet(`${baseUrl}/${scriptName}`));
    driver.wait_for_fn(scriptReadyExpression(scriptName), {
      timeout_ms: 2000,
    });
  }
  driver.wait_for_fn("typeof window.runDesignAudit === 'function'", {
    timeout_ms: 2000,
  });
  const payload = JSON.stringify({
    viewport: options.viewport_kind,
    viewportLabel: options.viewport_label,
  });
  const parsed = parseEvalPayload(
    driver.evaluate(`JSON.stringify(window.runDesignAudit(${payload}))`).stdout,
  );
  if (isRecord(parsed)) return parsed;
  throw new BrowserDriverError("runDesignAudit did not return an object");
}

function injectScriptSnippet(url: string): string {
  return `new Promise((resolve, reject) => {const s = document.createElement('script');s.src = ${JSON.stringify(url)};s.onload = () => resolve(true);s.onerror = (e) => reject(e);document.head.appendChild(s);})`;
}

function scriptReadyExpression(scriptName: string): string {
  const globalName = GLOBALS[scriptName.replace(/\.js$/, "")];
  return globalName === undefined
    ? "true"
    : `typeof window.${globalName} === 'function'`;
}

function parseEvalPayload(raw: string): unknown {
  const parsed = parseJson(raw);
  if (Array.isArray(parsed) && parsed.length > 0 && isRecord(parsed[0])) {
    const inner = parsed[0].result;
    if (isRecord(inner)) return parseNestedJson(inner.result);
    if (typeof parsed[0].data === "string") return parseJson(parsed[0].data);
  }
  return parseNestedJson(parsed);
}

function parseNestedJson(value: unknown): unknown {
  return typeof value === "string" ? parseJson(value) : value;
}

function parseJson(value: string): unknown {
  if (value.trim().length === 0) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
