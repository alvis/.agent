import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  writeFixture,
} from "../../../../../scripts/test-support.ts";

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const plugin = resolve(scriptDirectory, "../../..");
const skills = join(plugin, "skills");
const validator = join(scriptDirectory, "validate-transport-profile.ts");
const metadataCheck = join(scriptDirectory, "validate-transport-metadata.sh");

function digest(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function canonicalJson(value: unknown): string {
  const normalize = (item: unknown): unknown => Array.isArray(item)
    ? item.map(normalize)
    : typeof item === "object" && item !== null
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, normalize(child)]))
      : item;
  return JSON.stringify(normalize(value));
}

async function makeProfile(root: string): Promise<{ path: string; profile: Record<string, unknown> }> {
  const executable = await writeFixture(root, "notion-sync", "#!/bin/sh\nexit 0\n");
  await chmod(executable, 0o700);
  const binarySha256 = digest(await readFile(executable));
  const help = "pull --recursive --json\nsearch --json\ncreate --json --create-if-absent\npush --json --expected-revision\n";
  const capabilityVectors = {
    conditional_create: ["create", "--json", "--create-if-absent"],
    conditional_update: ["push", "--json", "--expected-revision"],
    create: ["create", "--json"],
    push: ["push", "--json"],
    recursive_pull: ["pull", "--recursive", "--json"],
    search: ["search", "--json"],
  };
  const outputContracts = {
    conditional_create: "notion-created-page-json-v1",
    conditional_update: "notion-page-write-json-v1",
    create: "notion-created-page-json-v1",
    push: "notion-page-write-json-v1",
    recursive_pull: "notion-page-tree-json-v1",
    search: "notion-search-json-v1",
  };
  const evidence = {
    binary_sha256: binarySha256,
    capability_vectors: capabilityVectors,
    help_stdout_sha256: digest(help),
    output_contracts: outputContracts,
    results: Object.fromEntries(Object.keys(capabilityVectors).map((key) => [key, "pass"])),
    tested_at: "2026-07-20T12:00:00Z",
    version: "1.2.3",
  };
  const profile: Record<string, unknown> = {
    capabilities: {
      conditional_create: { command: "create", flags: ["--create-if-absent"], output_contract: outputContracts.conditional_create, support: "supported" },
      conditional_update: { command: "push", flags: ["--expected-revision"], output_contract: outputContracts.conditional_update, support: "supported" },
      create: { command: "create", flags: ["--json"], output_contract: outputContracts.create },
      push: { command: "push", flags: ["--json"], output_contract: outputContracts.push },
      recursive_pull: { command: "pull", flags: ["--recursive", "--json"], output_contract: outputContracts.recursive_pull },
      search: { command: "search", flags: ["--json"], output_contract: outputContracts.search },
    },
    conformance: { evidence, evidence_sha256: digest(canonicalJson(evidence)), schema: "notion-sync-conformance/v1" },
    installation: { executable, package: "notion-sync", sha256: binarySha256, source: "team-artifact", version: "1.2.3" },
    name: "product-specs",
    probes: { help_argv: ["--help"], help_stdout_sha256: digest(help), version_argv: ["--version"], version_stdout_sha256: digest("notion-sync 1.2.3\n") },
    schema: "notion-sync-transport-profile/v1",
  };
  const path = await writeFixture(root, "transport-profile.json", JSON.stringify(profile));
  await chmod(path, 0o600);
  return { path, profile };
}

async function run(command: readonly string[], env?: Record<string, string>): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  return new Promise((resolveResult, reject) => {
    const [executable, ...arguments_] = command;
    if (executable === undefined) {
      reject(new Error("subprocess command must not be empty"));
      return;
    }
    const child = spawn(executable, arguments_, {
      env: env === undefined ? undefined : { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let stdout = "";
    child.stderr.setEncoding("utf8");
    child.stdout.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolveResult({ exitCode: exitCode ?? 1, stderr, stdout });
    });
  });
}

async function runMetadata(root: string, name: string, content: string): Promise<{ exitCode: number; final: string; stderr: string; stdout: string }> {
  const path = await writeFixture(root, name, content);
  const result = await run(["bash", metadataCheck, path]);
  return { ...result, final: await readFile(path, "utf8") };
}

describe("cmd:validate-transport-profile", () => {
  it("should emit the exact profile byte digest without leaking environment tokens", async () => {
    const root = await realpath(await createTemporaryDirectory("transport-profile-"));
    try {
      const profile = await makeProfile(root);
      const result = await run(["bun", validator, profile.path], { NOTION_TOKEN: "should-never-appear" });
      const report = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(result.exitCode).toBe(0);
      expect(report.status).toBe("profile_structure_verified");
      expect(report.profile_file).toBe(profile.path);
      expect(report.profile_file_sha256).toBe(digest(await readFile(profile.path)));
      expect(`${result.stdout}${result.stderr}`).not.toContain("should-never-appear");
    } finally { await removeTemporaryDirectory(root); }
  });

  it("should provide functional help and a secret-free refusing template", async () => {
    const help = await run(["bun", validator, "--help"]);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("<absolute-profile-file>");
    expect(help.stdout).toContain("--print-template");
    expect(help.stderr).toBe("");
    const templateResult = await run(["bun", validator, "--print-template"], { NOTION_TOKEN: "should-never-appear" });
    const template = JSON.parse(templateResult.stdout) as { profile: Record<string, unknown>; status: string };
    expect(templateResult.exitCode).toBe(0);
    expect(template.status).toBe("unverified_template");
    expect(`${templateResult.stdout}${templateResult.stderr}`).not.toContain("should-never-appear");
    const root = await realpath(await createTemporaryDirectory("transport-template-"));
    try {
      const path = await writeFixture(root, "template-profile.json", JSON.stringify(template.profile));
      await chmod(path, 0o600);
      const refusal = await run(["bun", validator, path]);
      expect(refusal.exitCode).toBe(2);
      expect((JSON.parse(refusal.stderr) as { error: string }).error).toContain("placeholder");
    } finally { await removeTemporaryDirectory(root); }
  });

  it("should reject a noncanonical digest and reused evidence after vector changes", async () => {
    const root = await realpath(await createTemporaryDirectory("transport-invalid-"));
    try {
      const { path, profile } = await makeProfile(root);
      const conformance = profile.conformance as Record<string, unknown>;
      conformance.evidence_sha256 = "0".repeat(64);
      await writeFile(path, JSON.stringify(profile));
      let refusal = await run(["bun", validator, path]);
      expect(refusal.exitCode).toBe(2);
      expect((JSON.parse(refusal.stderr) as { error: string }).error).toContain("conformance evidence SHA-256 mismatch");
      const rebuilt = await makeProfile(root);
      const capabilities = rebuilt.profile.capabilities as Record<string, Record<string, unknown>>;
      capabilities.push.flags = ["--json", "--force"];
      await writeFile(rebuilt.path, JSON.stringify(rebuilt.profile));
      refusal = await run(["bun", validator, rebuilt.path]);
      expect((JSON.parse(refusal.stderr) as { error: string }).error).toContain("conformance push vector does not match capabilities");
    } finally { await removeTemporaryDirectory(root); }
  });

  it("should treat conditional create independently from conditional update", async () => {
    const root = await realpath(await createTemporaryDirectory("transport-capability-"));
    try {
      const { path, profile } = await makeProfile(root);
      const capabilities = profile.capabilities as Record<string, Record<string, unknown>>;
      capabilities.conditional_create = { command: null, flags: [], output_contract: null, support: "unavailable" };
      const conformance = profile.conformance as { evidence: Record<string, Record<string, unknown>>; evidence_sha256: string };
      (conformance.evidence.capability_vectors as Record<string, unknown>).conditional_create = [];
      (conformance.evidence.output_contracts as Record<string, unknown>).conditional_create = "unavailable";
      (conformance.evidence.results as Record<string, unknown>).conditional_create = "unavailable";
      conformance.evidence_sha256 = digest(canonicalJson(conformance.evidence));
      await writeFile(path, JSON.stringify(profile));
      const result = await run(["bun", validator, path]);
      const report = JSON.parse(result.stdout) as { capabilities: Record<string, { support: string }> };
      expect(result.exitCode).toBe(0);
      expect(report.capabilities.conditional_update?.support).toBe("supported");
      expect(report.capabilities.conditional_create?.support).toBe("unavailable");
    } finally { await removeTemporaryDirectory(root); }
  });
});

describe("cmd:validate-transport-metadata", () => {
  it("should report present and absent revisions without mutating bytes", async () => {
    const root = await realpath(await createTemporaryDirectory("transport-metadata-"));
    try {
      const present = "---\ntitle: Contract\nlast_edited_time: 2026-07-20T10:30:00.000Z\nref: 01234567-89ab-cdef-0123-456789abcdef\n---\n# Contract\n";
      const presentResult = await runMetadata(root, "present.mdc", present);
      expect(presentResult.exitCode).toBe(0);
      expect(presentResult.final).toBe(present);
      expect(presentResult.stdout).toContain("transport_last_edited_time=2026-07-20T10:30:00.000Z");
      const absent = "---\ntitle: New child\nparent: parent-ref\n---\n# New child\n";
      const absentResult = await runMetadata(root, "absent.mdc", absent);
      expect(absentResult.exitCode).toBe(0);
      expect(absentResult.final).toBe(absent);
      expect(absentResult.stdout).toContain("transport_last_edited_time=<absent>");
    } finally { await removeTemporaryDirectory(root); }
  });

  it("should reject duplicate revisions and invalid identities without mutating bytes", async () => {
    const root = await realpath(await createTemporaryDirectory("transport-metadata-"));
    try {
      const duplicateRevision = "---\nlast_edited_time: first\nlast_edited_time: second\n---\n# Duplicate\n";
      const revision = await runMetadata(root, "revision.mdc", duplicateRevision);
      expect(revision.exitCode).not.toBe(0);
      expect(revision.final).toBe(duplicateRevision);
      expect(revision.stderr).toContain("malformed, duplicate");
      for (const [name, content] of [["duplicate-ref.mdc", "---\nref: first\nref: second\n---\n# Duplicate\n"], ["missing-ref.mdc", "---\ntitle: No identity\n---\n# Missing\n"]] as const) {
        const result = await runMetadata(root, name, content);
        expect(result.exitCode).not.toBe(0);
        expect(result.final).toBe(content);
        expect(result.stderr).toContain("transport identity metadata");
      }
    } finally { await removeTemporaryDirectory(root); }
  });

  it("should report identity changes and reject imprecise delimiters or symlinks", async () => {
    const root = await realpath(await createTemporaryDirectory("transport-metadata-"));
    try {
      const before = "---\nref: 01234567-89ab-cdef-0123-456789abcdef\nparent: fedcba98-7654-3210-fedc-ba9876543210\nlast_edited_time: 2026-07-20T10:30:00.000Z\n---\n# Contract\n";
      const first = await runMetadata(root, "before.mdc", before);
      const second = await runMetadata(root, "after.mdc", before.replace("01234567-89ab-cdef-0123-456789abcdef", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"));
      expect(first.stdout).toContain("transport_ref=01234567-89ab-cdef-0123-456789abcdef");
      expect(first.stdout).toContain("transport_parent=fedcba98-7654-3210-fedc-ba9876543210");
      expect(first.stdout).not.toBe(second.stdout);
      const imprecise = await runMetadata(root, "imprecise.mdc", "---\nref: stable-ref\n---   \n# Contract\n");
      expect(imprecise.exitCode).not.toBe(0);
      const target = await writeFixture(root, "target.mdc", "---\nref: stable-ref\n---\n# Contract\n");
      const alias = join(root, "alias.mdc");
      await symlink(target, alias);
      const linked = await run(["bash", metadataCheck, alias]);
      expect(linked.exitCode).not.toBe(0);
      expect(linked.stderr).toContain("regular non-symlink");
    } finally { await removeTemporaryDirectory(root); }
  });
});

describe("specification transport contracts", () => {
  it("should bind body authors through every specification call", async () => {
    const required = [join(skills, "mdc/SKILL.md"), join(skills, "mdc/references/closing-markers.md"), join(skills, "mdc/references/editing-rules.md"), join(skills, "mdc/references/examples.md"), join(skills, "mdc/references/syntax.md")];
    await expect(Promise.all(required.map((path) => readFile(path, "utf8")))).resolves.toHaveLength(required.length);
    const contracts = [join(plugin, "README.md"), join(plugin, "agents/specification-expert/base.md"), join(skills, "spec-code/SKILL.md"), join(skills, "implement-code/SKILL.md"), join(skills, "sync-spec/SKILL.md"), join(skills, "sync-notion/SKILL.md")];
    for (const contract of contracts) {
      const text = await readFile(contract, "utf8");
      expect(text).toContain("--body-author=<plugin:skill>");
      expect(text).not.toContain("Skill(mdc)");
    }
    const syncNotion = await readFile(join(skills, "sync-notion/SKILL.md"), "utf8");
    expect(syncNotion).toContain("next_action: select_body_author");
    expect(syncNotion).toContain("Never infer a default");
    const provenance = JSON.parse(await readFile(join(skills, "spec-code/assets/provenance.template.json"), "utf8")) as Record<string, unknown>;
    expect(provenance.body_author).toEqual({ capability_id: "<plugin>:<skill>", selection_source: "<explicit_argument|delegated_caller>" });
  });

  it("should prevent profile and property-policy bypasses", async () => {
    const agent = await readFile(join(plugin, "agents/specification-expert/base.md"), "utf8");
    for (const token of ["Bash: notion-sync", "--follow-children", "--depth-children", "--depth-database", "--depth-link"]) expect(agent).not.toContain(token);
    expect(agent).toContain("specification:sync-notion");
    expect(agent).toContain("selected transport profile alone");
    expect(agent).toContain("conformance-validated\n  `recursive_pull` vector");
    expect(await readFile(join(skills, "spec-code/references/document-mode.md"), "utf8")).toContain("explicit destination-owned mapping");
    expect((await readFile(join(skills, "sync-notion/references/database-resolution.md"), "utf8")).split(/\s+/).join(" ")).toContain("destination-owned mapping");
    expect((await readFile(join(skills, "sync-spec/references/concurrent-edit-matrix.md"), "utf8")).split(/\s+/).join(" ")).toContain("independently prove `conditional_update`");
  });
});
