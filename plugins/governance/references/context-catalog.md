# Base-Context Catalog

The menu of standards and repo-derived context an agent's `base.md` may cite, plus the per-agent assignment map.
This catalog is the single source of truth for agent base context — an agent's base.md never invents its own
standard name or path; it cites entries from here verbatim.

## Rules

- **No shared universal core.** There is no standards bundle every agent inherits. Each agent lists only its own
  role-scoped subset from the assignment map below. Two agents with an overlapping subset still each declare it
  independently — there is no implicit inheritance to fall back on.
- **Repo-derived context is lazy.** The entries in the repo-derived menu are resolved per task, from whatever repo
  the agent is currently working in. They are NEVER preloaded at agent-definition time and never hold a fixed path
  in this catalog; an agent's base.md states that it resolves them lazily, not what they currently point to.
- **Standards are stable.** These live at fixed paths in this repo (the plugin `standards/` trees)
  and MAY be named as preload candidates for producers/critics per the assignment map.
- **Every agent self-curates project memory.** Every roster definition carries `"memory": "project"` and owns
  `.claude/agent-memory/<name>/MEMORY.md`; there is no external memory steward or shared runtime memory file.
  Each definition names role-specific durable content and follows
  `essential:templates/memory.md` for
  evidence, verification, contradiction replacement, archival, size control, and sensitive-data exclusions.

## Standards menu (stable, real paths)

| Standard | Path |
|---|---|
| `universal` | `coding:standards/universal/` |
| `function` | `coding:standards/function/` |
| `typescript` | `coding:standards/typescript/` |
| `naming` | `coding:standards/naming/` |
| `testing` | `coding:standards/testing/` |
| `git` | `coding:standards/git/` |
| `documentation` | `coding:standards/documentation/` |
| `observability` | `coding:standards/observability/` |
| `code-review` | `coding:standards/code-review/` |
| `file-structure` | `coding:standards/file-structure/` |
| `python` | `coding:standards/python/` |
| `rust` | `coding:standards/rust/` |
| `data-entity`, `data-operation` | `backend:standards/{data-entity,data-operation}/` |
| the design standards — `css`, `design`, `theming`, `components`, `accessibility`, `hooks`, `project-structure`, `storybook` | `web:standards/{css,design,theming}/` + `react:standards/{components,accessibility,hooks,project-structure,storybook}/` |

Paths use canonical `plugin:path` syntax (e.g. `universal` resolves to
`coding:standards/universal/`). Directories (trailing slash) mean "read every file
under this tree, following cross-references."

### GAP note

No `authentication.md` or `data-protection.md` standard has been written anywhere in this repo. Any agent,
template, or prior agent file that cites `authentication.md`, `data-protection.md`, `communication.md`,
`checklist.md`, `infrastructure.md`, `monitoring.md`, `deployment.md`, or `naming/README.md` is citing a standard <!-- doc-path-gate: ignore -->
that was never written — those are fake and MUST NOT appear in any agent's base context. Security- and
data-protection-sensitive agents (e.g. `security-champion`) fall back to `code-review` + `universal` until a real
auth/data-protection standard is authored; do not paper over the gap by inventing a path.

## Repo-derived menu (lazy — never preloaded, no fixed path here)

| Context | Resolves to (at task time, from the target repo) |
|---|---|
| Task area | The functional area/module the current task touches (its own conventions, siblings, existing patterns) |
| Repo configuration | The target repo's build/lint/test configuration (`package.json` scripts, tsconfig, eslint config, CI) |
| Handover notes | Any paused-work/design notes left for the current task (`essential:handover` output, design docs) |
| Repo-local standards | Additional repo-local standards, if the target repo defines any; they cannot replace canonical rule IDs or thresholds |

An agent's base.md names which of these it consults and states that resolution happens lazily per task — it never
bakes in a repo path, because the agent is not scoped to one repo.

## Per-agent context assignment map

Producers get `universal` + `function` + `typescript` + role standards + the lazy task area and repo
configuration. Critics get `code-review` + role standards + the lazy task area. The table below is each agent's
role-scoped standards subset; every row additionally carries the lazy repo-derived context implied by its
producer/critic posture.

| Agent | Standards subset |
|---|---|
| `principal-engineer` | `universal`, `function`, `typescript`, `observability`, `code-review` |
| `tech-lead` | `universal`, `code-review`, `git` |
| `code-quality-critic` | `code-review`, `universal`, `function`, `typescript` |
| `testing-evangelist` | `testing`, `function`, `typescript`, `code-review` |
| `security-champion` | `code-review`, `universal` |
| `service-implementation-engineer` | `universal`, `function`, `typescript`, `data-entity`, `data-operation`, `testing` |
| `data-architect` | `data-entity`, `data-operation`, `universal`, `typescript`, `naming` |
| `devops` | `universal`, `observability`, `git` |
| `ml-engineer` | `universal`, `python`, `function`, `testing`, `observability` |
| `ai-research-lead` | `universal`, `observability`, `code-review` |
| `generalist-engineer` | `universal`, `function`, `typescript`, `testing` |
| `design-lead` | `universal`, the design standards, `code-review` |
| `desktop-implementer` | `universal`, `function`, `typescript`, the design standards, `testing` |
| `mobile-implementer` | `universal`, `function`, `typescript`, the design standards, `testing` |
| `workflow-optimizer` | `universal`, `documentation` |
| `specification-expert` | `documentation`, `naming`, `universal` |
| `project-initializer` | `universal`, `file-structure`, `git` |
| `frontend-designer` | the design standards, `universal`, `typescript` |
| `frontend-implementer` | `universal`, `function`, `typescript`, the design standards, `testing` |
| `aesthetic-evaluator` | the design standards, `code-review` |
| `adversarial-red-team` | `code-review`, `universal` |
| `harness-eval-engineer` | `testing`, `universal`, `function`, `observability`, `code-review` |
| `test-runner` | `testing` |

23 agents total. Each row is exhaustive for that agent's standards subset — do not add standards beyond what is
listed here without updating this catalog first; the catalog, not the agent file, is authoritative.

## How an agent cites this catalog

An agent's `base.md` Base Context section lists its standards subset by canonical name + real path (copied
verbatim from the menu above — no re-deriving), states which repo-derived context it resolves lazily, and — if it
carries a `memory` frontmatter key — states that it self-curates `.claude/agent-memory/<name>/MEMORY.md`. See
`../skills/create-agent/templates/agent.md` for the required `## Memory` section,
`essential:templates/memory.md` for its maintenance schema, and
`../skills/create-agent/templates/role-prompt.md` for how the same context
list is compressed into an `initialPrompt` load-context clause.
