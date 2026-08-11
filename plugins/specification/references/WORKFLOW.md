# Specification workflow

Read this before specification, architecture, requirements, documentation, implementation planning, alignment review, or Notion synchronization work.

## Actions

| Action | Instruction |
| --- | --- |
| Author or revise a specification | `specification:spec-code` |
| Plan approved specification work | `specification:plan-code` |
| Implement an approved plan | `specification:implement-code` |
| Review implementation against its specification | `specification:review-implementation` |
| Materialize or synchronize a specification | `specification:sync-spec` or `specification:sync-notion`; semantic Notion body changes additionally require the caller's explicit `--body-author=<plugin:skill>` because this marketplace ships none |
| Write, review, save, or publish code | Read `coding:references/WORKFLOW.md`, then use its action owner |
| Create or materially rewrite project artifacts | Follow the injected `essential:references/state.md` contract |

Before work delegation, read `specification:references/ROUTING.md`.

## Standards

Specification owns no standards. Specifications and technical documentation follow `coding:standards/documentation/`, `coding:standards/naming/`, and `coding:standards/universal/`. Implementation additionally follows every standard selected by `coding:references/WORKFLOW.md`.
