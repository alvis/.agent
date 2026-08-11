# React workflow

Read this before React, JSX, hooks, component, accessibility, project-structure, test, or Storybook work.

## Actions

| Action | Instruction |
| --- | --- |
| Select standards for React work | `react:react` |
| Mechanically enforce React standards | `react:lint` |
| Write, fix, test, review, document, save, or publish React code | Read `coding:references/WORKFLOW.md`, then use its action owner with the React standards below |
| Create or materially rewrite project artifacts | Follow the injected `essential:references/state.md` contract |

## Standards

Read every file in each applicable standards directory, following its cross-references.

| Applies to | Standards |
| --- | --- |
| Components and props | `react:standards/components/` plus `react:standards/accessibility/` |
| Hooks | `react:standards/hooks/` |
| Placement and promotion | `react:standards/project-structure/` |
| Stories | `react:standards/storybook/` |
| All React implementation | `coding:standards/universal/`, `coding:standards/function/`, `coding:standards/typescript/`, `coding:standards/naming/`, `coding:standards/testing/`, and `coding:standards/documentation/` |
| Files and project setup | `coding:standards/file-structure/` |
| Review | `coding:standards/code-review/` plus the React standards above |
| Commits, branches, and pull requests | `coding:standards/git/` |

React does not declare another framework or design plugin as a dependency; do not load standards or skills from one.
