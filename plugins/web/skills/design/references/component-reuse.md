# Component Reuse Gate

Runs after the design contract is signed off and before the first component or
hook is implemented. Hard rule: do not write any component or hook until the
question battery below is answered.

## Detection (do first, so questions carry evidence)

- `package.json` dependencies: `@radix-ui/*`, `@mui/*`, `@chakra-ui/*`,
  `@mantine/*`, `@headlessui/*`, `@ark-ui/*`, `@base-ui/*`.
- `components.json` at the project root → shadcn/ui.
- Workspace packages: glob `packages/ui*/package.json`,
  `packages/components/package.json`.
- Existing pattern: inspect `src/components/ui/` — shadcn-style local copies
  vs thin wrappers vs direct library imports.

## The question battery

One use of the graphical or structured user-input capability, ≤4 questions, each with a stated safe default:

1. **Which component library?** Options: each detected candidate (the dominant
   one marked as default), "None — hand-rolled", "Other (specify)". If nothing
   was detected there is NO default; the user must choose.
2. **Which component architecture?** Options: "Local copies, shadcn-style (own
   the source)", "Thin wrappers around the library", "Headless primitives +
   house styling", "Library as-is + theme bridge only". Default: the detected
   existing pattern, named explicitly.
3. **Styling delivery?** Tailwind utilities + `@theme` / CSS Modules / plain
   CSS with `@layer components`. Default: the detected strategy. One strategy
   per project.

## Per-new-shareable-component question (during implementation)

- Restyling an EXISTING library component is never a new component: use a
  scoped CSS-variable override (`wt-override-01`) or slots/headless
  composition (`wt-override-02`). No forks, no branded props.
- A genuinely NEW component with a visible second consumer (`rps-promo-01`:
  promote on the second consumer, never on a guess): ask — "Patch the upstream
  shared library (`packages/ui` — `rps-ws-01`) or keep it local for now?"
  Options: patch upstream (default when a second consumer exists today), local
  now with a promotion follow-up noted in the active work design, or skip the component.
  Batch up to 4 such questions per call when several qualify.
- Single-consumer components stay at the lowest tier (`rps-layout-01`); record
  them in the active work design's component inventory with source `local`.

Standards: `plugins/react/standards/project-structure/rules/`
(`rps-promo-01`, `rps-layout-01`, `rps-ws-01`, `rps-ws-02`) and
`plugins/web/standards/theming/rules/` (`wt-override-01`,
`wt-override-02`).
