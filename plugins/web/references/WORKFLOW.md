# Web workflow

Read this before UI/UX design, CSS, image-generation, Next.js diagnosis, Storybook audit, rendered-interface audit, or frontend implementation work.

## Actions

| Action | Instruction |
| --- | --- |
| Design or redesign an interface | `web:design` |
| Audit a rendered interface | `web:audit` |
| Create or maintain the root color-mode stylesheet | `web:css` |
| Generate or edit visual assets | `web:imagine` |
| Diagnose a Next.js runtime | `web:next` |
| Audit Storybook | `web:storybook` |
| Write, test, review, save, or publish frontend code | Read `coding:references/WORKFLOW.md`, then use its action owner |
| Create or materially rewrite project artifacts | Follow the injected `essential:references/engineering-work.md` contract |

Before work delegation, read `web:references/ROUTING.md`.

## Standards

Read every file in each applicable standards directory, following its cross-references.

| Applies to | Standards |
| --- | --- |
| Visual and interaction design or audit | `web:standards/design/` |
| Light, dark, and system color modes | `web:standards/css/` plus `web:standards/design/` |
| Brand and token theming | `web:standards/theming/` plus `web:standards/css/` and `web:standards/design/` |
| Frontend implementation | `coding:standards/universal/`, `coding:standards/function/`, `coding:standards/typescript/`, `coding:standards/naming/`, `coding:standards/testing/`, and `coding:standards/documentation/` |
| Files and project setup | `coding:standards/file-structure/` |
| Review | `coding:standards/code-review/` plus the Web standards above |
| Commits, branches, and pull requests | `coding:standards/git/` |

Web does not declare another framework plugin as a dependency; do not load its standards or skills.
