# GIT-PR-TYPE-04: Isolate Mechanical and Behavioral Changes

## Severity

error

## Intent

Renames, file moves, codemods, formatting sweeps, and pure restructuring do not
hide behavior changes in the same implementation diff. Reviewers may scan a
uniform mechanical diff quickly only when its behavior is unchanged.

## Scan

Compare symbols, signatures, control flow, and observable outputs before and
after the mechanical transformation. Report the rule when the diff also adds,
removes, or changes behavior.

## Fix

Separate the mechanical transformation from the behavior change. Imports and
references required solely by a move remain mechanical; signature, invariant,
or control-flow changes belong to the behavioral diff. Use
[stacked-prs.md](../../../skills/pr/references/stacked-prs.md) to arrange the
resulting changes.

## Edge Cases

- A formatter or lint autofix is mechanical only when it preserves behavior.
- A codemod needed to reproduce a uniform transformation belongs with that
  transformation.
- A latent bug discovered during a rename is fixed separately rather than
  hidden in the rename diff.

## Related

GIT-PR-SIZE-03, GIT-PR-TYPE-02, GIT-PR-TYPE-05
