# AGENTS.md

Keep every line load-bearing. If deleting a word would not change what someone
does, delete it — that governs this file and everything shipped from this tree.

## What this repository is

This is the **source** of one plugin marketplace for Claude Code and Codex: the
plugins under `plugins/` are projected into each harness's manifest format.

<IMPORTANT>
Edit plugin sources here. Never edit `~/.claude/plugins/` — that is a downstream cache
that lags this tree and will mislead you. Refresh it with `claude plugin update`.
</IMPORTANT>

Runtime prerequisites: Bash, `jq`, Git, and `uv` (which supplies Python 3.13+), plus
`gh`, and optionally `jj`, for publishing.

## Where things live

| Artifact | Path |
|---|---|
| Claude marketplace manifest | `.claude-plugin/marketplace.json` |
| Codex marketplace projection | `.agents/plugins/marketplace.json` |
| Plugin manifests | `plugins/<p>/.{claude,codex}-plugin/plugin.json` |
| Skill | `plugins/<p>/skills/<name>/SKILL.md` (+ `references/`, `scripts/`, `assets/`) |
| Agent | `plugins/<p>/agents/<name>/base.md` + `frontmatter/{meta,claude,codex}.json` |
| Standard | `plugins/<p>/standards/<name>/{meta,scan,write}.md` + `rules/` |
| Injected payload | `plugins/<p>/hooks/{ALLAGENT,MAINAGENT,SUBAGENT}.md` |
| Routing table | `plugins/<p>/references/ROUTING.md` |
| Shared executables | `plugins/essential/scripts/` |

There are **no source `commands/` directories**. Agents ship from `agents/` as
templates (`base.md` body + split JSON files under `frontmatter/`) that
`/essential:install-agents` installs as Claude Markdown or Codex TOML. Every
plugin depends on `essential`; `web` and `react` also depend on `coding`.

## The injection contract

A plugin's `ALLAGENT.md`, `MAINAGENT.md`, and `SUBAGENT.md` hook payloads are **shipped product**, not
developer docs. Each context-owning plugin's
`plugins/<p>/hooks/hooks.json` registers hooks that pipe the file through `sed`
and `jq` into the user's session context:

```bash
sed "s|{{PLUGIN_DIR}}|${CLAUDE_PLUGIN_ROOT}|g" "${CLAUDE_PLUGIN_ROOT}/hooks/ALLAGENT.md" \
  | jq -Rs '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:.}}'
```

- `ALLAGENT.md` — injected at `SessionStart` **and** `SubagentStart`; carries that plugin's
  own routing only. Do not rebuild a central roster table in it.
- `MAINAGENT.md` — `SessionStart` only; binds the main agent to a domain lead
  (`coding`→`tech-lead`, `web`→`design-lead`, `backend`→`ai-research-lead`).
- `SUBAGENT.md` — `essential` only, `SubagentStart`.

Use `{{PLUGIN_DIR}}` for in-payload paths; the hook substitutes it. Because these files
are re-read on every session, they are byte-budgeted (see below) — put detail in
`references/` and link to it at the decision point.

This root `AGENTS.md` is a different mechanism: ordinary memory-file discovery, for work
done *in this repo*. It is not shipped, not hook-injected, and not byte-budgeted.

## Design invariants

These plugins are built to one model of how knowledge ages:
`plugins/essential/references/truth.md`. Read it before changing how a skill records,
reads, or retires anything. The invariants below are what it forbids while you edit
these sources, and each is the rule a locally sensible change breaks first.

- **One home per fact.** Give every fact exactly one authoritative file. A second mention
  is derived: it names its source and is rewritten from that source, never patched in
  place. This is the rule behind "no central roster in a plugin's
  `plugins/<p>/hooks/ALLAGENT.md`" above — a
  convenience copy is drift with a head start.
- **Regenerate projections; never trust them.** `.state/` state, overviews, and the
  installed plugin cache are derived views, safe to delete and rebuild. Do not add a
  cache, index, or generated summary that something else then depends on.
- **Status is not validity.** `done` is terminal history; whether its result still holds
  is a separate question with a separate answer. A skill choosing what to recompute reads
  validity, never status, and never flips a completed row back.
- **Bind evidence to its exact inputs.** A recorded result names the revision and inputs
  that produced it. "Passed" alone carries no truth, and must not survive a change to
  what it was measured against.
- **Supersede, never rewrite.** An accepted decision or shipped contract is replaced
  without rewriting its historical body. ADRs move to their owning
  `decisions/superseded/` folder, gain the standard forward header, and leave the
  successor standing alone; other records follow their owning contract.

## Hard limits

Enforced mechanically — each with the file that enforces it.

| Limit | Enforced by |
|---|---|
| `SKILL.md` body < 500 lines | `plugins/governance/skills/write-skill/scripts/quick_validate.py` |
| Skill `description` 25–60 words (warning) | same |
| No placeholder text (`[TODO]`, `[Description]`, …) and no unresolved local links | same |
| Agent metadata `description` ≤ 1024 chars | `plugins/essential/skills/install-agents/scripts/stitch_agent.py` |
| Agent metadata `name` matches `^[a-z0-9]+(?:-[a-z0-9]+)*$` and equals its directory name | same |
| Agent metadata `intelligence` exists in `plugins/essential/skills/install-agents/references/intelligence-levels.json`; harness model/effort fields are derived | same |
| Agent harness overlays **omit `tools`** (agents inherit runtime capabilities) | same |
| Codex overlay values are scalar TOML fields; nickname candidates derive from metadata; shared prose makes no promise from Claude-only isolation | same |
| `memory` is `"project"`; body has exactly one `## Memory` section | same |
| Every injected payload ≤ 2,000 bytes, per plugin | `scripts/contract_footprint.py`, declared in `plugins/<p>/tests/test_contract_footprint.py` |
| Every plugin's unconditional hook read chain ≤ 40,960 bytes | same |
| `.state/` work Markdown flagged over 16,384 bytes | `plugins/essential/scripts/check-markdown-size` |
| `Agent`/`Task`/`SendMessage` body ≤ 4,096 characters | `plugins/essential/references/orchestration.md` |
| Batch ≤ ~10 resources per subagent; structured reports < 1000 tokens; ~2 retries per batch | `plugins/governance/standards/delegation/` |

A plugin declares its own payloads and unconditional hook read chain in its own test;
the shared script holds the budgets and fails a payload the plugin ships but forgot to
declare. Per-moment references are not part of that chain.

An agent metadata `description` must also end with the exact sentence
`Preferably named <A>, <B>, or <C> when the main agent spawns this role.` — three
distinct capitalized names.

## Authoring rules

Read the rule before writing the artifact; these are the sources, not summaries.

- `plugins/governance/standards/authoring/` — one coherent
  document (supersede prose, never append addenda); concision must preserve the
  executable contract; the Content Boundary Convention (`<IMPORTANT>` for hard
  guardrails, `<report>` for output contracts, every tag closed); headings are useful
  defaults, not a contract.
- `plugins/governance/references/context-catalog.md` — the standards an
  agent may cite. Name a standard by its canonical path; never invent one.
- `plugins/governance/standards/delegation/` — batching, reports, and
  the message ceiling for skills that dispatch subagents.
- `plugins/governance/skills/{write-skill,create-agent,create-standard}/templates/` —
  seed templates for their authored artifacts. Delete every author-guide comment
  before shipping.

Give every threshold its reason; the repo bans magic numbers. Skill and standard
directory names are kebab-case and match their `name`. Agent names are role-only
lowercase kebab, never personalized.

## Validation

Run every Python script and test through `uv`, pinning the interpreter with
`--python`. `uv` fetches the requested version when it is absent, so the same command
works on any machine.

One command validates this repository, with no install step:

```bash
uvx pytest                                                              # everything
uvx pytest plugins/essential/tests/test_install_agents.py
```

Every mechanical gate is a pytest test, so the suite and the gates cannot drift
apart: the byte budgets, the skill policy gate, agent-template stitching, and
the doc-path gate each fail as a named test beside the script that owns them.
`.github/workflows/ci.yml` runs that same one command on every pull request and
on pushes to `master`. Tests are configured by the root `pytest.ini`; there is
no `package.json`.

`claude plugin validate --strict .` checks the manifest and frontmatter schema
against the installed CLI. It stays out of both the suite and CI, which is why
you run it by hand before publishing a manifest change.

<IMPORTANT>
Never invoke a bare `python3`. macOS ships it as 3.9, which fails this repo's sources on
3.10+ syntax such as `dataclass(slots=True)` — a version error that reads like a real
test failure. Pin the version with `uv run --python 3.13`.
</IMPORTANT>

Further suites live in `plugins/<p>/tests/` and beside their scripts.

## Git and pull requests

Conventional Commits, validated before any history mutation against
`plugins/coding/skills/commit/references/conventional-commits.md`:

```
^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([\w./-]+\))?!?: .+
```

Those 11 types only — no aliases, no emoji prefix. Scope is a plugin or `plugin/skill`
(`feat(essential):`, `docs(coding/pr):`), omitted for global changes. Branches are
`type/kebab-summary`, or `type/<work-id>` and `type/<work-id>/NN-<slice>` for a
branch belonging to an engineering work stream. Work lands through pull requests whose titles are themselves
conventional commits.

Tooling is jj-first and git-compatible: `coding:commit` is the sole owner of history
mutation; `coding:pr create|update` owns publication and CI; `coding:pr merge`
merges stacks bottom-up. Route publication through those skills rather than
hand-rolled `git commit` + `gh pr create`.
