import { accessSync, constants, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { HARNESS_ROOT_VARIABLES, PLUGIN_ROOT_ANCHOR, PLUGIN_ROOT_GUARD } from "../../../scripts/harness_contract.ts";

const plugin = resolve(fileURLToPath(new URL("..", import.meta.url)));
const hooks = JSON.parse(readFileSync(resolve(plugin, "hooks/hooks.json"), "utf8")) as { hooks: { PreToolUse: Array<{ matcher: string; hooks: Array<{ command: string }> }> } };
const questions = "AskUserQuestion|request_user_input";
const plans = "ExitPlanMode|update_plan";
const dispatch = "Agent|spawn_agent";
const matchers = [questions, plans, dispatch] as const;
const validTags = ["Architectural", "Ideal", "Recommended", "Pragmatic", "Hotfix", "Workaround"] as const;
const teammate = "raj-tech-lead-fix-auth";
const compliantPlan = `# Enforce the documented formats

## Goal

One verifiable outcome and the bar that proves it.

## Requirements

- An observable condition the outcome must satisfy.

## Boundary

Inside: the three hook scripts. Outside: content heuristics.

## Direction

Write each check as a bash script, then swap the command entries.

## Context

- **Current state** — nothing implemented yet.
`;
const compliantPrompt = `checkout-refunds

Goal: Restore refund totals so the ledger reconciles to the cent.

Requirements:
- Every refund path reconciles against the ledger fixture.

Boundary:
- Do not touch the payment capture path.

Directions:
- The rounding helper is the likely culprit.

Context:
Path: /work/checkout-refunds

Recent work:
- Parser migration landed; consumer conversion remains — state/journal.md
`;

interface HookOutput { readonly additionalContext?: string; readonly permissionDecision?: string; readonly permissionDecisionReason?: string }

function commandFor(matcher: string): string {
  const entries = hooks.hooks.PreToolUse.filter((entry) => entry.matcher === matcher);
  expect(entries, matcher).toHaveLength(1);
  return entries[0]!.hooks[0]!.command;
}

function harnessEnvironment(variable: string): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of HARNESS_ROOT_VARIABLES) delete environment[name];
  environment[variable] = plugin;
  return environment;
}

function runHook(matcher: string, toolInput: Record<string, unknown>, variable = "CLAUDE_PLUGIN_ROOT"): HookOutput {
  const completed = spawnSync("bash", ["-c", commandFor(matcher)], { encoding: "utf8", env: harnessEnvironment(variable), input: JSON.stringify({ tool_input: toolInput }) });
  expect(completed.status, completed.stderr).toBe(0);
  return (JSON.parse(completed.stdout) as { hookSpecificOutput: HookOutput }).hookSpecificOutput;
}

function expectAllowed(output: HookOutput): void {
  expect(output.permissionDecision).toBeUndefined();
  expect(output.additionalContext).toBeTruthy();
}

function denialReason(output: HookOutput): string {
  expect(output.permissionDecision).toBe("deny");
  expect(output.additionalContext).toBeUndefined();
  expect(output.permissionDecisionReason).toBeTypeOf("string");
  return output.permissionDecisionReason!;
}

function question(...options: Array<Record<string, string>>): Record<string, unknown> {
  return { questions: [{ header: "Route", multiSelect: false, options, question: "Which route should we take?" }] };
}

describe("PreToolUse hook wiring", () => {
  it("should run an executable validator script for every matcher", () => {
    for (const matcher of matchers) {
      const command = commandFor(matcher);
      expect(command.startsWith(PLUGIN_ROOT_GUARD)).toBe(true);
      const invocation = command.slice(PLUGIN_ROOT_GUARD.length);
      expect(invocation.startsWith(`"${PLUGIN_ROOT_ANCHOR}/hooks/scripts/validate-`)).toBe(true);
      expect(invocation.endsWith('"')).toBe(true);
      const script = resolve(plugin, invocation.slice(1, -1).replace(`${PLUGIN_ROOT_ANCHOR}/`, ""));
      expect(() => accessSync(script, constants.X_OK)).not.toThrow();
    }
  });

  it.each(matchers.flatMap((matcher) => HARNESS_ROOT_VARIABLES.map((variable) => [matcher, variable] as const)))("should resolve %s with %s", (matcher, variable) => expectAllowed(runHook(matcher, {}, variable)));
  it.each(HARNESS_ROOT_VARIABLES)("should deny a violation with %s", (variable) => expect(denialReason(runHook(dispatch, { name: "Raj_TechLead", task: "do it" }, variable))).toContain("Raj_TechLead"));
});

describe("question validator", () => {
  it("should deny an option without a tag and name every valid tag", () => {
    const reason = denialReason(runHook(questions, question({ label: "Consolidate purchasing", description: "One supplier." })));
    expect(reason).toContain("Consolidate purchasing");
    for (const tag of validTags) expect(reason).toContain(tag);
  });
  it.each(["Fast", "Recommeded"])("should deny invalid tag %s by name", (tag) => expect(denialReason(runHook(questions, question({ label: `Ship it [${tag}]`, description: "Quick." })))).toContain(`[${tag}]`));
  it("should allow a question without a mechanically recommended option", () => expectAllowed(runHook(questions, question({ label: "Patch now [Hotfix]", description: "Restores service." }, { label: "Rebuild [Architectural]", description: "Long-term." }))));
  it("should accept tags on the first description line", () => expectAllowed(runHook(questions, question({ label: "Consolidate vendors", description: "[Pragmatic] [Recommended]\nMoves purchases." }))));
  it("should accept tags in the label", () => expectAllowed(runHook(questions, question({ label: "Consolidate [Pragmatic] [Recommended]", description: "Moves purchases." }))));
  it("should ignore bracketed prose beside a valid tag", () => expectAllowed(runHook(questions, question({ label: "Use Postgres [Recommended]", description: "[Note] requires a migration." }))));
});

describe("plan validator", () => {
  it("should name only a missing Context heading", () => expect(denialReason(runHook(plans, { plan: compliantPlan.split("## Context")[0] }))).toContain("missing headings: Context."));
  it("should name all four missing default-plan headings", () => expect(denialReason(runHook(plans, { plan: "## Context\n\nSlow.\n\n## Summary\n\nFast.\n" }))).toContain("missing headings: Goal, Requirements, Boundary, Direction."));
  it("should allow a complete plan", () => expectAllowed(runHook(plans, { plan: compliantPlan })));
  it("should match headings at any depth and case", () => expectAllowed(runHook(plans, { plan: "# goal\na\n#### REQUIREMENTS\nb\n### Boundary\nc\n## direction\nd\n### context\ne\n" })));
  it("should not require headings in a Codex step list", () => expectAllowed(runHook(plans, { plan: [{ step: "audit", status: "pending" }] })));
});

describe("dispatch validator", () => {
  it("should name all five missing interface fields", () => {
    const reason = denialReason(runHook(dispatch, { prompt: "Please fix the auth bug.", name: teammate }));
    for (const field of ["Goal:", "Requirements:", "Boundary:", "Directions:", "Context:"]) expect(reason).toContain(field);
  });
  it("should deny a prose first line", () => expect(denialReason(runHook(dispatch, { prompt: compliantPrompt.replace("checkout-refunds", "Fix the refund totals please"), name: teammate }))).toContain("stable reference"));
  it("should deny a field label as the first line", () => expect(denialReason(runHook(dispatch, { prompt: compliantPrompt.slice(compliantPrompt.indexOf("\n") + 1).trimStart(), name: teammate }))).toContain("stable reference"));
  it.each([teammate, undefined])("should enforce the prompt ceiling for name %s", (name) => {
    const prompt = compliantPrompt + "x".repeat(5_000);
    const reason = denialReason(runHook(dispatch, { prompt, ...(name === undefined ? {} : { name }) }));
    expect(reason).toContain(String(prompt.length));
    expect(reason).toContain("4096");
  });
  it.each([{ prompt: compliantPrompt, name: "Raj_TechLead" }, { task: "do it", name: "Raj_TechLead" }])("should deny a non-kebab name", (input) => expect(denialReason(runHook(dispatch, input))).toContain("Raj_TechLead"));
  it.each(["checkout-refunds", "00521233-550e-4441-9bb7-f0c705d79b0a", "#158", "a".repeat(40)])("should allow stable reference %s", (reference) => expectAllowed(runHook(dispatch, { prompt: compliantPrompt.replace("checkout-refunds", reference), name: teammate })));
  it("should allow the compliant handover prompt", () => expectAllowed(runHook(dispatch, { prompt: compliantPrompt, name: teammate })));
  it("should allow leading indentation on the stable reference", () => expectAllowed(runHook(dispatch, { prompt: `  ${compliantPrompt}`, name: teammate })));
  it.each(["Find every caller of parseRefund across the repo.", compliantPrompt, ""])("should exempt an unnamed nested spawn", (prompt) => expectAllowed(runHook(dispatch, { prompt, subagent_type: "Explore" })));
});

describe("fail-open behavior", () => {
  it.each([[questions, {}], [questions, { questions: [] }], [plans, {}], [dispatch, {}], [plans, { plan: [{ step: "audit", status: "pending" }] }], [dispatch, { task: "audit the parser" }]] as const)("should allow uncheckable %s payloads", (matcher, input) => expectAllowed(runHook(matcher, input)));
  it.each(matchers)("should fail open on malformed stdin for %s", (matcher) => {
    const completed = spawnSync("bash", ["-c", commandFor(matcher)], { encoding: "utf8", env: harnessEnvironment("CLAUDE_PLUGIN_ROOT"), input: "not json at all" });
    expect(completed.status, completed.stderr).toBe(0);
    expectAllowed((JSON.parse(completed.stdout) as { hookSpecificOutput: HookOutput }).hookSpecificOutput);
  });
});
