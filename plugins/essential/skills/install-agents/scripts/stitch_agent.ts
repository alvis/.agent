import {
  existsSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, unknown>;
type HarnessProjection = Record<string, string>;
interface IntelligenceProjection {
  readonly rank: number | null;
  readonly best_for: readonly string[];
  readonly claude: HarnessProjection;
  readonly codex: HarnessProjection;
}
export interface AgentSources {
  readonly metadata: JsonObject;
  readonly claude: JsonObject;
  readonly codex: JsonObject;
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const intelligenceLevelsPath = resolve(
  scriptDirectory,
  "../references/intelligence-levels.json",
);
const agentName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const preferredNames =
  /(?:^| )Preferably named ([A-Z][a-z]{1,15}), ([A-Z][a-z]{1,15}), or ([A-Z][a-z]{1,15}) when the main agent spawns this role\.$/;
const fixedRoutingLanguage =
  /\b(?:only|always)\s+(?:spawn|delegate|route)\b|\bAgent` tool for one purpose\b|\bI am the only agent who forms\b/i;
const sharedPolicyLanguage = [
  "current `Agent` roster",
  "When I need a Dynamic Workflow",
  "For changed code, I inspect",
  "REVIEWED: source=",
  "I hold the `Agent` tool",
  "I hold `Agent`",
  "spawn target",
  "spawned by",
] as const;
const descriptionLimit = 1_024;
const validPermissionModes = new Set([
  "default",
  "acceptEdits",
  "auto",
  "dontAsk",
  "bypassPermissions",
  "plan",
  "manual",
]);
const memoryContractMarkers = [
  "durable",
  "evidence",
  "last-verified",
  "archive",
  "150 lines",
  "20kb",
  "essential:templates/memory.md",
  "topics/<stable-area>/<specific-subject>.md",
] as const;
export const leadAgentDirectionAlias =
  "@essential:references/directions/lead-agent.md";
export const leadAgentDirectionPath = "references/directions/lead-agent.md";
const metadataFields = new Set(["name", "description", "intelligence"]);
const claudeDerivedFields = new Set([
  "name",
  "description",
  "intelligence",
  "intelligenceLevel",
  "model",
  "effort",
]);
const codexDerivedFields = new Set([
  "name",
  "description",
  "nickname_candidates",
  "intelligence",
  "intelligenceLevel",
  "model",
  "model_reasoning_effort",
  "developer_instructions",
]);

export class AgentTemplateError extends Error {}

function markdownSection(body: string, heading: string): RegExpMatchArray[] {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^## ${escaped}\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`,
    "gm",
  );
  return [...body.matchAll(pattern)];
}

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function sameKeys(value: JsonObject, expected: ReadonlySet<string>): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.size && keys.every((key) => expected.has(key))
  );
}
function inside(root: string, target: string): boolean {
  const path = relative(root, target);
  return (
    path === "" ||
    (path !== ".." && !path.startsWith(`..${sep}`) && !path.startsWith(sep))
  );
}
function quote(value: unknown): string {
  if (typeof value === "string") return `'${value}'`;
  if (value === null) return "None";
  if (value === undefined) return "None";
  return String(value);
}
function readJsonObject(path: string): JsonObject {
  try {
    const document: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!object(document))
      throw new AgentTemplateError(
        `agent source must be a JSON object: ${path}`,
      );
    return document;
  } catch (error) {
    if (error instanceof AgentTemplateError) throw error;
    throw new AgentTemplateError(
      `invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function loadIntelligenceLevels(
  path = intelligenceLevelsPath,
): Record<string, IntelligenceProjection> {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new AgentTemplateError(
      `invalid intelligence-level matrix ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!object(raw) || Object.keys(raw).length === 0)
    throw new AgentTemplateError(
      "intelligence-level matrix must be a non-empty object",
    );
  const matrix = raw as Record<string, IntelligenceProjection>;
  const ranks: number[] = [];
  const examples = new Set<string>();
  for (const [level, projection] of Object.entries(matrix)) {
    if (!object(projection))
      throw new AgentTemplateError("invalid intelligence-level matrix entry");
    if (!sameKeys(projection, new Set(["rank", "best_for", "claude", "codex"])))
      throw new AgentTemplateError(
        `intelligence level ${quote(level)} must define rank, best_for, claude, and codex`,
      );
    const rank = projection.rank;
    if (level === "inherit") {
      if (rank !== null)
        throw new AgentTemplateError("inherit intelligence rank must be null");
    } else if (!Number.isInteger(rank) || (rank as number) < 0)
      throw new AgentTemplateError(
        `intelligence level ${quote(level)} must have a non-negative integer rank`,
      );
    else ranks.push(rank as number);
    if (
      !Array.isArray(projection.best_for) ||
      projection.best_for.length === 0 ||
      !projection.best_for.every(
        (example) => typeof example === "string" && example.trim() !== "",
      )
    )
      throw new AgentTemplateError(
        `intelligence level ${quote(level)} best_for must contain task examples`,
      );
    for (const example of projection.best_for) {
      if (examples.has(example))
        throw new AgentTemplateError(
          "intelligence task examples must be unique across levels",
        );
      examples.add(example);
    }
    for (const [harness, allowed] of [
      ["claude", new Set(["model", "effort"])],
      ["codex", new Set(["model", "model_reasoning_effort"])],
    ] as const) {
      const fields = projection[harness];
      if (
        !object(fields) ||
        Object.keys(fields).some((field) => !allowed.has(field))
      )
        throw new AgentTemplateError(
          `invalid ${harness} projection for intelligence level ${quote(level)}`,
        );
      if (Object.values(fields).some((value) => typeof value !== "string"))
        throw new AgentTemplateError(
          `${harness} projection values must be strings for ${quote(level)}`,
        );
    }
  }
  if (!("inherit" in matrix))
    throw new AgentTemplateError(
      "intelligence-level matrix must define inherit",
    );
  if (new Set(ranks).size !== ranks.length)
    throw new AgentTemplateError("concrete intelligence ranks must be unique");
  const sorted = [...ranks].sort((left, right) => left - right);
  if (sorted.some((rank, index) => rank !== index))
    throw new AgentTemplateError(
      "concrete intelligence ranks must be contiguous from zero",
    );
  return matrix;
}

export const intelligenceLevels = loadIntelligenceLevels();
export const validIntelligenceLevels = Object.keys(intelligenceLevels);

export function preferredNameCandidates(
  description: unknown,
): [string, string, string] {
  const match =
    typeof description === "string"
      ? preferredNames.exec(description)
      : undefined;
  const names = match?.slice(1) as [string, string, string] | undefined;
  if (names === undefined || new Set(names).size !== 3)
    throw new AgentTemplateError(
      "description must end with exactly three distinct preferred short names",
    );
  return names;
}

function legacyAgentSources(path: string): AgentSources {
  const legacy = readJsonObject(path);
  const take = (name: string): unknown => {
    const value = legacy[name];
    delete legacy[name];
    return value;
  };
  const name = take("name");
  const description = take("description");
  let intelligence = take("intelligence");
  const previous = take("intelligenceLevel");
  if (intelligence !== undefined && previous !== undefined)
    throw new AgentTemplateError(
      "legacy frontmatter must not define both intelligence keys",
    );
  intelligence ??= previous;
  if (intelligence === undefined) {
    const projection: JsonObject = {};
    for (const field of ["model", "effort"])
      if (field in legacy) projection[field] = take(field);
    intelligence = Object.entries(intelligenceLevels).find(
      ([, value]) =>
        JSON.stringify(value.claude) === JSON.stringify(projection),
    )?.[0];
    if (intelligence === undefined)
      throw new AgentTemplateError(
        "legacy model/effort pair is not represented by the intelligence matrix",
      );
  }
  return {
    metadata: { name, description, intelligence },
    claude: legacy,
    codex: {},
  };
}

export function loadAgentSources(
  templateDirectory: string,
  options: { readonly allowLegacy?: boolean } = {},
): AgentSources {
  const frontmatter = resolve(templateDirectory, "frontmatter");
  const paths = Object.fromEntries(
    ["meta.json", "claude.json", "codex.json"].map((name) => [
      name,
      resolve(frontmatter, name),
    ]),
  ) as Record<string, string>;
  const base = resolve(templateDirectory, "base.md");
  if (!existsSync(base) || !statSync(base).isFile())
    throw new AgentTemplateError(`missing base.md in ${templateDirectory}`);
  const present = Object.fromEntries(
    Object.entries(paths).map(([name, path]) => [
      name,
      existsSync(path) && statSync(path).isFile(),
    ]),
  );
  const legacy =
    options.allowLegacy === true &&
    present["claude.json"] &&
    !present["meta.json"] &&
    !present["codex.json"];
  if (!Object.values(present).every(Boolean) && !legacy) {
    const missing = Object.keys(present).find((name) => !present[name]);
    throw new AgentTemplateError(
      `missing frontmatter/${missing} in ${templateDirectory}`,
    );
  }
  const root = realpathSync(templateDirectory);
  for (const path of [
    ...(legacy ? [paths["claude.json"]!] : Object.values(paths)),
    base,
  ])
    if (!inside(root, realpathSync(path)))
      throw new AgentTemplateError(
        `template symlink or path escapes agent directory: ${path}`,
      );
  const sources = legacy
    ? legacyAgentSources(paths["claude.json"]!)
    : {
        metadata: readJsonObject(paths["meta.json"]!),
        claude: readJsonObject(paths["claude.json"]!),
        codex: readJsonObject(paths["codex.json"]!),
      };
  if (!sameKeys(sources.metadata, metadataFields))
    throw new AgentTemplateError(
      "frontmatter/meta.json must contain exactly name, description, and intelligence",
    );
  for (const [harness, overlay, reserved] of [
    ["claude", sources.claude, claudeDerivedFields],
    ["codex", sources.codex, codexDerivedFields],
  ] as const) {
    const collision = Object.keys(overlay).find((field) => reserved.has(field));
    if (collision !== undefined)
      throw new AgentTemplateError(
        `frontmatter/${harness}.json must not define derived field ${quote(collision)}`,
      );
  }
  const invalidCodex = Object.entries(sources.codex).find(
    ([field, value]) =>
      !/^[A-Za-z0-9_-]+$/.test(field) ||
      !["string", "boolean", "number"].includes(typeof value),
  )?.[0];
  if (invalidCodex !== undefined)
    throw new AgentTemplateError(
      `frontmatter/codex.json values must be TOML scalar fields: ${quote(invalidCodex)}`,
    );
  const name = sources.metadata.name;
  if (typeof name !== "string" || !agentName.test(name))
    throw new AgentTemplateError(
      `invalid agent name in ${paths["meta.json"]}: ${quote(name)}`,
    );
  if (name !== basename(templateDirectory))
    throw new AgentTemplateError(
      `metadata name ${quote(name)} does not match directory ${quote(basename(templateDirectory))}`,
    );
  preferredNameCandidates(sources.metadata.description);
  return sources;
}

export function validateAgentContract(
  sources: AgentSources,
  body: string,
): void {
  const description = sources.metadata.description;
  if (typeof description === "string" && description.length > descriptionLimit)
    throw new AgentTemplateError(
      `description exceeds ${descriptionLimit} characters: ${description.length}`,
    );
  const permission = sources.claude.permissionMode;
  if (permission !== undefined && !validPermissionModes.has(String(permission)))
    throw new AgentTemplateError(
      `invalid permissionMode ${quote(permission)}: expected one of ${[...validPermissionModes].join(", ")}`,
    );
  const intelligence = sources.metadata.intelligence;
  if (typeof intelligence !== "string" || !(intelligence in intelligenceLevels))
    throw new AgentTemplateError(
      `invalid intelligence ${quote(intelligence)}: expected one of ${validIntelligenceLevels.join(", ")}`,
    );
  if ("tools" in sources.claude || "tools" in sources.codex)
    throw new AgentTemplateError(
      "agent definitions must omit tools to inherit runtime capabilities",
    );
  const routing = [
    body,
    sources.metadata.description,
    sources.claude.initialPrompt,
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
  if (fixedRoutingLanguage.test(routing))
    throw new AgentTemplateError(
      "fixed routing language conflicts with runtime discovery",
    );
  const duplicated = sharedPolicyLanguage.find((phrase) =>
    body.includes(phrase),
  );
  if (duplicated !== undefined)
    throw new AgentTemplateError(
      `agent body repeats shared delegation policy: ${duplicated}`,
    );
  if (sources.claude.memory !== "project")
    throw new AgentTemplateError("agent memory must be project-scoped");
  const sections = markdownSection(body, "Memory");
  if (sections.length !== 1)
    throw new AgentTemplateError(
      "agent body must contain exactly one ## Memory section",
    );
  const memory = sections[0]?.[1] ?? "";
  const expected = `.claude/agent-memory/${String(sources.metadata.name)}/MEMORY.md`;
  if (!memory.includes(expected))
    throw new AgentTemplateError(
      `Memory section must name exact path ${expected}`,
    );
  const normalized = memory.toLowerCase();
  const missing = memoryContractMarkers.find(
    (marker) => !normalized.includes(marker),
  );
  if (missing !== undefined)
    throw new AgentTemplateError(
      `Memory section is missing maintenance marker: ${missing}`,
    );
}

function deriveEssentialRoot(templateDirectory: string): string | undefined {
  let current = realpathSync(templateDirectory);
  while (dirname(current) !== current) {
    if (basename(current) === "plugins") {
      const candidate = resolve(current, "essential");
      if (existsSync(resolve(candidate, leadAgentDirectionPath)))
        return candidate;
    }
    current = dirname(current);
  }
  const pluginRoot = resolve(realpathSync(templateDirectory), "../..");
  const cached = resolve(pluginRoot, "../../essential", basename(pluginRoot));
  if (existsSync(resolve(cached, leadAgentDirectionPath))) return cached;
  return undefined;
}

function resolveEssentialReferences(
  body: string,
  templateDirectory: string,
  essentialRoot?: string,
  referenceRoot?: string,
): string {
  if (!body.includes(leadAgentDirectionAlias)) return body;
  const root = essentialRoot
    ? realpathSync(essentialRoot)
    : deriveEssentialRoot(templateDirectory);
  if (root === undefined)
    throw new AgentTemplateError(
      "agent template uses @essential references; pass --essential-root or place the template in an unambiguous source checkout",
    );
  const direction = resolve(root, leadAgentDirectionPath);
  if (!existsSync(direction))
    throw new AgentTemplateError(
      `missing Essential lead direction: ${direction}`,
    );
  return body.replaceAll(
    leadAgentDirectionAlias,
    `@${resolve(referenceRoot ?? root, leadAgentDirectionPath)}`,
  );
}

function injectIntelligenceLine(body: string, intelligence: string): string {
  if (body.includes("Intelligence level:"))
    throw new AgentTemplateError(
      "base.md must not duplicate the derived intelligence line",
    );
  const newline = body.indexOf("\n");
  const title = newline < 0 ? body : body.slice(0, newline);
  if (!title.startsWith("# "))
    throw new AgentTemplateError(
      "base.md must start with an H1 title for intelligence injection",
    );
  const statement =
    intelligence === "inherit"
      ? "Intelligence level: inherit; resolve the effective harness level before accepting a skill."
      : `Intelligence level: ${intelligence}.`;
  const remainder = newline < 0 ? "" : body.slice(newline + 1);
  return `${title}\n\n${statement}\n${remainder}`;
}

function template(
  templateDirectory: string,
  options: {
    readonly essentialRoot?: string;
    readonly referenceRoot?: string;
    readonly allowLegacy?: boolean;
  },
): { sources: AgentSources; body: string } {
  const sources = loadAgentSources(templateDirectory, {
    allowLegacy: options.allowLegacy,
  });
  let body = readFileSync(
    resolve(templateDirectory, "base.md"),
    "utf8",
  ).replace(/^\n+/, "");
  validateAgentContract(sources, body);
  body = injectIntelligenceLine(body, String(sources.metadata.intelligence));
  return { sources, body };
}

export function stitchAgentDefinition(
  templateDirectory: string,
  options: {
    readonly essentialRoot?: string;
    readonly referenceRoot?: string;
    readonly allowLegacy?: boolean;
  } = {},
): string {
  const { sources, body } = template(templateDirectory, options);
  const intelligence =
    intelligenceLevels[String(sources.metadata.intelligence)]!;
  const projected: JsonObject = {
    name: sources.metadata.name,
    description: sources.metadata.description,
  };
  if ("color" in sources.claude) projected.color = sources.claude.color;
  Object.assign(projected, intelligence.claude);
  for (const [field, value] of Object.entries(sources.claude))
    if (field !== "color") projected[field] = value;
  const yaml = JSON.stringify(projected, undefined, 2);
  return `---\n${yaml}\n---\n\n${resolveEssentialReferences(body, templateDirectory, options.essentialRoot, options.referenceRoot)}`;
}

function removeMarkdownSection(body: string, heading: string): string {
  const match = markdownSection(body, heading)[0];
  if (match === null) return body;
  const before = body.slice(0, match.index).trimEnd();
  const after = body.slice(match.index + match[0].length).replace(/^\n+/, "");
  return before && after ? `${before}\n\n${after}` : before || after;
}
function codexHarnessNeutralText(text: string): string {
  return text
    .replaceAll(
      "run it inside my isolated worktree",
      "run it within the active harness boundaries",
    )
    .replace(/,? and Workflow launches/g, "")
    .replace(/^[^\n.!?]*\bworktree\b[^\n.!?]*[.!?][ \t]*/gm, "");
}
function codexDeveloperInstructions(body: string): string {
  let projected = removeMarkdownSection(body, "Memory");
  const delegation = markdownSection(projected, "Delegation Modes")[0] ?? null;
  if (delegation !== null && delegation[1]?.includes("Dynamic Workflow")) {
    const direct =
      /^- \*\*Direct persistent delegation\*\*.*?(?=^- \*\*Dynamic Workflow delegation\*\*)/gms.exec(
        delegation[1],
      );
    if (direct === null)
      throw new AgentTemplateError(
        "Delegation Modes must contain direct delegation before Dynamic Workflow",
      );
    projected = `${projected.slice(0, delegation.index)}## Delegation Modes\n\n${direct[0].trimEnd()}\n${projected.slice(delegation.index + delegation[0].length)}`;
  }
  projected = `${codexHarnessNeutralText(projected).trimEnd()}\n`;
  const unsupported = [
    ".claude/agent-memory/",
    "Dynamic Workflow",
    "Workflow launches",
    "worktree",
  ].find((marker) => projected.includes(marker));
  if (unsupported !== undefined)
    throw new AgentTemplateError(
      `Codex developer instructions retain Claude-only behavior: ${unsupported}`,
    );
  return projected;
}
function tomlValue(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => tomlValue(item)).join(", ")}]`;
  const encoded = JSON.stringify(value);
  if (encoded === undefined)
    throw new AgentTemplateError("Codex overlay contains an unsupported value");
  return encoded;
}
export function stitchCodexAgentDefinition(
  templateDirectory: string,
  options: {
    readonly essentialRoot?: string;
    readonly referenceRoot?: string;
    readonly allowLegacy?: boolean;
  } = {},
): string {
  const { sources, body } = template(templateDirectory, options);
  const fields: Array<readonly [string, unknown]> = [
    ["name", sources.metadata.name],
    [
      "description",
      codexHarnessNeutralText(String(sources.metadata.description)),
    ],
    [
      "nickname_candidates",
      preferredNameCandidates(sources.metadata.description),
    ],
    ...Object.entries(
      intelligenceLevels[String(sources.metadata.intelligence)]!.codex,
    ),
    ...Object.entries(sources.codex),
    [
      "developer_instructions",
      resolveEssentialReferences(
        codexDeveloperInstructions(body),
        templateDirectory,
        options.essentialRoot,
        options.referenceRoot,
      ),
    ],
  ];
  return fields
    .map(([name, value]) => `${name} = ${tomlValue(value)}\n`)
    .join("");
}

const program = basename(fileURLToPath(import.meta.url));
const usage = `usage: ${program} [-h] [--output OUTPUT] [--harness {claude,codex}]\n${" ".repeat(program.length + 7)}[--essential-root ESSENTIAL_ROOT]\n${" ".repeat(program.length + 7)}template`;
const help = `${usage}\n\nValidate and stitch a split agent template into a Claude agent file.\n\npositional arguments:\n  template\n\noptions:\n  -h, --help            show this help message and exit\n  --output OUTPUT\n  --harness {claude,codex}\n  --essential-root ESSENTIAL_ROOT\n                        Essential plugin root used to resolve @essential\n                        references; inferred from normal source-checkout and\n                        installed-cache layouts\n`;
function cliError(message: string): never {
  process.stderr.write(`${usage}\n${program}: error: ${message}\n`);
  process.exit(2);
}
export function main(argv = process.argv.slice(2)): number {
  let output: string | undefined;
  let harness = "claude";
  let essentialRoot: string | undefined;
  const templates: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    const value = (): string => {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("-"))
        cliError(`argument ${argument}: expected one argument`);
      index += 1;
      return next;
    };
    if (argument === "-h" || argument === "--help") {
      process.stdout.write(help);
      return 0;
    }
    if (argument === "--output") output = value();
    else if (argument.startsWith("--output="))
      output = argument.slice("--output=".length);
    else if (argument === "--harness") harness = value();
    else if (argument.startsWith("--harness="))
      harness = argument.slice("--harness=".length);
    else if (argument === "--essential-root") essentialRoot = value();
    else if (argument.startsWith("--essential-root="))
      essentialRoot = argument.slice("--essential-root=".length);
    else if (argument.startsWith("-"))
      cliError(`unrecognized arguments: ${argument}`);
    else templates.push(argument);
  }
  if (templates.length === 0)
    cliError("the following arguments are required: template");
  if (templates.length > 1)
    cliError(`unrecognized arguments: ${templates.slice(1).join(" ")}`);
  if (!new Set(["claude", "codex"]).has(harness))
    cliError(
      `argument --harness: invalid choice: '${harness}' (choose from 'claude', 'codex')`,
    );
  if (essentialRoot === undefined) {
    const candidate = resolve(scriptDirectory, "../../..");
    if (existsSync(resolve(candidate, leadAgentDirectionPath)))
      essentialRoot = candidate;
  }
  try {
    const stitched =
      harness === "claude"
        ? stitchAgentDefinition(templates[0]!, { essentialRoot })
        : stitchCodexAgentDefinition(templates[0]!, { essentialRoot });
    if (output === undefined) process.stdout.write(stitched);
    else writeFileSync(output, stitched, "utf8");
    return 0;
  } catch (error) {
    if (error instanceof AgentTemplateError) cliError(error.message);
    throw error;
  }
}

if (import.meta.main) process.exit(main());
