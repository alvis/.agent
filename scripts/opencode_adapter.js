import { createHash } from "node:crypto"
import { lstat, readFile, realpath } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const adapterDirectory = dirname(fileURLToPath(import.meta.url))
const configRoot = resolve(adapterDirectory, "..")

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"))
}

function validateContract(contract) {
  const stringKeys = [
    "manager",
    "canonical_skill",
    "canonical_command",
    "projected_skill",
    "projected_command",
    "canonical_bundle_path",
    "projected_bundle_path",
  ]
  if (
    stringKeys.some((key) => typeof contract?.[key] !== "string") ||
    !Number.isInteger(contract?.schema_version) ||
    contract?.skill_separator !== "-"
  ) {
    throw new Error("invalid Alvis OpenCode projection contract")
  }
}

function validateManifest(manifest, contract) {
  if (
    manifest?.manager !== contract.manager ||
    manifest?.schema_version !== contract.schema_version ||
    !["project", "user"].includes(manifest?.scope) ||
    !Array.isArray(manifest?.plugins) ||
    typeof manifest?.file_digests !== "object" ||
    Array.isArray(manifest?.file_digests) ||
    manifest?.file_digests === null
  ) {
    throw new Error("invalid Alvis OpenCode manifest")
  }
  const names = new Set()
  for (const plugin of manifest.plugins) {
    if (
      typeof plugin?.name !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plugin.name) ||
      plugin.bundle_path !== `alvis/plugins/${plugin.name}` ||
      names.has(plugin.name)
    ) {
      throw new Error("invalid Alvis OpenCode plugin receipt")
    }
    names.add(plugin.name)
  }
  if (!names.has("essential")) {
    throw new Error("Alvis OpenCode projection requires essential")
  }
}

async function readManagedFile(root, manifest, relativePath) {
  if (isAbsolute(relativePath) || relativePath.split("/").includes("..")) {
    throw new Error(`unsafe managed path ${relativePath}`)
  }
  const expectedDigest = manifest.file_digests[relativePath]
  if (!/^[0-9a-f]{64}$/.test(expectedDigest ?? "")) {
    throw new Error(`unmanaged runtime file ${relativePath}`)
  }
  let current = root
  for (const segment of relativePath.split("/")) {
    current = join(current, segment)
    const status = await lstat(current)
    if (status.isSymbolicLink()) {
      throw new Error(`symlinked runtime path ${relativePath}`)
    }
  }
  const [resolvedRoot, resolvedFile] = await Promise.all([
    realpath(root),
    realpath(current),
  ])
  const containment = relative(resolvedRoot, resolvedFile)
  if (containment.startsWith("..") || isAbsolute(containment)) {
    throw new Error(`runtime path escapes projection ${relativePath}`)
  }
  const content = await readFile(resolvedFile)
  const digest = createHash("sha256").update(content).digest("hex")
  if (digest !== expectedDigest) {
    throw new Error(`managed runtime file was modified ${relativePath}`)
  }
  return { path: resolvedFile, text: content.toString("utf8") }
}

async function loadProjection(root, expectedContract) {
  const manifestFile = join(root, "alvis", "manifest.json")
  const manifestStatus = await lstat(manifestFile)
  if (manifestStatus.isSymbolicLink() || !manifestStatus.isFile()) {
    throw new Error("projection manifest is not a regular file")
  }
  const [contract, manifest] = await Promise.all([
    readJson(join(root, "alvis", "contract.json")),
    readJson(manifestFile),
  ])
  validateContract(contract)
  if (
    expectedContract &&
    (contract.manager !== expectedContract.manager ||
      contract.schema_version !== expectedContract.schema_version ||
      contract.skill_separator !== expectedContract.skill_separator)
  ) {
    throw new Error("project projection contract differs from user projection")
  }
  validateManifest(manifest, contract)
  await Promise.all([
    readManagedFile(root, manifest, "alvis/contract.json"),
    readManagedFile(root, manifest, "plugins/alvis-marketplace.js"),
  ])
  return { contract, manifest }
}

async function logWarning(client, service, message, extra = {}) {
  try {
    await client.app.log({
      body: {
        service,
        level: "warn",
        message,
        extra,
      },
    })
  } catch {
    // logging must never disable the adapter
  }
}

async function runProcess(command, input, workingDirectory) {
  const childProcess = Bun.spawn(command, {
    cwd: workingDirectory,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })
  if (input !== undefined) {
    childProcess.stdin.write(input)
  }
  childProcess.stdin.end()
  const [status, standardOutput, standardError] = await Promise.all([
    childProcess.exited,
    new Response(childProcess.stdout).text(),
    new Response(childProcess.stderr).text(),
  ])
  if (status !== 0) {
    const detail = standardError.trim() || standardOutput.trim() || `exit ${status}`
    throw new Error(`${command[0]} failed: ${detail}`)
  }
  return standardOutput
}

async function loadContext(
  projectionRoot,
  manifest,
  plugin,
  audience,
  workingDirectory,
) {
  const contextScript = await readManagedFile(
    projectionRoot,
    manifest,
    `${plugin.bundle_path}/hooks/scripts/context.sh`,
  )
  return runProcess(
    [
      "bash",
      "-c",
      'source "$1"; get_plugin_context "$2"',
      manifest.manager,
      contextScript.path,
      audience,
    ],
    undefined,
    workingDirectory,
  )
}

async function runValidator(
  projectionRoot,
  manifest,
  plugin,
  validator,
  tool,
  args,
  workingDirectory,
) {
  const [validatorFile] = await Promise.all([
    readManagedFile(
      projectionRoot,
      manifest,
      `${plugin.bundle_path}/hooks/scripts/${validator}`,
    ),
    readManagedFile(
      projectionRoot,
      manifest,
      `${plugin.bundle_path}/hooks/scripts/context.sh`,
    ),
  ])
  const standardOutput = await runProcess(
    [validatorFile.path],
    JSON.stringify({ tool_name: tool, tool_input: args }),
    workingDirectory,
  )
  const result = JSON.parse(standardOutput)
  const hookOutput = result?.hookSpecificOutput
  if (hookOutput?.permissionDecision === "deny") {
    throw new Error(hookOutput.permissionDecisionReason || `${tool} denied`)
  }
}

function translateModelContextProtocolServer(server) {
  if (server?.type === "http" && typeof server.url === "string") {
    return {
      type: "remote",
      url: server.url,
      enabled: true,
      headers: server.headers,
    }
  }
  if (typeof server?.command === "string") {
    return {
      type: "local",
      command: [server.command, ...(Array.isArray(server.args) ? server.args : [])],
      enabled: true,
      environment: server.env,
    }
  }
  throw new Error("unsupported Claude MCP server definition")
}

async function configureModelContextProtocol(
  config,
  projectionRoot,
  manifest,
  client,
) {
  config.mcp ??= {}
  for (const plugin of manifest.plugins) {
    const relativePath = `${plugin.bundle_path}/.mcp.json`
    if (!Object.hasOwn(manifest.file_digests, relativePath)) continue
    const sourceFile = await readManagedFile(
      projectionRoot,
      manifest,
      relativePath,
    )
    const source = JSON.parse(sourceFile.text)
    for (const [name, server] of Object.entries(source.mcpServers ?? {})) {
      if (Object.hasOwn(config.mcp, name)) {
        await logWarning(client, manifest.manager, `kept existing MCP server ${name}`, {
          plugin: plugin.name,
        })
        continue
      }
      config.mcp[name] = translateModelContextProtocolServer(server)
    }
  }
}

async function readPayload(projectionRoot, manifest, plugin, name) {
  const relativePath = `${plugin.bundle_path}/hooks/${name}.md`
  if (!Object.hasOwn(manifest.file_digests, relativePath)) return ""
  const payload = await readManagedFile(projectionRoot, manifest, relativePath)
  return payload.text.replaceAll(
    "{{PLUGIN_DIR}}",
    join(projectionRoot, plugin.bundle_path),
  )
}

async function resolveSessionAudience(client, sessionId) {
  if (!sessionId) throw new Error("system transform has no session ID")
  const result = await client.session.get({ path: { id: sessionId } })
  if (result?.error || !result?.data || typeof result.data !== "object") {
    throw new Error("session lookup returned no session")
  }
  return result.data.parentID ? "child" : "root"
}

function buildIdentifierContext(contract) {
  return [
    "## Alvis OpenCode V1 projection",
    "",
    `- \`${contract.canonical_skill}\` and \`${contract.canonical_command}\` map to \`${contract.projected_skill}\` and \`${contract.projected_command}\`.`,
    `- \`${contract.canonical_bundle_path}\` maps to \`${contract.projected_bundle_path}\` under this OpenCode config root.`,
    "- OpenCode child sessions are task subagents; persistent teammate identities and direct peer messaging are unavailable.",
  ].join("\n")
}

async function buildSystemContext(
  projectionRoot,
  contract,
  manifest,
  client,
  sessionId,
  workingDirectory,
) {
  let sessionAudience
  try {
    sessionAudience = await resolveSessionAudience(client, sessionId)
  } catch (error) {
    const caughtError = /** @type {Error} */ (error)
    await logWarning(client, manifest.manager, "could not resolve session audience", {
      error: caughtError.message,
    })
  }

  const contextAudience = sessionAudience === "root" ? "session" : "subagent"
  const payloads = []
  for (const plugin of manifest.plugins) {
    const allAgent = await readPayload(projectionRoot, manifest, plugin, "ALLAGENT")
    if (allAgent) payloads.push(allAgent)
    if (sessionAudience) {
      const audiencePayload = await readPayload(
        projectionRoot,
        manifest,
        plugin,
        sessionAudience === "child" ? "SUBAGENT" : "MAINAGENT",
      )
      if (audiencePayload) payloads.push(audiencePayload)
    }
  }

  const essential = manifest.plugins.find((plugin) => plugin.name === "essential")
  if (essential) {
    const context = await loadContext(
      projectionRoot,
      manifest,
      essential,
      contextAudience,
      workingDirectory,
    )
    if (context) payloads.push(context)
  }
  payloads.push(buildIdentifierContext(contract))
  return payloads.join("\n\n")
}

async function isSuppressedByProjectProjection(manifest, contract, worktree) {
  if (manifest.scope !== "user" || !worktree) return false
  try {
    const projectRoot = resolve(worktree, ".opencode")
    const project = await loadProjection(projectRoot, contract)
    if (project.manifest.scope !== "project") return false
    const essential = project.manifest.plugins.find(
      (plugin) => plugin.name === "essential",
    )
    await Promise.all(
      ["context.sh", "validate-question", "validate-dispatch"].map((name) =>
        readManagedFile(
          projectRoot,
          project.manifest,
          `${essential.bundle_path}/hooks/scripts/${name}`,
        ),
      ),
    )
    return true
  } catch {
    return false
  }
}

export const AlvisMarketplace = async ({ client, directory, worktree }) => {
  const { contract, manifest } = await loadProjection(configRoot)
  if (await isSuppressedByProjectProjection(manifest, contract, worktree)) return {}

  const essential = manifest.plugins.find((plugin) => plugin.name === "essential")

  return {
    config: async (config) =>
      configureModelContextProtocol(config, configRoot, manifest, client),
    "experimental.chat.system.transform": async (input, output) => {
      const context = await buildSystemContext(
        configRoot,
        contract,
        manifest,
        client,
        input.sessionID,
        directory,
      )
      output.system.push(context)
    },
    "tool.execute.before": async (input, output) => {
      if (input.tool === "question") {
        await runValidator(
          configRoot,
          manifest,
          essential,
          "validate-question",
          input.tool,
          output.args,
          directory,
        )
      }
      if (input.tool === "task") {
        await runValidator(
          configRoot,
          manifest,
          essential,
          "validate-dispatch",
          input.tool,
          output.args,
          directory,
        )
      }
    },
  }
}
