# Harness projections

## Support tiers

The files under `plugins/` are the source of truth. Claude Code consumes each
`.claude-plugin` manifest; Codex consumes generated `.codex-plugin` manifests
and `.agents/plugins/marketplace.json`. Both are native targets and must remain
behaviorally aligned.

Grok Build is a compatibility consumer: xAI documents direct loading of Claude
marketplaces, plugins, skills, agents, MCP servers, hooks, and instructions. No
Grok-specific source or generated manifest exists here.

OpenCode support targets stable V1 only. Its documented extension layout differs
from this marketplace, so `scripts/install_opencode.py` produces a managed
directory projection and installs `scripts/opencode_adapter.js` as a local
plugin. OpenCode V2 and `opencode2` are outside this contract.

## OpenCode projection flow

```text
.claude-plugin/marketplace.json
          │ plugin source and dependency order
          ▼
plugins/<plugin>/ ── install_opencode.py ──► OpenCode config directory
          │                                  ├── skills/
          │                                  ├── commands/
          │                                  ├── agents/
          │                                  ├── plugins/alvis-marketplace.js
          └─────────────────────────────────►└── alvis/plugins/ + manifest.json
```

The installer accepts explicit plugin names or `--all`, resolves dependencies
before dependents, and stages every output. It preflights all destination paths,
refuses unmanaged collisions, backs up prior managed files, installs regular
files with atomic renames, and rolls back if an installation step fails. The
manifest is the final commit marker and records every managed path and source
digest. A later run may replace or retire only those recorded paths.
Before doing so, it validates canonical path shapes and verifies every existing
managed file's digest. Modified, forged, overlapping, or symlinked claims stop
the install as unmanaged state.

Project scope writes `<project>/.opencode`. User scope writes
`${XDG_CONFIG_HOME:-~/.config}/opencode`. The installer does not alter either
OpenCode configuration file; V1 auto-discovers the local plugin and projected
definitions.

## Identifier and resource mapping

OpenCode requires a globally unique lowercase kebab skill directory and matching
frontmatter name. The projector therefore maps `plugin:skill` to
`plugin-skill`. A generated command with the same hyphenated name loads that
skill and forwards `$ARGUMENTS`. This lets `coding:lint` and `react:lint`
coexist as `coding-lint` and `react-lint`.

Each projected skill retains its resource tree. Markdown links that leave the
skill directory are retargeted into `alvis/plugins/<plugin>`, where the complete
resolved plugin bundles preserve cross-plugin references, standards, templates,
scripts, and hook payloads. Runtime context also states that `@plugin:path`
means that bundled path.

Agent names remain canonical because routing payloads refer to them. A duplicate
agent name across selected plugins aborts projection. The generator combines
canonical metadata and body with the Claude initial prompt, maps `maxTurns` to
OpenCode `steps`, translates supported colors, and omits `model` so the invoking
provider remains authoritative.

## Runtime adapter

OpenCode V1 loads `plugins/alvis-marketplace.js` without extra npm dependencies. <!-- doc-path-gate: ignore -->
The adapter:

- adds absent MCP definitions to the merged configuration, mapping Claude HTTP
  servers to OpenCode remote servers and command definitions to local arrays;
- preserves an existing user or project MCP entry with the same name and logs a
  warning;
- injects `ALLAGENT` plus the root or child payload through
  `experimental.chat.system.transform`, mutating `output.system` in place;
- sources Essential's existing context script instead of copying its environment
  logic;
- validates OpenCode `question` and `task` arguments with the existing Essential
  validators; and
- disables a user-scope adapter when the active worktree has a complete project
  projection, preventing double injection. Suppression requires a matching
  contract, adapter, Essential context script, and both validators; a marker-only
  directory leaves the user adapter active.

The system-transform hook is experimental in the V1 plugin type, so its matrix
status is 🧪. V1 has no equivalent plan-exit event. Task sessions support child
agents, but not persistent teammate identities or direct peer messaging. If the
session lookup cannot establish root or child status, the adapter injects no
`MAINAGENT` or `SUBAGENT` payload and uses the narrower context-script audience;
it never promotes an unresolved session to root behavior.

## Fail-closed boundaries

Agent overlays may contain security-sensitive Claude hooks. The projector maps
the two recognized critic write fences to OpenCode granular edit permissions,
limits edits to rooted agent-memory and canonical review-state paths, denies
shell and external-directory access for those critics, and rejects a canonical
hook unless its complete policy digest is recognized. It does not infer models,
permission modes, isolation, background execution, or memory features that
OpenCode does not document as equivalent.

Runtime reads are receipt-bound. Plugin names and bundle paths must match the
shared `scripts/opencode_contract.json` protocol; every executable or payload
must remain beneath its regular-file bundle path and match its recorded digest
before it is read or spawned.

Replacement authority is also bound outside the projected tree. The installer
stores a target-specific ownership record and durable transaction journal under
`${XDG_STATE_HOME:-~/.local/state}/alvis-opencode-v1/`. A manifest without the
matching external record is unmanaged even when its paths and digests look
canonical. Before the first rename, the installer fsyncs a journal containing
the prior and desired path digests; a later non-dry run rolls back an
interrupted transaction or cleans up a transaction whose ownership commit
completed. Dry-run never mutates recovery state and stops when recovery is
required.

`COMPATIBILITY.md` is generated from current skill and agent sources plus explicit
cross-harness exceptions. Its emoji is part of the claim: adapted, experimental,
external, and unavailable features must never be rewritten as native support.

## Upstream documentation

OpenCode V1 claims were reviewed on 2026-08-21 against its documentation for
[plugins](https://opencode.ai/docs/plugins/),
[skills](https://opencode.ai/docs/skills/),
[agents](https://opencode.ai/docs/agents/),
[commands](https://opencode.ai/docs/commands/),
[tools](https://opencode.ai/docs/tools/),
[permissions](https://opencode.ai/docs/permissions/),
[MCP servers](https://opencode.ai/docs/mcp-servers/), and
[rules](https://opencode.ai/docs/rules/). Grok compatibility is grounded in
[xAI's skills, plugins, and marketplaces documentation](https://docs.x.ai/build/features/skills-plugins-marketplaces).
