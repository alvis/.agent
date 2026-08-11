# Troubleshooting recipes

Run observation commands through the resolved local binary. Examples use pnpm; replace
the prefix with the detected package manager.

| Symptom | Observation command and evidence | Fix |
| --- | --- | --- |
| Wrong config or no config | `DEBUG=presetter:* pnpm exec presetter bootstrap --projects "packages/api"`; inspect `searching` and `loading presetter configuration` paths | Edit the closest owner. If it should inherit a root, import and extend that root explicitly. If no owner exists, apply the ownership question before adopting. |
| Bootstrap selected the wrong monorepo packages | `pnpm exec presetter bootstrap --projects "packages/*" "!packages/legacy"`; then repeat with `--packages "@scope/*" "!@scope/legacy"` | Start with a positive selection. Quote globs. Negations only subtract and exclusions apply across both flags. |
| One package failure hides the rest | Run the same filtered bootstrap and inspect the final `AggregateError` plus every nested target error | Fix each reported target; Presetter already attempted all selected projects. Do not assume later packages were skipped. |
| Asset is missing | `DEBUG=presetter:* pnpm exec presetter bootstrap --projects "<target>"`; inspect `ASSET FILES`, initial pass, final pass, and `Skipping`/`Generating` | Remove an unintended `null`, correct a condition or variable, include the asset owner in `extends`, or fix target selection. |
| Handwritten config was overwritten | `git diff -- <path>` and `git ls-files -- <path>`; locate the preset asset with `rg -n "'<path>'|\"<path>\"" --glob 'presetter.config.*'` | Restore the tracked file, encode its intent in the preset/override, compare regeneration, then untrack only after the generated result is correct. |
| Generated files recur in status | `git ls-files -- <paths>` and `git check-ignore -v <paths>` | Add paths to the Presetter-owned ignore asset, bootstrap, verify ignore behavior, then remove already-preserved outputs from the index. Never hand-edit the generated file. |
| Local script unexpectedly wins | Compare `pnpm exec presetter run build` with `pnpm exec presetter run build --template`; inspect `jq '.scripts.build' package.json` | Remove or change the local shadow if accidental. Keep it when project-specific behavior is intentional. |
| `run <task>` cannot be resolved | `DEBUG=presetter:* pnpm exec presetter run <task>` and `pnpm exec presetter run <task> --template`; inspect resolved preset and local scripts | Add the missing preset capability, correct the task name, or add a deliberate local task. Avoid a self-referential delegate other than the supported `"task": "run task"` pattern. |
| Arguments do not reach the tool | Compare `pnpm exec presetter run test -- --watch` with the failing command | Put task arguments after `--`; quote compound values so the shell preserves them. |
| Binary or imported library is missing | `pnpm why <package>` and `DEBUG=presetter:* pnpm exec presetter run <task>` | Add the preset that owns the binary or the required peer. Preset roots enter `PATH`, but libraries dynamically imported by consumer code may require a direct dependency. |
| Override loses upstream arrays or executable config | Inspect initial/final debug values, then compare the content function's return with `current` | Spread `current ?? []` for lists or use `merge(current, patch)` for structured content. A function owns its returned value. |
| Upgrade leaves old imports or task names | `rg -n 'presetter-preset-|presetter-types|"coverage"|"watch"' --glob '!node_modules/**'` plus the installed migration guide | Apply only the migration mapping supported by the detected versions; update dependencies with the package manager and regenerate. |
| Packages resolve incompatible Presetter generations | `pnpm list --depth 0 presetter '@presetter/*'` and inspect workspace catalogs plus lockfile entries | Align CLI and preset ranges using repository conventions; let the package manager rewrite the lockfile, then bootstrap again. |

After a fix, rerun the same observation command against the same exact target before
widening scope. Then run that target's build, lint, typecheck, and tests and confirm
generated outputs remain ignored and untracked.
