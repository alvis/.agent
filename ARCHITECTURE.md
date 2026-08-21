# Scanner architecture

The coding plugin ships an advisory scanner that finds mechanically recognizable review candidates before semantic lint or code review. It never decides that code violates a standard: candidate counts do not affect the status of a completed scan, and a human or reviewing agent must confirm each candidate against the referenced rule guide.

## Components

```text
plugins/coding/scripts/
├── scan_potential_violations.ts  # stable command-line entry point
├── scanlib                      # discovery, file selection, execution, and rendering
│   ├── core.ts                  # command-line contract and scan pipeline
│   ├── jsdoc.ts                 # shared JSDoc token and prose extraction
│   ├── loader.ts                # automatic RULE and RULES module discovery
│   ├── predicates.ts            # reusable file applicability gates
│   ├── prefixes.ts              # live standard rule-prefix discovery
│   └── rule.ts                  # scanner extension interface
└── scanners                     # one independently loadable module per candidate rule
```

- **Command-line entry point** (`plugins/coding/scripts/scan_potential_violations.ts`): imports the shared engine and returns its status.
- **Engine** (`plugins/coding/scripts/scanlib/core.ts`): parses arguments, walks supported source files, applies rules, and renders contextual matches plus a summary.
- **Loader** (`plugins/coding/scripts/scanlib/loader.ts`): imports every public module under `scanners` and isolates a broken module so one extension cannot disable the advisory pass.
- **Predicates** (`plugins/coding/scripts/scanlib/predicates.ts`): centralizes language, test, index, and suffix selection.
- **Rule modules** (`plugins/coding/scripts/scanners/*.ts`): recognize one mechanically detectable candidate shape and append `Match` values.
- **Test suite** (`plugins/coding/scripts/scan_potential_violations.spec.ts`): exercises rule behavior directly and uses golden fixtures where the rendered command-line interface is the behavior under test.

## Pipeline

```mermaid
flowchart LR
    Caller[Lint or review workflow] --> CLI[scan_potential_violations.ts]
    CLI --> Engine[scanlib.core.run]
    Engine --> Loader[loadRules]
    Loader --> Modules[scanners modules]
    Engine --> Files[iterFiles]
    Files --> Predicate[Rule appliesTo]
    Predicate --> Scanner[Rule scan]
    Scanner --> Matches[Match candidates]
    Matches --> Renderer[Context and summary renderer]
    Renderer --> Reviewer[Human or reviewing agent]
    Reviewer --> Decision{Confirmed against rule guide?}
    Decision -->|Yes| Finding[Violation finding]
    Decision -->|No| Dismissed[Candidate dismissed]
```

Candidate generation and violation decisions are deliberately separate. A scanner may trade precision for recall when its label and rule guide make the review requirement explicit. For example, the `TST-CORE-10` scanner flags static file reads in test files because they often precede assertions over checked-in prose; reading a generated output file can be valid and must be dismissed after review.

## Invocation lifecycle

```mermaid
sequenceDiagram
    participant Caller
    participant Engine as scanlib.core
    participant Loader as scanlib.loader
    participant Rule as scanner Rule
    participant Reviewer

    Caller->>Engine: paths, category, context widths
    Engine->>Loader: loadRules()
    Loader-->>Engine: rules sorted by order and id
    loop Each supported file and applicable rule
        Engine->>Rule: scan(path, lines, matches)
        Rule-->>Engine: append zero or more Match values
    end
    Engine-->>Caller: contextual report and exit 0
    Caller->>Reviewer: candidates and referenced standards
    Reviewer-->>Caller: confirmed findings or dismissals
```

## Extension interfaces

Every scanner module exports `RULE` or `RULES`. The loader discovers modules automatically, so adding a scanner requires no dispatcher edit.

```typescript
export const RULE: Rule = {
  id: "stable-category-name",
  label: "Reviewer-facing candidate label",
  scan,
  order: 100,
  appliesTo: candidateFiles,
  ruleRefs: ["TST-CORE-10"],
};
```

The interfaces are:

| Interface | Contract |
|---|---|
| `Rule.id` | Unique stable command-line category |
| `Rule.label` | Heading that describes the candidate without prejudging it |
| `Rule.scan` | Callable receiving `path`, complete `lines`, and a mutable `matches` list |
| `Rule.order` | Deterministic report ordering; ties resolve by ID |
| `Rule.appliesTo` | Path predicate evaluated before the file is read for that rule |
| `Rule.honorNoTests` | Whether `--no-tests` suppresses the rule for spec files |
| `Rule.ruleRefs` | Traceability to standards; metadata only, never an engine verdict |
| `Match` | Immutable `path`, one-based `lineno`, and source `line` rendered with context |

`scan` functions must not edit files, execute project code, or raise findings. They append candidates only. The engine catches file-read errors, isolates module import failures, and returns zero after a completed scan regardless of its match count. Invalid arguments and other operational failures remain errors.

## Command-line contract

```text
bun run scan_potential_violations.ts [paths ...]
  [--category all|<rule-id>]
  [--before <lines>]
  [--after <lines>]
  [--no-tests]
```

Paths may name files or directories. The engine scans supported JavaScript, TypeScript, Python, and Rust suffixes while excluding generated, dependency, cache, coverage, and version-control directories. Output is grouped by rule, includes source context, and ends with match and file counts.

## Adding a scanner

1. Add one kebab-case TypeScript module under `plugins/coding/scripts/scanners` that exports a `Rule`.
2. Reuse or add a narrow predicate in `plugins/coding/scripts/scanlib/predicates.ts`.
3. Test candidates as structured `Match` values. Add a golden fixture only when changing the rendered command-line interface itself.
4. Reference the owning standard in `ruleRefs` and list the rule as scanner-backed in its `scan.md`.
5. Run the scanner spec, then the fixture-excluded repository suite — both with the Vitest command canonicalized in the Validation section of the root `AGENTS.md`.

Prefer a mechanical signal that is cheap to explain and verify. If recognizing the condition requires semantic interpretation, keep that decision in review rather than encoding a brittle verdict in the scanner.
