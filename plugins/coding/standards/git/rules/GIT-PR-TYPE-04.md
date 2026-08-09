# GIT-PR-TYPE-04: Mechanical Refactors Isolated from Behaviour Changes

## Severity

error

## Intent

Renames, file moves, codemods, and pure restructuring land in dedicated `mechanical-refactor` PRs that contain **no behaviour change**. The reviewer's contract is "type-checker is the safety net; spot-check a few files." That contract is broken the moment a behaviour change is interleaved with the rename.

## Fix

Two-PR sequence:

```text
auth-rename/01-rename     refactor(auth): rename User to Account
auth-rename/02-suspend    feat(auth): add Account.suspend()
```

The mechanical PR is permitted to be large (red zone allowed under `GIT-PR-SIZE-03`) because cognitive load is low:

```typescript
// before (User.ts)
export interface User { id: string; email: string; }

// after (Account.ts) — pure rename, no field added/removed
export interface Account { id: string; email: string; }
```

The follow-up PR adds the new method against the renamed type with no rename noise in the diff.

### Why this matters

- A reviewer scanning a mechanical diff at speed will not catch a behaviour change buried inside it.
- Mechanical PRs qualify for fast-track review precisely because the diff is uniform; mixing breaks the trust.
- Commit a codemod with the mechanical change when the target repository needs
  it to reproduce the diff.

## Edge Cases

- Adjusting an import path because a file moved is part of the mechanical change. Adjusting a call site to use a new method signature is not.
- If a rename reveals a latent bug, file the bug as a follow-up issue and fix it in a separate PR — do not opportunistically fix during the rename.
- Auto-formatters and lint autofixes sweeping over many files count as mechanical and follow this rule.

## Related

GIT-PR-TYPE-01, GIT-PR-TYPE-02, GIT-PR-TYPE-05, GIT-PR-SIZE-03, GIT-PR-STACK-05
