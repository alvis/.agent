---
name: discover
description: "Discovers material unknowns before planning. Use for a blindspot pass or unknown unknowns, to brainstorm approaches from cheapest to ambitious, interview about architecture, extract reference implementation semantics, make a disposable prototype before touching the real app, or check whether discovery is ready for a decision; researched option selection belongs to essential:decide."
requirements:
  intelligence: high
argument-hint: "<problem> [--mode=blindspots|options|interview|reference|prototype|readiness] [--persist] [--work-id=<id>]"
---

# Discover

Reduce consequential uncertainty before it becomes an implementation
assumption. This skill owns divergent exploration and a decision-ready evidence
ledger; `essential:decide` owns converging on one approach, domain skills own
production artifacts, and implementing skills own application-source changes.

## Boundaries

- Use for: explicit "blindspot pass" or "unknown unknowns" requests,
  unfamiliar code or domains, broad solution brainstorming, preferences the
  user can recognize but not yet articulate, extracting semantics from a
  reference, disposable prototypes, and readiness checks before planning.
- Do not use for: fact-finding reports (`essential:deep-research`), metric-driven
  optimization (`essential:autoresearch`), choosing among already-grounded
  options (`essential:decide`), production UI design (`web:design`), or clear
  bounded implementation.
- Never claim an unknown unknown has been found merely because it is plausible;
  record it as a hypothesis until evidence supports it.

## Inputs and output

- **Required**: the problem, goal, or artifact to explore.
- **Optional**: `--mode`; `--persist`; explicit `--work-id`; the user's
  experience, confidence, references, hard constraints, and known unanswered
  questions.

Before creating or materially rewriting a project artifact, read the absolute
`state.md` path injected by Essential. If unavailable, stop artifact
writes and report the missing contract. Resolve the active work directory from
that contract. A direct persistent run passes `--work-id` to the resolver only
when the user supplied that explicit override; otherwise accept automatic
existing-work selection and ask only on `work_id_required`. The PM performs the
contract's ignore gate and no-clobber bootstrap before the first persistent
artifact.

Default to a conversational result. With `--persist` or a long-lived task,
write the ledger to `state/discovery.md`; each material finding also earns one
appended `state/journal.md` line from the coordinator-lease holder (a worker
returns the line as a reconciliation delta instead of appending it). Keep requested disposable prototypes
under `artifacts/prototypes/<semantic-slug>/` and copied or summarized source
material under `artifacts/discovery/`. Never modify application source.

For persistent discovery, follow `state-format.md` linked by the
state contract. Register one `DSC` parent and every discovery leaf
in root `state.md` before writing the child. Keep the root as the complete task
registry and make `state/discovery.md` a reconciled child mirror with:

- `State role: child`, the resolved work ID, lifecycle status, and
  `Parent task: DSC`;
- `## Status` with the derived topology and local graph;
- `## Tasks` with the canonical marked table and full `DSC01` IDs; and
- the evidence ledger below as a separate section, never as task status.

Use `DSC01 → {DSC02,DSC03} → DSC04` when the work maps to capture,
independent intent/system probes, then synthesis. Otherwise encode the smallest
truthful linear or branching sibling DAG; never force this example onto a
different dependency shape. Root and child rows use the same immutable
definition and mutable execution fields byte-for-byte at reconciliation. After
each status transition, update the child, reconcile the complete root registry,
re-read the root task definitions when immutable definition fields changed,
and read `state.md` and `state/discovery.md` directly to determine runnable/
blocked tasks, owner, and next action from the task table; proceed on that
reading — there is no separate validation step. Only the coordinator-lease
holder edits root state.

When structured comparison, explanation, or preference capture would be easier
to understand interactively, follow [presentation](references/presentation.md).
Generated HTML is a temporary review surface, not a durable deliverable: always
create it in a collision-safe OS temporary directory and discard it after its
decisions and annotations have been transferred. A persisted discovery ledger
may record the temporary path and extracted decisions, but must not treat the
HTML as long-lived evidence.

The evidence ledger uses these fields:

| ID  | Kind | Statement | Source or evidence | Decision impact | Reversibility | Disposition | Owner |
| --- | ---- | --------- | ------------------ | --------------- | ------------- | ----------- | ----- |

`Kind` is one of `intent`, `observed`, `inference`, `unknown`, or `assumption`.
An accepted assumption must be low-impact, reversible, and have a recheck
trigger. A material unknown must be resolved, explicitly deferred with an
owner, or marked blocking.

## Workflow

1. **Capture the starting map.** State the goal, requested deliverable, why it
   matters, what the user already knows, their familiarity with the codebase or domain,
   known questions, hard constraints, and supplied references. Ask only when a
   missing answer changes which discovery mode is appropriate.
2. **Resolve exactly one mode.** An explicit valid `--mode` wins; otherwise use:
   - `blindspots`: missing constraints, failure modes, history, or integration
     surfaces may change the problem;
   - `options`: the problem is understood but the solution space is too narrow
     or too broad;
   - `interview`: the user holds material intent or preferences not yet stated;
   - `reference`: a codebase, document, site, image, or example defines the
     desired semantics more precisely than prose;
   - `prototype`: the cheapest way to learn is a disposable artifact and the
     user has authorized creating it;
   - `readiness`: existing evidence needs a plan/implementation go-no-go check.
3. **Load only the selected mode reference** and execute it:
   - [blindspots](references/blindspots.md)
   - [options](references/options.md)
   - [interview](references/interview.md)
   - [reference](references/reference.md)
   - [prototype](references/prototype.md)
   - [readiness](references/readiness.md)
4. **Update the ledger.** Preserve provenance. Move an item between kinds only
   when evidence or a user decision justifies it; do not collapse inference into
   observed fact. Record rejected alternatives and why they were rejected when
   they would otherwise be rediscovered.
5. **Choose the next probe or stop.** Continue only when another cheap probe can
   resolve a material unknown. Stop when all material items are resolved,
   explicitly deferred with an owner, or blocking; remaining assumptions must
   be low-impact and reversible.
6. **Route the result.** Recommend exactly one next owner: another discovery
   mode, `essential:decide`, `specification:spec-code`,
   `specification:plan-code`, `web:design`, an implementing skill, or stop. Pass
   the evidence ledger and artifact paths without rewriting them as certainty.
7. **Present interactive results when useful.** If presentation criteria are
   met, choose the most suitable directional action from the presentation
   reference (including the plan/implementation/change lifecycle actions).
   Never hand-write artifact HTML from scratch: copy the committed starter
   scaffold `templates/src/page/` into the session workspace, then fill its
   `{{PLACEHOLDER}}` tokens and add, edit, reorder, or remove `sections/` files
   to fit the action. Before composing:
   - **Check `references/features.md`** — the Floor features are mandatory;
     the Menu is a shelf of proven devices, never a completeness requirement.
   - **Build a coverage map**: list every ledger finding, unknown, stream, and
     decision, and assign each to a section. Content that fits no catalog
     pattern gets a free-pattern section — never drop ledger content to
     satisfy the catalog.
   - **Theme the board**: fill `{{PRODUCT_NAME}}`, pick a per-board accent
     (companion boards get distinct accents from the shell's own families),
     and map the board's domain states onto the semantic ramps
     (`--ui-verdict-*`, `--ui-status-*`, `--ui-k-*`) via the
     `<style data-board-theme>` overlay — whitelisted tokens only, light and
     dark values both.
   - **Design freely above the floor.** Layout, section shapes, devices, and
     interactions are yours to design for the content at hand — approach it
     like a design lead, not a form-filler. Bespoke section CSS/JS is welcome
     as long as it styles through the `--ui-*` tokens and keeps the floor
     (shell, annotation, per-card capture, single generated prompt, dual
     theme, a11y, self-containment). Where a card carries a real decision
     with alternatives, render the option set with reasons and a badged
     recommendation — never a bare accept.
   Then compose and compile a self-contained file with
   `scripts/build-artifact.ts`; sources carry no asset links, so the compiled
   file is what gets opened. Present it in preference order: the LLM
   environment's built-in local HTML viewer, then a safe cloud artifact viewer,
   then a local browser such as Chrome. Capture the user's answers and section
   annotations in the page's single generated prompt and transfer them back to
   the ledger.
8. Run the verification below. Fix a failed check and repeat until it passes or
   a concrete blocker remains.

## Verification

- Every consequential claim is labeled and carries evidence or an explicit
  user source; hypotheses are not reported as facts.
- No application source changed. Every prototype is visibly disposable;
  non-HTML prototypes are contained inside the active work's artifacts directory
  and generated HTML is contained inside a collision-safe OS temporary directory.
- Every material unknown has a disposition and owner; every accepted assumption
  is low-impact, reversible, and has a recheck trigger.
- The recommended next owner receives the ledger and all artifact paths.
- Any HTML result is stored under the OS temporary root, supports annotation of
  every user-facing section, and exposes exactly one live prompt intended for
  replying to the LLM coder.
- Parity self-check against the ledger: every finding, unknown, stream, and
  decision appears on the board or in an explicit scope-cuts note — nothing
  silently dropped. Every recommendation-bearing card captures a response
  (options with a badged recommendation where alternatives exist; accept
  otherwise; note everywhere), and each response feeds the generated prompt.
  Walk the Floor checklist in `references/features.md` before shipping.
- Validate the Essential plugin and run repository policy plus trigger checks.

## Completion

Report the selected mode, starting point, material unknowns found or resolved,
accepted assumptions, decisions and rejected alternatives, persistent workspace
when any, readiness verdict (`ready`, `more-discovery`, or `blocked`), and the
single recommended next owner. Return explicit final paths generated or
materially rewritten as `generated_files`; the PM reconciles overviews and runs
the size pass only for eligible work Markdown inside the target
`.state/`. Runtime trigger behavior is reported as exercised only when an
executable evaluation actually ran.
