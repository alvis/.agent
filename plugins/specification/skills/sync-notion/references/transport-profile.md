# Notion transport profile

Every remote operation receives
`--transport-profile=<absolute-profile-file>`. There is no implicit profile,
PATH lookup, bundled binary, or origin-workspace fallback. The file is
destination/team-owned configuration and contains no credential; authentication
comes only from `NOTION_TOKEN` at invocation time.

## File safety

Before parsing, require an absolute normalized path, safe non-symlink parent
components, and a non-symlink regular file. Reject group/world-writable files,
duplicate JSON keys, unknown fields, placeholders, control characters, and any
field/key/value that carries a token, secret, authorization header, private
key, cookie, or environment value. Read it once, retain those exact bytes, and
record their SHA-256. Do not interpolate profile values into a shell command;
invoke the canonical executable with an argv array and only the declared
validated command/flag tokens.

## `notion-sync-transport-profile/v1`

The strict JSON shape is:

```json
{
  "schema": "notion-sync-transport-profile/v1",
  "name": "product-specs",
  "installation": {
    "source": "npm|pipx|homebrew|system-package|team-artifact",
    "package": "exact distribution/package identity",
    "version": "exact non-range version",
    "executable": "/absolute/canonical/path/to/notion-sync",
    "sha256": "64 lowercase hex characters"
  },
  "probes": {
    "version_argv": ["--version"],
    "version_stdout_sha256": "64 lowercase hex characters",
    "help_argv": ["--help"],
    "help_stdout_sha256": "64 lowercase hex characters"
  },
  "capabilities": {
    "recursive_pull": {"command": "pull", "flags": ["--recursive", "--json"], "output_contract": "notion-page-tree-json-v1"},
    "search": {"command": "search", "flags": ["--json"], "output_contract": "notion-search-json-v1"},
    "create": {"command": "create", "flags": ["--json"], "output_contract": "notion-created-page-json-v1"},
    "push": {"command": "push", "flags": ["--json"], "output_contract": "notion-page-write-json-v1"},
    "conditional_update": {
      "support": "supported|unavailable",
      "command": "push|null",
      "flags": ["--expected-revision"],
      "output_contract": "notion-page-write-json-v1|null"
    },
    "conditional_create": {
      "support": "supported|unavailable",
      "command": "create|null",
      "flags": ["--create-if-absent"],
      "output_contract": "notion-created-page-json-v1|null"
    }
  },
  "conformance": {
    "schema": "notion-sync-conformance/v1",
    "evidence": {
      "binary_sha256": "same installation sha256",
      "version": "same exact installation version",
      "help_stdout_sha256": "same probes help digest",
      "capability_vectors": {
        "recursive_pull": ["pull", "--recursive", "--json"],
        "search": ["search", "--json"],
        "create": ["create", "--json"],
        "push": ["push", "--json"],
        "conditional_update": ["push", "--json", "--expected-revision"],
        "conditional_create": ["create", "--json", "--create-if-absent"]
      },
      "output_contracts": {
        "recursive_pull": "notion-page-tree-json-v1",
        "search": "notion-search-json-v1",
        "create": "notion-created-page-json-v1",
        "push": "notion-page-write-json-v1",
        "conditional_update": "notion-page-write-json-v1",
        "conditional_create": "notion-created-page-json-v1"
      },
      "results": {
        "recursive_pull": "pass",
        "search": "pass",
        "create": "pass",
        "push": "pass",
        "conditional_update": "pass|unavailable",
        "conditional_create": "pass|unavailable"
      },
      "tested_at": "UTC ISO-8601 timestamp"
    },
    "evidence_sha256": "sha256 from the bundled v1 canonical evidence serializer"
  }
}
```

All listed keys are required. In v1, the two probe argv arrays must be exactly
the shown inert values. `package`, `version`, commands, and flags are literal
single argv tokens, not fragments containing whitespace or shell syntax. The
four core capability results must be `pass`. `conditional_update` and
`conditional_create` are independent: each is `supported` only when its result
is `pass`, its command equals the corresponding core `push` or `create`
command, and its exact precondition flag is present in verified help. An
unavailable conditional capability uses `command: null`, `flags: []`, and
`output_contract: null`; its conformance vector is `[]`, output contract is the
literal `unavailable`, and result is `unavailable`. Update-CAS evidence never
proves atomic create-if-absent. Such a profile remains valid for read-only
operations. It cannot authorize the corresponding mutation: an existing-page
write without supported `conditional_update`, or a page creation without
supported `conditional_create`, returns `status: refused` with
`next_action: provide_conditional_transport` before any remote or
canonical-local mutation. This differs from `transport_unverified`, which
means the profile itself failed structural, fingerprint, probe, or conformance
verification.

The canonical vector for a core capability is exactly `[command, ...flags]`.
For a supported conditional capability it is the corresponding core vector
followed by the conditional precondition flags. Conformance evidence records
those six exact vectors, their output contracts, and results. The validator
requires exact equality with `capabilities`; a pass result from a different
command or flag vector cannot be reused.

The output contracts are plugin-owned adapters, not free-form labels:

- `notion-page-tree-json-v1` returns one root plus complete recursive units with
  canonical refs, parents, relationships, paths, revisions, and exact bytes;
- `notion-search-json-v1` returns a JSON object containing canonical-ref,
  parent-ref, and title candidates without selecting one;
- `notion-created-page-json-v1` returns the new canonical ref, parent, revision,
  path, relationships, and exact accepted body; and
- `notion-page-write-json-v1` returns canonical ref, compared/precondition
  revision, resulting revision, path, relationships, and exact accepted body.

Any executable needs a separately checksum-bound conformance run proving these
exact output shapes. Help text alone is not an output contract.

Verification binds the exact profile bytes, canonical executable, executable
SHA-256, version output, help output, capability tokens, and canonicalized
conformance evidence. A mismatch in any one field returns
`transport_unverified` before a Notion query or canonical local write. The
completion report records the profile path/digest and actual fingerprints, but
never records `NOTION_TOKEN` or its value.

Run the bundled dependency-free structural verifier before any executable
probe:

```bash
bun run <sync-notion-skill-root>/scripts/validate-transport-profile.ts \
  /absolute/path/to/notion-sync-transport.json
```

The verifier reads the profile once, rejects duplicate/unknown/secret-bearing
content, checks path and mode safety, hashes the exact profile and executable
bytes, validates every strict v1 field, and emits the normalized expected
fingerprints/capabilities. It never executes the transport or reads
`NOTION_TOKEN`.

For command help or a starter profile, run:

```bash
bun run <sync-notion-skill-root>/scripts/validate-transport-profile.ts --help
bun run <sync-notion-skill-root>/scripts/validate-transport-profile.ts --print-template
```

The template output is a secret-free JSON envelope with
`status: unverified_template`. Its nested `profile` has the complete v1 shape,
declares both conditional capabilities unavailable, and contains conspicuous
placeholder fingerprints and paths. It is configuration scaffolding only: do
not pass the envelope to transport, and do not use the nested profile until all
placeholders and checksum-bound conformance evidence have been replaced and
the positional validation command succeeds.

For v1, canonical conformance evidence bytes are produced by the bundled
verifier from the validated fixed-shape `evidence` object using Python
`json.dumps(evidence, ensure_ascii=False, sort_keys=True,
separators=(",", ":"))`, encoded as UTF-8 with no trailing newline. This
restricted algorithm is the contract; it does not depend on an external JCS
implementation. The profile's `evidence_sha256` is SHA-256 of exactly those
bytes.
