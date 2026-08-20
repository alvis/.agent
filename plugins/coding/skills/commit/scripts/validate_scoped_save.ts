#!/usr/bin/env bun

import {
  accessSync,
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { cc, FFIType, ptr } from "bun:ffi";
import { createHash } from "node:crypto";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  normalize,
  posix,
  relative,
  resolve,
  sep,
} from "node:path";

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

interface JsonObject {
  [key: string]: JsonValue;
}

interface CommandResult {
  exitCode: number;
  stderr: Uint8Array;
  stdout: Uint8Array;
}

interface Arguments {
  action: "build" | "preflight" | "recover" | "verify";
  values: Readonly<Record<string, string>>;
}

interface PathState {
  mode: JsonValue;
  path: string;
  sha256: JsonValue;
  state: string;
  status?: string;
  origin?: string;
}

export interface SecureDirectory {
  readonly descriptor: number;
  readonly path: string;
}

interface NativeFilesystem {
  symbols: {
    secureMkdirAt(
      directoryDescriptor: number,
      path: ReturnType<typeof ptr>,
      mode: number,
    ): number;
    secureOpenAt(
      directoryDescriptor: number,
      path: ReturnType<typeof ptr>,
      flags: number,
      mode: number,
    ): number;
    secureRootOptionsEnded(entrypoint: ReturnType<typeof ptr>): number;
    secureUnlinkAt(
      directoryDescriptor: number,
      path: ReturnType<typeof ptr>,
      flags: number,
    ): number;
  };
}

const SCHEMA = "state-scoped-save/v1";
const REQUEST_SCHEMA = "state-scoped-save-request/v1";
const PRODUCER_SCHEMA = "state-generated-files/v1";
const WORK_ID = /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/;
const LOWER_HEX_SHA256 = /^[0-9a-f]{64}$/;
const UTF8 = new TextDecoder("utf-8", { fatal: true });
const NATIVE_SOURCE = `
#include <fcntl.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#ifdef __APPLE__
#include <crt_externs.h>
#endif

int secureMkdirAt(int directoryDescriptor, const char *path, unsigned int mode) {
  return mkdirat(directoryDescriptor, path, (mode_t)mode);
}

int secureOpenAt(
  int directoryDescriptor,
  const char *path,
  int flags,
  unsigned int mode
) {
  return openat(directoryDescriptor, path, flags, (mode_t)mode);
}

int secureUnlinkAt(int directoryDescriptor, const char *path, int flags) {
  return unlinkat(directoryDescriptor, path, flags);
}

static int secureSameFile(const char *candidate, const char *entrypoint) {
  char candidatePath[PATH_MAX];
  char entrypointPath[PATH_MAX];
  return realpath(candidate, candidatePath) != NULL &&
    realpath(entrypoint, entrypointPath) != NULL &&
    strcmp(candidatePath, entrypointPath) == 0;
}

int secureRootOptionsEnded(const char *entrypoint) {
#ifdef __APPLE__
  int count = *_NSGetArgc();
  char **arguments = *_NSGetArgv();
  for (int index = 0; index + 1 < count; index++) {
    if (secureSameFile(arguments[index], entrypoint) &&
        strcmp(arguments[index + 1], "--") == 0) {
      return 1;
    }
  }
  return 0;
#else
  FILE *stream = fopen("/proc/self/cmdline", "rb");
  if (stream == NULL) return 0;
  size_t capacity = 4096;
  size_t length = 0;
  char *arguments = malloc(capacity);
  if (arguments == NULL) {
    fclose(stream);
    return 0;
  }
  while (!feof(stream)) {
    if (length == capacity) {
      capacity *= 2;
      char *expanded = realloc(arguments, capacity);
      if (expanded == NULL) {
        free(arguments);
        fclose(stream);
        return 0;
      }
      arguments = expanded;
    }
    length += fread(arguments + length, 1, capacity - length, stream);
    if (ferror(stream)) {
      free(arguments);
      fclose(stream);
      return 0;
    }
  }
  fclose(stream);
  int result = 0;
  char *cursor = arguments;
  char *end = arguments + length;
  while (cursor < end) {
    size_t argumentLength = strnlen(cursor, (size_t)(end - cursor));
    char *next = cursor + argumentLength + 1;
    if (next < end && secureSameFile(cursor, entrypoint) &&
        strcmp(next, "--") == 0) {
      result = 1;
      break;
    }
    cursor = next;
  }
  free(arguments);
  return result;
#endif
}
`;
let loadedNativeFilesystem: NativeFilesystem | undefined;
const PREFLIGHT_FIELDS = new Set([
  "schema",
  "manifest_path",
  "manifest_sha256",
  "old_head",
  "index_sha256",
  "index_existed",
  "index_file_mode",
  "index_backup_path",
  "index_backup_sha256",
  "selected_paths",
  "excluded_inventory_sha256",
  "excluded_dirty_paths",
  "literal_pathspec_sha256",
  "jj_preflight_state",
]);
const JJ_STATE_FIELDS = new Set([
  "operation_id",
  "working_copy_commit_id",
  "working_copy_change_id",
  "parent_commit_ids",
  "git_head",
  "mutable",
  "conflicts",
  "divergent",
  "selected_diff_sha256",
]);
const SUBCOMMAND_OPTIONS: Readonly<
  Record<Arguments["action"], readonly string[]>
> = {
  build: ["--repo", "--work-root", "--base-rev", "--scope"],
  preflight: ["--repo", "--manifest", "--manifest-sha256"],
  verify: [
    "--repo",
    "--manifest",
    "--manifest-sha256",
    "--snapshot",
    "--snapshot-sha256",
    "--saved-rev",
  ],
  recover: [
    "--repo",
    "--manifest",
    "--manifest-sha256",
    "--snapshot",
    "--snapshot-sha256",
    "--failed-head",
  ],
};

class ContractError extends Error {}

export function main(argv = commandLineArguments()): number {
  const args = parseArguments(argv);
  if (!args) return process.exitCode ?? 0;
  try {
    const output =
      args.action === "build"
        ? commandBuild(args.values)
        : args.action === "preflight"
          ? commandPreflight(args.values)
          : args.action === "verify"
            ? commandVerify(args.values)
            : commandRecover(args.values);
    process.stdout.write(`${jsonOutput(output)}\n`);
    return 0;
  } catch (error) {
    const caughtError = error as Error;
    if (!(caughtError instanceof ContractError)) throw caughtError;
    process.stdout.write(
      `${jsonOutput({ status: "blocked_scope", error: caughtError.message })}\n`,
    );
    return 2;
  }
}

function commandBuild(values: Readonly<Record<string, string>>): JsonObject {
  const [repo, identity] = repositoryIdentity(values["--repo"]!);
  const requestPath = absoluteCliPath(values["--scope"], "--scope");
  const [request] = loadJson(requestPath);
  const workId = request.work_id;
  if (typeof workId !== "string" || !WORK_ID.test(workId))
    throw new ContractError(
      "scope request work_id must match the resolver lowercase-kebab grammar",
    );
  const workRoot = validateWorkArtifacts(
    repo,
    values["--work-root"]!,
    workId,
    requestPath,
  );
  const baseRevision = decodeTrimmedPath(
    runGit(repo, ["rev-parse", "--verify", `${values["--base-rev"]!}^{commit}`])
      .stdout,
  );
  const [publication, selected] = normalizePublicationRequest(repo, request);
  const publicationByPath = objectByPath(publication);
  const dirty = statusInventory(repo);
  const dirtyPublication = [
    ...directPublicationDirty(repo, publicationByPath),
  ].sort(comparePythonStrings);
  if (!equalArrays(selected, dirtyPublication))
    throw new ContractError(
      "selected_paths must equal the exact dirty publication subset: " +
        `declared=${pythonRepr(selected)} actual=${pythonRepr(dirtyPublication)}`,
    );
  if (!selected.length)
    throw new ContractError(
      "scoped-save manifest requires at least one dirty selected path",
    );
  const absent = selected.filter((path) => dirty[path] === undefined);
  if (absent.length)
    throw new ContractError(
      `direct publication comparison found dirty paths absent from Git status: ${pythonRepr(absent)}`,
    );
  const selectedEntries = selected.map((path) => ({
    ...publicationByPath[path]!,
    status: dirty[path]!.status!,
  }));
  const excluded = Object.keys(dirty)
    .filter((path) => !selected.includes(path))
    .sort(comparePythonStrings)
    .map((path) => dirty[path]!);
  const sources = request.generated_file_manifests;
  if (
    !Array.isArray(sources) ||
    sources.some((item) => typeof item !== "string" || !item)
  )
    throw new ContractError(
      "generated_file_manifests must be an array of non-empty strings",
    );
  const sourceBindings = reconcileProducerReceipts(
    repo,
    workRoot,
    sources,
    baseRevision,
    publicationByPath,
  );
  if (request.scope_complete !== true)
    throw new ContractError(
      "scope_complete must be true after lifecycle reconciliation",
    );
  const manifest: JsonObject = {
    schema: SCHEMA,
    work_id: workId,
    repository: identity,
    base_rev: baseRevision,
    build_state: captureBuildState(repo, identity, selected),
    publication_paths: publication,
    selected_paths: selectedEntries,
    excluded_dirty_paths: excluded,
    scope_attestation: {
      complete: true,
      generated_file_manifests: sourceBindings,
      excluded_owner: "user",
    },
  };
  const raw = canonicalJson(manifest);
  const digest = sha256(raw);
  const outputLeaf = `${digest}.json`;
  const output = withSecureDirectory(
    repo,
    [".state", "works", workId, "artifacts", "history", "save-manifests"],
    true,
    (directory) => {
      const outputPath = join(directory.path, outputLeaf);
      writeOrVerifyImmutable(directory, outputLeaf, raw);
      return outputPath;
    },
  );
  return {
    status: "sealed",
    manifest_path: output,
    manifest_sha256: digest,
    selected_paths: selected,
    invocation: `/coding:commit --paths-from=${output} --manifest-sha256=${digest}`,
  };
}

function commandPreflight(
  values: Readonly<Record<string, string>>,
): JsonObject {
  const [repo] = repositoryIdentity(values["--repo"]!);
  const manifestPath = absoluteCliPath(values["--manifest"], "--manifest");
  const [manifest, digest] = validateManifest(
    repo,
    manifestPath,
    values["--manifest-sha256"]!,
  );
  const selectedEntries = requireArray(
    manifest.selected_paths,
    "manifest selected_paths",
  );
  const selectedPaths = selectedEntries.map((entry) =>
    requireString(requireObject(entry, "selected entry").path, "selected path"),
  );
  const buildState = requireUnchangedBuildState(repo, manifest, selectedPaths);
  const state = validateManifestState(repo, manifest, false);
  const selected = Object.keys(state.selected).sort(comparePythonStrings);
  rejectSelectedCleanFilters(repo, selected);
  if (
    runGit(repo, ["rev-parse", "-q", "--verify", "MERGE_HEAD"], false)
      .exitCode === 0
  )
    throw new ContractError("a merge in progress cannot be isolated safely");
  const excludedRaw = canonicalJson(state.excluded);
  const oldHead = currentHead(repo);
  const indexPathRaw = decodeTrimmedPath(
    runGit(repo, ["rev-parse", "--path-format=absolute", "--git-path", "index"])
      .stdout,
  );
  const indexPath = isAbsolute(indexPathRaw)
    ? indexPathRaw
    : join(repo, indexPathRaw);
  const indexExisted = existsSync(indexPath);
  const indexBytes = indexExisted ? readFileSync(indexPath) : new Uint8Array();
  const indexDigest = sha256(indexBytes);
  const indexFileMode = indexExisted ? statSync(indexPath).mode & 0o7777 : null;
  const directoryPath = dirname(manifestPath);
  const pathspecRaw = Buffer.concat(
    selected.map((path) => Buffer.from(`:(literal)${path}\0`)),
  );
  const pathspecSha = sha256(pathspecRaw);
  const pathspecLeaf = `${digest}.paths.${pathspecSha}.nul`;
  const pathspecPath = join(directoryPath, pathspecLeaf);
  const indexBackupLeaf = `${digest}.index.${indexDigest}.bin`;
  const indexBackupPath = join(directoryPath, indexBackupLeaf);
  const snapshot: JsonObject = {
    schema: "state-scoped-save-preflight/v1",
    manifest_path: manifestPath,
    manifest_sha256: digest,
    old_head: oldHead,
    index_sha256: indexDigest,
    index_existed: indexExisted,
    index_file_mode: indexFileMode,
    index_backup_path: indexBackupPath,
    index_backup_sha256: indexDigest,
    selected_paths: selected,
    excluded_inventory_sha256: sha256(excludedRaw),
    excluded_dirty_paths: Object.values(state.excluded),
    literal_pathspec_sha256: pathspecSha,
    jj_preflight_state: buildState.jj,
  };
  const snapshotRaw = canonicalJson(snapshot);
  const snapshotSha = sha256(snapshotRaw);
  const snapshotLeaf = `${digest}.preflight.${snapshotSha}.json`;
  const snapshotPath = join(directoryPath, snapshotLeaf);
  withSecureDirectory(
    repo,
    secureRelativeComponents(repo, directoryPath),
    false,
    (directory) => {
      writeOrVerifyImmutable(directory, pathspecLeaf, pathspecRaw, 0o400);
      writeOrVerifyImmutable(directory, indexBackupLeaf, indexBytes, 0o400);
      writeOrVerifyImmutable(directory, snapshotLeaf, snapshotRaw);
    },
  );
  return {
    status: "validated",
    manifest_path: manifestPath,
    manifest_sha256: digest,
    selected_paths: selected,
    snapshot_path: snapshotPath,
    snapshot_sha256: snapshotSha,
    literal_pathspec_file: pathspecPath,
    literal_pathspec_sha256: pathspecSha,
    old_head: oldHead,
  };
}

function commandVerify(values: Readonly<Record<string, string>>): JsonObject {
  const [repo] = repositoryIdentity(values["--repo"]!);
  const manifestPath = absoluteCliPath(values["--manifest"], "--manifest");
  const [manifest, digest] = validateManifest(
    repo,
    manifestPath,
    values["--manifest-sha256"]!,
  );
  const [, snapshot, snapshotSha] = loadBoundSnapshot(
    repo,
    manifestPath,
    digest,
    values["--snapshot"]!,
    values["--snapshot-sha256"]!,
  );
  const state = validateManifestState(repo, manifest, true);
  const expectedExcluded = Object.values(state.excluded);
  if (!deepEqual(snapshot.excluded_dirty_paths, expectedExcluded))
    throw new ContractError(
      "preflight snapshot exclusion inventory differs from the manifest",
    );
  const selected = Object.keys(state.selected).sort(comparePythonStrings);
  if (!deepEqual(snapshot.selected_paths, selected))
    throw new ContractError(
      "preflight snapshot selected paths differ from the manifest",
    );
  const indexBackupPath = absoluteCliPath(
    snapshot.index_backup_path,
    "index backup path",
  );
  requireContainedPath(
    indexBackupPath,
    dirname(manifestPath),
    "index backup is outside the manifest artifacts directory",
  );
  const artifactsDirectoryPath = dirname(manifestPath);
  const pathspecSha = snapshot.literal_pathspec_sha256;
  if (typeof pathspecSha !== "string" || pathspecSha.length !== 64)
    throw new ContractError("preflight snapshot pathspec checksum is invalid");
  const pathspecLeaf = `${digest}.paths.${pathspecSha}.nul`;
  const [indexBackupHash, pathspecHash] = withSecureDirectory(
    repo,
    secureRelativeComponents(repo, artifactsDirectoryPath),
    false,
    (directory) => [
      sha256(readImmutable(directory, basename(indexBackupPath))),
      sha256(readImmutable(directory, pathspecLeaf)),
    ],
  );
  if (
    indexBackupHash !== snapshot.index_backup_sha256 ||
    indexBackupHash !== snapshot.index_sha256
  )
    throw new ContractError("preflight index backup checksum mismatch");
  if (pathspecHash !== pathspecSha)
    throw new ContractError(
      "preflight literal pathspec file checksum mismatch",
    );
  const saved = decodeTrimmedPath(
    runGit(repo, [
      "rev-parse",
      "--verify",
      `${values["--saved-rev"]!}^{commit}`,
    ]).stdout,
  );
  const parentResult = runGit(
    repo,
    ["rev-parse", "--verify", `${saved}^`],
    false,
  );
  const repository = requireObject(manifest.repository, "manifest repository");
  const vcsProof =
    repository.vcs === "git"
      ? verifyGitSave(repo, saved, parentResult, snapshot)
      : verifyJjSave(repo, saved, state.selected, snapshot);
  const diffArguments = [
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "--no-renames",
    "-r",
    "-z",
  ];
  if (parentResult.exitCode === 0)
    diffArguments.push(decodeTrimmedPath(parentResult.stdout), saved);
  else diffArguments.push("--root", saved);
  const changed = new Set(
    splitBytes(runGit(repo, diffArguments).stdout, 0)
      .filter((path) => path.length)
      .map((path) => validateRelativePath(repo, decodePath(path))),
  );
  if (!equalSets(changed, new Set(selected)))
    throw new ContractError(
      "saved diff is not the selected closed set: " +
        `expected=${pythonRepr(selected)} actual=${pythonRepr([...changed].sort(comparePythonStrings))}`,
    );
  for (const [path, entry] of Object.entries(state.selected)) {
    const savedState = treeEntry(repo, saved, path);
    if (!equalArrays(savedState, stateTuple(entry)))
      throw new ContractError(
        `saved tree content/mode differs from manifest: ${path}`,
      );
  }
  const excludedDigest = sha256(canonicalJson(state.excluded));
  if (excludedDigest !== snapshot.excluded_inventory_sha256)
    throw new ContractError("non-selected dirty inventory changed after save");
  const savedTreeHashes = Object.fromEntries(
    Object.entries(state.selected)
      .sort(([left], [right]) => comparePythonStrings(left, right))
      .map(([path, entry]) => [
        path,
        { state: entry.state, sha256: entry.sha256, mode: entry.mode },
      ]),
  );
  const jjPreflight = snapshot.jj_preflight_state;
  const receipt: JsonObject = {
    schema: "state-scoped-save-result/v1",
    status: "pass",
    manifest_path: manifestPath,
    manifest_sha256: digest,
    preflight_snapshot_sha256: snapshotSha,
    old_head: snapshot.old_head,
    rollback_handle:
      repository.vcs === "git"
        ? snapshot.old_head
        : isJsonObject(jjPreflight)
          ? jjPreflight.operation_id
          : null,
    saved_revision: saved,
    vcs_current_proof: vcsProof,
    selected_paths: selected,
    saved_tree_hashes: savedTreeHashes,
    excluded_inventory_before: snapshot.excluded_inventory_sha256,
    excluded_inventory_after: excludedDigest,
    non_selected_preserved: true,
  };
  const raw = canonicalJson(receipt);
  const receiptSha = sha256(raw);
  const outputLeaf = `${digest}.result.${receiptSha}.json`;
  const directoryPath = dirname(manifestPath);
  const output = withSecureDirectory(
    repo,
    secureRelativeComponents(repo, directoryPath),
    false,
    (directory) => {
      const outputPath = join(directory.path, outputLeaf);
      writeOrVerifyImmutable(directory, outputLeaf, raw);
      return outputPath;
    },
  );
  return {
    status: "pass",
    receipt_path: output,
    receipt_sha256: receiptSha,
    saved_revision: saved,
    non_selected_preserved: true,
  };
}

function commandRecover(values: Readonly<Record<string, string>>): JsonObject {
  const [repo] = repositoryIdentity(values["--repo"]!);
  const manifestPath = absoluteCliPath(values["--manifest"], "--manifest");
  const [manifest, digest] = validateManifest(
    repo,
    manifestPath,
    values["--manifest-sha256"]!,
  );
  if (requireObject(manifest.repository, "manifest repository").vcs !== "git")
    throw new ContractError(
      "recover currently supports only the plain Git scoped-save route",
    );
  const [, snapshot, snapshotSha] = loadBoundSnapshot(
    repo,
    manifestPath,
    digest,
    values["--snapshot"]!,
    values["--snapshot-sha256"]!,
  );
  const state = validateManifestState(repo, manifest, true, true);
  rejectAmbiguousIndexFlags(repo);
  const failedHead = decodeTrimmedPath(
    runGit(repo, [
      "rev-parse",
      "--verify",
      `${values["--failed-head"]!}^{commit}`,
    ]).stdout,
  );
  if (currentHead(repo) !== failedHead)
    throw new ContractError(
      "recovery refused: current HEAD differs from --failed-head",
    );
  const parent = decodeTrimmedPath(
    runGit(repo, ["rev-parse", "--verify", `${failedHead}^`]).stdout,
  );
  const oldHead = requireString(snapshot.old_head, "preflight old_head");
  if (parent !== oldHead)
    throw new ContractError(
      "recovery refused: failed commit is not directly based on preflight old_head",
    );
  const relevant = [
    ...new Set([
      ...Object.keys(state.selected),
      ...Object.keys(state.excluded),
    ]),
  ].sort(comparePythonStrings);
  const physicalBefore = Object.fromEntries(
    relevant.map((path) => [path, physicalState(repo, path)]),
  );
  const update = runGit(
    repo,
    ["update-ref", "HEAD", oldHead, failedHead],
    false,
  );
  if (update.exitCode)
    throw new ContractError(
      `atomic HEAD recovery failed: ${decodeReplacement(update.stderr).trim()}`,
    );
  const restoredIndex = restoreIndexFromBackup(repo, snapshot);
  const physicalAfter = Object.fromEntries(
    relevant.map((path) => [path, physicalState(repo, path)]),
  );
  if (!deepEqual(physicalAfter, physicalBefore))
    throw new ContractError("working-tree bytes changed during recovery");
  validateManifestState(repo, manifest, false);
  const receipt: JsonObject = {
    schema: "state-scoped-save-recovery/v1",
    status: "recovered",
    manifest_sha256: digest,
    preflight_snapshot_sha256: snapshotSha,
    failed_head: failedHead,
    restored_head: oldHead,
    restored_index_sha256: restoredIndex,
    working_tree_preserved: true,
  };
  const raw = canonicalJson(receipt);
  const receiptSha = sha256(raw);
  const outputLeaf = `${digest}.recovery.${receiptSha}.json`;
  const directoryPath = dirname(manifestPath);
  const output = withSecureDirectory(
    repo,
    secureRelativeComponents(repo, directoryPath),
    false,
    (directory) => {
      const outputPath = join(directory.path, outputLeaf);
      writeOrVerifyImmutable(directory, outputLeaf, raw);
      return outputPath;
    },
  );
  return {
    status: "recovered",
    receipt_path: output,
    receipt_sha256: receiptSha,
    restored_head: oldHead,
    restored_index_sha256: restoredIndex,
    working_tree_preserved: true,
  };
}

function repositoryIdentity(repoArgument: string): [string, JsonObject] {
  const candidate = realpathSync(repoArgument);
  const root = realpathSync(
    decodeTrimmedPath(
      runGit(candidate, ["rev-parse", "--show-toplevel"]).stdout,
    ),
  );
  const commonRaw = decodeTrimmedPath(
    runGit(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"])
      .stdout,
  );
  const common = realpathSync(
    isAbsolute(commonRaw) ? commonRaw : join(root, commonRaw),
  );
  const gitDirectoryRaw = decodeTrimmedPath(
    runGit(root, ["rev-parse", "--path-format=absolute", "--git-dir"]).stdout,
  );
  const gitDirectory = realpathSync(
    isAbsolute(gitDirectoryRaw) ? gitDirectoryRaw : join(root, gitDirectoryRaw),
  );
  const identity: JsonObject = {
    canonical_root: root,
    vcs: "git",
    git_common_dir: common,
  };
  if (!which("jj")) return [root, identity];
  const jjRootResult = runJj(root, ["root"], {
    check: false,
    ignoreWorkingCopy: true,
  });
  if (jjRootResult.exitCode && existsSync(join(root, ".jj")))
    throw new ContractError(
      "jj workspace detected, but the installed jj cannot perform the required " +
        `non-snapshotting root capability probe: ${decodeReplacement(jjRootResult.stderr).trim()}`,
    );
  if (jjRootResult.exitCode) return [root, identity];
  const jjRoot = realpathSync(decodeTrimmedPath(jjRootResult.stdout));
  if (jjRoot !== root)
    throw new ContractError(
      "jj workspace root differs from the canonical Git worktree root",
    );
  const jjGitResult = runJj(root, ["git", "root"], {
    check: false,
    ignoreWorkingCopy: true,
  });
  if (jjGitResult.exitCode)
    throw new ContractError(
      "jj workspace is present but has no structurally provable colocated Git root",
    );
  const jjGitDirectory = realpathSync(decodeTrimmedPath(jjGitResult.stdout));
  const bare = decodeTrimmedPath(
    runGit(root, ["rev-parse", "--is-bare-repository"]).stdout,
  );
  if (bare !== "false")
    throw new ContractError(
      "jj scoped save requires a non-bare colocated Git repository",
    );
  if (gitDirectory !== common)
    throw new ContractError(
      "jj scoped save does not support a linked Git worktree; use a jj workspace",
    );
  if (jjGitDirectory !== gitDirectory || jjGitDirectory !== common)
    throw new ContractError(
      "jj Git root differs from Git --git-dir/--git-common-dir; colocation is not proven",
    );
  if (
    runJj(root, ["git", "colocation", "status"], {
      check: false,
      ignoreWorkingCopy: true,
    }).exitCode
  )
    throw new ContractError("jj cannot confirm Git colocation status");
  identity.vcs = "jj-colocated";
  return [root, identity];
}

function captureBuildState(
  repo: string,
  identity: JsonObject,
  selected: string[],
): JsonObject {
  if (identity.vcs === "jj-colocated") {
    const jj = jjWorkspaceState(repo, selected);
    return { head_commit: jj.git_head!, jj };
  }
  return { head_commit: currentHead(repo), jj: null };
}

function requireUnchangedBuildState(
  repo: string,
  manifest: JsonObject,
  selected: string[],
): JsonObject {
  const state = validateBuildStateShape(manifest);
  if (state.head_commit !== currentHead(repo))
    throw new ContractError(
      "repository HEAD changed after scoped manifest sealing",
    );
  const repository = requireObject(manifest.repository, "manifest repository");
  if (repository.vcs === "jj-colocated") {
    const expected = requireObject(
      state.jj,
      "manifest sealed jj build identity",
    );
    if (!deepEqual(jjWorkspaceState(repo, selected), expected))
      throw new ContractError(
        "jj operation/working-copy identity changed after manifest sealing",
      );
  }
  return state;
}

function validateBuildStateShape(manifest: JsonObject): JsonObject {
  const state = requireObject(manifest.build_state, "manifest build_state");
  requireExactKeys(
    state,
    new Set(["head_commit", "jj"]),
    "manifest build_state",
  );
  if (typeof state.head_commit !== "string" || !state.head_commit)
    throw new ContractError("manifest build_state head_commit is invalid");
  const repository = requireObject(manifest.repository, "manifest repository");
  if (repository.vcs === "jj-colocated") {
    const jj = requireObject(state.jj, "manifest sealed jj build identity");
    requireExactKeys(jj, JJ_STATE_FIELDS, "manifest jj build state");
    if (jj.mutable !== true || jj.conflicts !== false || jj.divergent !== false)
      throw new ContractError(
        "manifest jj build state is not mutable/conflict-free/non-divergent",
      );
    if (jj.git_head !== state.head_commit)
      throw new ContractError(
        "manifest jj build state is not bound to its Git HEAD",
      );
    if (!deepEqual(jj.parent_commit_ids, [state.head_commit]))
      throw new ContractError(
        "manifest jj build state lacks the exact Git HEAD parent",
      );
  } else if (state.jj !== null) {
    throw new ContractError("plain Git manifest cannot contain jj build state");
  }
  return state;
}

function jjWorkspaceState(repo: string, selected: string[]): JsonObject {
  const staged = runGit(
    repo,
    ["diff-index", "--cached", "--quiet", "HEAD", "--"],
    false,
  );
  if (staged.exitCode === 1)
    throw new ContractError(
      "jj scoped save blocks ambient staged Git index entries",
    );
  if (staged.exitCode)
    throw new ContractError(
      `cannot prove a clean ambient Git index for jj: ${decodeReplacement(staged.stderr).trim()}`,
    );
  requireJjCapabilities(repo, selected);
  runJj(repo, ["status"]);
  const operationId = decodeTrimmedPath(
    runJj(
      repo,
      ["op", "log", "-n", "1", "--no-graph", "-T", 'self.id() ++ "\\n"'],
      {
        ignoreWorkingCopy: true,
      },
    ).stdout,
  );
  if (!operationId)
    throw new ContractError(
      "cannot capture the jj operation after working-copy snapshot",
    );
  const pinned = (args: string[]) =>
    runJj(repo, args, {
      atOperation: operationId,
      ignoreWorkingCopy: true,
    });
  if (
    decodedLines(
      pinned([
        "log",
        "-r",
        "@ & conflicts()",
        "--no-graph",
        "-T",
        'commit_id ++ "\\n"',
      ]).stdout,
    ).length
  )
    throw new ContractError("jj working-copy change has unresolved conflicts");
  if (
    decodedLines(
      pinned([
        "log",
        "-r",
        "@ & mutable()",
        "--no-graph",
        "-T",
        'commit_id ++ "\\n"',
      ]).stdout,
    ).length !== 1
  )
    throw new ContractError("jj working-copy change is not uniquely mutable");
  if (
    decodedLines(
      pinned([
        "log",
        "-r",
        "@ & divergent()",
        "--no-graph",
        "-T",
        'commit_id ++ "\\n"',
      ]).stdout,
    ).length
  )
    throw new ContractError("jj working-copy change id is divergent");
  const commitId = decodeTrimmedPath(
    pinned(["log", "-r", "@", "--no-graph", "-T", 'commit_id ++ "\\n"']).stdout,
  );
  const changeId = decodeTrimmedPath(
    pinned(["log", "-r", "@", "--no-graph", "-T", 'change_id ++ "\\n"']).stdout,
  );
  const parents = decodedLines(
    pinned([
      "log",
      "-r",
      "parents(@)",
      "--no-graph",
      "-T",
      'commit_id ++ "\\n"',
    ]).stdout,
  );
  if (!commitId || !changeId || parents.length !== 1)
    throw new ContractError("cannot capture complete jj working-copy identity");
  const gitHead = currentHead(repo);
  if (!equalArrays(parents, [gitHead]))
    throw new ContractError(
      "jj working-copy change must have Git HEAD as its exact sole parent",
    );
  if (runGit(repo, ["cat-file", "-e", `${commitId}^{commit}`], false).exitCode)
    throw new ContractError(
      "jj working-copy commit is not present in the colocated Git object store",
    );
  const diff = pinned(["diff", "-r", "@", "--git", "--", ...selected]).stdout;
  const currentOperation = decodeTrimmedPath(
    runJj(
      repo,
      ["op", "log", "-n", "1", "--no-graph", "-T", 'self.id() ++ "\\n"'],
      {
        ignoreWorkingCopy: true,
      },
    ).stdout,
  );
  if (currentOperation !== operationId)
    throw new ContractError(
      "jj operation changed while capturing scoped-save identity",
    );
  return {
    operation_id: operationId,
    working_copy_commit_id: commitId,
    working_copy_change_id: changeId,
    parent_commit_ids: parents,
    git_head: gitHead,
    mutable: true,
    conflicts: false,
    divergent: false,
    selected_diff_sha256: sha256(diff),
  };
}

function requireJjCapabilities(repo: string, selected: string[]): void {
  const operationProbe = runJj(
    repo,
    ["op", "log", "-n", "1", "--no-graph", "-T", 'self.id() ++ "\\n"'],
    { check: false, ignoreWorkingCopy: true },
  );
  if (operationProbe.exitCode)
    throw new ContractError(
      "installed jj lacks the scoped-save operation/template capability: " +
        decodeReplacement(operationProbe.stderr).trim(),
    );
  const operationId = decodeTrimmedPath(operationProbe.stdout);
  if (!operationId)
    throw new ContractError(
      "installed jj returned no operation id during capability probing",
    );
  const probes: ReadonlyArray<readonly [string, string[]]> = [
    [
      "commit/change identity template",
      ["log", "-r", "@", "--no-graph", "-T", 'commit_id ++ change_id ++ "\\n"'],
    ],
    [
      "conflicts revset",
      [
        "log",
        "-r",
        "@ & conflicts()",
        "--no-graph",
        "-T",
        'commit_id ++ "\\n"',
      ],
    ],
    [
      "mutable revset",
      ["log", "-r", "@ & mutable()", "--no-graph", "-T", 'commit_id ++ "\\n"'],
    ],
    [
      "divergent revset",
      [
        "log",
        "-r",
        "@ & divergent()",
        "--no-graph",
        "-T",
        'commit_id ++ "\\n"',
      ],
    ],
    [
      "working-copy parents revset",
      ["log", "-r", "parents(@)", "--no-graph", "-T", 'commit_id ++ "\\n"'],
    ],
    [
      "Git-format selected diff",
      ["diff", "-r", "@", "--git", "--", ...selected],
    ],
  ];
  for (const [label, command] of probes) {
    const result = runJj(repo, command, {
      atOperation: operationId,
      check: false,
      ignoreWorkingCopy: true,
    });
    if (result.exitCode)
      throw new ContractError(
        `installed jj lacks required scoped-save capability (${label}): ${decodeReplacement(result.stderr).trim()}`,
      );
  }
}

function currentHead(repo: string): string {
  return decodeTrimmedPath(
    runGit(repo, ["rev-parse", "--verify", "HEAD^{commit}"]).stdout,
  );
}

function runGit(repo: string, args: string[], check = true): CommandResult {
  const result = Bun.spawnSync(["git", "-C", repo, ...args], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const normalized = {
    exitCode: result.exitCode,
    stderr: result.stderr,
    stdout: result.stdout,
  };
  if (check && result.exitCode)
    throw new ContractError(
      `git ${args.join(" ")} failed: ${decodeReplacement(result.stderr).trim()}`,
    );
  return normalized;
}

function runJj(
  repo: string,
  args: string[],
  options: {
    atOperation?: string;
    check?: boolean;
    ignoreWorkingCopy?: boolean;
  } = {},
): CommandResult {
  if (!which("jj"))
    throw new ContractError(
      "manifest declares jj-colocated but jj is unavailable",
    );
  const command = ["jj", "-R", repo, "--no-pager", "--color=never"];
  if (options.ignoreWorkingCopy) command.push("--ignore-working-copy");
  if (options.atOperation) command.push("--at-operation", options.atOperation);
  command.push(...args);
  const result = Bun.spawnSync(command, { stderr: "pipe", stdout: "pipe" });
  const normalized = {
    exitCode: result.exitCode,
    stderr: result.stderr,
    stdout: result.stdout,
  };
  if ((options.check ?? true) && result.exitCode)
    throw new ContractError(
      `jj ${args.join(" ")} failed: ${decodeReplacement(result.stderr).trim()}`,
    );
  return normalized;
}

function normalizePublicationRequest(
  repo: string,
  request: JsonObject,
): [PathState[], string[]] {
  requireExactKeys(
    request,
    new Set([
      "schema",
      "work_id",
      "scope_complete",
      "publication_paths",
      "selected_paths",
      "generated_file_manifests",
    ]),
    "scope request",
  );
  if (request.schema !== REQUEST_SCHEMA)
    throw new ContractError(`scope request schema must be ${REQUEST_SCHEMA}`);
  const rawPublication = request.publication_paths;
  const rawSelected = request.selected_paths;
  if (!Array.isArray(rawPublication) || !Array.isArray(rawSelected))
    throw new ContractError(
      "publication_paths and selected_paths must be arrays",
    );
  const publication: PathState[] = [];
  const seen = new Set<string>();
  const folded = new Set<string>();
  for (const rawEntry of rawPublication) {
    const entry = requireObject(rawEntry, "publication path entry");
    requireExactKeys(
      entry,
      new Set(["path", "origin"]),
      "scope publication entry",
    );
    const path = validateRelativePath(repo, entry.path);
    const origin = entry.origin;
    if (typeof origin !== "string" || !origin.trim())
      throw new ContractError(
        `publication path lacks lifecycle origin: ${path}`,
      );
    const foldedPath = pythonCasefold(path);
    if (seen.has(path) || folded.has(foldedPath))
      throw new ContractError(
        `duplicate/case-colliding publication path: ${path}`,
      );
    if (path === ".state/working.md" || path.startsWith(".state/works/"))
      throw new ContractError(
        `ignored local state cannot be published: ${path}`,
      );
    if (checkIgnored(repo, path))
      throw new ContractError(`publishable lifecycle path is ignored: ${path}`);
    seen.add(path);
    folded.add(foldedPath);
    const [state, digest, mode] = physicalState(repo, path);
    publication.push({ path, state, sha256: digest, mode, origin });
  }
  const selected: string[] = [];
  for (const rawPath of rawSelected) {
    const path = validateRelativePath(repo, rawPath);
    if (!seen.has(path))
      throw new ContractError(
        `selected path is outside publication_paths: ${path}`,
      );
    if (selected.includes(path))
      throw new ContractError(`duplicate selected path: ${path}`);
    selected.push(path);
  }
  publication.sort((left, right) =>
    comparePythonStrings(left.path, right.path),
  );
  selected.sort(comparePythonStrings);
  return [publication, selected];
}

function statusInventory(repo: string): Record<string, PathState> {
  rejectAmbiguousIndexFlags(repo);
  const chunks = splitBytes(
    runGit(repo, [
      "status",
      "--porcelain=v2",
      "-z",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ]).stdout,
    0,
  );
  const result: Record<string, PathState> = {};
  for (let index = 0; index < chunks.length;) {
    const record = chunks[index++]!;
    if (!record.length) continue;
    const kind = record[0];
    const records: Array<[string, string]> = [];
    if (kind === 49) {
      const fields = splitAtMost(record, 32, 8);
      if (fields.length !== 9)
        throw new ContractError("malformed porcelain-v2 ordinary record");
      records.push([
        decodePath(fields[8]!),
        decodeAscii(joinBytes(fields.slice(0, 8), 32)),
      ]);
    } else if (kind === 50) {
      const fields = splitAtMost(record, 32, 9);
      if (fields.length !== 10 || index >= chunks.length)
        throw new ContractError("malformed porcelain-v2 rename/copy record");
      const prefix = decodeAscii(joinBytes(fields.slice(0, 9), 32));
      const destination = decodePath(fields[9]!);
      const original = decodePath(chunks[index++]!);
      records.push([
        destination,
        `${prefix} role=destination original=${jsonString(original)}`,
      ]);
      if (fields[8]![0] === 82)
        records.push([
          original,
          `${prefix} role=source destination=${jsonString(destination)}`,
        ]);
    } else if (kind === 117) {
      throw new ContractError(
        "unmerged index entries cannot be isolated safely",
      );
    } else if (kind === 63 || kind === 33) {
      records.push([decodePath(record.subarray(2)), String.fromCharCode(kind)]);
    } else {
      throw new ContractError(
        `unknown porcelain-v2 record: ${pythonBytesRepr(record.subarray(0, 20))}`,
      );
    }
    for (const [rawPath, status] of records) {
      const path = validateRelativePath(repo, rawPath);
      if (result[path])
        throw new ContractError(`duplicate dirty status path: ${path}`);
      const [state, digest, mode] = physicalState(repo, path);
      result[path] = { path, state, sha256: digest, mode, status };
    }
  }
  return result;
}

function directPublicationDirty(
  repo: string,
  publication: Record<string, PathState>,
): Set<string> {
  const dirty = new Set<string>();
  const coreFilemode = decodeTrimmedPath(
    runGit(repo, ["config", "--bool", "core.filemode"], false).stdout,
  ).toLowerCase();
  for (const path of Object.keys(publication)) {
    const worktree = physicalState(repo, path);
    const indexed = indexEntry(repo, path);
    const headed = treeEntry(repo, "HEAD", path);
    if (
      coreFilemode === "false" &&
      worktree[0] === "file" &&
      indexed[0] === "file" &&
      worktree[2] !== indexed[2]
    )
      throw new ContractError(
        "core.filemode=false hides a publication mode mismatch that cannot be saved safely: " +
          path,
      );
    if (!equalArrays(worktree, indexed) || !equalArrays(indexed, headed))
      dirty.add(path);
  }
  return dirty;
}

function rejectAmbiguousIndexFlags(repo: string): void {
  const filemode = runGit(repo, ["config", "--bool", "core.filemode"], false);
  if (![0, 1].includes(filemode.exitCode))
    throw new ContractError(
      "cannot determine core.filemode for exact scoped proof",
    );
  if (decodeReplacement(filemode.stdout).trim().toLowerCase() === "false")
    throw new ContractError(
      "core.filemode=false makes repository-wide executable-mode preservation ambiguous",
    );
  for (const record of splitBytes(
    runGit(repo, ["ls-files", "-v", "-z"]).stdout,
    0,
  )) {
    if (!record.length) continue;
    if (record.length < 3 || record[1] !== 32)
      throw new ContractError("malformed git ls-files -v record");
    const tag = String.fromCharCode(record[0]!);
    const path = validateRelativePath(repo, decodePath(record.subarray(2)));
    if (tag === "S" || tag === tag.toLowerCase())
      throw new ContractError(
        `skip-worktree/assume-unchanged index flag makes scoped proof ambiguous: ${path}`,
      );
  }
}

function rejectSelectedCleanFilters(repo: string, selected: string[]): void {
  const attributes = [
    "filter",
    "text",
    "eol",
    "working-tree-encoding",
    "ident",
  ];
  const autocrlfResult = runGit(
    repo,
    ["config", "--get", "core.autocrlf"],
    false,
  );
  if (![0, 1].includes(autocrlfResult.exitCode))
    throw new ContractError(
      "cannot determine core.autocrlf before scoped save",
    );
  const autocrlf = decodeReplacement(autocrlfResult.stdout)
    .trim()
    .toLowerCase();
  for (const path of selected) {
    const values = splitBytes(
      runGit(repo, ["check-attr", "-z", ...attributes, "--", path]).stdout,
      0,
    ).filter((item) => item.length);
    if (values.length !== attributes.length * 3)
      throw new ContractError(
        `cannot determine clean-transform state for selected path: ${path}`,
      );
    for (const [offset, attribute] of attributes.entries()) {
      const returnedPath = decodePath(values[offset * 3]!);
      const returnedAttribute = decodePath(values[offset * 3 + 1]!);
      if (returnedPath !== path || returnedAttribute !== attribute)
        throw new ContractError(
          `malformed clean-transform attributes for selected path: ${path}`,
        );
      const value = decodePath(values[offset * 3 + 2]!);
      if (!new Set(["unspecified", "unset"]).has(value))
        throw new ContractError(
          "selected path has a Git clean transform and is blocked before mutation: " +
            `${path} (${attribute}=${value})`,
        );
    }
    if (
      !new Set(["", "false"]).has(autocrlf) &&
      physicalState(repo, path)[0] === "file"
    )
      throw new ContractError(
        `core.autocrlf=${autocrlf} may clean-transform selected path; blocked before mutation: ${path}`,
      );
  }
}

function physicalState(
  repo: string,
  path: string,
): [string, string | null, string | null] {
  const absolute = join(repo, path);
  if (!existsOrSymlink(absolute)) return ["deleted", null, null];
  const metadata = lstatSync(absolute);
  if (metadata.isSymbolicLink())
    return [
      "symlink",
      sha256(readlinkSync(absolute, { encoding: "buffer" })),
      "120000",
    ];
  if (metadata.isFile())
    return [
      "file",
      sha256(readFileSync(absolute)),
      metadata.mode & 0o111 ? "100755" : "100644",
    ];
  throw new ContractError(
    `selected/publication path is not a file, symlink, or deletion: ${path}`,
  );
}

function indexEntry(
  repo: string,
  path: string,
): [string, string | null, string | null] {
  const records = splitBytes(
    runGit(repo, ["ls-files", "--stage", "-z", "--", `:(literal)${path}`])
      .stdout,
    0,
  ).filter((record) => record.length);
  if (!records.length) return ["deleted", null, null];
  if (records.length !== 1)
    throw new ContractError(
      `unmerged/multiple index stages cannot be isolated: ${path}`,
    );
  const tab = records[0]!.indexOf(9);
  if (tab < 0 || decodePath(records[0]!.subarray(tab + 1)) !== path)
    throw new ContractError(`malformed index entry for ${path}`);
  const fields = decodeAscii(records[0]!.subarray(0, tab)).split(" ");
  if (fields.length !== 3)
    throw new ContractError(`malformed index metadata for ${path}`);
  const [mode, objectId, stage] = fields;
  if (stage !== "0")
    throw new ContractError(`unmerged index stage cannot be isolated: ${path}`);
  if ([...objectId!].every((character) => character === "0"))
    return ["deleted", null, null];
  if (!new Set(["100644", "100755", "120000"]).has(mode!))
    throw new ContractError(
      `unsupported index object mode for ${path}: ${mode}`,
    );
  return [
    mode === "120000" ? "symlink" : "file",
    sha256(runGit(repo, ["cat-file", "blob", objectId!]).stdout),
    mode!,
  ];
}

function treeEntry(
  repo: string,
  revision: string,
  path: string,
): [string, string | null, string | null] {
  const raw = runGit(repo, [
    "ls-tree",
    "-z",
    revision,
    "--",
    `:(literal)${path}`,
  ]).stdout;
  if (!raw.length) return ["deleted", null, null];
  const record = raw.at(-1) === 0 ? raw.subarray(0, -1) : raw;
  const tab = record.indexOf(9);
  if (tab < 0 || decodePath(record.subarray(tab + 1)) !== path)
    throw new ContractError(`saved tree returned unexpected path for ${path}`);
  const [mode, objectType, objectId] = decodeAscii(
    record.subarray(0, tab),
  ).split(" ");
  if (
    objectType !== "blob" ||
    !new Set(["100644", "100755", "120000"]).has(mode!)
  )
    throw new ContractError(
      `unsupported saved object for ${path}: ${mode} ${objectType}`,
    );
  return [
    mode === "120000" ? "symlink" : "file",
    sha256(runGit(repo, ["cat-file", "blob", objectId!]).stdout),
    mode!,
  ];
}

function reconcileProducerReceipts(
  repo: string,
  workRoot: string,
  sources: JsonValue[],
  baseRevision: string,
  publication: Record<string, PathState>,
): JsonObject[] {
  const bindings: JsonObject[] = [];
  const declared: Record<string, JsonObject> = {};
  for (const source of sources) {
    const [binding, entries] = loadProducerReceipt(
      repo,
      workRoot,
      source,
      baseRevision,
    );
    if (bindings.some((existing) => existing.path === binding.path))
      throw new ContractError(
        `duplicate generated-files receipt: ${binding.path}`,
      );
    bindings.push(binding);
    for (const [path, entry] of Object.entries(entries)) {
      if (declared[path])
        throw new ContractError(
          `multiple producer receipts claim publication path: ${path}`,
        );
      declared[path] = entry;
    }
  }
  const missing = Object.keys(publication)
    .filter((path) => !declared[path])
    .sort(comparePythonStrings);
  const extra = Object.keys(declared)
    .filter((path) => !publication[path])
    .sort(comparePythonStrings);
  if (missing.length || extra.length)
    throw new ContractError(
      "producer generated_files must equal publication scope exactly: " +
        `missing=${pythonRepr(missing)} extra=${pythonRepr(extra)}`,
    );
  for (const [path, entry] of Object.entries(declared)) {
    const published = publication[path]!;
    for (const key of ["state", "sha256", "mode"])
      if (entry[key] !== published[key as keyof PathState])
        throw new ContractError(
          `producer/publication ${key} differs for ${path}`,
        );
  }
  return bindings.sort((left, right) =>
    comparePythonStrings(String(left.path), String(right.path)),
  );
}

function loadProducerReceipt(
  repo: string,
  workRoot: string,
  value: JsonValue,
  expectedBaseRevision: string,
): [JsonObject, Record<string, JsonObject>] {
  const [candidate, relativePath] = validateArtifactsPointer(
    repo,
    workRoot,
    value,
  );
  const [receipt, raw] = loadJson(candidate);
  if (!equalBytes(raw, canonicalJson(receipt)))
    throw new ContractError(
      `generated-files receipt is not canonical JSON: ${relativePath}`,
    );
  requireExactKeys(
    receipt,
    new Set(["schema", "producer", "base_rev", "generated_files"]),
    "generated-files receipt",
  );
  if (receipt.schema !== PRODUCER_SCHEMA)
    throw new ContractError(
      `generated-files receipt schema must be ${PRODUCER_SCHEMA}: ${relativePath}`,
    );
  if (typeof receipt.producer !== "string" || !receipt.producer.trim())
    throw new ContractError(
      `generated-files receipt producer is missing: ${relativePath}`,
    );
  if (receipt.base_rev !== expectedBaseRevision)
    throw new ContractError(
      `generated-files receipt base_rev differs: ${relativePath}`,
    );
  if (
    !Array.isArray(receipt.generated_files) ||
    !receipt.generated_files.length
  )
    throw new ContractError(
      `generated-files receipt must declare generated_files: ${relativePath}`,
    );
  const entries: Record<string, JsonObject> = {};
  const folded = new Set<string>();
  for (const rawEntry of receipt.generated_files) {
    const entry = requireObject(rawEntry, "generated-files entry");
    requireExactKeys(
      entry,
      new Set(["path", "state", "sha256", "mode"]),
      "generated-files entry",
    );
    const path = validateRelativePath(repo, entry.path);
    const foldedPath = pythonCasefold(path);
    if (entries[path] || folded.has(foldedPath))
      throw new ContractError(
        `duplicate/case-colliding generated path: ${path}`,
      );
    if (path === ".state/working.md" || path.startsWith(".state/works/"))
      throw new ContractError(
        `ignored work state cannot be producer-generated: ${path}`,
      );
    if (checkIgnored(repo, path))
      throw new ContractError(
        `producer-generated publication path is ignored: ${path}`,
      );
    if (!equalArrays(stateTuple(entry), physicalState(repo, path)))
      throw new ContractError(
        `generated-files receipt content/state/mode is stale: ${path}`,
      );
    entries[path] = entry;
    folded.add(foldedPath);
  }
  return [{ path: relativePath, sha256: sha256(raw) }, entries];
}

function validateManifest(
  repo: string,
  manifestPathArgument: string,
  expectedSha: string,
): [JsonObject, string] {
  const manifestPath = absoluteCliPath(manifestPathArgument, "--manifest");
  if (!LOWER_HEX_SHA256.test(expectedSha))
    throw new ContractError(
      "manifest SHA-256 must be 64 lowercase hexadecimal characters",
    );
  const [manifest, raw] = loadJson(manifestPath);
  if (!equalBytes(raw, canonicalJson(manifest)))
    throw new ContractError("manifest bytes are not canonical JSON");
  const actualSha = sha256(raw);
  if (actualSha !== expectedSha)
    throw new ContractError(
      `manifest checksum mismatch: expected ${expectedSha}, got ${actualSha}`,
    );
  if (basename(manifestPath) !== `${expectedSha}.json`)
    throw new ContractError("manifest filename is not bound to its SHA-256");
  if (manifest.schema !== SCHEMA)
    throw new ContractError(`manifest schema must be ${SCHEMA}`);
  requireExactKeys(
    manifest,
    new Set([
      "schema",
      "work_id",
      "repository",
      "base_rev",
      "build_state",
      "publication_paths",
      "selected_paths",
      "excluded_dirty_paths",
      "scope_attestation",
    ]),
    "manifest",
  );
  const workId = manifest.work_id;
  if (typeof workId !== "string" || !WORK_ID.test(workId))
    throw new ContractError(
      "manifest work_id must match the resolver lowercase-kebab grammar",
    );
  const workRoot = validateWorkArtifacts(
    repo,
    join(repo, ".state", "works", workId),
    workId,
    manifestPath,
  );
  const [, identity] = repositoryIdentity(repo);
  const repository = requireObject(manifest.repository, "manifest repository");
  requireExactKeys(
    repository,
    new Set(["canonical_root", "vcs", "git_common_dir"]),
    "manifest repository",
  );
  if (!deepEqual(repository, identity))
    throw new ContractError(
      "manifest repository identity does not match the current repository",
    );
  validateBuildStateShape(manifest);
  if (typeof manifest.base_rev !== "string")
    throw new ContractError("manifest base_rev is missing");
  runGit(repo, ["rev-parse", "--verify", `${manifest.base_rev}^{commit}`]);
  const attestation = requireObject(
    manifest.scope_attestation,
    "manifest scope_attestation",
  );
  if (!Array.isArray(attestation.generated_file_manifests))
    throw new ContractError(
      "manifest generated_file_manifests must be an array",
    );
  const sourcePaths: JsonValue[] = [];
  for (const rawSource of attestation.generated_file_manifests) {
    const source = requireObject(rawSource, "manifest generated-file binding");
    requireExactKeys(
      source,
      new Set(["path", "sha256"]),
      "generated-file binding",
    );
    if (typeof source.path !== "string" || typeof source.sha256 !== "string")
      throw new ContractError("generated-file binding path/hash is invalid");
    sourcePaths.push(source.path);
  }
  if (!Array.isArray(manifest.publication_paths))
    throw new ContractError("manifest publication_paths must be an array");
  const publicationMap: Record<string, PathState> = {};
  for (const rawEntry of manifest.publication_paths) {
    const entry = requireObject(rawEntry, "manifest publication entry");
    const path = validateRelativePath(repo, entry.path);
    if (publicationMap[path])
      throw new ContractError(`duplicate manifest publication path: ${path}`);
    publicationMap[path] = entry as PathState;
  }
  const actualBindings = reconcileProducerReceipts(
    repo,
    workRoot,
    sourcePaths,
    manifest.base_rev,
    publicationMap,
  );
  if (!deepEqual(actualBindings, attestation.generated_file_manifests))
    throw new ContractError(
      "generated-files receipt path/hash bindings changed after sealing",
    );
  return [manifest, actualSha];
}

function validateManifestState(
  repo: string,
  manifest: JsonObject,
  afterSave: boolean,
  recoveryInspection = false,
): {
  dirty: Record<string, PathState>;
  excluded: Record<string, PathState>;
  selected: Record<string, PathState>;
} {
  const publication = requireArray(
    manifest.publication_paths,
    "manifest publication_paths",
  );
  const selected = requireArray(
    manifest.selected_paths,
    "manifest selected_paths",
  );
  const excluded = requireArray(
    manifest.excluded_dirty_paths,
    "manifest excluded_dirty_paths",
  );
  const attestation = requireObject(
    manifest.scope_attestation,
    "manifest scope_attestation",
  );
  if (attestation.complete !== true)
    throw new ContractError("manifest scope attestation is incomplete");
  const publicationMap = validateStateEntries(
    repo,
    publication,
    "publication",
    false,
  );
  const selectedMap = validateStateEntries(repo, selected, "selected", true);
  const excludedMap = validateStateEntries(repo, excluded, "excluded", true);
  if (
    !Object.keys(selectedMap).length ||
    Object.keys(selectedMap).some((path) => !publicationMap[path])
  )
    throw new ContractError(
      "selected_paths must be a non-empty publication subset",
    );
  for (const [path, selectedEntry] of Object.entries(selectedMap)) {
    const publicationEntry = publicationMap[path]!;
    for (const key of ["state", "sha256", "mode", "origin"])
      if (
        selectedEntry[key as keyof PathState] !==
        publicationEntry[key as keyof PathState]
      )
        throw new ContractError(
          `selected/publication ${key} differs for ${path}`,
        );
  }
  const selectedPaths = Object.keys(selectedMap);
  const excludedPaths = Object.keys(excludedMap);
  if (selectedPaths.some((path) => excludedMap[path]))
    throw new ContractError("selected and excluded dirty paths overlap");
  const excludedFolded = new Set(excludedPaths.map(pythonCasefold));
  if (selectedPaths.some((path) => excludedFolded.has(pythonCasefold(path))))
    throw new ContractError("selected and excluded paths case-collide");
  requireExactKeys(
    attestation,
    new Set(["complete", "generated_file_manifests", "excluded_owner"]),
    "scope attestation",
  );
  if (
    !Array.isArray(attestation.generated_file_manifests) ||
    attestation.generated_file_manifests.some((rawItem) => {
      if (!isJsonObject(rawItem)) return true;
      return (
        !equalSets(
          new Set(Object.keys(rawItem)),
          new Set(["path", "sha256"]),
        ) ||
        typeof rawItem.path !== "string" ||
        typeof rawItem.sha256 !== "string"
      );
    })
  )
    throw new ContractError(
      "scope attestation generated_file_manifests is invalid",
    );
  if (attestation.excluded_owner !== "user")
    throw new ContractError(
      "scope attestation must assign exclusions to the user",
    );
  if (recoveryInspection)
    return { selected: selectedMap, excluded: excludedMap, dirty: {} };
  const directDirty = directPublicationDirty(repo, publicationMap);
  if (afterSave && directDirty.size)
    throw new ContractError(
      "publication paths remain dirty by direct worktree/index/HEAD comparison: " +
        pythonRepr([...directDirty].sort(comparePythonStrings)),
    );
  if (!afterSave && !equalSets(directDirty, new Set(selectedPaths)))
    throw new ContractError(
      "selected paths differ from direct worktree/index/HEAD comparison: " +
        `expected=${pythonRepr(selectedPaths.sort(comparePythonStrings))} ` +
        `actual=${pythonRepr([...directDirty].sort(comparePythonStrings))}`,
    );
  const dirty = statusInventory(repo);
  if (afterSave) {
    const stillDirty = selectedPaths
      .filter((path) => dirty[path])
      .sort(comparePythonStrings);
    if (stillDirty.length)
      throw new ContractError(
        `selected paths remain dirty after save: ${pythonRepr(stillDirty)}`,
      );
  }
  const expected = afterSave ? excludedMap : { ...selectedMap, ...excludedMap };
  const expectedPaths = Object.keys(expected).sort(comparePythonStrings);
  const actualPaths = Object.keys(dirty).sort(comparePythonStrings);
  if (!equalArrays(expectedPaths, actualPaths))
    throw new ContractError(
      `dirty path set changed: expected=${pythonRepr(expectedPaths)} actual=${pythonRepr(actualPaths)}`,
    );
  for (const [path, expectedEntry] of Object.entries(expected))
    for (const key of ["state", "sha256", "mode", "status"])
      if (
        expectedEntry[key as keyof PathState] !==
        dirty[path]![key as keyof PathState]
      )
        throw new ContractError(`dirty ${key} changed for ${path}`);
  return { selected: selectedMap, excluded: excludedMap, dirty };
}

function validateStateEntries(
  repo: string,
  values: JsonValue[],
  label: "excluded" | "publication" | "selected",
  requireStatus: boolean,
): Record<string, PathState> {
  const result: Record<string, PathState> = {};
  const folded = new Set<string>();
  for (const rawValue of values) {
    const value = requireObject(rawValue, `${label} entry`);
    const expected = new Set(["path", "state", "sha256", "mode"]);
    if (label === "publication" || label === "selected") expected.add("origin");
    if (requireStatus) expected.add("status");
    requireExactKeys(value, expected, `${label} entry`);
    const path = validateRelativePath(repo, value.path);
    if (label === "publication") {
      if (path === ".state/working.md" || path.startsWith(".state/works/"))
        throw new ContractError(
          `ignored local state cannot be published: ${path}`,
        );
      if (checkIgnored(repo, path))
        throw new ContractError(
          `publishable lifecycle path is ignored: ${path}`,
        );
    }
    const foldedPath = pythonCasefold(path);
    if (result[path] || folded.has(foldedPath))
      throw new ContractError(
        `duplicate/case-colliding ${label} path: ${path}`,
      );
    if (requireStatus && typeof value.status !== "string")
      throw new ContractError(`${label} entry lacks canonical status: ${path}`);
    if (!new Set(["file", "symlink", "deleted"]).has(String(value.state)))
      throw new ContractError(`invalid ${label} state: ${path}`);
    if (value.state === "deleted") {
      if (value.sha256 !== null || value.mode !== null)
        throw new ContractError(
          `deleted ${label} path must have null hash/mode: ${path}`,
        );
    } else if (
      typeof value.sha256 !== "string" ||
      !LOWER_HEX_SHA256.test(value.sha256)
    ) {
      throw new ContractError(`invalid SHA-256 for ${label} path: ${path}`);
    }
    if (
      value.state !== "deleted" &&
      !new Set(["100644", "100755", "120000"]).has(String(value.mode))
    )
      throw new ContractError(
        `invalid Git object mode for ${label} path: ${path}`,
      );
    if (value.state === "symlink" && value.mode !== "120000")
      throw new ContractError(`symlink mode must be 120000: ${path}`);
    if (value.state === "file" && value.mode === "120000")
      throw new ContractError(`regular file cannot use symlink mode: ${path}`);
    if (
      (label === "publication" || label === "selected") &&
      (typeof value.origin !== "string" || !value.origin.trim())
    )
      throw new ContractError(`${label} path lacks lifecycle origin: ${path}`);
    if (!equalArrays(stateTuple(value), physicalState(repo, path)))
      throw new ContractError(
        `current bytes/deletion/mode differs for ${label} path: ${path}`,
      );
    result[path] = value as PathState;
    folded.add(foldedPath);
  }
  return result;
}

function loadBoundSnapshot(
  repo: string,
  manifestPath: string,
  manifestSha: string,
  snapshotArgument: string,
  snapshotSha: string,
): [string, JsonObject, string] {
  const snapshotPath = absoluteCliPath(snapshotArgument, "--snapshot");
  requireContainedPath(
    snapshotPath,
    dirname(manifestPath),
    "preflight snapshot is outside the manifest artifacts directory",
  );
  const raw = withSecureDirectory(
    repo,
    secureRelativeComponents(repo, dirname(snapshotPath)),
    false,
    (directory) => readImmutable(directory, basename(snapshotPath)),
  );
  const snapshot = parseJson(raw, snapshotPath);
  if (!equalBytes(raw, canonicalJson(snapshot)))
    throw new ContractError("preflight snapshot bytes are not canonical JSON");
  const actualSha = sha256(raw);
  if (actualSha !== snapshotSha)
    throw new ContractError(
      `preflight snapshot checksum mismatch: expected ${snapshotSha}, got ${actualSha}`,
    );
  if (basename(snapshotPath) !== `${manifestSha}.preflight.${actualSha}.json`)
    throw new ContractError(
      "preflight snapshot filename is not checksum-bound",
    );
  requireExactKeys(snapshot, PREFLIGHT_FIELDS, "preflight snapshot");
  if (snapshot.schema !== "state-scoped-save-preflight/v1")
    throw new ContractError("unknown preflight snapshot schema");
  if (
    snapshot.manifest_sha256 !== manifestSha ||
    snapshot.manifest_path !== manifestPath
  )
    throw new ContractError(
      "preflight snapshot does not belong to this manifest",
    );
  return [snapshotPath, snapshot, actualSha];
}

function verifyGitSave(
  repo: string,
  saved: string,
  parent: CommandResult,
  snapshot: JsonObject,
): JsonObject {
  if (parent.exitCode)
    throw new ContractError(
      "plain Git scoped save must have the preflight HEAD as its parent",
    );
  const savedParent = decodeTrimmedPath(parent.stdout);
  if (savedParent !== snapshot.old_head)
    throw new ContractError(
      "plain Git saved commit parent differs from the preflight old_head",
    );
  const head = currentHead(repo);
  if (head !== saved)
    throw new ContractError(
      "plain Git current HEAD no longer equals the exact scoped saved commit",
    );
  return { vcs: "git", current_head: head };
}

function verifyJjSave(
  repo: string,
  saved: string,
  selected: Record<string, PathState>,
  snapshot: JsonObject,
): JsonObject {
  const preflight = requireObject(
    snapshot.jj_preflight_state,
    "jj preflight state",
  );
  requireExactKeys(preflight, JJ_STATE_FIELDS, "jj preflight state");
  const preflightOperation = requireString(
    preflight.operation_id,
    "jj preflight operation id",
  );
  const current = jjWorkspaceState(
    repo,
    Object.keys(selected).sort(comparePythonStrings),
  );
  const currentOperation = requireString(
    current.operation_id,
    "current jj operation id",
  );
  const operationHistory = new Set(
    decodedLines(
      runJj(repo, ["op", "log", "--no-graph", "-T", 'self.id() ++ "\\n"'], {
        atOperation: currentOperation,
        ignoreWorkingCopy: true,
      }).stdout,
    ),
  );
  if (!operationHistory.has(preflightOperation))
    throw new ContractError(
      "current jj operation does not descend from the preflight operation",
    );
  const savedLine = decodeTrimmedPath(
    runGit(repo, ["rev-list", "--parents", "-n", "1", saved]).stdout,
  ).split(/\s+/);
  const savedParents = savedLine.slice(1);
  if (!deepEqual(savedParents, preflight.parent_commit_ids))
    throw new ContractError(
      "jj saved change parents differ from the preflight working-copy parents",
    );
  const currentParents = requireArray(
    current.parent_commit_ids,
    "jj current parent ids",
  );
  if (!deepEqual(currentParents, [saved]))
    throw new ContractError(
      "jj current working-copy change is not directly based on the exact scoped saved commit",
    );
  const pinned = (template: string) =>
    decodeTrimmedPath(
      runJj(repo, ["log", "-r", saved, "--no-graph", "-T", template], {
        atOperation: currentOperation,
        ignoreWorkingCopy: true,
      }).stdout,
    );
  const savedCommitId = pinned('commit_id ++ "\\n"');
  if (savedCommitId !== saved)
    throw new ContractError(
      "jj current operation does not contain the exact saved commit",
    );
  const savedChangeId = pinned('change_id ++ "\\n"');
  if (!savedChangeId)
    throw new ContractError(
      "jj saved change identity is missing from the current operation",
    );
  return {
    vcs: "jj-colocated",
    current_operation_id: currentOperation,
    preflight_operation_id: preflightOperation,
    preflight_working_copy_commit_id: preflight.working_copy_commit_id!,
    preflight_working_copy_change_id: preflight.working_copy_change_id!,
    saved_commit_id: savedCommitId,
    saved_change_id: savedChangeId,
    saved_parent_commit_ids: savedParents,
    current_working_copy_commit_id: current.working_copy_commit_id!,
    current_working_copy_change_id: current.working_copy_change_id!,
    working_copy_parents: currentParents,
  };
}

function restoreIndexFromBackup(repo: string, snapshot: JsonObject): string {
  const backupPath = absoluteCliPath(
    snapshot.index_backup_path,
    "index backup path",
  );
  const backup = withSecureDirectory(
    repo,
    secureRelativeComponents(repo, dirname(backupPath)),
    false,
    (directory) => readImmutable(directory, basename(backupPath)),
  );
  const digest = sha256(backup);
  if (
    digest !== snapshot.index_backup_sha256 ||
    digest !== snapshot.index_sha256
  )
    throw new ContractError("cannot recover: index backup checksum mismatch");
  const rawIndexPath = decodeTrimmedPath(
    runGit(repo, ["rev-parse", "--path-format=absolute", "--git-path", "index"])
      .stdout,
  );
  const indexPath = isAbsolute(rawIndexPath)
    ? rawIndexPath
    : join(repo, rawIndexPath);
  const lockPath = `${indexPath}.lock`;
  let descriptor: number;
  try {
    descriptor = openSync(
      lockPath,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
  } catch (error) {
    const caughtError = error as NodeJS.ErrnoException;
    if (caughtError.code === "EEXIST")
      throw new ContractError(
        `cannot recover while Git index lock exists: ${lockPath}`,
      );
    throw caughtError;
  }
  try {
    writeAll(descriptor, backup);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = -1;
    if (snapshot.index_existed === true) {
      if (typeof snapshot.index_file_mode !== "number")
        throw new ContractError(
          "cannot recover: original index mode is missing",
        );
      chmodSync(lockPath, snapshot.index_file_mode);
      renameSync(lockPath, indexPath);
    } else if (snapshot.index_existed === false) {
      if (existsSync(indexPath)) unlinkSync(indexPath);
      unlinkSync(lockPath);
    } else {
      throw new ContractError(
        "cannot recover: original index existence is ambiguous",
      );
    }
  } catch (error) {
    if (descriptor >= 0) closeSync(descriptor);
    if (existsOrSymlink(lockPath)) unlinkSync(lockPath);
    throw error;
  }
  const restored = existsSync(indexPath)
    ? sha256(readFileSync(indexPath))
    : sha256(new Uint8Array());
  if (restored !== digest)
    throw new ContractError("index recovery checksum proof failed");
  return restored;
}

function validateWorkArtifacts(
  repo: string,
  workRootArgument: string,
  workId: string,
  child: string,
): string {
  const workRoot = absoluteCliPath(workRootArgument, "--work-root");
  const expected = join(repo, ".state", "works", workId);
  if (workRoot !== expected)
    throw new ContractError(`work root must be ${expected}`);
  ensureNoSymlinkChain(workRoot, repo);
  if (!existsSync(workRoot) || !statSync(workRoot).isDirectory())
    throw new ContractError(`work root does not exist: ${workRoot}`);
  const childAbsolute = absoluteCliPath(child, "artifacts path");
  requireContainedPath(
    childAbsolute,
    join(workRoot, "artifacts"),
    `artifacts path is outside work artifacts: ${childAbsolute}`,
    true,
  );
  ensureNoSymlinkChain(childAbsolute, repo);
  if (!regularFileWithoutSymlink(childAbsolute))
    throw new ContractError(
      `artifacts path is not a regular file: ${childAbsolute}`,
    );
  const repoRelative = posixPath(relative(repo, childAbsolute));
  if (!checkIgnored(repo, repoRelative))
    throw new ContractError(`work artifacts must be ignored: ${childAbsolute}`);
  return workRoot;
}

function validateArtifactsPointer(
  repo: string,
  workRoot: string,
  value: JsonValue,
): [string, string] {
  if (typeof value !== "string" || !value)
    throw new ContractError(
      "generated-file artifacts pointer must be a non-empty path",
    );
  let candidate: string;
  if (value.startsWith("/")) {
    candidate = absoluteCliPath(value, "generated-file artifacts pointer");
  } else {
    if (!normalizedRelativePosix(value))
      throw new ContractError(
        "generated-file artifacts pointer is not lexically normalized",
      );
    const parts = value.split("/");
    if (parts[0] === "artifacts") candidate = join(workRoot, ...parts);
    else if (
      parts.slice(0, 4).join("/") ===
      `.state/works/${basename(workRoot)}/artifacts`
    )
      candidate = join(repo, ...parts);
    else
      throw new ContractError(
        "generated-file artifacts pointer must be absolute, work-root-relative artifacts/, " +
          "or repo-relative .state/works/<id>/artifacts/",
      );
  }
  requireContainedPath(
    candidate,
    join(workRoot, "artifacts"),
    "generated-file artifacts pointer escapes work artifacts",
    true,
  );
  ensureNoSymlinkChain(candidate, repo);
  if (!regularFileWithoutSymlink(candidate))
    throw new ContractError(
      `generated-file artifacts pointer is not a regular file: ${candidate}`,
    );
  const repoRelative = posixPath(relative(repo, candidate));
  if (!checkIgnored(repo, repoRelative))
    throw new ContractError(
      `generated-file artifacts pointer must be ignored: ${candidate}`,
    );
  return [candidate, repoRelative];
}

function validateRelativePath(
  repo: string,
  value: JsonValue,
  leafSymlink = true,
): string {
  if (typeof value !== "string" || !value)
    throw new ContractError("path must be a non-empty UTF-8 string");
  if (hasControlCharacter(value))
    throw new ContractError(`control character in path: ${pythonRepr(value)}`);
  if (value.startsWith(":"))
    throw new ContractError(`Git pathspec magic is forbidden: ${value}`);
  if (!normalizedRelativePosix(value))
    throw new ContractError(
      `path is not normalized repo-relative POSIX syntax: ${value}`,
    );
  const parts = value.split("/");
  for (const [index, component] of parts.entries()) {
    const cursor = join(repo, ...parts.slice(0, index + 1));
    if (!existsOrSymlink(cursor)) continue;
    const metadata = lstatSync(cursor);
    const isLeaf = index === parts.length - 1;
    if (metadata.isSymbolicLink() && !(isLeaf && leafSymlink))
      throw new ContractError(`symlink parent/path ambiguity: ${value}`);
    if (!isLeaf && !metadata.isDirectory())
      throw new ContractError(`non-directory path parent: ${value}`);
  }
  return value;
}

function absoluteCliPath(value: JsonValue, label: string): string {
  if (typeof value !== "string" || !value || !value.startsWith("/"))
    throw new ContractError(`${label} must be an absolute path`);
  if (hasControlCharacter(value))
    throw new ContractError(`control character in ${label}`);
  const components = value.slice(1).split("/");
  if (
    !components.length ||
    components.some((component) => ["", ".", ".."].includes(component))
  )
    throw new ContractError(
      `${label} contains lexical traversal or non-normalized components`,
    );
  if (normalize(value) !== value)
    throw new ContractError(`${label} is not lexically normalized`);
  return value;
}

function ensureNoSymlinkChain(path: string, stop: string): void {
  const resolvedStop = realpathSync(stop);
  const lexicalPath = resolve(path);
  const descendant = relative(resolvedStop, lexicalPath);
  if (descendant === ".." || descendant.startsWith(`..${sep}`))
    throw new ContractError(`path escapes repository: ${path}`);
  const parts = descendant ? descendant.split(sep) : [];
  for (const [index] of parts.entries()) {
    const cursor = join(resolvedStop, ...parts.slice(0, index + 1));
    if (existsOrSymlink(cursor) && lstatSync(cursor).isSymbolicLink())
      throw new ContractError(`symlink traversal is not allowed: ${cursor}`);
  }
}

function secureRelativeComponents(base: string, target: string): string[] {
  const descendant = relative(base, target);
  if (
    descendant === ".." ||
    descendant.startsWith(`..${sep}`) ||
    isAbsolute(descendant)
  )
    throw new ContractError(`path escapes repository: ${target}`);
  return descendant ? descendant.split(sep) : [];
}

export function withSecureDirectory<Result>(
  base: string,
  components: readonly string[],
  create: boolean,
  callback: (directory: SecureDirectory) => Result,
): Result {
  const directory = traverseSecureDirectory(base, components, create);
  try {
    return callback(directory);
  } finally {
    closeSync(directory.descriptor);
  }
}

function traverseSecureDirectory(
  base: string,
  components: readonly string[],
  create: boolean,
): SecureDirectory {
  const flags =
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
  let descriptor: number | undefined;
  let cursor = base;
  try {
    descriptor = openSync(base, flags);
    for (const component of components) {
      validateNativeLeaf(component, "artifacts directory component");
      if (create) nativeMkdirAt(descriptor, component, 0o700);
      const nextDescriptor = nativeOpenAt(descriptor, component, flags, 0);
      if (nextDescriptor < 0)
        throw new ContractError(
          `cannot open safe artifacts directory component: ${component}`,
        );
      closeSync(descriptor);
      descriptor = nextDescriptor;
      cursor = join(cursor, component);
    }
    return { descriptor, path: cursor };
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    const caughtError = error as Error;
    if (caughtError instanceof ContractError) throw caughtError;
    throw new ContractError(
      `cannot create safe artifacts directory under ${base}: ${caughtError.message}`,
    );
  }
}

export function writeOrVerifyImmutable(
  directory: SecureDirectory,
  leaf: string,
  raw: Uint8Array,
  mode = 0o444,
): void {
  validateNativeLeaf(leaf, "immutable artifact filename");
  const path = join(directory.path, leaf);
  const readDescriptor = nativeOpenAt(
    directory.descriptor,
    leaf,
    constants.O_RDONLY | constants.O_NOFOLLOW,
    0,
  );
  if (readDescriptor >= 0) {
    try {
      if (
        !fstatSync(readDescriptor).isFile() ||
        !equalBytes(readFileSync(readDescriptor), raw)
      )
        throw new ContractError(`immutable artifacts collision: ${path}`);
      return;
    } finally {
      closeSync(readDescriptor);
    }
  }
  const writeDescriptor = nativeOpenAt(
    directory.descriptor,
    leaf,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    mode,
  );
  if (writeDescriptor < 0)
    throw new ContractError(`immutable artifacts collision: ${path}`);
  try {
    writeAll(writeDescriptor, raw);
    fsyncSync(writeDescriptor);
  } catch (error) {
    nativeUnlinkAt(directory.descriptor, leaf);
    throw error;
  } finally {
    closeSync(writeDescriptor);
  }
}

export function readImmutable(
  directory: SecureDirectory,
  leaf: string,
): Uint8Array {
  validateNativeLeaf(leaf, "immutable artifact filename");
  const descriptor = nativeOpenAt(
    directory.descriptor,
    leaf,
    constants.O_RDONLY | constants.O_NOFOLLOW,
    0,
  );
  if (descriptor < 0)
    throw new ContractError(
      `immutable artifact is missing or unsafe: ${join(directory.path, leaf)}`,
    );
  try {
    if (!fstatSync(descriptor).isFile())
      throw new ContractError(
        `immutable artifact is missing or unsafe: ${join(directory.path, leaf)}`,
      );
    return readFileSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function validateNativeLeaf(value: string, label: string): void {
  if (
    ["", ".", ".."].includes(value) ||
    value.includes("/") ||
    value.includes("\0")
  )
    throw new ContractError(`unsafe ${label}: ${pythonRepr(value)}`);
}

function nativePath(value: string): Buffer {
  return Buffer.from(`${value}\0`);
}

function nativeFilesystem(): NativeFilesystem {
  if (loadedNativeFilesystem) return loadedNativeFilesystem;
  const sourceDirectory = mkdtempSync(
    join(tmpdir(), "validate-scoped-save-native-"),
  );
  const sourcePath = join(sourceDirectory, "filesystem.c");
  try {
    writeFileSync(sourcePath, NATIVE_SOURCE, {
      encoding: "utf-8",
      flag: "wx",
      mode: 0o600,
    });
    loadedNativeFilesystem = cc({
      source: sourcePath,
      symbols: {
        secureMkdirAt: {
          args: [FFIType.i32, FFIType.ptr, FFIType.u32],
          returns: FFIType.i32,
        },
        secureOpenAt: {
          args: [FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.u32],
          returns: FFIType.i32,
        },
        secureRootOptionsEnded: {
          args: [FFIType.ptr],
          returns: FFIType.i32,
        },
        secureUnlinkAt: {
          args: [FFIType.i32, FFIType.ptr, FFIType.i32],
          returns: FFIType.i32,
        },
      },
    }) as NativeFilesystem;
    return loadedNativeFilesystem;
  } finally {
    rmSync(sourceDirectory, { recursive: true });
  }
}

function nativeMkdirAt(
  directoryDescriptor: number,
  leaf: string,
  mode: number,
): void {
  const encoded = nativePath(leaf);
  nativeFilesystem().symbols.secureMkdirAt(
    directoryDescriptor,
    ptr(encoded),
    mode,
  );
}

function nativeOpenAt(
  directoryDescriptor: number,
  leaf: string,
  flags: number,
  mode: number,
): number {
  const encoded = nativePath(leaf);
  return nativeFilesystem().symbols.secureOpenAt(
    directoryDescriptor,
    ptr(encoded),
    flags,
    mode,
  );
}

function nativeUnlinkAt(directoryDescriptor: number, leaf: string): void {
  const encoded = nativePath(leaf);
  nativeFilesystem().symbols.secureUnlinkAt(
    directoryDescriptor,
    ptr(encoded),
    0,
  );
}

function commandLineArguments(): string[] {
  const argumentsList = process.argv.slice(2);
  const entrypoint = process.argv[1];
  if (!entrypoint) return argumentsList;
  const encoded = nativePath(entrypoint);
  return nativeFilesystem().symbols.secureRootOptionsEnded(ptr(encoded))
    ? ["--", ...argumentsList]
    : argumentsList;
}

function parseArguments(argv: string[]): Arguments | null {
  const rootOptionsEnded = argv[0] === "--";
  const argumentsList = rootOptionsEnded ? argv.slice(1) : argv;
  if (
    !rootOptionsEnded &&
    (argumentsList[0] === "-h" || argumentsList[0] === "--help")
  ) {
    process.stdout.write(
      "usage: validate_scoped_save.ts [-h] {build,preflight,verify,recover} ...\n\n" +
        "Build and verify checksum-bound, exact-path lifecycle save manifests.\n\n" +
        "positional arguments:\n  {build,preflight,verify,recover}\n\n" +
        "options:\n  -h, --help            show this help message and exit\n",
    );
    return null;
  }
  const action = argumentsList[0];
  if (!new Set(["build", "preflight", "verify", "recover"]).has(action ?? ""))
    return argumentError(
      action
        ? `argument command: invalid choice: '${action}' (choose from 'build', 'preflight', 'verify', 'recover')`
        : "the following arguments are required: command",
    );
  const typedAction = action as Arguments["action"];
  const expected = SUBCOMMAND_OPTIONS[typedAction];
  if (argumentsList[1] === "-h" || argumentsList[1] === "--help") {
    process.stdout.write(subcommandHelp(typedAction));
    return null;
  }
  const values: Record<string, string> = {};
  const unknown: string[] = [];
  let optionsEnded = false;
  for (let index = 1; index < argumentsList.length; index += 1) {
    const rawArgument = argumentsList[index]!;
    if (!optionsEnded && (rawArgument === "-h" || rawArgument === "--help")) {
      process.stdout.write(subcommandHelp(typedAction));
      return null;
    }
    if (rawArgument === "--" || optionsEnded) {
      optionsEnded = true;
      unknown.push(rawArgument);
      continue;
    }
    const equals = rawArgument.indexOf("=");
    const optionName = equals < 0 ? rawArgument : rawArgument.slice(0, equals);
    const candidates = expected.filter((option) =>
      option.startsWith(optionName),
    );
    const option = candidates.includes(optionName)
      ? optionName
      : candidates.length === 1
        ? candidates[0]!
        : optionName;
    if (!candidates.includes(optionName) && candidates.length > 1)
      return subcommandArgumentError(
        typedAction,
        `ambiguous option: ${rawArgument} could match ${candidates.join(", ")}`,
      );
    if (!expected.includes(option)) {
      unknown.push(rawArgument);
      continue;
    }
    const inlineValue = equals < 0 ? undefined : rawArgument.slice(equals + 1);
    const value = inlineValue ?? argumentsList[index + 1];
    if (
      value === undefined ||
      (inlineValue === undefined &&
        value.startsWith("-") &&
        value !== "-" &&
        !isNegativeNumber(value))
    )
      return subcommandArgumentError(
        typedAction,
        `argument ${option}: expected one argument`,
      );
    values[option] = value;
    if (inlineValue === undefined) index += 1;
  }
  const missing = expected.filter((option) => values[option] === undefined);
  if (missing.length)
    return subcommandArgumentError(
      typedAction,
      `the following arguments are required: ${missing.join(", ")}`,
    );
  if (unknown.length)
    return argumentError(`unrecognized arguments: ${unknown.join(" ")}`);
  return { action: typedAction, values };
}

function isNegativeNumber(value: string): boolean {
  return /^(?:-\p{Decimal_Number}+|-\p{Decimal_Number}*\.\p{Decimal_Number}+)$/u.test(
    value,
  );
}

function argumentError(message: string): null {
  process.stderr.write(
    "usage: validate_scoped_save.ts [-h] {build,preflight,verify,recover} ...\n" +
      `validate_scoped_save.ts: error: ${message}\n`,
  );
  process.exitCode = 2;
  return null;
}

function subcommandArgumentError(
  action: Arguments["action"],
  message: string,
): null {
  process.stderr.write(
    `${subcommandUsage(action)}\nvalidate_scoped_save.ts ${action}: error: ${message}\n`,
  );
  process.exitCode = 2;
  return null;
}

function subcommandUsage(action: Arguments["action"]): string {
  const usage: Readonly<Record<Arguments["action"], string>> = {
    build:
      "usage: validate_scoped_save.ts build [-h] --repo REPO --work-root WORK_ROOT\n" +
      "                                     --base-rev BASE_REV --scope SCOPE",
    preflight:
      "usage: validate_scoped_save.ts preflight [-h] --repo REPO --manifest MANIFEST\n" +
      "                                         --manifest-sha256 MANIFEST_SHA256",
    verify:
      "usage: validate_scoped_save.ts verify [-h] --repo REPO --manifest MANIFEST\n" +
      "                                      --manifest-sha256 MANIFEST_SHA256\n" +
      "                                      --snapshot SNAPSHOT\n" +
      "                                      --snapshot-sha256 SNAPSHOT_SHA256\n" +
      "                                      --saved-rev SAVED_REV",
    recover:
      "usage: validate_scoped_save.ts recover [-h] --repo REPO --manifest MANIFEST\n" +
      "                                       --manifest-sha256 MANIFEST_SHA256\n" +
      "                                       --snapshot SNAPSHOT\n" +
      "                                       --snapshot-sha256 SNAPSHOT_SHA256\n" +
      "                                       --failed-head FAILED_HEAD",
  };
  return usage[action];
}

function subcommandHelp(action: Arguments["action"]): string {
  const lines = [subcommandUsage(action), "", "options:"];
  lines.push("  -h, --help            show this help message and exit");
  for (const option of SUBCOMMAND_OPTIONS[action]) {
    const metavar = option.slice(2).replaceAll("-", "_").toUpperCase();
    lines.push(`  ${option} ${metavar}`);
  }
  return `${lines.join("\n")}\n`;
}

function loadJson(path: string): [JsonObject, Uint8Array] {
  try {
    const raw = readFileSync(path);
    return [parseJson(raw, path), raw];
  } catch (error) {
    const caughtError = error as Error;
    if (caughtError instanceof ContractError) throw caughtError;
    throw new ContractError(`cannot read JSON ${path}: ${caughtError.message}`);
  }
}

function parseJson(raw: Uint8Array, path: string): JsonObject {
  const text = UTF8.decode(raw);
  assertNoDuplicateJsonKeys(text);
  const value = JSON.parse(text) as JsonValue;
  if (!isJsonObject(value))
    throw new ContractError(`JSON root must be an object: ${path}`);
  return value;
}

function assertNoDuplicateJsonKeys(source: string): void {
  let index = 0;
  const whitespace = () => {
    while (/\s/u.test(source[index] ?? "")) index += 1;
  };
  const string = (): string => {
    const start = index;
    index += 1;
    while (index < source.length) {
      if (source[index] === "\\") {
        index += 2;
        continue;
      }
      if (source[index] === '"') {
        index += 1;
        return JSON.parse(source.slice(start, index)) as string;
      }
      index += 1;
    }
    throw new SyntaxError("unterminated JSON string");
  };
  const value = (): void => {
    whitespace();
    if (source[index] === "{") {
      index += 1;
      whitespace();
      const keys = new Set<string>();
      while (source[index] !== "}") {
        if (source[index] !== '"') throw new SyntaxError("expected object key");
        const key = string();
        if (keys.has(key))
          throw new ContractError(`duplicate JSON key: ${key}`);
        keys.add(key);
        whitespace();
        if (source[index++] !== ":") throw new SyntaxError("expected colon");
        value();
        whitespace();
        if (source[index] === ",") {
          index += 1;
          whitespace();
          continue;
        }
        break;
      }
      if (source[index++] !== "}") throw new SyntaxError("expected object end");
      return;
    }
    if (source[index] === "[") {
      index += 1;
      whitespace();
      while (source[index] !== "]") {
        value();
        whitespace();
        if (source[index] === ",") {
          index += 1;
          continue;
        }
        break;
      }
      if (source[index++] !== "]") throw new SyntaxError("expected array end");
      return;
    }
    if (source[index] === '"') {
      string();
      return;
    }
    const match = source
      .slice(index)
      .match(
        /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/,
      );
    if (!match) throw new SyntaxError("invalid JSON value");
    index += match[0].length;
  };
  value();
  whitespace();
  if (index !== source.length) throw new SyntaxError("trailing JSON content");
}

function canonicalJson(value: JsonValue): Uint8Array {
  return Buffer.from(`${serializeJson(value, false)}\n`);
}

function jsonOutput(value: JsonValue): string {
  return serializeJson(value, true);
}

function serializeJson(value: JsonValue, spaces: boolean): string {
  if (value === null || typeof value !== "object") return jsonPrimitive(value);
  if (Array.isArray(value))
    return `[${value.map((item) => serializeJson(item, spaces)).join(spaces ? ", " : ",")}]`;
  return `{${Object.keys(value)
    .sort(comparePythonStrings)
    .map(
      (key) =>
        `${jsonString(key)}${spaces ? ": " : ":"}${serializeJson(value[key]!, spaces)}`,
    )
    .join(spaces ? ", " : ",")}}`;
}

function jsonPrimitive(value: JsonPrimitive): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new ContractError("unsupported JSON value");
  return serialized;
}

function jsonString(value: string): string {
  return JSON.stringify(value);
}

function requireExactKeys(
  value: JsonObject,
  expected: Set<string>,
  label: string,
): void {
  const actual = new Set(Object.keys(value));
  if (!equalSets(actual, expected)) {
    const missing = [...expected]
      .filter((key) => !actual.has(key))
      .sort(comparePythonStrings);
    const unknown = [...actual]
      .filter((key) => !expected.has(key))
      .sort(comparePythonStrings);
    throw new ContractError(
      `${label} fields differ: missing=${pythonRepr(missing)} unknown=${pythonRepr(unknown)}`,
    );
  }
}

function requireObject(
  value: JsonValue | undefined,
  label: string,
): JsonObject {
  if (!isJsonObject(value))
    throw new ContractError(`${label} must be an object`);
  return value;
}

function requireArray(
  value: JsonValue | undefined,
  label: string,
): JsonValue[] {
  if (!Array.isArray(value))
    throw new ContractError(`${label} must be an array`);
  return value;
}

function requireString(value: JsonValue | undefined, label: string): string {
  if (typeof value !== "string" || !value)
    throw new ContractError(`${label} is missing`);
  return value;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectByPath(entries: PathState[]): Record<string, PathState> {
  return Object.fromEntries(entries.map((entry) => [entry.path, entry]));
}

function stateTuple(
  value: JsonObject | PathState,
): [string, string | null, string | null] {
  return [
    String(value.state),
    nullableString(value.sha256),
    nullableString(value.mode),
  ];
}

function nullableString(value: JsonValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function decodePath(raw: Uint8Array): string {
  let value: string;
  try {
    value = UTF8.decode(raw);
  } catch {
    throw new ContractError("non-UTF-8 repository paths are unsupported");
  }
  if (hasControlCharacter(value))
    throw new ContractError(`control character in path: ${pythonRepr(value)}`);
  return value;
}

function decodeTrimmedPath(raw: Uint8Array): string {
  let start = 0;
  let end = raw.length;
  while (start < end && isAsciiWhitespace(raw[start]!)) start += 1;
  while (end > start && isAsciiWhitespace(raw[end - 1]!)) end -= 1;
  return decodePath(raw.subarray(start, end));
}

function isAsciiWhitespace(byte: number): boolean {
  return byte === 32 || (byte >= 9 && byte <= 13);
}

function decodedLines(raw: Uint8Array): string[] {
  return splitBytes(raw, 10)
    .filter((line) => line.length)
    .map(decodePath);
}

function decodeReplacement(raw: Uint8Array): string {
  return new TextDecoder().decode(raw);
}

function decodeAscii(raw: Uint8Array): string {
  for (const byte of raw)
    if (byte > 127) throw new ContractError("non-ASCII Git metadata");
  return new TextDecoder().decode(raw);
}

function checkIgnored(repo: string, path: string): boolean {
  const result = runGit(
    repo,
    ["check-ignore", "-q", "--no-index", "--", path],
    false,
  );
  if (![0, 1].includes(result.exitCode))
    throw new ContractError(
      `git check-ignore failed for ${path}: ${decodeReplacement(result.stderr).trim()}`,
    );
  return result.exitCode === 0;
}

function which(command: string): string | null {
  for (const directory of (process.env.PATH ?? "/usr/bin:/bin").split(":")) {
    const candidate = join(directory, command);
    try {
      accessSync(candidate, constants.X_OK);
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function normalizedRelativePosix(value: string): boolean {
  return (
    !posix.isAbsolute(value) &&
    posix.normalize(value) === value &&
    value === value.replaceAll("\\", "/") &&
    value.split("/").every((component) => !["", ".", ".."].includes(component))
  );
}

function requireContainedPath(
  path: string,
  parent: string,
  message: string,
  requireChild = false,
): void {
  const descendant = relative(parent, path);
  if (
    descendant === ".." ||
    descendant.startsWith(`..${sep}`) ||
    isAbsolute(descendant) ||
    (requireChild && !descendant)
  )
    throw new ContractError(message);
}

function regularFileWithoutSymlink(path: string): boolean {
  return (
    existsOrSymlink(path) &&
    !lstatSync(path).isSymbolicLink() &&
    statSync(path).isFile()
  );
}

function existsOrSymlink(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    const caughtError = error as NodeJS.ErrnoException;
    if (caughtError.code === "ENOENT") return false;
    throw caughtError;
  }
}

function writeAll(descriptor: number, raw: Uint8Array): void {
  for (let offset = 0; offset < raw.length;) {
    offset += writeSync(descriptor, raw, offset);
  }
}

function splitBytes(raw: Uint8Array, delimiter: number): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let start = 0;
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== delimiter) continue;
    parts.push(raw.subarray(start, index));
    start = index + 1;
  }
  parts.push(raw.subarray(start));
  return parts;
}

function splitAtMost(
  raw: Uint8Array,
  delimiter: number,
  maximumSplits: number,
): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let start = 0;
  for (
    let index = 0;
    index < raw.length && parts.length < maximumSplits;
    index += 1
  ) {
    if (raw[index] !== delimiter) continue;
    parts.push(raw.subarray(start, index));
    start = index + 1;
  }
  parts.push(raw.subarray(start));
  return parts;
}

function joinBytes(parts: Uint8Array[], separator: number): Uint8Array {
  return Buffer.concat(
    parts.flatMap((part, index) =>
      index
        ? [Buffer.from([separator]), Buffer.from(part)]
        : [Buffer.from(part)],
    ),
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

function equalArrays(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return deepEqual(left, right);
}

function equalSets<T>(left: Set<T>, right: Set<T>): boolean {
  return left.size === right.size && [...left].every((item) => right.has(item));
}

function deepEqual(left: unknown, right: unknown): boolean {
  return (
    serializeJson(left as JsonValue, false) ===
    serializeJson(right as JsonValue, false)
  );
}

function comparePythonStrings(left: string, right: string): number {
  const leftPoints = [...left].map((character) => character.codePointAt(0)!);
  const rightPoints = [...right].map((character) => character.codePointAt(0)!);
  for (
    let index = 0;
    index < Math.min(leftPoints.length, rightPoints.length);
    index += 1
  ) {
    if (leftPoints[index] !== rightPoints[index])
      return leftPoints[index]! - rightPoints[index]!;
  }
  return leftPoints.length - rightPoints.length;
}

function pythonCasefold(value: string): string {
  const expansions: Readonly<Record<string, string>> = {
    "\u00b5": "\u03bc",
    "\u00df": "ss",
    "\u0149": "\u02bcn",
    "\u017f": "s",
    "\u01f0": "j\u030c",
    "\u0345": "\u03b9",
    "\u0390": "\u03b9\u0308\u0301",
    "\u03b0": "\u03c5\u0308\u0301",
    "\u03c2": "\u03c3",
    "\u03d0": "\u03b2",
    "\u03d1": "\u03b8",
    "\u03d5": "\u03c6",
    "\u03d6": "\u03c0",
    "\u03f0": "\u03ba",
    "\u03f1": "\u03c1",
    "\u03f5": "\u03b5",
    "\u0587": "\u0565\u0582",
    "\u13a0": "\u13a0",
    "\u13a1": "\u13a1",
    "\u13a2": "\u13a2",
    "\u13a3": "\u13a3",
    "\u13a4": "\u13a4",
    "\u13a5": "\u13a5",
    "\u13a6": "\u13a6",
    "\u13a7": "\u13a7",
    "\u13a8": "\u13a8",
    "\u13a9": "\u13a9",
    "\u13aa": "\u13aa",
    "\u13ab": "\u13ab",
    "\u13ac": "\u13ac",
    "\u13ad": "\u13ad",
    "\u13ae": "\u13ae",
    "\u13af": "\u13af",
    "\u13b0": "\u13b0",
    "\u13b1": "\u13b1",
    "\u13b2": "\u13b2",
    "\u13b3": "\u13b3",
    "\u13b4": "\u13b4",
    "\u13b5": "\u13b5",
    "\u13b6": "\u13b6",
    "\u13b7": "\u13b7",
    "\u13b8": "\u13b8",
    "\u13b9": "\u13b9",
    "\u13ba": "\u13ba",
    "\u13bb": "\u13bb",
    "\u13bc": "\u13bc",
    "\u13bd": "\u13bd",
    "\u13be": "\u13be",
    "\u13bf": "\u13bf",
    "\u13c0": "\u13c0",
    "\u13c1": "\u13c1",
    "\u13c2": "\u13c2",
    "\u13c3": "\u13c3",
    "\u13c4": "\u13c4",
    "\u13c5": "\u13c5",
    "\u13c6": "\u13c6",
    "\u13c7": "\u13c7",
    "\u13c8": "\u13c8",
    "\u13c9": "\u13c9",
    "\u13ca": "\u13ca",
    "\u13cb": "\u13cb",
    "\u13cc": "\u13cc",
    "\u13cd": "\u13cd",
    "\u13ce": "\u13ce",
    "\u13cf": "\u13cf",
    "\u13d0": "\u13d0",
    "\u13d1": "\u13d1",
    "\u13d2": "\u13d2",
    "\u13d3": "\u13d3",
    "\u13d4": "\u13d4",
    "\u13d5": "\u13d5",
    "\u13d6": "\u13d6",
    "\u13d7": "\u13d7",
    "\u13d8": "\u13d8",
    "\u13d9": "\u13d9",
    "\u13da": "\u13da",
    "\u13db": "\u13db",
    "\u13dc": "\u13dc",
    "\u13dd": "\u13dd",
    "\u13de": "\u13de",
    "\u13df": "\u13df",
    "\u13e0": "\u13e0",
    "\u13e1": "\u13e1",
    "\u13e2": "\u13e2",
    "\u13e3": "\u13e3",
    "\u13e4": "\u13e4",
    "\u13e5": "\u13e5",
    "\u13e6": "\u13e6",
    "\u13e7": "\u13e7",
    "\u13e8": "\u13e8",
    "\u13e9": "\u13e9",
    "\u13ea": "\u13ea",
    "\u13eb": "\u13eb",
    "\u13ec": "\u13ec",
    "\u13ed": "\u13ed",
    "\u13ee": "\u13ee",
    "\u13ef": "\u13ef",
    "\u13f0": "\u13f0",
    "\u13f1": "\u13f1",
    "\u13f2": "\u13f2",
    "\u13f3": "\u13f3",
    "\u13f4": "\u13f4",
    "\u13f5": "\u13f5",
    "\u13f8": "\u13f0",
    "\u13f9": "\u13f1",
    "\u13fa": "\u13f2",
    "\u13fb": "\u13f3",
    "\u13fc": "\u13f4",
    "\u13fd": "\u13f5",
    "\u1c80": "\u0432",
    "\u1c81": "\u0434",
    "\u1c82": "\u043e",
    "\u1c83": "\u0441",
    "\u1c84": "\u0442",
    "\u1c85": "\u0442",
    "\u1c86": "\u044a",
    "\u1c87": "\u0463",
    "\u1c88": "\ua64b",
    "\u1e96": "h\u0331",
    "\u1e97": "t\u0308",
    "\u1e98": "w\u030a",
    "\u1e99": "y\u030a",
    "\u1e9a": "a\u02be",
    "\u1e9b": "\u1e61",
    "\u1e9e": "ss",
    "\u1f50": "\u03c5\u0313",
    "\u1f52": "\u03c5\u0313\u0300",
    "\u1f54": "\u03c5\u0313\u0301",
    "\u1f56": "\u03c5\u0313\u0342",
    "\u1f80": "\u1f00\u03b9",
    "\u1f81": "\u1f01\u03b9",
    "\u1f82": "\u1f02\u03b9",
    "\u1f83": "\u1f03\u03b9",
    "\u1f84": "\u1f04\u03b9",
    "\u1f85": "\u1f05\u03b9",
    "\u1f86": "\u1f06\u03b9",
    "\u1f87": "\u1f07\u03b9",
    "\u1f88": "\u1f00\u03b9",
    "\u1f89": "\u1f01\u03b9",
    "\u1f8a": "\u1f02\u03b9",
    "\u1f8b": "\u1f03\u03b9",
    "\u1f8c": "\u1f04\u03b9",
    "\u1f8d": "\u1f05\u03b9",
    "\u1f8e": "\u1f06\u03b9",
    "\u1f8f": "\u1f07\u03b9",
    "\u1f90": "\u1f20\u03b9",
    "\u1f91": "\u1f21\u03b9",
    "\u1f92": "\u1f22\u03b9",
    "\u1f93": "\u1f23\u03b9",
    "\u1f94": "\u1f24\u03b9",
    "\u1f95": "\u1f25\u03b9",
    "\u1f96": "\u1f26\u03b9",
    "\u1f97": "\u1f27\u03b9",
    "\u1f98": "\u1f20\u03b9",
    "\u1f99": "\u1f21\u03b9",
    "\u1f9a": "\u1f22\u03b9",
    "\u1f9b": "\u1f23\u03b9",
    "\u1f9c": "\u1f24\u03b9",
    "\u1f9d": "\u1f25\u03b9",
    "\u1f9e": "\u1f26\u03b9",
    "\u1f9f": "\u1f27\u03b9",
    "\u1fa0": "\u1f60\u03b9",
    "\u1fa1": "\u1f61\u03b9",
    "\u1fa2": "\u1f62\u03b9",
    "\u1fa3": "\u1f63\u03b9",
    "\u1fa4": "\u1f64\u03b9",
    "\u1fa5": "\u1f65\u03b9",
    "\u1fa6": "\u1f66\u03b9",
    "\u1fa7": "\u1f67\u03b9",
    "\u1fa8": "\u1f60\u03b9",
    "\u1fa9": "\u1f61\u03b9",
    "\u1faa": "\u1f62\u03b9",
    "\u1fab": "\u1f63\u03b9",
    "\u1fac": "\u1f64\u03b9",
    "\u1fad": "\u1f65\u03b9",
    "\u1fae": "\u1f66\u03b9",
    "\u1faf": "\u1f67\u03b9",
    "\u1fb2": "\u1f70\u03b9",
    "\u1fb3": "\u03b1\u03b9",
    "\u1fb4": "\u03ac\u03b9",
    "\u1fb6": "\u03b1\u0342",
    "\u1fb7": "\u03b1\u0342\u03b9",
    "\u1fbc": "\u03b1\u03b9",
    "\u1fbe": "\u03b9",
    "\u1fc2": "\u1f74\u03b9",
    "\u1fc3": "\u03b7\u03b9",
    "\u1fc4": "\u03ae\u03b9",
    "\u1fc6": "\u03b7\u0342",
    "\u1fc7": "\u03b7\u0342\u03b9",
    "\u1fcc": "\u03b7\u03b9",
    "\u1fd2": "\u03b9\u0308\u0300",
    "\u1fd3": "\u03b9\u0308\u0301",
    "\u1fd6": "\u03b9\u0342",
    "\u1fd7": "\u03b9\u0308\u0342",
    "\u1fe2": "\u03c5\u0308\u0300",
    "\u1fe3": "\u03c5\u0308\u0301",
    "\u1fe4": "\u03c1\u0313",
    "\u1fe6": "\u03c5\u0342",
    "\u1fe7": "\u03c5\u0308\u0342",
    "\u1ff2": "\u1f7c\u03b9",
    "\u1ff3": "\u03c9\u03b9",
    "\u1ff4": "\u03ce\u03b9",
    "\u1ff6": "\u03c9\u0342",
    "\u1ff7": "\u03c9\u0342\u03b9",
    "\u1ffc": "\u03c9\u03b9",
    "\uab70": "\u13a0",
    "\uab71": "\u13a1",
    "\uab72": "\u13a2",
    "\uab73": "\u13a3",
    "\uab74": "\u13a4",
    "\uab75": "\u13a5",
    "\uab76": "\u13a6",
    "\uab77": "\u13a7",
    "\uab78": "\u13a8",
    "\uab79": "\u13a9",
    "\uab7a": "\u13aa",
    "\uab7b": "\u13ab",
    "\uab7c": "\u13ac",
    "\uab7d": "\u13ad",
    "\uab7e": "\u13ae",
    "\uab7f": "\u13af",
    "\uab80": "\u13b0",
    "\uab81": "\u13b1",
    "\uab82": "\u13b2",
    "\uab83": "\u13b3",
    "\uab84": "\u13b4",
    "\uab85": "\u13b5",
    "\uab86": "\u13b6",
    "\uab87": "\u13b7",
    "\uab88": "\u13b8",
    "\uab89": "\u13b9",
    "\uab8a": "\u13ba",
    "\uab8b": "\u13bb",
    "\uab8c": "\u13bc",
    "\uab8d": "\u13bd",
    "\uab8e": "\u13be",
    "\uab8f": "\u13bf",
    "\uab90": "\u13c0",
    "\uab91": "\u13c1",
    "\uab92": "\u13c2",
    "\uab93": "\u13c3",
    "\uab94": "\u13c4",
    "\uab95": "\u13c5",
    "\uab96": "\u13c6",
    "\uab97": "\u13c7",
    "\uab98": "\u13c8",
    "\uab99": "\u13c9",
    "\uab9a": "\u13ca",
    "\uab9b": "\u13cb",
    "\uab9c": "\u13cc",
    "\uab9d": "\u13cd",
    "\uab9e": "\u13ce",
    "\uab9f": "\u13cf",
    "\uaba0": "\u13d0",
    "\uaba1": "\u13d1",
    "\uaba2": "\u13d2",
    "\uaba3": "\u13d3",
    "\uaba4": "\u13d4",
    "\uaba5": "\u13d5",
    "\uaba6": "\u13d6",
    "\uaba7": "\u13d7",
    "\uaba8": "\u13d8",
    "\uaba9": "\u13d9",
    "\uabaa": "\u13da",
    "\uabab": "\u13db",
    "\uabac": "\u13dc",
    "\uabad": "\u13dd",
    "\uabae": "\u13de",
    "\uabaf": "\u13df",
    "\uabb0": "\u13e0",
    "\uabb1": "\u13e1",
    "\uabb2": "\u13e2",
    "\uabb3": "\u13e3",
    "\uabb4": "\u13e4",
    "\uabb5": "\u13e5",
    "\uabb6": "\u13e6",
    "\uabb7": "\u13e7",
    "\uabb8": "\u13e8",
    "\uabb9": "\u13e9",
    "\uabba": "\u13ea",
    "\uabbb": "\u13eb",
    "\uabbc": "\u13ec",
    "\uabbd": "\u13ed",
    "\uabbe": "\u13ee",
    "\uabbf": "\u13ef",
    "\ufb00": "ff",
    "\ufb01": "fi",
    "\ufb02": "fl",
    "\ufb03": "ffi",
    "\ufb04": "ffl",
    "\ufb05": "st",
    "\ufb06": "st",
    "\ufb13": "\u0574\u0576",
    "\ufb14": "\u0574\u0565",
    "\ufb15": "\u0574\u056b",
    "\ufb16": "\u057e\u0576",
    "\ufb17": "\u0574\u056d",
  };
  return [...value]
    .map((character) => expansions[character] ?? character.toLowerCase())
    .join("");
}

function pythonRepr(value: unknown): string {
  if (typeof value === "string")
    return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
  if (Array.isArray(value)) return `[${value.map(pythonRepr).join(", ")}]`;
  if (value === null) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  return String(value);
}

function pythonBytesRepr(value: Uint8Array): string {
  return `b'${[...value]
    .map((byte) =>
      byte >= 32 && byte < 127 && byte !== 39 && byte !== 92
        ? String.fromCharCode(byte)
        : `\\x${byte.toString(16).padStart(2, "0")}`,
    )
    .join("")}'`;
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codepoint = character.codePointAt(0)!;
    return codepoint < 32 || codepoint === 127;
  });
}

function posixPath(path: string): string {
  return path.split(sep).join("/");
}

if (import.meta.main) process.exitCode = main();
