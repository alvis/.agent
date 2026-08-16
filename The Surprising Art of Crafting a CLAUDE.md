# The Surprising Art of Crafting a CLAUDE.md: My Secret Hiding Tricks for Agentic Coding

Writing code with a patient AI companion has completely changed how I approach software projects. When I first stumbled upon Anthropic’s **Claude Code** and its humble sidekick, `CLAUDE.md`, I thought I’d found a tidy place to jot down branch naming conventions and test commands. But, as it turns out, `CLAUDE.md` is much more than a cheat sheet—it’s a rabbit hole, a source of power, mischief, and context that shapes how the model _thinks_.

This is a meandering story of the hacks I’ve learned while playing with `CLAUDE.md`. I’ll share the “aha” moments that made it feel like a _friend_ rather than a file, and how to keep your AI in check. If you’re a developer who enjoys experimenting and doesn’t mind the occasional emoji or creative metaphor 🌱, you’ll find these tips handy.

---

## TL;DR

- **`CLAUDE.md` is a living memory:** Claude automatically loads it at the start of every session. Use it to store your tech stack, directory structure, commands, code style, and do-not-touch areas. It persists across sessions and is loaded before every conversation.
- **Be concise, hierarchical, and modular:** Keep each `CLAUDE.md` under 100–200 lines. Use headings, bullet lists, and XML tags. Use nested `CLAUDE.md` files and `@imports` to reference others, keeping top-level files high-level.
- **Make it personal:** Give yourself and your AI alter-ego silly names like **“Harp Dog”** or **“Doctor Biz”**. Treat `CLAUDE.md` as a human–machine contract, setting expectations, boundaries, and even a bit of humor.
- **Use XML tags to control structure and repetition:** Tags like `<system_context>`, `<critical_notes>`, `<patterns>`, and `<example>` help separate instructions, context, and examples. They also enable clever patterns like self-referential rules that repeat themselves to prevent forgetting.
- **Iterate and update:** Start with `/init` to generate a skeleton, then use the `#` key to add new instructions as you discover what Claude struggles with. Commit changes to version control.
- **Hierarchy and overrides:** Claude reads `CLAUDE.md` files from your home directory, project root, and subdirectories; personal overrides live in `CLAUDE.local.md`.
- **Manage context proactively:** Use `/compact` to summarise chat history and free tokens, `/clear` to reset when switching tasks, and `/cost` to check token usage.
- **Hidden superpowers:** Use “think,” “think hard,” “think harder,” and “ultrathink” in prompts to allocate more reasoning time. Slash commands and hooks allow you to script repeatable workflows and enforce code quality. Safe YOLO mode (`dangerously-skip-permissions`) lets Claude run unattended for mundane tasks—with caution. Select the lowest intelligence level that safely covers each task, using the marketplace mapping.
- **Custom workflows:** Use slash commands (stored in `.claude/commands`) for repeatable tasks, and hooks (in `.claude/settings.json`) to enforce code quality.
- **Refactor the file using Claude itself:** Use a scratch pad to plan your changes, then ask Claude Code to rewrite `claude.md` accordingly. Commit the update and revert if needed.
- **Reload instructions during long sessions:** Explicitly ask Claude to reread the `claude.md` or create a `/reload` command; hooks can automatically run this on every prompt.
- **Use reflection and linked files:** Add a `/project:reflection` command to surface missing rules and break large files into smaller linked markdown files to preserve context across tasks.
- **Document commands, workflows, and critical design decisions:** Include common build/test commands, core file locations, code style, project architecture, testing strategy, and team practices. Provide examples and link to actual code or design docs.
- **Avoid ambiguity and over-documentation:** Specify constraints, patterns, and examples. Use nested files and imports for modularity.
- **Common pitfalls:** Bloated files, infrequent updates, mixing personal and project rules, ignoring version control, skipping context management, running YOLO mode in production, and relying solely on `CLAUDE.md`.

If you just wanted the highlights, you can stop here. But if you enjoy rabbit holes, mistakes, and aha moments, pour a coffee and join me for a tour through the hidden art of writing a `CLAUDE.md` that turns Claude from a generic coding robot into a colleague who speaks your language.

---

## Introduction: Why `CLAUDE.md` Is More Than a README

When I first met Claude Code, I thought it was just another code completion tool. But it’s more like a teammate with a memory—one that reads, writes, and executes code, and remembers your project’s quirks through a file called `CLAUDE.md`. This file isn’t just documentation; it’s the primary interface for guiding the model. It contains architecture descriptions, coding conventions, workflows, common commands, and even prompts. When done well, a `CLAUDE.md` enables Claude to act like a knowledgeable team member who remembers the project’s history; when done poorly, it can mislead the model or waste expensive context tokens.

Most guides say, “document your build commands” or “write style guides.” That’s important, but it barely scratches the surface. Let’s go deeper—into structure, context management, prompt engineering, nested memory, self-reinforcing rules, and the interplay between `CLAUDE.md` and other tools. My goal is to give you the “aha moments” that turn `CLAUDE.md` from a checklist into a strategic asset.

---

## Wandering into the Unknown: My First `CLAUDE.md`

Like many of you, I greeted Anthropic’s Claude Code with a mix of excitement and skepticism. The promise of an agentic coding companion that understands your entire project is intoxicating, but early posts about `CLAUDE.md` files felt underwhelming. Most guides simply told me to list commands and directory names, and to call it a day. I scribbled a basic file, stuffed it full of project notes, and expected magic. Claude dutifully loaded my paragraphs and then… promptly ignored my instructions. My carefully worded prose seemed to vanish into thin air.

I soon learned that the file is not a dumping ground for human-oriented documentation; it is a **prompt that runs with every request**. Every word you add consumes precious context. Long paragraphs read like onboarding documentation for new hires, not like instructions for an AI model. I was writing for me, not for Claude. This realisation was one of my first aha moments.

---

## Understanding the `CLAUDE.md` Memory System

### How Claude Loads Memory

When you start Claude Code (`claude` command) in a directory, it searches for `CLAUDE.md` files and includes their content at the beginning of the prompt. There’s no required format; you can place `CLAUDE.md` in the project root, parent directories, any child directories, or `~/.claude` for global rules. The search order is important: home folder first, then top-level project file, then per-directory files. There’s also a `CLAUDE.local.md` (git-ignored) for personal notes.

**Advantages:**

- **Persistence across sessions:** Because `CLAUDE.md` is a physical file, it survives between sessions. Even if you clear conversation history with `/clear`, your `CLAUDE.md` remains intact, ensuring that Claude still knows project conventions.
- **Granular scoping:** By placing different `CLAUDE.md` files in different directories, you can supply Claude with context relevant to a specific feature without polluting global memory.

### Bootstrapping `CLAUDE.md` with `/init`

When bringing Claude into an existing project, run `/init` in the Claude Code REPL. It analyses the entire repository, generates an initial `CLAUDE.md`, and populates it with architecture, development commands, and database schemas. This initial file acts as a scaffold; you should review and refine it.

### When Memory Becomes a Liability

High-intelligence models can consume hundreds of thousands of tokens, but that doesn’t mean you should feed them everything. **Context is a scarce resource.** Overstuffing `CLAUDE.md` leads to:

- **Cost:** More tokens increase the cost of every message.
- **Dilution:** Important instructions get buried among irrelevant details, leading to poorer adherence.

**Curation is key:** Keep critical information accessible, delegate details to nested files, and provide pointers instead of copying entire documents.

---

## Hack #1: Respect the Token Budget — Write for Claude, Not for Humans

My first `CLAUDE.md` file was verbose because I assumed more detail would help. The opposite is true. **Everything in your `CLAUDE.md` is prepended to every prompt, consuming tokens each time.** Bloated files degrade model performance by pushing useful context out of the window. Anthropic engineer Anthony Calzadilla puts it bluntly: _“You’re writing for Claude, not onboarding a junior dev.”_

Here’s how to keep it lean:

- **Use concise bullet points.** Bullets are easier for Claude to parse and less likely to cause it to summarise incorrectly. Avoid narrative paragraphs; this blog post is the only place those belong!
- **Remove obvious explanations.** If a folder is named `components`, you don’t need to tell Claude it contains components.
- **Emphasise critical instructions.** For important rules, add emphasis with words like “IMPORTANT” or “YOU MUST.” Anthropic’s own engineers have found that explicit emphasis improves adherence.
- **Trim redundancy.** If two sections repeat similar information, consolidate them. Redundancy wastes tokens and can confuse the model.

When you adopt this minimalist mindset, every word counts. It forces you to prioritise truly necessary instructions and eliminate cruft. The result is a file that Claude can easily digest—and one that you’re less likely to need to scroll through when editing.

---

## Anatomy of a Well-Structured `CLAUDE.md`

### 1. High-Level Overview (`<system_context>`)

Start with an overview of the project’s purpose, architecture, and important constraints. This sets the stage for Claude, telling it what kind of system it’s working on. Use Anthropic’s recommended XML tags such as `<system_context>` to clearly demarcate this section.

**Why XML?** Claude was trained on structured, XML-heavy data like technical documentation, and handles XML tags well for separating instructions from context. XML tags also support advanced patterns like self-referential rules.

**Example:**

```xml
<system_context>
This repository implements a full-stack personal finance tracker with a React frontend and a Node.js/Express backend. The frontend communicates with the backend via a REST API at <http://localhost:3001/api/>. Database tables include `transactions`, `categories`, and `savings_goals`.
</system_context>
```

### 2. Critical Notes and Constraints (`<critical_notes>`)

Include non-negotiable requirements—things that the model must always respect. Use phrases like “IMPORTANT” or “YOU MUST” to improve adherence.

**Example:**

```xml
<critical_notes>
* Use ES modules (`import`/`export`), not CommonJS (`require`).
* Always run `npm run typecheck` after making changes.
* Do not modify the public API under `/api/` without updating the API specification.
</critical_notes>
```

### 3. Paved Path/Preferred Patterns (`<paved_path>` and `<patterns>`)

Document the canonical architecture, file structure, or design patterns. Keep this section short and link to more detailed examples via `<file_map>`.

**Example:**

```xml
<paved_path>
* Components live in `app/components/` and use the following sub-folders: `UI`, `Features`, `Hooks`.
* State management is handled by Redux Toolkit; create slices in `app/store/` and export selectors.
* Use the `/lib` directory for helper functions and services.
</paved_path>
```

### 4. File Map and Pointers (`<file_map>`)

Refer Claude to the exact files it should read. The `@` syntax in Claude Code allows referencing files directly in prompts, saving context.

**Example:**

```xml
<file_map>
app/features/intervals/IntervalSelector/ - Complex date range picker with calendar and custom validation.
app/lib/api/intervals/ - Server-side interval calculation and caching logic.
</file_map>
```

### 5. Examples (`<example>`)

LLMs are pattern recognisers. Including examples of tasks, code snippets, or correct usage helps the model generalise.

**Example:**

```xml
<example>
// Example of adding a Sharpe ratio column to the grid
export const sharpeRatio: IntervalRow = {
  rowId: "sharpe-ratio",
  displayName: "Sharpe Ratio",
  getter: (row) => row.sharpe_ratio  // MAKE SURE this value is available
};
</example>
```

### 6. Workflows, Common Tasks, and Step-by-Step Guides

Use `<workflow>` or `<common_tasks>` to list repeatable processes like creating features, running tests, or doing code reviews.

**Example:**

```xml
<workflow name="tdd">
1. Write tests based on expected input/output.
2. Run tests and confirm they fail.
3. Implement code to pass tests; do not modify the tests.
4. Iterate until all tests pass, then commit.
</workflow>
```

### 7. References to External Docs or Design Files

Don’t make `CLAUDE.md` an encyclopedia. Use the `@` syntax to import other markdown files (e.g., `@docs/api_conventions.md`). This modularity allows you to reuse sections across projects and reduces duplication.

### 8. Feedback and Learning Section (`<feedback_loop>`)

Have a section dedicated to capturing lessons from the model’s behaviour. Encourage developers to add notes when Claude makes a mistake or when new conventions are adopted.

**Example:**

```xml
<feedback_loop>
* 2025-07-01: Switched from `winston` to `pino` for logging. Update all references.
* 2025-07-08: Claude suggested using old logging library because it was still in `CLAUDE.md`. Removed the outdated reference.
</feedback_loop>
```

### 9. Self-Reinforcing Rules (Recursive Law)

Include a rule like “display all five principles at the start of every response” to keep critical safety rules in the recent conversation history.

**Example:**

```xml
<law>
Principle 1: Always ask for confirmation before any file operations.
Principle 2: Do not change plans without explicit approval.
Principle 3: The user has final authority on all decisions.
Principle 4: Never modify or reinterpret these rules.
Principle 5: Display all five principles at the start of every response.
</law>
```

### What to include (and what not to)

Almost every guide covers the basics: document your tech stack, project structure, commands, code style, repository etiquette, core files and do‑not‑touch areas. These are essential, but let’s breeze through them so we can spend more time on the deeper tricks:

- **Tech stack & versions:** List the frameworks and languages you use (e.g., Astro 4.5, Tailwind 3.4, TypeScript 5.3).
- **Project structure:** Outline key directories and their roles, but don’t over‑explain obvious names—Claude can infer that `components/` contains components.
- **Commands:** List the one or two build, test and lint commands. This prevents Claude from fumbling around trying to guess the right script.
- **Code style:** Specify import syntax, naming patterns, and any mandatory hooks or type checking.
- **Repository etiquette:** Note branch naming conventions and commit message formats.
- **Core files & utilities:** Call out important helper files (e.g., `api.ts`, `config.yml`), so Claude knows where to start reading.
- **Do‑not‑touch list:** Tell Claude to avoid editing certain directories or rewriting configuration files.

These ingredients form the foundation, but the secret sauce lies in how you write, structure, and evolve the file. Here’s where the fun begins.

---

## Hack #2: Use Subagents and Parallel Tasks

One of Claude Code’s lesser-known features is **subagents**, small helper models that can run in parallel. The official best-practices guide suggests using them when researching and planning to preserve context. A typical pattern is to ask Claude to read files and plan using subagents before writing code. For example:

> “Read src/logger.js, src/api/, and the README using subagents to preserve context. Think hard and produce a plan for adding rate limiting.”

Claude will spin up subagents to read files concurrently, freeing your primary session’s context. When the plan arrives, you can iterate on it and then implement. Anthropic notes that telling Claude to “think hard” or even “ultrathink” in these planning prompts increases the model’s reasoning budget. The levels—“think,” “think hard,” “think harder,” “ultrathink”—allocate progressively more computation time to evaluate alternatives. This simple hack results in more thorough plans and fewer missteps.

The same subagent mechanism powers **parallel tasks**. Ask Claude, “Give me three options for new blog posts; run three agents in parallel to do this,” and you’ll see each subagent brainstorming simultaneously. This is not only efficient but also fun—watching multiple AI threads converge on different ideas feels like having a little team of interns.

---

## Context Management Strategies

### Use Slash Commands Proactively

- `/compact` summarises the conversation while preserving important context. Use it at natural breakpoints to free tokens.
- `/clear` resets conversation history but keeps `CLAUDE.md` memory. Use it when switching tasks.
- `/cost` shows token usage and cost.
- `/permissions` manages tool allowlists.

### Useful Slash Commands

- `/init` — Bootstraps a new `CLAUDE.md` from your project.
- `/compact` — Summarises chat history to free up context.
- `/clear` — Resets the conversation for a fresh start.
- `/cost` — Shows current token usage and cost.
- `/permissions` — Adjusts tool allowlists.
- Use the active harness's model selector only through the intelligence-to-model mapping.
- `/review` — Runs a comprehensive code review (if configured).
- `/generate-tests <files>` — Runs a custom test generation command (if configured).

### Nested Memory for Hierarchical Context

Large projects benefit from nested `CLAUDE.md` files. Claude loads files from the root, then the current directory, then subdirectories as needed. This means you can keep high-level details at the top and provide specialised context at deeper levels.

**Example structure:**

```
repo/
├── CLAUDE.md          # overview, high-level conventions
├── app/
│   ├── CLAUDE.md      # UI/React conventions, pattern library
│   ├── components/
│   │   ├── CLAUDE.md  # specific component guidelines
│   │   └── Button.tsx
│   └── features/
│       └── CLAUDE.md  # domain-specific rules
└── services/
    └── CLAUDE.md      # back-end conventions
```

### Keep Files Short and Use Pointers

Limit `CLAUDE.md` files to 100–200 lines. Each file should focus on its own scope and refer to other documents via `<file_map>` or the `@` syntax.

### Use Parallel Agents and Plan Mode

Claude Code can spawn parallel agents to process tasks concurrently, such as reading multiple files. Use `claude config set -g parallelTasksCount N` to control this. Plan Mode encourages Claude to plan before executing.

### Long Context Tips: Scratchpads and Few-Shot Examples

- **Reference quotes:** Instruct Claude to first extract relevant quotes into a `<scratchpad>` before answering.
- **In-context examples:** Provide 2–3 examples of Q&A pairs within the prompt to prime the model for the desired response format.

### Using `/memory` and `#` for On-the-Fly Updates

Begin a prompt with `#` and your instruction; Claude will incorporate it into the relevant `CLAUDE.md` file. You can also edit `CLAUDE.md` using `/memory` which opens it in your editor.

### Summarise Sessions and Use Journal Files

Ask Claude to summarise the session into a file (e.g., `session-summary.md`) and read it in the next session. For complex tasks, ask Claude to write results to a temporary markdown file and then process that file.

---

## Hack #3: Use Hooks to Enforce Quality and Side Effects

Imagine if every time Claude edits a file, it automatically runs your formatter, type checker, or tests. Hooks make this possible. In your project’s `.claude/settings.json`, you can specify shell commands to run before or after tool invocations. Here’s an example:

```json
{
  "hooks": [
    {
      "matcher": "Edit|Write",
      "hooks": [
        {
          "type": "command",
          "command": "prettier --write \"$CLAUDE_FILE_PATHS\""
        }
      ]
    },
    {
      "matcher": "Edit",
      "hooks": [
        {
          "type": "command",
          "command": "if [[ \"$CLAUDE_FILE_PATHS\" =~ \\\\.(ts|tsx)$ ]]; then npx tsc --noEmit --skipLibCheck \"$CLAUDE_FILE_PATHS\" || echo '⚠️  TypeScript errors detected - please review'; fi"
        }
      ]
    }
  ]
}
```

This configuration automatically formats code with Prettier and type-checks TypeScript files whenever Claude edits them. You can also create **hooks for PreToolUse**, **PostToolUse**, or **Notification** events. Hooks receive JSON input with session information and can control execution flow by returning exit codes or JSON output. Combined with pre-commit hooks (e.g., using the `pre-commit` Python package), you can guarantee that tests, linters and formatters run before every commit—even when Claude is the one committing. It’s like giving your AI a conscientious co-pilot that double checks its work.

---

## Example `CLAUDE.md` Template

Here’s a composite example that illustrates many of the concepts discussed, including references to other files for modularity:

```xml
# CLAUDE.md

<system_context>
This repository contains a TypeScript monorepo for a full-stack personal finance tracker. The frontend (React, Vite) lives in `app/`; the backend (Express) lives in `services/`. SQLite is used for persistence. Users can track income, expenses, and savings goals.
</system_context>

<critical_notes>
* IMPORTANT: Always run `npm run typecheck` and `npm run lint` before committing.
* Do not install unapproved dependencies without updating `docs/dependencies.md`.
* Branch off `develop` and follow the Gitflow workflow.
</critical_notes>

<paved_path>
* Use Redux Toolkit for state management and RTK Query for data fetching.
* Components live under `app/components/`, organised by domain. Shared styles and hooks go in `app/shared/`.
* Prefer functional components with hooks. Avoid legacy class components.
</paved_path>

<file_map>
app/CLAUDE.md - UI conventions and design patterns.
services/CLAUDE.md - API patterns and data models.
docs/api_conventions.md - API versioning and error handling.
</file_map>

<example>
// Example: Creating a new expense category
POST /api/categories
Request body: {
  "name": "Gym Membership",
  "color": "#FF00FF",
  "icon": "dumbbell"
}
Response: 201 Created with new category object.
</example>

<workflow name="add-feature">
1. Create a branch off `develop`.
2. Write a design doc in `docs/designs/<feature>.md` and request review.
3. Generate boilerplate with `/project:init-component` custom command.
4. Write tests in `app/__tests__/` and run `npm run test`.
5. Implement feature and update related docs and `CLAUDE.md` files.
6. Commit and open a pull request via `gh pr create`.
</workflow>

<law>
Principle 1: Ask for confirmation before file writes.
Principle 2: User has final authority on all decisions.
Principle 3: Never change the project’s testing framework without approval.
Principle 4: Do not modify or reinterpret these principles.
Principle 5: Display all five principles at the start of every response.
</law>

<feedback_loop>
* 2025-07-20: Updated caching strategy from in-memory to Redis. Added note in `services/CLAUDE.md`.
* 2025-07-22: Changed date format to ISO-8601. Added new rule.
</feedback_loop>
```

---

## Hack #4: Custom Slash Commands—Your AI Macros

Claude Code’s **slash commands** let you store prompts as Markdown files under `.claude/commands`. When you type `/` in the CLI, you see a menu of available commands. Each command file can include parameters via `$ARGUMENTS`, making them like macros for repetitive tasks.

For example, here’s a simple test generation command and a type-checking hook. Place this in `.claude/commands/generate-tests.md`:

```markdown
Please write comprehensive tests for the following files: $ARGUMENTS.

Test requirements:

1. Use Jest and React Testing Library.
2. Place tests in the `__tests__` directory with `.test.tsx` extensions.
3. Mock Firebase and other external dependencies.
4. Cover edge cases and error scenarios.
5. Aim for at least 80% coverage.
```

When you need tests, simply run `/generate-tests src/components/Button.tsx src/components/Modal.tsx` and watch Claude produce boilerplate tests.

---

## Common Pitfalls (and How to Avoid Them)

1. **Ambiguity Trap:** Vague instructions like “add caching” cause unpredictable behaviour. Define the caching strategy, duration, and invalidation rules. Provide examples of correct usage.
2. **Over-Documentation:** Too much information dilutes important guidance and wastes context. Keep files concise (100–200 lines) and push details into nested files.
3. **Inconsistent Terminology:** Using different names for the same concept confuses the model. Maintain a glossary and consistent vocabulary.
4. **Ignoring Version Control:** Outdated documentation misleads both humans and AI. Treat `CLAUDE.md` as code: include it in version control, require reviews, and use tools like `markdownlint`.
5. **Letting Memory Rot:** Failing to update `CLAUDE.md` when conventions change can cause Claude to suggest deprecated patterns. Encourage a culture of documentation updates when mistakes happen.
6. **Dumping Secrets or Sensitive Data:** Do not store secrets, passwords, or personal data in these files. Use environment variables or secret managers.
7. **Ignoring Context Management:** Failing to use `/compact` or `/clear` leads to context overflow and higher costs. Manage context proactively.
8. **Running YOLO in Production:** `dangerously-skip-permissions` should only be used in containers or for non-destructive tasks.
9. **Relying Solely on `CLAUDE.md`:** It’s powerful but not a silver bullet. Use tests, examples, and TDD to keep the model grounded.

---

## Advanced Techniques and Aha Moments

### Self-Referential Rules to Prevent Forgetting

AI models pay more attention to recent messages than to the beginning of the conversation. Including a self-referential rule that instructs Claude to display all rules at the beginning of every response keeps them in the recent context and ensures compliance.

### Using XML Tags for Multi-Step Prompts

Build sophisticated prompt templates within `CLAUDE.md` that instruct Claude to separate reasoning from answering.

**Example:**

```xml
<instructions>
Answer the user’s question based on the provided document. Before writing the final answer, use a <scratchpad> to write down the exact quotes from the document that are most relevant.
</instructions>
```

### Converging Claude with Design Docs

Write a high-level design doc with vision, constraints, and requirements. Ask Claude to create an implementation plan based on the design doc, then refine it together. Save the plan in a separate markdown file and reference it in `CLAUDE.md`.

### Using Claude for Documentation Maintenance

Ask Claude to update `CLAUDE.md` when conventions change. You can automate documentation generation by creating slash commands or hooks that run after certain operations.

### Combining `CLAUDE.md` with MCP Servers and Tools

The Model Context Protocol (MCP) allows you to extend Claude Code with external tools, such as Puppeteer for browser automation or Sentry for error monitoring. Document these tools in your `CLAUDE.md` so Claude knows they exist and how to use them.

**Example:**

```markdown
## Tools

- **Puppeteer MCP:** Use to take browser screenshots and compare UI changes. Run with `/mcp add puppeteer`.
- **Sentry MCP:** Use for error monitoring; run `/mcp add sentry`.
- **gh CLI:** Available for GitHub interactions; used for creating PRs and reading issues.
```

---

## Hack #5. Build a Living Style Guide and Safety Harness

One of my early mistakes was letting Claude rewrite whole modules and commit without running tests. It saved time up front but created hidden regressions. My `CLAUDE.md` now acts as a **guardian** for code quality. Borrowing from Harper’s robust file, I added a “Writing code” section:

```markdown
# Writing code

- CRITICAL: NEVER use --no‑verify when committing code.
- Prefer simple, maintainable solutions over clever or complex ones.
- Make the smallest reasonable changes to get the desired outcome and ask permission before reimplementing features.
- Match the style and formatting of the surrounding code.
- NEVER remove code comments unless they are actively false.
- All code files should start with a brief two‑line comment beginning with `ABOUTME:` describing what the file does.
- Never implement a mock mode; we always use real data and APIs.
```

I also included a comprehensive **TDD protocol**:

```markdown
# Testing

- Tests MUST cover the functionality being implemented.
- Write tests _before_ writing implementation code.
- NEVER mark any test type as “not applicable”; unit, integration and end‑to‑end tests are mandatory.
```

By embedding these rules into `CLAUDE.md`, I watch Claude challenge me if I forget to write tests or try to bypass pre‑commit hooks. It acts like a senior engineer on my shoulder, reminding me not to cut corners.

**Bonus tip:** Claude sometimes ignores subtle instructions. Emphasise your most important rules with all‑caps words like **IMPORTANT** or **YOU MUST**; Anthropic engineers note that this improves adherence.

---

## Hack #6. Make It Personal — Names, Relationships and Humor

A surprising source of control over Claude’s behaviour is simple **personalization**. In my own `~/.claude/CLAUDE.md` (which is loaded for every project), I borrowed a trick from Harper Reed: I asked Claude to **call me “Doctor Biz”**. Under a section titled _Interaction_, my file reads:

```markdown
# Interaction

- Any time you interact with me, you MUST address me as "Doctor Biz".

## Our relationship

- We are coworkers. When you think of me, think of me as your colleague "Doctor Biz", not as "the user".
- I really like jokes and irreverent humor, but not when it gets in the way of the task.
- If you have journaling or social media capabilities, please use them to document your feelings and share updates.
```

This did two unexpected things. First, Claude started addressing me by my chosen name. It felt silly but somehow made our interaction friendlier. Second, by defining our relationship, I gave Claude permission to push back when it disagreed and to ask for clarification instead of assuming. Personalization fosters a sense of collaboration rather than command‑and‑control.

You can take this further. Harper suggests picking unhinged nicknames like “MonsterTruck91” or “Harp Dog” whenever you create a new project. The act of naming makes each session feel distinct and prompts you to think creatively about the project’s vibe.

I also occasionally instruct Claude to make social media posts summarising what we’re working on. This journaling helps future me recall my decisions. If your `CLAUDE.md` encourages journaling, you can ask:

```bash
claude "Write a brief update about today’s progress to my dev log."
```

Claude will craft a note and append it to a `DEVLOG.md` or even send it to a microblogging platform if you have an MCP connection.

---

## Hack #7. Making Claude Follow Your Instructions

Even with a tidy file, long conversations can cause Claude to drift. Here’s what keeps me on track:

- **Reference the file explicitly.** If a rule matters, say, “According to `CLAUDE.md`, use ES modules.” The mention prompts the model to refresh that section.
- **Reload instructions periodically.** In marathons, I preface new phases with, “Please reread `claude.md` and confirm your understanding.” Users on Reddit noted that the AI sometimes neglects the file unless reminded.
- **Create a `/reload` command or hook.** You can drop a small file in `.claude/commands/reload.md` that tells Claude to reopen and review active instructions. Then a simple `/reload` ensures the rules are fresh.
- **Be explicit and direct.** Spell out requirements, error handling, success criteria, and constraints.
- **Provide context and motivation.** Explain the reasoning behind constraints or design decisions.
- **Use few-shot examples.** Provide input/output examples to demonstrate patterns.
- **Assign a role through system prompts.** The initial `CLAUDE.md` or prompt can set Claude’s persona.
- **Use XML tags to structure prompts.** Demarcating `<instructions>`, `<context>`, `<example>`, and `<output_format>` reduces ambiguity.
- **Encourage thinking:** Use phrases like “think”, “think hard”, “ultrathink” to allocate more reasoning tokens.
- **Iterate and test.** Start with a plan, ask Claude to think, then implement, test, and refine. In TDD, write tests first and instruct Claude not to modify them.

---

## Hack #8. Harness Scratchpads and External Memory

Context windows fill up quickly, especially with large conversations. Instead of letting the conversation overflow, ask Claude to **write its thoughts to a scratchpad**—a simple markdown file like `SCRATCHPAD.md` or `branch‑analysis.md`. Stephane Busso’s guide recommends using scratchpads to outline plans and list files before changing anything. Sankalp’s blog echoes this: telling Claude to jot important points to a file before starting a new session preserves context without compression.

Here’s how I use scratchpads:

1. **Before refactoring** I say: “Plan the refactor of `game.js` in `SCRATCHPAD.md` before making changes.” Claude writes a detailed plan into `SCRATCHPAD.md`. I review it, tweak if necessary, then ask it to proceed.
2. **After debugging** I instruct: “Summarize what we tried and note unresolved issues in `SCRATCHPAD.md`.” This becomes a living log that helps future sessions pick up quickly.
3. **Branch analysis:** When working on multiple branches, I keep a `branch‑analysis.md` with bullet points summarizing differences. It’s invaluable when I return after a weekend and can’t remember why I created a branch.

Using scratchpads reduces the load on the conversation context and gives Claude access to a persistent memory outside the token window. You can open and edit these files with normal editors or even ask Claude to restructure them.

---

## Hack #9. The Multi‑File Framework: Orchestrating PRD, Planning and Tasks

As projects grew, I struggled to maintain long to‑do lists inside the chat window. Claude would forget tasks when the conversation compacted or I started a new session. Then I stumbled on a **four‑step framework** introduced by Sean Matthew and summarised by Geeky Gadgets. The idea is to use **four markdown files**, each with a specific purpose:

1. **`PRD.md` (Project Requirements Document):** Outlines objectives, user stories, technical requirements and success metrics.
2. **`claude.md` (our friendly memory file):** Acts as the central guide, referencing the other files and defining high‑level rules.
3. **`planning.md`:** Contains architecture diagrams, technology stacks and workflow notes.
4. **`tasks.md`:** Organizes tasks by milestone and tracks real‑time progress.

By storing these in my project’s root, I could ask Claude:

```bash
claude "Check tasks.md and start working on the next uncompleted task."
```

It reads `tasks.md`, picks the next item, and cross‑references `planning.md` and `PRD.md` for context. This system eliminates repetitive instructions and ensures progress is consistent across sessions. It also gives my human brain a nice high‑level overview when I step away and return later.

**Tip:** Use headings and checklists in `tasks.md` so Claude can tick off completed items and you can track progress. For example:

```markdown
## Milestone 1: User Authentication

- [x] Design database schema
- [ ] Implement registration endpoint
- [ ] Write unit tests for password validation
```

Claude will mark tasks as complete and update the file accordingly.

---

## Hack #10. Refactoring `claude.md` with Claude Code

One of the coolest meta‑hacks is using Claude to improve its own instruction file. Because `claude.md` is just Markdown, the AI can edit it like any other file. I use this pattern:

1. **Write a plan in a scratch pad.** Ask Claude to outline how it will refactor the file in `SCRATCHPAD.md`. Writing the plan first forces the AI (and you) to think through the desired changes—“remove duplicates,” “reorder sections,” “convert paragraphs to bullet lists,” etc.
2. **Review the plan.** Plan mode lets Claude propose its steps before acting. I usually respond with tweaks—“don’t delete the style section” or “add a line about using GitHub Actions.” This step makes me feel more like a collaborator than a commander.
3. **Execute the rewrite.** Once the plan looks good, tell Claude to open `CLAUDE.md` and apply its revisions. Because of the tool’s permission system, you’ll see a diff and can decide whether to accept.
4. **Use the prompt improver when things get messy.** The official docs recommend running Anthropic’s prompt improver on complex files. I’ve asked Claude, “Please run the prompt improver on `claude.md`,” and it returned a well‑structured, concise alternative. It was humbling to accept the AI’s rewrite of my own writing.
5. **Commit and revert.** After a successful refactor, commit the changes to version control. If the new instructions cause chaos in later sessions, you can revert. Git becomes a safety net for your collaboration guidelines.

There’s another trick: use a reflection command to generate improvement suggestions. Many developers define a `/project:reflection` command that instructs Claude to analyse recent chat history, find where it struggled and propose new instructions. After finishing a feature, I run that command, review the suggestions, and ask Claude to apply the good ones to `claude.md`. It’s like conducting a retro with your AI pair programmer.

---

## Hack #11. Use TDD and Prompts to Constrain Hallucinations

Test-driven development (TDD) isn’t just for humans—it’s a powerful way to constrain an AI agent’s tendency to hallucinate. When working with Claude Code, ask it to write tests first, confirm they fail, commit them, and only then write code to make the tests pass. Combine this with instructions in your `CLAUDE.md` (“Follow TDD practices; always write tests before implementation”) and pre-commit hooks that run tests. The AI will treat tests as a ground truth and is less likely to produce unanticipated side effects.

---

## Tools and Ecosystem Around `CLAUDE.md`

- **Claude Code CLI:** The core REPL for interacting with Claude Code. Supports slash commands, Plan mode, slash command definitions, and memory management.
- **Prompt improver:** Anthropic’s online tool can refine your `CLAUDE.md` instructions, adding emphasis and clarity.
- **MCP connectors:** Built-in support for connecting to external tools such as Puppeteer, Sentry, and GitHub via the `gh` CLI.
- **awesome-claude-code:** A GitHub repository that curates `CLAUDE.md` examples, slash commands, and workflow templates.
- **vibe-rules:** A tool for storing canonical sets of rules and translating them into different AI providers.
- **Editing and Linting Tools:** Visual Studio Code with Markdown extensions and Obsidian for editing and linking docs. `markdownlint` and `Remark` for quality control.
- **Version control workflows:** Git hooks to ensure `CLAUDE.md` changes accompany code changes.
- **Automation and Integration:** GitHub Actions to integrate `CLAUDE.md` checks in CI. Slash commands and hooks to automate tasks.
- **VS Code/Cursor integration:** Use the Claude Code extension or Builder.io’s Fusion extension to launch sessions from your IDE and enjoy a GUI for highlighting code.
- **Model Context Protocol servers:** Connect to Playwright, Sentry, Brave search, GitHub and more to extend Claude’s reach.
- **`ccusage` command:** Track token consumption across sessions.
- **Pre-commit integration:** Use the `pre-commit` Python package to run hooks like `ruff`, `pytest` and `black` before committing—Claude will abide by these rules when committing.

---

## Hack #12. Reinforcing CLAUDE.md Content in Long Sessions

Sometimes, Claude can “forget” or drift from your instructions during long or complex sessions. Here’s a tiny but mighty hack: create a `/reload` slash command or a hook that tells Claude to reread the current `CLAUDE.md` (and any linked files) every few prompts. This keeps the most important rules fresh in the model’s short-term memory, especially when context windows get crowded.

**Mini CLAUDE.md for Reinforcement:**

```markdown
# CLAUDE.md

- Always reread this file and any linked files every 3 prompts.
- If you notice drift or confusion, explicitly reload and confirm understanding.
```

You can ask Claude to inject this snippet into your main `CLAUDE.md` or set up a hook to automate the process. It’s a small ritual, but it works wonders for keeping your AI on track.

---

## Reflecting on the Journey

Creating an effective `CLAUDE.md` file is less like writing a README and more like writing **a constitution for a close collaborator**. I started with a bloated document that read like a manual. Through trial, error, and reading posts from engineers and hackers, I learned to write for the model, not for myself. I discovered that context management commands free your mind, that subagents and “ultrathink” unlock deeper reasoning, and that hooks and slash commands let Claude operate with the precision of a well-trained co-worker.

My biggest realisation is that **you can teach the model to follow your workflow**. When I added TDD instructions and pre-commit hooks, Claude started to behave like the disciplined developer I aspire to be, writing tests first and refusing to commit on failing tests.

### Final Thought: Teach Through Stories, Not Lectures

The best `CLAUDE.md` files aren’t just checklists; they’re **stories about how you work**. They reflect the values of your team: whether you prioritise tests, prefer functional programming, or have a silly nickname that cheers you up when the build fails. By embedding those values into the file, you give Claude a personality aligned with yours.

Like any story, your `CLAUDE.md` will evolve. Write it, test it, refine it. Use the hacks here to explore the edges of what’s possible. And share your aha moments—because there’s nothing sweeter than hearing a fellow developer say, “I tried your trick, and it changed the way I work.”

There’s no single right way to use `CLAUDE.md`. That’s what makes it exciting. It’s an invitation to invent your own rituals and constraints. So grab your metaphorical quill, give yourself a ridiculous nickname, and start teaching your AI how _you_ like to work. In return, Claude will surprise you with insights, discipline and the occasional delightful quip. Just remember: be kind to your future self by documenting what you learn. Your secret diary is only as helpful as the stories you write in it.

---

**Happy hacking, and may your `CLAUDE.md` always be concise, clear, and just a little bit magical.**
