<!--
Section selection by archetype — delete the OSS-ONLY fences you don't need:
  - monorepo-internal package: remove ALL OSS-ONLY blocks
  - standalone OSS library: keep Hero, Quick Start, Why, Alternatives, FAQ, Troubleshooting, Contributing, Changelog, Security, License
  - OSS monorepo root: keep Hero, Philosophy, FAQ, Contributing, License; delegate per-package detail to sub-READMEs
  - CLI: keep Quick Start, FAQ, Troubleshooting
  - microservice: keep Quick Start, Env Vars, FAQ, Troubleshooting
  - data/iac: keep Env Vars, Architecture, Operations (internal shape); iac adds Troubleshooting
-->

# <project name from package.json>

<!-- OSS-ONLY START: Hero block -->
<!--
When to include: standalone OSS library OR OSS monorepo root. Skip for monorepo-internal packages, CLIs with no public landing page, and closed-source services.
Purpose: give first-time visitors a one-glance pitch, trust signals (badges), and a visual anchor before they scroll.
-->

> <one-sentence tagline — the elevator pitch. What is this, who is it for, why should they care?>

<p align="center">
  <a href="https://www.npmjs.com/package/<package-name>"><img src="https://img.shields.io/npm/v/<package-name>.svg" alt="npm version"></a>
  <a href="https://github.com/<org>/<repo>/actions"><img src="https://img.shields.io/github/actions/workflow/status/<org>/<repo>/ci.yml?branch=main" alt="CI"></a>
  <a href="https://codecov.io/gh/<org>/<repo>"><img src="https://img.shields.io/codecov/c/github/<org>/<repo>" alt="coverage"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/<package-name>.svg" alt="license"></a>
</p>

<p align="center">
  <!-- Hero image/diagram slot: screenshot, architecture sketch, or animated GIF demo. -->
  <img src="./docs/assets/hero.png" alt="<name> hero diagram" width="720">
</p>

<!-- OSS-ONLY END -->

<!--
SCOPE BANNER:
README = usage, examples, install, API. For how-it-works, link the durable architecture path.
Keep this file focused on what the consumer needs to *use* the package. Push
internal shape, data flow, and design rationale into `docs/architecture/<architecture-slug>.md`.
-->

<!--
README TEMPLATE INSTRUCTIONS:
This is a template for creating package README files. When creating a new README:
1. Replace all placeholder text (e.g., <package-name>, <description>) with actual content
2. Remove all instruction comments (HTML comments like this one)
3. Remove optional sections that don't apply to your package
4. Ensure all code examples are validated with TypeScript compiler

EMOJI USAGE GUIDELINES:
- Always use 📌 for the overview section
- Section headings use these standard emojis:
  - 💡 Core Concept (for conceptual explanation)
  - 🧰 Support Matrix (for feature/capability/runtime overview)
  - 🔑 Environment Variables (for configuration)
  - 🔗 Package Relationships
  - 📐 Architecture
  - 📖 Usage (for usage examples)
  - 📚 API Reference (for API documentation)
  - 📦 Related Packages
- Be consistent: either use emojis for all sections or none
- Don't mix emoji styles within the same README
-->

<br/>

📌 **First paragraph:** What problem does this package solve? What is this package for? Be specific and direct.

**Second paragraph:** What are the key features and unique selling points? How does this package fit into the broader ecosystem? What makes it different or useful?

<!--
Table of Contents — DISCIPLINE:
  • The link row itself must stay on ONE line (no wrapping of the bullet list).
  • Blank lines inside the centering `<div>` are REQUIRED for GitHub's markdown
    parser to render inline links — they do NOT count as multi-line.
  • **TOC budget**: Keep the TOC ≤110 **displayed** characters. Run
    `bun run scripts/toc_width.ts <file>` — it is authoritative. Key counts:
    `&emsp;` = 2, emoji/CJK = 2, `&nbsp;`/`&ensp;` = 1, `[caption](url)` drops
    to `caption` only. So `&emsp;&emsp;•&emsp;&emsp;` is 9 displayed chars
    (2+2+1+2+2), not 5. Exclude the `<div>` wrapper from the count; include
    the leading `•&emsp;&emsp;` and trailing `&emsp;&emsp;•`.
  • Prefer hard-to-spot / high-value anchors; skip anchors already obvious on
    first scroll (e.g. Quick Start at the top).
  • Shorten link captions only when the shorter form uses full English words
    and preserves full meaning. Never abbreviate (write `Architecture`, not
    `Arch`). Never drop meaning-bearing words (write `Quick Start`, not
    `Quick`). Valid shortenings collapse to a shorter synonym of equal
    meaning, e.g. `How to Deploy` → `Deployment`.
  • **Format**: Place emoji OUTSIDE the link brackets with one space:
    `💡 [Core Concept](#-core-concept)`. Never embed the emoji inside `[...]`
    — the link caption must be plain text only. Use `&emsp;&emsp;•&emsp;&emsp;`
    separators, leading `•&emsp;&emsp;` + trailing `&emsp;&emsp;•` wrap, with
    a centered `<div>` and a blank line on each side of the link row.

Sample block (copy & edit, stay under the 110 displayed-char budget):

  <div align="center">

  •&emsp;&emsp;💡 [Concept](#-concept)&emsp;&emsp;•&emsp;&emsp;📖 [Usage](#-usage)&emsp;&emsp;•&emsp;&emsp;📚 [API](#-api)&emsp;&emsp;•

  </div>
-->

<br/>
<div align="center">

•&emsp;&emsp;💡 [Concept](#-core-concept)&emsp;&emsp;•&emsp;&emsp;🔑 [Env](#-environment-variables)&emsp;&emsp;•&emsp;&emsp;🔗 [Deps](#-package-relationships)&emsp;&emsp;•&emsp;&emsp;🧰 [Matrix](#-capability-matrix)&emsp;&emsp;•&emsp;&emsp;📖 [Usage](#-usage)&emsp;&emsp;•&emsp;&emsp;📚 [API](#-api-reference)&emsp;&emsp;•

</div>
<br/>

---

<!-- OSS-ONLY START: Quick Start -->
<!--
When to include: anything a stranger installs from npm/PyPI/GitHub — standalone OSS library, CLI, microservice. Skip for monorepo-internal packages (consumers already know how to import siblings).
Purpose: get a reader from zero to first successful call in under 60 seconds.
-->

## ⚡ Quick Start

```bash
# install
npm install <package-name>
```

```ts
// first call — smallest possible happy path
import { <mainExport> } from '<package-name>';

const result = <mainExport>({ /* minimal required options */ });
console.log(result);
```

<One sentence describing what the reader just ran and where to go next (link to Usage or API Reference).>

---

<!-- OSS-ONLY END -->

<!-- OSS-ONLY START: Why <Name>? -->
<!--
When to include: standalone OSS library entering a crowded space where differentiation matters. Skip for monorepo-internal packages and obvious-purpose utilities.
Purpose: frame the Problem → Solution narrative so readers self-select in or out before investing time.
-->

## ✨ Why <Name>?

**The problem:** <1–2 sentences describing the pain that existing tools leave on the table.>

**The solution:** <1–2 sentences describing how this package removes that pain, and what design choice makes it possible.>

- **<Pillar 1>** — <why it matters in one line>
- **<Pillar 2>** — <why it matters in one line>
- **<Pillar 3>** — <why it matters in one line>

---

<!-- OSS-ONLY END -->

<!--
OPTIONAL: Include this section for packages that have a central abstraction, architectural pattern,
or non-obvious design that requires conceptual understanding to use effectively.

When to INCLUDE this section:
- Packages with specific architectural patterns (pipeline, factory, adapter, state machine)
- Packages with a central abstraction that unifies multiple components
- Packages where understanding the "why" significantly improves usage
- Packages with non-obvious design decisions that affect how consumers use them

When to SKIP this section:
- Simple utility libraries with self-explanatory APIs
- Component collections without unifying patterns
- Straightforward adapters or wrappers where the concept is obvious
- Packages where the overview already explains everything needed

Good examples of packages that benefit from Core Concept:
- Hypothetical request router: Explains middleware → handler → response flow
- Hypothetical scheduler: Would explain job lifecycle and execution model
- Hypothetical state-machine: Would explain state transition mechanics

Bad fits (skip this section):
- Hypothetical schema validator: The concept is self-evident
- Hypothetical key-value cache: A simple adapter pattern needs no conceptual overview
- Component libraries: Individual components are self-explanatory

STRUCTURE & CONTENT GUIDELINES:

1. **Open with the core abstraction** (1 sentence)
   - State the central pattern or abstraction using bold on key concepts
   - Focus on nouns/concepts, not verbs: "Every capability hangs off: **each endpoint is a thin wrapper around...**"
   - This anchors the reader's mental model

2. **Document the process flow** (if applicable)
   - Use numbered steps for sequential processes or pipelines
   - Bold verb phrases for phase names: "**Resolve the `Request`**"
   - Follow pattern: WHAT (bolded) → HOW/WHERE (parenthetical) → WHY (explanatory clause)
   - Example: "**Resolve the `Request`** (via `getRequest()`) so that security context is established"

3. **Explain component relationships**
   - Reference actual filenames/functions using `code formatting`
   - Show how main components support the core concept
   - Use bold for abstractions, `code` for identifiers

4. **Include practical guidance**
   - What developers should understand to use it correctly
   - Use imperative bullets: "Treat X as Y so that Z"
   - Provide immediate causal reasoning with connectors like "so that," "because"

5. **Connect to usage patterns**
   - Link the concept to practical implications: "This means you should..."
   - Show how understanding the concept affects usage

6. **Close by reinforcing the model**
   - Tie back to the opening concept
   - Show how all pieces connect: "With that mindset, the APIs simply..."

WRITING STYLE:

- **Match structure to content type**:
  - Sequential processes: numbered steps with bold verb phrases
  - Conceptual relationships: noun-first phrasing with bold abstractions
  - Prescriptive guidance: imperative bullets with causal reasoning

- **Layer detail progressively**: Each unit follows anchor → clarify → justify
  - Start with WHAT (bolded concept)
  - Add WHERE/HOW (parenthetical details)
  - Explain WHY (consequence/rationale in explanatory clauses)

- **Use formatting intentionally**:
  - **Bold** for concepts/phase names (what to remember)
  - `code` for identifiers (what to type/trace)
  - Causal connectors ("so that," "because") signal rationale

- **Be concise**: Aim for 2-4 paragraphs maximum (plus optional numbered steps)

Remember: This section explains the "why" and "how it works conceptually".
The API Reference covers "what functions exist". Usage shows "how to call them".
This bridges the gap by answering: "What's the key insight I need to understand this package's design?"
-->

## 💡 Core Concept

<Open with ONE sentence establishing the core abstraction, architectural pattern, or unifying idea.>

<OPTIONAL: If there's a process flow or pipeline, document it in numbered steps:>

The <process name> always runs in the same order:

1. **Phase One** (<reference to file/function>): What happens in this phase and why
2. **Phase Two** (<reference to file/function>): What happens in this phase and why
3. **Phase Three** (<reference to file/function>): What happens in this phase and why
<!-- Add more steps as needed -->

<2-3 paragraphs explaining the implications and practical guidance>

---

<!--
OPTIONAL: Include this section *only* if the package requires environment variables.
Place this section immediately after the Core Concept (or directly after the overview if the Core Concept section does not apply).
-->

## 🔑 Environment Variables

<Describe any environment variables this package uses or requires.>

The <package name> requires/uses the following environment variables:

- `ENV_VAR_NAME`: Description of what it does and when it's required

---

<!--
OPTIONAL: Include this section *only* if this package has important relationships with other packages.
Examples: runtime/service separation, packages that extend or build upon each other.
-->

## 🔗 Package Relationships

### <package-a> vs <package-b>

<Explain how this package relates to other packages. Be clear about:>
- When to use which package
- How they work together
- What responsibilities each has
- The relationship/dependency direction

### Usage by Other Packages

<Explain how other libraries in the ecosystem may use this package:>
- Common integration patterns
- What functionality this provides to dependent packages
- Examples of packages that depend on this one and why

---

<!--
OPTIONAL: Include this section for packages with multiple files/modules or
architectural patterns.

SEPARATION RULE: When durable architecture is also being generated, keep this
section to ≤8 lines total (one-line summary + depth-2 file-tree snippet +
link to its computed relative path). All diagrams, design patterns, invariants,
data flow, and extension points belong in durable architecture, not here.

If there is no durable architecture document, you may expand this section to include a
"Main Components" bullet list. But never duplicate ARCHITECTURE content.

SNIPPETS: Reusable Mermaid diagram snippets (dependency-graph,
architecture-flow, preset-composition) live in `references/snippets/`.
Copy the closest match and edit rather than hand-rolling a new diagram.
-->

## 📐 Architecture

<One sentence naming the architectural shape (pipeline, layered adapter, plugin host, …).>

```plain
src
├── <main-component-1>  # description of component
├── <main-component-2>  # description of component
└── index.ts            # main exports
```

See [the architecture guide](<relative-path-to-docs/architecture/<architecture-slug>.md>) for module topology, data flow, design patterns, and invariants.

---

<!--
OPTIONAL: 🧰 Support Matrix
Include ONLY if the package either (a) ships an `adapters/`, `plugins/`, `drivers/`,
or `providers/` directory (interchangeable implementations worth comparing), OR
(b) is a unified interface over multiple providers, OR (c) advertises runtime /
platform support that consumers need to verify (Node/Deno/Bun/browser).
Skip otherwise.

Pick ONE of the three shapes below that matches your package; delete the others.
Legend must use the exact emoji set below so automated audits can parse it.
-->

## 🧰 Support Matrix

<!-- Shape A: adapter/provider × feature matrix -->

| Adapter | Feature A | Feature B | Notes |
|---------|-----------|-----------|-------|
| <name>  | ✅        | ⚠️        | ...   |

Legend: ✅ supported &nbsp; ⚠️ partial &nbsp; ❌ unsupported &nbsp; 🔜 planned

<!-- Shape B: providers + supported actions
**Providers:** <Provider 1>, <Provider 2>, <Provider 3>

**Supported Actions:**

<div align="center">

| Action     | Description         |
| ---------- | ------------------- |
| <action 1> | <Short description> |

</div>
-->

<!-- Shape C: runtime / platform compatibility
| Runtime       | Supported | Notes                        |
| ------------- | --------- | ---------------------------- |
| Node.js ≥ 18  | ✓         | Native `AbortController`.    |
-->

---

## 📖 Usage

<Show several real-world usage examples with code snippets. Focus on common patterns and best practices.>

<Examples should demonstrate:>
- Most common use cases
- Important configuration options
- Integration with other packages
- Error handling patterns (where relevant)

```ts
import { mainExport } from '@scope/<package-name>';

// clear, practical example
```

---

<!--
IMPORTANT: All code examples in this section MUST be valid TypeScript that can be verified
by the TypeScript compiler. Before adding examples:

1. Create a temporary .ts file in your package
2. Copy the example code into it
3. Run `tsc --noEmit <temp-file>.ts` to verify it compiles
4. Only include examples that pass TypeScript compilation
5. Delete the temporary file after verification

CODE STYLE:
- All comments (code and file tree) start with lowercase
- File tree comments: align vertically with 2 spaces after the longest path **within each directory level**
  - Calculate alignment separately for each directory level (top-level, subdirectory entries, etc.)
  - Do NOT align globally across the entire tree
- Exception: proper nouns, acronyms, code identifiers

**File Tree Alignment Example:**
```plain
src
├── adapters   # top-level: all aligned 2 spaces after longest (utilities)
├── schemas    # top-level: aligned with other top-level entries
│   ├── cache.ts         # schemas level: all aligned 2 spaces after longest (verylongname.ts)
│   ├── service.ts       # schemas level: aligned with siblings
│   └── verylongname.ts  # schemas level: this is the longest, dictates alignment
├── utilities  # top-level: this is the longest, dictates alignment
└── index.ts   # top-level: aligned with other top-level entries
```

**Folder Notation Rule:** Never use trailing `/` on directory names. Write `src/components`, not `src/components/`. Applies to TOCs, tree fences, component refs, and prose references.

This ensures examples remain accurate and useful as the package evolves.
-->

### Example: <Realistic Use Case Title>

<Describe the scenario this example addresses. What real-world problem does it solve?>

```ts
// complete, working example that combines multiple features
// must be valid TypeScript that compiles without errors
import { feature1, feature2 } from '@scope/<package-name>';

// show imports, setup, execution, and result handling
```

### Example: <Another Use Case>

<Another realistic scenario with complete working code>

```ts
// another validated TypeScript example
```

---

## 📚 API Reference

<!--
Organization guidelines:
- If there are many exports, group them by logical section (e.g., "Core Functions", "Utility Functions", "Type Definitions")
- For each group, use a heading (###) then collapsible details for each API
- If your library is small (< 10 exports), you may omit grouping and just use collapsible details
- Always include examples for each API function
-->

### <Section Name 1>

<details>
<summary><code>functionName(param1: Type1, param2: Type2): ReturnType</code></summary>

**Description:**
<One or two sentences describing what this function/class/type does and when to use it.>

**Parameters:**

- `param1` (`Type1`): Clear description of the parameter, including any constraints or special values
- `param2` (`Type2`): Description with examples of valid values if helpful
<!-- Repeat for each parameter -->

**Returns:**

- `ReturnType`: Description of what is returned, including structure for objects

**Throws:** <!-- Optional: include if the function can throw errors -->

- `ErrorType`: When and why this error is thrown
<!-- Repeat for each error type -->

**Example:**

```ts
// practical example showing typical usage
import { functionName } from '@scope/<package-name>';

const result = functionName(value1, value2);
// result: expected output
```

**Type Signature:** <!-- Optional: for complex generic types -->

```ts
function functionName<T extends Constraint>(
  param1: Type1,
  param2: Type2,
): ReturnType<T>;
```

</details>

<!-- Repeat the above structure for each API in the section -->

### <Section Name 2>

<!-- Additional grouped APIs, if applicable -->

---

<!-- OSS-ONLY START: Advanced -->
<!--
When to include: any package with non-trivial extension points, performance footguns, or edge-case behaviour readers will hit in production. Skip for tiny utilities whose surface is fully covered by API Reference.
Purpose: collect gotchas and power-user knobs so advanced users don't have to spelunk the source.
-->

## 🏗️ Advanced

### Extension points

- **<extension hook 1>** — <how to plug in custom behaviour and why you would>
- **<extension hook 2>** — <same>

### Gotchas

- **<gotcha 1>** — <the surprising behaviour, the rationale, the workaround>
- **<gotcha 2>** — <same>

### Performance notes

<When it matters, which options trade latency for memory, which operations are O(n) vs O(1), etc.>

---

<!-- OSS-ONLY END -->

<!-- OSS-ONLY START: Alternatives -->
<!--
When to include: standalone OSS library in a well-populated category where readers will (and should) compare. Skip for monorepo-internal packages and niche tools with no peers.
Purpose: honest side-by-side so readers pick the right tool — builds trust even when the answer isn't "us."
-->

## ⚔️ Alternatives

| Project            | Strengths                           | Trade-offs                          | Pick it when                        |
| ------------------ | ----------------------------------- | ----------------------------------- | ----------------------------------- |
| **<this package>** | <what we do best>                   | <what we give up>                   | <the reader's situation>            |
| <alternative 1>    | <what they do best>                 | <where they struggle>               | <the reader's situation>            |
| <alternative 2>    | <what they do best>                 | <where they struggle>               | <the reader's situation>            |

---

<!-- OSS-ONLY END -->

<!-- OSS-ONLY START: Ecosystem -->
<!--
When to include: standalone OSS library that ships (or plays with) companion packages, plugins, adapters, or templates. Skip for solo packages.
Purpose: help readers discover the full surface and integrations.
-->

## 🔌 Ecosystem

- [`<companion-package-1>`](<link>) — <one-line relationship>
- [`<companion-package-2>`](<link>) — <one-line relationship>
- [`<community-plugin>`](<link>) — <one-line relationship, mark community vs official>

---

<!-- OSS-ONLY END -->

## 📦 Related Packages

<!--
ALWAYS include this section. List packages that:
- This package depends on
- Work well with this package
- Are commonly used together
- Provide complementary functionality

Use relative links to other packages in the monorepo.
-->

- [`@scope/<related-package-1>`](../<related-package-1>): Brief description of relationship
- [`@scope/<related-package-2>`](../<related-package-2>): How it relates to this package
<!-- Add more as needed -->

---

<!-- OSS-ONLY START: FAQ -->
<!--
When to include: standalone OSS library, CLI, microservice, or any package that gets repeat questions in issues/Discord. Skip for monorepo-internal packages.
Purpose: pre-empt the top 3–7 recurring misconceptions so issues stay focused on real bugs.
-->

## ❓ FAQ

<details>
<summary><strong><Common question 1 that readers actually ask?></strong></summary>

<Short, direct answer. Link to the relevant section/API if deeper reading helps.>

</details>

<details>
<summary><strong><Common question 2?></strong></summary>

<Short, direct answer.>

</details>

<details>
<summary><strong><Common question 3?></strong></summary>

<Short, direct answer.>

</details>

---

<!-- OSS-ONLY END -->

<!-- OSS-ONLY START: Troubleshooting -->
<!--
When to include: standalone OSS library, CLI, iac, or microservice with known friction points (install, env, permissions, version skew). Skip for pure in-process libraries with no side effects.
Purpose: give readers a first-line checklist before they open an issue.
-->

## 🛠️ Troubleshooting

### <Symptom 1: short description of what the reader sees>

**Cause:** <what actually triggers this>
**Fix:** <concrete steps or config change>

### <Symptom 2>

**Cause:** <what actually triggers this>
**Fix:** <concrete steps or config change>

### Still stuck?

Open an issue with the output of `<diagnostic command>` and your <runtime/version info>.

---

<!-- OSS-ONLY END -->

<!-- OSS-ONLY START: Philosophy -->
<!--
When to include: flagship OSS projects and OSS monorepo roots where values/trade-offs shape the whole ecosystem. Skip for individual packages — link up to the root instead.
Purpose: make the project's non-negotiables legible so contributors and users can align (or self-select out).
-->

## 🌟 Philosophy

- **<Principle 1>** — <the value, and the trade-off it forces>
- **<Principle 2>** — <same>
- **<Principle 3>** — <same>

<Optional closing paragraph tying the principles back to concrete design decisions readers will encounter.>

---

<!-- OSS-ONLY END -->

<!-- OSS-ONLY START: Contributing -->
<!--
When to include: any OSS package that accepts external contributions. Skip for monorepo-internal packages (the monorepo root handles this).
Purpose: point contributors to the canonical `contributing.md` instead of duplicating it here.
-->

## 🤝 Contributing

Contributions are welcome. See [`contributing.md`](./contributing.md) for the dev setup, branching model, and review process.

---

<!-- OSS-ONLY END -->

<!-- OSS-ONLY START: Changelog -->
<!--
When to include: any OSS package published to a registry. Skip for monorepo-internal packages without independent release cadence.
Purpose: single link to the canonical change history.
-->

## 📜 Changelog

See [`changelog.md`](./changelog.md) for the full release history.

---

<!-- OSS-ONLY END -->

<!-- OSS-ONLY START: Security -->
<!--
When to include: any OSS package that handles untrusted input, credentials, network IO, or runs in a security-sensitive context. Skip for pure-math utilities or presentation-only libraries.
Purpose: tell reporters where to disclose privately instead of filing a public issue.
-->

## 🛡️ Security

Please report vulnerabilities via the process in [`security.md`](./security.md). Do not open public issues for security reports.

---

<!-- OSS-ONLY END -->

<!-- OSS-ONLY START: License -->
<!--
When to include: standalone OSS library or OSS monorepo root. Skip for monorepo-internal packages (covered at monorepo level).
Purpose: state the license plainly at the end of the README, as readers expect.
-->

## 📄 License

<SPDX identifier, e.g. `MIT`> © <year> <copyright holder>. See [`license`](./license) for the full text.

<!-- OSS-ONLY END -->

<!--
FOOTER NOTES:
- DO NOT include a "License" section (handled at monorepo level)
- DO NOT include a "Contributing" section (handled at monorepo level)
- DO NOT include installation instructions (users should refer to monorepo docs)
- Keep the footer minimal and focused on navigation
-->
