import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** appends structured audit events to a JSONL file */
export class ActionLogger {
  readonly path: string;

  constructor(path: string) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
  }

  /** appends one timestamped event while omitting undefined and null fields */
  log(event: string, fields: Readonly<Record<string, unknown>> = {}): void {
    const populatedFields = Object.fromEntries(
      Object.entries(fields).filter(
        ([, value]) => value !== undefined && value !== null,
      ),
    );
    const timestamp = new Date().toISOString().replace(/Z$/, "+00:00");
    appendFileSync(
      this.path,
      `${JSON.stringify({ timestamp, event, ...populatedFields })}\n`,
      "utf8",
    );
  }
}
