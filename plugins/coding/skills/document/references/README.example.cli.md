# @scope/tsx-lint

<br/>
📌 A zero-config TypeScript + JSX linter that runs as a single CLI binary, designed for monorepos where every package currently reinvents its own `eslint` wiring. It solves the config-drift problem: teams copy half-working `.eslintrc` files across workspaces, drift apart, and eventually stop trusting the linter entirely.

The `@scope/tsx-lint` CLI bundles a parser, a deterministic rule engine, and a reporter behind one command, so a fresh checkout lints in under a second with no `node_modules` gymnastics. Compared to `eslint` it ships opinionated defaults and a stable cache layout; compared to `biome` it keeps a pluggable rule interface so teams can author custom rules in plain TypeScript without forking the tool.

<br/>
<div align="center">

•&emsp;&emsp;🚀 [Start](#-quick-start)&emsp;&emsp;•&emsp;&emsp;📖 [Usage](#-usage)&emsp;&emsp;•&emsp;&emsp;📚 [CLI](#-cli-reference)&emsp;&emsp;•&emsp;&emsp;🔑 [Env](#-environment-variables)&emsp;&emsp;•&emsp;&emsp;📐 [Arch](#-architecture)&emsp;&emsp;•&emsp;&emsp;📦 [Related](#-related-packages)&emsp;&emsp;•

</div>
<br/>

---

## 🚀 Quick Start

Install the CLI into your project or globally. The binary is named `tsx-lint` and the package ships its own TypeScript toolchain, so no peer `typescript` install is required.

```sh
# npm
npm install --save-dev @scope/tsx-lint

# yarn
yarn add --dev @scope/tsx-lint

# pnpm
pnpm add --save-dev @scope/tsx-lint
```

Generate a starter config and run your first lint:

```sh
npx tsx-lint init
npx tsx-lint lint "src/**/*.{ts,tsx}"
```

Run `tsx-lint --help` for the full flag listing.

---

## 📖 Usage

### Example: Lint an entire workspace

Run the default ruleset against every TypeScript and TSX file in `src/`. Exit code is `0` on clean, `1` on any error-level finding, `2` on CLI misuse.

```sh
npx tsx-lint lint "src/**/*.{ts,tsx}"
```

```text
src/app.ts:42:5  error  no-unused-vars  'foo' is unused
src/app.ts:87:9  warn   no-console      avoid console.log in production

2 findings (1 error, 1 warn) in 1 file (145ms)
```

### Example: Autofix safe issues in-place

The `fix` subcommand rewrites files for rules marked fixable; unfixable findings are still reported to stderr so CI stays honest.

```sh
npx tsx-lint fix "src/**/*.ts" --rules recommended --format pretty
```

### Example: Programmatic invocation from a script

Every subcommand is also exposed as an async function so build scripts can embed the linter without shelling out.

```ts
import { lint } from '@scope/tsx-lint';

const report = await lint({
  patterns: ['src/**/*.tsx'],
  rules: 'recommended',
  format: 'json',
});

if (report.errorCount > 0) {
  process.exitCode = 1;
}
```

---

## 📚 CLI Reference

Invoke any subcommand with `tsx-lint <subcommand> [flags] [patterns]`. Global flags may appear before or after the subcommand.

### Subcommands

| Command | Arguments | Description |
| --- | --- | --- |
| `lint` | `<patterns...>` | check files against the active ruleset; exit `1` on any error-level finding |
| `fix` | `<patterns...>` | apply safe autofixes in-place, then report remaining findings |
| `init` | — | write a starter `tsx-lint.config.ts` into the current working directory |

### Global Flags

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--config` | `path` | auto-discover from CWD upward | path to a config file; overrides auto-discovery |
| `--rules` | `preset\|path` | `recommended` | preset name (`recommended`, `strict`, `minimal`) or a file exporting a rule array |
| `--format` | `pretty\|json\|sarif` | `pretty` (TTY) / `json` (CI) | reporter format |
| `--ignore` | `glob, repeatable` | (none) | extra glob to skip; merges with `.tsxlintignore` |
| `--cache-dir` | `path` | `node_modules/.cache/tsx-lint` | directory for the parse/rule cache |
| `--no-color` | `flag` | off | disable ANSI colors in the `pretty` reporter |
| `--verbose` | `flag` | off | upgrade info-severity findings to warn (useful for CI diagnostics) |
| `--help` | `flag` | off | print the full flag listing and exit |

### Exit Codes

| Code | Meaning | Trigger |
|------|---------|---------|
| 0    | Clean   | No findings at error severity |
| 1    | Findings | One or more findings at error severity |
| 2    | Misuse   | Bad flags, invalid config, unreadable input |

---

## 🔑 Environment Variables

The CLI reads a small set of environment variables to support CI pipelines and container caches. All are optional and override nothing that is already passed on the command line.

| Variable | Default | Flag | Purpose |
| --- | --- | --- | --- |
| `TSX_LINT_CONFIG` | (none) | `--config` | absolute path to a config file |
| `TSX_LINT_CACHE_DIR` | `node_modules/.cache/tsx-lint` | `--cache-dir` | directory for the parse/rule cache |
| `NO_COLOR` | (unset) | `--no-color` | when set to any non-empty value, disables ANSI colors in the `pretty` reporter |

**Precedence**: CLI flag > env var > config file > built-in default.

---

## 📐 Architecture

The CLI is a thin argv parser around a three-stage pipeline: **parse** the source with `@scope/tsx-parser`, **run** each rule as a visitor over the resulting AST, and **report** findings through a pluggable formatter. Rule plugins are loaded once per process and cached on disk by content hash.

A full architectural breakdown — system context, module topology, data flow diagrams, state machine, and invariants — lives in [`docs/architecture/code-linter.md`](./docs/architecture/code-linter.md).

---

## 📦 Related Packages

- [`@scope/tsx-parser`](../tsx-parser): the parser backing the `lint` and `fix` subcommands; exposes the same AST nodes rule authors receive
- [`@scope/rules-recommended`](../rules-recommended): the default ruleset loaded by `--rules recommended`; depend on it directly to compose custom presets

---

## ❓ FAQ

**Q: What is the precedence when a flag, env var, and config file all set the same option?**
A: CLI flag wins, then env var (e.g. `TSX_LINT_CONFIG`, `TSX_LINT_CACHE_DIR`, `NO_COLOR`), then values from the discovered `tsx-lint.config.ts`, then the built-in default. This is the same order documented in [Environment Variables](#-environment-variables); `--config` on the command line overrides `TSX_LINT_CONFIG` even when both are set.

**Q: What do the exit codes mean and how should CI react to them?**
A: `0` means no error-level findings (warn and info are still printed, but the run is considered clean), `1` means at least one error-level finding, and `2` means CLI misuse — bad flags, an unreadable config, or an invalid pattern. Pipelines should fail on `1` or `2`; treating `2` as "no findings, therefore green" hides broken config.

**Q: How is the config file discovered when `--config` is not passed?**
A: The CLI walks upward from the current working directory looking for `tsx-lint.config.ts`, stopping at the first hit or at the filesystem root. `TSX_LINT_CONFIG` short-circuits that walk with an absolute path; `--config` overrides both. The `.tsxlintignore` file is discovered the same way and merged with any `--ignore` globs.

**Q: Can I pipe source through stdin instead of passing file globs?**
A: Yes — `tsx-lint lint --stdin --stdin-filename src/app.ts < app.ts` lints the piped buffer as if it lived at the given filename, so path-sensitive rules still fire. Reporter output goes to stdout, diagnostics to stderr, and `fix` in stdin mode writes the rewritten source to stdout so editors can splice it back in.

**Q: Why did `tsx-lint fix` leave some findings in place?**
A: Only rules explicitly marked fixable are rewritten; findings from unfixable rules are still reported to stderr with the normal severity so CI stays honest. Run `tsx-lint lint` (not `fix`) afterwards to confirm nothing slipped through, or pass `--rules strict` to surface rules that have no autofixer at all.

---

## 🛠️ Troubleshooting

- **`tsx-lint: command not found`** — the binary is on `node_modules/.bin` rather than on your `PATH`. Invoke it via `npx tsx-lint ...` or a package script (`"lint": "tsx-lint lint 'src/**/*.{ts,tsx}'"`). For a global install, verify `npm bin -g` is on `PATH`; this is the usual cause after a fresh shell on a new machine.
- **`EACCES: permission denied` when running the binary** — typically a global install done under `sudo` that left the binary root-owned, or a cache directory owned by a different user inside a Docker volume. Reinstall without `sudo` (prefer `npm install --save-dev` per-project), or `chmod -R u+rw node_modules/.cache/tsx-lint` to reclaim the cache.
- **Config changes have no effect** — check discovery order: an env var `TSX_LINT_CONFIG` or a `--config` flag will override the file you just edited, and auto-discovery stops at the first `tsx-lint.config.ts` walking upward from CWD. Run `tsx-lint lint --verbose` to see the resolved config path and rule set; if the path is unexpected, either unset the env var or pass `--config` explicitly.
- **Shell completion prints nothing or the wrong suggestions** — the completion script has to be sourced from the shell that ships with the binary version in use. Regenerate it with `tsx-lint completion zsh > ~/.tsx-lint-completion.zsh` (or `bash`/`fish`), source it from your rc file, and restart the shell. Stale completions after a major upgrade are the common cause of mismatched flags.

---
