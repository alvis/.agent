// violation: namespace import — use named imports
import * as path from "node:path";

// violation: wildcard re-export from a leaf file
export * from "./user-service";

// compliant: named imports
import { readFile } from "node:fs/promises";

// compliant: explicit named re-export
export { UserRepository } from "./repository";

export function joinPath(left: string, right: string): string {
  return path.join(left, right);
}

void readFile;
