import { spawnSync } from "node:child_process";

import type { ActionLogger } from "../action_log";

export interface BrowserResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export class BrowserDriverError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BrowserDriverError";
  }
}

export interface BrowserDriverOptions {
  readonly binary?: string;
  readonly timeout?: number;
  readonly cdp_url?: string;
  readonly logger?: ActionLogger;
}

type BrowserCommand = readonly string[];

/** Runs short-lived agent-browser batches against one persistent browser session. */
export class BrowserDriver {
  readonly cdp_url: string | undefined;
  created_session = false;

  readonly #binary: string;
  readonly #timeout: number;
  readonly #logger: ActionLogger | undefined;

  constructor(options: BrowserDriverOptions = {}) {
    this.#binary = options.binary ?? "agent-browser";
    this.#timeout = options.timeout ?? 30;
    this.cdp_url = options.cdp_url;
    this.#logger = options.logger;
  }

  navigate(url: string): BrowserResult {
    if (this.cdp_url !== undefined) {
      return this._run_batch([["connect", this.cdp_url]]);
    }
    const result = this._run_batch([["open", url]]);
    this.created_session = true;
    return result;
  }

  snapshot(): Readonly<Record<string, unknown>> {
    const parsed = parseSingleJson(
      this._run_batch([["snapshot", "-i", "--json"]]).stdout,
    );
    return isRecord(parsed) ? parsed : { nodes: [] };
  }

  click(uid: number): BrowserResult {
    return this._run_batch([["click", `@e${uid}`]]);
  }

  hover(target: number | string): BrowserResult {
    return this._run_batch([
      ["hover", typeof target === "number" ? `@e${target}` : target],
    ]);
  }

  wait_for_fn(
    expression: string,
    options: { readonly timeout_ms?: number } = {},
  ): BrowserResult {
    const timeoutMs = options.timeout_ms ?? 3000;
    const promise = `new Promise(r=>{let d=Date.now()+${timeoutMs};(function t(){try{if(${expression})return r(true);}catch(e){}if(Date.now()>d)return r(false);setTimeout(t,50);})();})`;
    return this._run_batch([["eval", promise]]);
  }

  screenshot(path: string): BrowserResult {
    return this._run_batch([["screenshot", path]]);
  }

  evaluate(expression: string): BrowserResult {
    return this._run_batch([["eval", expression]]);
  }

  resize(width: number, height: number): BrowserResult {
    return this._run_batch([
      ["set", "viewport", String(width), String(height)],
    ]);
  }

  press(key: string): BrowserResult {
    return this._run_batch([["press", key]]);
  }

  reload(): BrowserResult {
    return this._run_batch([["reload"]]);
  }

  get_url(): string {
    const result = this._run_batch([["get", "url"]]);
    const parsed = parseSingleJson(result.stdout);
    return isRecord(parsed) && typeof parsed.url === "string"
      ? parsed.url
      : result.stdout.trim();
  }

  close(): void {
    if (!this.created_session) return;
    this.created_session = false;
    try {
      this._run_batch([["close"]]);
    } catch (error) {
      if (!(error instanceof BrowserDriverError)) throw error;
    }
  }

  _run_batch(commands: readonly BrowserCommand[]): BrowserResult {
    const result = spawnSync(this.#binary, ["batch", "--bail", "--json"], {
      input: JSON.stringify(commands),
      encoding: "utf8",
      timeout: this.#timeout * 1000,
    });
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";

    if (result.error !== undefined) {
      const exception = result.error;
      const code = "code" in exception ? exception.code : undefined;
      const missing = code === "ENOENT";
      const timedOut = code === "ETIMEDOUT";
      const detail = missing
        ? `binary not found: ${this.#binary}`
        : timedOut
          ? `timed out after ${this.#timeout}s`
          : `${typeof code === "string" ? `${code}: ` : ""}${exception.message}`;
      this.#log_action(commands, false, { error: detail });
      throw new BrowserDriverError(
        missing
          ? `agent-browser binary not found: ${this.#binary}`
          : timedOut
            ? `agent-browser batch timed out after ${this.#timeout}s`
            : `agent-browser batch failed: ${detail}`,
        { cause: exception },
      );
    }

    const exitCode = result.status ?? 1;
    if (exitCode !== 0) {
      const detail = extractBatchErrorDetail(stdout, stderr);
      this.#log_action(commands, false, {
        error: detail,
        stdout: stdout.trim() || undefined,
        stderr: stderr.trim() || undefined,
      });
      throw new BrowserDriverError(
        `agent-browser exited ${exitCode}: ${detail}`,
      );
    }

    this.#log_action(commands, true, {
      stdout: stdout.trim() || undefined,
      stderr: stderr.trim() || undefined,
    });
    return { stdout, stderr, exitCode: exitCode };
  }

  #log_action(
    commands: readonly BrowserCommand[],
    success: boolean,
    fields: {
      readonly error?: string;
      readonly stdout?: string;
      readonly stderr?: string;
    },
  ): void {
    this.#logger?.log("browser_action", {
      action: commands[0]?.[0] ?? "unknown",
      commands: commands.map((command) => [...command]),
      success,
      ...fields,
      cdp_url: this.cdp_url,
    });
  }
}

function extractBatchErrorDetail(stdout: string, stderr: string): string {
  const details = [
    extractStructuredBatchError(stdout),
    stderr.trim(),
  ].filter(
    (detail, index, values) =>
      detail.length > 0 && values.indexOf(detail) === index,
  );
  return details.join(" | ") || "<no error details>";
}

function extractStructuredBatchError(stdout: string): string {
  const parsed = parseJson(stdout);
  if (!Array.isArray(parsed)) return "";
  return parsed
    .filter(isRecord)
    .map((entry) => entry.error)
    .filter(
      (error): error is string =>
        typeof error === "string" && error.trim().length > 0,
    )
    .map((error) => error.trim())
    .join(" | ");
}

function parseSingleJson(stdout: string): unknown {
  const parsed = parseJson(stdout);
  if (!Array.isArray(parsed) || parsed.length === 0) return parsed;
  const first = parsed[0];
  if (!isRecord(first)) return first;
  if ("result" in first && "success" in first) return first.result;
  return "data" in first ? first.data : first;
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
