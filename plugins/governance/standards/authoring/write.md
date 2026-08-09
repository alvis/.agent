# Governance Authoring Invariants: Compliant Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

## Key Principles

- Keep only content that changes what someone does.
- Integrate policy where readers expect it and remove superseded prose.
- Preserve the decisions, failure behavior, and verification needed to execute the contract.
- Use headings that fit the capability; boundaries, inputs, workflow, verification, and completion are useful defaults rather than mandatory names.
- Bound important or long content with semantic, balanced tags without replacing document headings.
- Delegate only when a bounded assignment and report save context.

## Core Rules Summary

### Content (AUT-CONT)

- **AUT-CONT-01**: Every shipped line must change behavior; omit filler and unbounded illustrative negations.
- **AUT-CONT-02**: Maintain one coherent document by replacing superseded prose rather than appending corrections.
- **AUT-CONT-03**: Concision must retain operational decisions, failure behavior, and verification.

### Boundaries (AUT-BOUN)

- **AUT-BOUN-01**: Enclose important or long content in a semantically named tag that identifies its role.
- **AUT-BOUN-02**: Keep headings and fenced-block language hints, and close every boundary tag.

### Delegation (AUT-DELG)

- **AUT-DELG-01**: Compare direct-execution context cost with assignment-plus-report cost and follow `standard:delegation` when dispatching subagents.

## Patterns

### Coherent Revision

Before adding content, identify the existing section that owns the behavior. Replace contradictory or obsolete prose there, then read the whole artifact for one executable flow.

### Content Boundary Convention

The tag names the content's role, not its section. Tags in use are:

- `<report>` for a machine-readable report or output contract.
- `<IMPORTANT>` for a hard guardrail or critical instruction that must not be missed.

Keep the document outline in Markdown headings. When a fenced block appears inside a boundary, keep its language hint because the boundary and fence serve different purposes.

### Delegation Decision

Delegate bulk reads, noisy commands, or independent resource transformations when briefing and receiving a bounded report costs less context than doing the work inline. Keep small work inline and then apply the delegated-execution standard at the dispatch step.

## Anti-Patterns

- Appending a changelog-style correction to a normative artifact.
- Trimming an outcome until its required decisions or verification disappear.
- Wrapping a short structural section in a tag that merely repeats the heading.
- Treating delegation as ceremony when it saves no context.

## Quick Decision Tree

1. Does the content change behavior? If not, delete it (`AUT-CONT-01`).
2. Does related policy already exist? Integrate and supersede it in place (`AUT-CONT-02`).
3. Can a reader execute and verify the result? Restore any missing operational contract (`AUT-CONT-03`).
4. Is the content important or long? Add a semantic, balanced boundary without removing headings (`AUT-BOUN-01`, `AUT-BOUN-02`).
5. Would delegation reduce context cost? If yes, follow `standard:delegation`; otherwise work inline (`AUT-DELG-01`).
