import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface CoreModule {
  readonly run: (
    argv: readonly string[],
    options: { readonly rulesDirectory: string },
  ) => Promise<number>;
}
const argv = process.argv.slice(2);
const marker = argv.findIndex(
  (argument) => argument === "--scanlib" || argument.startsWith("--scanlib="),
);
const scanlibArgument =
  marker < 0
    ? undefined
    : argv[marker]?.startsWith("--scanlib=")
      ? argv[marker]?.slice("--scanlib=".length)
      : argv[marker + 1];
if (marker < 0 || scanlibArgument === undefined || scanlibArgument === "") {
  process.stderr.write(
    "error: the following arguments are required: --scanlib\n",
  );
  process.exit(2);
}
const scanlib = resolve(scanlibArgument);
const remaining = argv.filter(
  (_, index) =>
    index !== marker &&
    (!argv[marker]?.startsWith("--scanlib=") ? index !== marker + 1 : true),
);
const core = (await import(
  pathToFileURL(resolve(scanlib, "core.ts")).href
)) as CoreModule;
process.exit(
  await core.run(remaining, {
    rulesDirectory: resolve(import.meta.dir, "scanners"),
  }),
);
