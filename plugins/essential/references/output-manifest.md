# Output manifest and the final size loop

Read this when returning an artifact-writing skill's manifest, or when
combining manifests and running the end-of-run size pass.

Every artifact-writing skill returns explicit final paths it generated or
materially rewrote:

<report>

```yaml
generated_files:
  - /absolute/path/to/file.md
```

</report>

Writers finish all files and links before returning the manifest and never
measure or split independently. The coordinator combines and deduplicates
manifests, selects only absolute `.md` paths inside the resolved target
workspace's `.state/` (excluding any `working.md`), and runs exactly
one pass when eligible paths remain:

```bash
"$ESSENTIAL_ROOT/scripts/check-markdown-size" \
  --engineering-root "$state_root/.state" \
  "${generated_md_files[@]}"
```

The checker canonicalizes the declared root and every path, excludes
traversal, symlink, and other-workspace escapes, and returns every eligible
file greater than 16,384 bytes together (12,288 bytes is authoring guidance
only). The gate does not apply outside `.state/`; the only separate
limit is the 2,000-byte injection limit for Essential's `hooks/ALLAGENT.md`,
`hooks/MAINAGENT.md`, and `hooks/SUBAGENT.md`.

No mechanical limit is not a licence to pad. This is the general length rule
for every written artifact, and the one place it is defined: everywhere the
gate does not reach — `docs/**`, READMEs, and any report or review artifact
written outside `.state/` — match length to what the task needs, covering the
substance and adding no filler sections, redundant summaries, or boilerplate.
A document is the right length when removing a section would change what a
reader does. Authoring standards may add their own limits on top; none of them
restates this rule.

On `split_required`, send all oversized files through one complete split
round — each original path remains a concise overview linking its lowercase
children — then rebuild the final manifest and run one subsequent batch
pass. The checker reports only `pass`, `split_required`, or `invalid`; it
never edits or splits files itself.
