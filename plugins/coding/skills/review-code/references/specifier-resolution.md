# Specifier Resolution

Use this reference during Phase 1 (Planning) when a `<specifier>` argument is provided. Each specifier type has its own resolution path — only the matching branch runs for any given invocation.

The `<specifier>` argument identifies which files to review through one of the following methods:

1. **File paths**: Direct path to specific file(s) — `src/auth/auth.service.ts`
2. **Directory paths**: Review all code files in directory — `src/api/`
3. **Glob patterns**: Pattern matching — `**/*.spec.ts`, `src/**/*.{ts,tsx}`
4. **Package names**: Find all imports/usage — `@myapp/auth`, `lodash`
5. **PR numbers**: Review PR changes — `PR#123`
6. **Git ranges**: Review commits — `HEAD~3..HEAD`
7. **Command output**: Dynamic file lists — `$(git diff --cached --name-only)`
8. **Omitted**: Review entire codebase or auto-detect from current context

## File Discovery

Use Glob/Grep to discover files matching the resolved specifier. Categorize by type:

- Source: `*.ts`, `*.tsx`
- Tests: `*.spec.ts`, `*.spec.tsx`
- Docs: `*.md`, `README`
- Config: `*.json`, `*.yaml`

Filter files by selected scopes (pass file paths to subagents, **not** file contents).

## Default Scope Determination

Apply this decision ladder after file discovery:

1. If `--area` parameter provided → Use specified scope(s)
2. If specifier includes test files (`**/*.spec.ts`, `**/*.test.ts`) → Default to `testing` scope
3. If specifier includes documentation files (`**/*.md`, `**/README*`) → Default to `docs` scope
4. If working in interactive mode and no clear context → ask through the graphical or structured user-input capability with multiple selection:
   - Options: alignment, correctness, security, quality, testing, docs, style, all
   - Default: all
5. If in CI mode and no scope specified → Default to `all`

## File Filtering by Scope

When dispatching subagent tasks, filter the discovered file list per scope:

- **alignment**: changed files + state-linked contract files
- **correctness**: source files + tests
- **testing**: test files + source files
- **docs**: source + doc files + test files
- **quality**: source files + test files
- **security**: source files (especially `auth/`, `api/`, `services/`)
- **style**: source + test files

For compatibility, normalize the old selectors `test`, `documentation`, and
`code-quality` to `testing`, `docs`, and `quality,correctness` respectively;
report the normalization. Path output still follows the canonical work-local
contract.

Prepare a separate file list per selected scope before dispatch.
