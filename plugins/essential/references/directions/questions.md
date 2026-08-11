# Asking user questions

Write every question and every option for an outsider who has not seen this
conversation, repository, task stream, task identifier, or referenced file.
Make each one self-contained: state the plain-language subject, the decision or
action, and the consequence of choosing it. The reader must not need to decode
internal shorthand or infer missing context.

## Establish the decision

- State what needs direction and why it matters now.
- Describe each referenced item in one line. Do not write only `ADR 1` or
  `Proposal A`; write, for example, `Architecture Decision Record (ADR) 1 —
  Consolidate vendors: moves purchases to one supplier, lowering unit cost but
  increasing dependency`.
- Never use an acronym, abbreviation, internal name, task-stream label, task
  identifier, file name, or other internal shorthand as the sole description of
  a question or option. Spell out and briefly explain every term an outsider
  may not know; put a short identifier after the plain-language description in
  parentheses only when traceability helps.
- Define any term an outsider may not know, then state its implication for this
  decision. For example, `cannibalization means a new offering takes sales from
  an existing one, which can reduce total growth even when the new offering
  performs well`.
- Ask one focused question. Separate unrelated decisions.
- Apply an outsider test before sending: without the surrounding conversation or
  another file, a reader must be able to tell what is being decided, what each
  option would do, and what changes after choosing it. Rewrite anything that
  fails.

## Present choices

Put the solution—the action or outcome—in plain language in each choice title;
never use only an acronym, internal label, task name, or identifier. Prefer
every applicable tag there. For example, use the title
`Consolidate purchasing [Pragmatic] [Recommended]`.
If the provider limits title or label length, keep the solution
title within that limit and put the tags on the first line of the choice detail
instead. For example, use title `Consolidate vendors` and begin its detail with
`[Pragmatic] [Recommended]`.

For a material decision, identify the recommendation and explain why.

| Tag | Use when |
| --- | --- |
| `Architectural` | This is the long-term north star, aligned with the system architecture and expected to remain correct as the codebase evolves. |
| `Ideal` | This is the highest-quality implementation: the best balance of correctness, maintainability, readability, and engineering principles. |
| `Recommended` | This is the default for most situations unless a compelling reason favors another choice. |
| `Pragmatic` | This deliberately trades some elegance or generality for practicality, delivery speed, or simplicity. |
| `Hotfix` | This urgently restores functionality and should usually be revisited after the immediate issue is resolved. |
| `Workaround` | This temporarily bypasses the root cause to keep progress moving and needs a planned permanent replacement. |

In each choice body, explain how the solution works and what choosing it commits
the decision-maker to. Include meaningful benefits, drawbacks, implications,
upfront or ongoing cost, reversibility, and follow-up work. Use explicit
`Pros` and `Cons` when they make a real trade-off easier to compare.
