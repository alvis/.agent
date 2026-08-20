---
name: next
description: "Diagnose Next.js runtime behavior with next-browser and Chrome DevTools MCP: React components, routes, SSR errors, DOM/styles, performance, Lighthouse, network, device emulation, JavaScript debugging, storage, screenshots, and interactions. Use for evidence-backed browser diagnosis; route visual creation to design and story-state assessment to storybook."
requirements:
  intelligence: high
argument-hint: "[debug instruction or URL]"
---

# Next.js debugging

Debug and inspect Next.js applications by combining Chrome DevTools MCP and the next-browser CLI. Chrome DevTools opens the browser page (foundation layer); next-browser connects via CDP port on top of it; each tool handles what it is best at. This skill owns runtime diagnosis; `design` owns visual creation, `audit` owns independent design assessment, `storybook` owns story-state auditing.

## Boundaries

- Use for: inspecting DOM, computed styles, or the accessibility tree; debugging React component trees, props, and state; analyzing console messages and errors; profiling performance and memory; Lighthouse audits; network monitoring; device emulation; screenshots and visual comparisons; cookies and web storage; and Next.js routes, server actions, and SSR behavior.
- Do not use for: creating or iterating UI visuals (`design`), independent design QA (`audit`), or Storybook story audits (`storybook`).

## Inputs

- **Required**: a debug instruction or a target URL.
- **Optional**: scope hints — routes, components, or files implicated by the issue.
- **Prerequisites**: a Next.js project whose dev server is running or startable with `npm run dev`; Chrome DevTools MCP (configured via the plugin's `.mcp.json`, available automatically); the `next-browser` CLI installed globally or via `npx`.

## Workflow

1. Set up the shared session: start the dev server if not running (or detect a running server on the expected port), open the target URL with Chrome DevTools `navigate_page` — this launches the controllable browser instance — then connect next-browser with `next-browser open <url>` via the CDP port. Verify both tools share the same browser session.
2. Classify the instruction into a routing category and pick the primary tool:

   | Category | Primary tool |
   |---|---|
   | Page opening | Chrome DevTools `navigate_page` (foundation; next-browser `open`/`goto` for subsequent navigation) |
   | DOM & styles | Chrome DevTools `evaluate_script`, `take_snapshot` |
   | React components | next-browser `tree`, `tree <id>` (exclusive — no Chrome DevTools equivalent) |
   | Console & errors | next-browser `errors`, `logs` (parses the Next.js error overlay) |
   | Performance | Chrome DevTools `performance_start_trace`, `performance_stop_trace`, `take_memory_snapshot` (exclusive) |
   | Lighthouse | Chrome DevTools `lighthouse_audit` (exclusive) |
   | Network | Chrome DevTools `list_network_requests` |
   | Screenshots | next-browser `screenshot`, `preview` |
   | Device emulation | Chrome DevTools `emulate`, `resize_page` (named device profiles with UA, DPR, screen dimensions) |
   | User interaction | next-browser `click`, `type`; Chrome DevTools for drag, file upload, dialogs, checkboxes, dropdowns |
   | Storage | Chrome DevTools `evaluate_script` for localStorage/sessionStorage/cookies (exclusive) |
   | Next.js specific | next-browser `routes`/`page`/`project`, `action <id>`, `ssr lock`/`ssr unlock` (all exclusive) |
   | JS debugging | Chrome DevTools breakpoints, stepping, `evaluate_script` (exclusive) |
   | Accessibility tree | either Chrome DevTools `take_snapshot` or next-browser `snapshot` — use whichever is already active |

   Fallback order, per-category rationale, and multi-step recipes (slow page, broken component render, mobile layout, failed API call, SSR inspection): see [references/tool-routing.md](references/tool-routing.md). Full tool inventories: [references/chrome-devtools-tools.md](references/chrome-devtools-tools.md) and [references/next-browser-commands.md](references/next-browser-commands.md).
3. Execute with the primary tool; fall back to the secondary when the primary is unavailable or insufficient.
4. Analyze and summarize findings with evidence. If code fixes are needed,
   provide file paths and specific changes. Apply or dispatch repairs only when
   the agent invoking this skill already owns implementation for the affected
   files. Otherwise hand the evidence and proposed changes to
   `frontend-implementer` (or the documented implementation owner) and do not
   edit production source. An implementation-owning invoker may use
   [references/implementation-team.md](references/implementation-team.md) for a
   multi-file repair.
5. When this skill creates or modifies any visible page or component, integrate design quality:
   - Invoke the `design` skill first for all visual decisions — layout, color, typography, spacing, animation. Do not implement UI without it; it iterates in a browser feedback loop toward 10/10 in all 12 design categories, within its own rework budget, and reports whatever still falls short as a residual gap for confirmation.
   - After implementation, spawn a subagent to run the `audit` skill on the affected URL/component; it checks compliance against the web plugin's `standards/design/scan.md`. P0 and P1 findings block UI completion unless closed under the canonical [audit disposition rules](../audit/references/review-template.md): a non-fixed closure requires explicit risk-acceptance authority, an accountable owner, non-placeholder rationale, durable acceptance evidence, and a concrete recheck condition. P2 and P3 are ranked follow-up, and info is advisory.
   - Consult the web plugin's `standards/design/write.md` for the spacing scale (4px/8px grid), type scale (1.25 ratio), color palette construction, component state requirements (loading/empty/error/success/permission), and token usage.
6. If the issue is not resolved, try the fallback tool or a different approach and loop back to step 3.
7. When done, optionally close skill-opened sessions with `next-browser close`; never close a browser session owned by another skill.
8. Run the verification below; when a check fails, fix the cause and re-run that check. Repeat until every check passes or a concrete blocker remains, then report the blocker instead of looping.

## Verification

- Every diagnostic claim cites tool evidence (trace, snapshot, log, request, or screenshot), not inference alone.
- Exclusive capabilities were routed to their owning tool per the table above.
- For UI-creating or UI-modifying work: the design skill ran first and the audit subagent reported no outstanding P0/P1 findings under the canonical disposition rules.
- Any dispatched implementation team was deleted and its reviewed slices accounted for.
- Session teardown honored ownership.

## Completion

Report the diagnosis with supporting evidence, the tools used per category, recommended or applied fixes with file paths and specific changes, audit results for UI work, and any unresolved issues or blocked prerequisites (dev server, browser, or next-browser CLI unavailable).
