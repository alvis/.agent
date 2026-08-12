# GIT-PR-TYPE-05: Isolate or Mark Generated Output

## Severity

warning

## Intent

Generated artifacts are isolated when practical. In a mixed implementation
diff, every generated path is identifiable as generated and the rendered PR
message names its source or generator, so reviewers can distinguish authored
logic from derived output.

## Scan

Compare the classifier's generated paths with the implementation diff, Git
attributes, and the rendered Generated Files section. Report unmarked paths,
missing source or generator evidence, or generated output mixed with unrelated
authored changes when separation is practical.

## Fix

Move the generated output into a focused diff or mark every generated path and
its source or generator in the selected PR message. Configure
`linguist-generated=true` when the repository supports it, without excluding
the path from the PR file count.

## Edge Cases

- A path that humans edit and review as source is authored even if a tool
  originally created it.
- Lockfiles remain in the file count while their additions and deletions are
  excluded from authored net LOC.
- Snapshot-only changes may remain together when they are one reproducible
  generated surface.

## Related

GIT-PR-02, GIT-PR-SIZE-01, GIT-PR-SIZE-03, GIT-PR-SIZE-04,
GIT-PR-TYPE-04
