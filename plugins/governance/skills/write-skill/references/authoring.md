# Agent Skill authoring contract

Load this reference for every action. It owns the portable structure and
content rules for skills authored by `write-skill`.

## Contents

- [Directory contract](#directory-contract)
- [Reusable knowledge target](#reusable-knowledge-target)
- [`SKILL.md`](#skillmd)
- [Supporting resources](#supporting-resources)
- [Validation](#validation)

## Directory contract

- Author one self-contained skill directory with `SKILL.md` at its root.
- Stop at the skill directory; installation and catalog placement are separate
  workflows.
- Put optional documentation in `references/`, deterministic executables in
  `scripts/`, and templates or static resources in `assets/`.
- Keep every required resource inside the skill root. Address files directly
  from that root, such as `references/<topic>.md` or `scripts/<check>.py`, even
  when the instruction appears in a supporting file.
- Never require the caller's current working directory, a hard-coded install
  path, `../`, or a harness-specific path substitution to find a resource.
- Maintain one shared `SKILL.md` for Claude Code and Codex. Do not generate a
  portable projection of a non-portable source.

## Reusable knowledge target

Before writing, derive one to three representative tasks from the skill's promised
outcome and real usage. Map every task to the exact promise it tests and include a real
caller or observed failure when available. Collectively exercise the common operation,
a material decision, and a common failure when those concerns exist. For each task,
name the raw inputs, expected outcome, decisions, independent acceptance check, and
reusable knowledge the agent would otherwise have to discover. The target is the
smallest skill that lets a fresh agent complete those tasks from the skill and raw
inputs without repeating ordinary subject research.

Inspect evidence in this order, stopping when it is sufficient:

1. Real local consumers, callers, configurations, tests, and failures. Treat their
   project choices as conventions unless the implementation proves a general rule.
2. Official documentation and source. Use these for universal mechanics, supported
   interfaces, and current setup or migration contracts.
3. Credible, battle-tested public usage when local and official evidence leave an
   operational gap. Prefer maintained production examples with observable outcomes
   over tutorial prose.

Distinguish universal mechanics from project conventions and current evidence from
claims that may have gone stale. Keep claim-to-source notes and cold-start evidence in
working context or OS temporary files through the verdict, but ship synthesized
operational guidance rather than an evidence or research diary. Never add those raw
bytes, receipts, transcripts, or outcomes to the skill or repository. Avoid fixed
versions unless the capability is version-bound;
direct the executing agent to inspect current evidence for changing or
project-specific facts.

For every applicable representative task, capture the non-obvious mechanics, decision
rules, complete setup recipe, concrete commands and configuration examples,
generated-versus-source boundaries, common failure symptoms and diagnostics, and
verification that proves the outcome. Keep routing and the always-used workflow in
`SKILL.md`; put conditional recipes, examples, and troubleshooting depth in directly
linked references. Missing routine mechanics are incompleteness, not an invitation for
the executing agent to research the subject again.

## `SKILL.md`

Use the strict Agent Skills frontmatter:

```yaml
---
name: skill-name
description: Describe the owned outcome and the natural-language conditions that should activate it.
requirements:
  intelligence: medium
---
```

`name` is 1-64 lowercase ASCII letters, digits, or hyphens, with no leading,
trailing, or consecutive hyphens; it must match the directory name.
`description` is non-empty, no more than 1024 characters, and states what the
skill does and when an agent should use it. Aim for 25-60 words and put the
primary intent first.

Every shared skill declares exactly one concrete `requirements.intelligence` from
`plugin:essential/install-agents/references/intelligence-levels.json`. The mapping's
`rank` and `best_for` fields own the ordering and task examples. `inherit` is
agent-only. Never add model or effort fields to a skill; harness adapters derive
agent configuration from agent metadata. `requirements` is this marketplace's
harness-neutral extension; external skills may omit it and remain eligible.

Agent Skills reference validators may report the marketplace-owned `requirements`
extension as unknown; use this skill's validator and both marketplace harness
validators as the structural authority for shared skills. Other portable optional
fields are `license`, non-empty `compatibility` of at
most 500 characters, and additional `metadata` string entries. Agent
Skills marks `allowed-tools` as experimental and its support varies; never
depend on it for shared behavior. Omit harness extensions from a shared skill.
Express activation conditions as natural-language intent, not user-interface
command syntax.

When requested behavior names a harness-only control, express equivalent
behavior as a portable body instruction. If an instruction cannot provide the
same semantics, report the incompatibility instead of adding an extension,
projection, or harness-specific branch.

Write one coherent workflow. Keep always-used instructions in `SKILL.md`; move
only conditional detail to a directly linked resource. Include the inputs,
decisions, failure behavior, output, and verification needed to execute the
workflow. Remove prose that does not change agent behavior. Keep the body below
500 lines.

Use `<IMPORTANT>` only for hard guardrails and `<report>` only for
machine-readable output contracts. Close every tag.

## Supporting resources

- Explain when to read each reference or use each asset.
- Add a script only when deterministic computation or file processing is more
  reliable than instructions and existing tools. Make it self-contained,
  document dependencies, handle edge cases, and emit useful errors.
- Keep reference chains shallow. Link required resources directly from
  `SKILL.md` when practical.

## Validation

1. Run the Agent Skills reference validator:

   ```bash
   uvx --python 3.13 --from skills-ref agentskills validate "<skill-root>"
   ```

   Its published schema does not include this marketplace's `requirements`
   extension. Record an unknown-field result limited to `requirements`, then
   continue to the marketplace and harness validators below; any other finding
   fails this step. If it is unavailable, check the strict frontmatter and
   directory rules above and report that no standard validator ran.
2. Run the bundled `scripts/quick_validate.ts --portable` as described in the
   root `SKILL.md`. It checks the self-contained path contract and validates a
   containing Claude plugin only when one is resolvable.
3. Apply the harness-specific checks in `references/harnesses.md` only when the
   target includes that harness.
4. When behavior or discovery changes, reason through representative positive
   and near-miss prompts. Do not report runtime behavior as exercised unless an
   executable evaluation ran.
5. Apply the root `SKILL.md` completion guard. When cold-start is applicable, use
   `references/functional-mode.md` as the sole receipt and evidence-currency contract.
