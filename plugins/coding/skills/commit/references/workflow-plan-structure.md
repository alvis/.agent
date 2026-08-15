# Plan change structure BEFORE writing code

Follow `essential:references/directions/plan.md`; this reference adds commit and
pull-request structure to that shared plan contract.

This reference is consulted at the START of any non-trivial task, before code edits begin. The goal: structure work so that commits and PRs end up independently mergeable, with no forward references, and no "split by directory" anti-patterns. See [SKILL.md](../SKILL.md) for the overall pipeline.

## First principle: domain coherence

A commit is a unit of intent, not a unit of file system location. One feature that touches data, service, and UI layers is **ONE commit**, NOT three commits split by directory.

### Good (domain-coherent)

```
feat(user-profile): add avatar upload
├── packages/data/src/user/avatar.ts
├── packages/service/src/user/uploadAvatar.ts
└── packages/web/src/components/AvatarPicker.tsx
```

### Bad (directory-sliced)

```
feat(data): add avatar field        # broken on its own — service uses field that exists but no upload
feat(service): add upload endpoint  # broken on its own — UI doesn't call it yet
feat(web): add avatar picker        # broken on its own — calls service that doesn't exist (forward ref!)
```

The "bad" form fails the self-containment rule in [SKILL.md](../SKILL.md) hard rules: each change must compile + lint + test in isolation.

## Layering check: no forward references

For each candidate commit in the plan, ask: **"If I checked out exactly this commit on top of `main@origin`, does it build?"** If the answer is no because it calls into something not yet introduced, the split is wrong.

Forward references typically appear when:

- UI commits land before the service/data they call
- A `package.json` `dependencies` bump lands in a different commit than the code that uses the new API
- A `tsconfig` `paths` mapping lands later than imports that resolve through it

## Shared-file evolution

Files like `package.json`, `tsconfig.json`, lockfiles, schema migration files, and central type registries are touched by many features. Plan for **incremental evolution**, not a single batch dump:

- Commit A introduces dependency `X` AND the first code that uses it
- Commit B uses more of `X` — bumps `package.json` only if needed
- Lockfile updates ride alongside their `package.json` change in the SAME commit

Never separate `package.json` from the code that needs the new dep — that's a forward reference disguised as "tidiness".

## Upfront decision: one PR or many bookmarks?

Before coding, answer:

1. **Is this one logical feature or several?**
   - One feature, one PR: default path → end with single commit on `@`, no `--create-pr` flag needed beyond the basic save.
   - Several independent features: stacked PRs → plan the bookmark chain now, use `--create-pr` later.
2. **Can each piece be reviewed and merged independently?** If not, it's one PR.
3. **Does each piece deliver standalone value?** If not, it's one PR.

If "many bookmarks":

- Sketch the chain order: `feat-a/01-data` → `feat-a/02-service` → `feat-a/03-ui` (each layer compiles standalone)
- Confirm the order respects layering (lower layers first)
- Each saved change will be handed to [`coding:pr create`](../../pr/references/create-update.md), which owns bookmark and draft-PR publication.

## Concrete examples

### Example A: feature with three layers (ONE commit)

User asks: "add password reset flow". Plan:

```
feat(auth): add password reset flow
- packages/data/src/auth/resetToken.ts          (new token model)
- packages/service/src/auth/requestReset.ts     (issue token + email)
- packages/service/src/auth/confirmReset.ts     (verify token + update password)
- packages/web/src/components/PasswordReset.tsx (UI)
- packages/web/src/pages/reset/[token].tsx      (route)
```

One commit. Each layer alone is broken; together they form one shippable feature.

### Example B: two independent features (TWO commits, stacked PRs)

User asks: "add password reset AND profile picture upload". Plan:

```
01 feat(auth): add password reset flow      → bookmark feat-x/01-reset
02 feat(user-profile): add avatar upload    → bookmark feat-x/02-avatar
```

Two commits. Each is independent. `/coding:commit --create-pr` preserves the
compatibility call and delegates the saved stack to
[`coding:pr create`](../../pr/references/create-update.md).

### Example C: refactor that enables a feature (TWO commits, layered)

```
01 refactor(auth): extract token validation into shared util   (pure refactor, zero behaviour change)
02 feat(auth): add password reset flow                          (uses the new util)
```

The refactor commit must compile + pass tests with no behaviour change. Verify the layering: at commit 01, no caller of the new util exists yet — that's fine as long as it's exported and unit-tested.

## Output of planning

Before invoking [workflow-save-local.md](./workflow-save-local.md),
[workflow-split.md](./workflow-split.md), or handing publication to
[`coding:pr create`](../../pr/references/create-update.md), produce:

1. Ordered list of intended commits
2. For each: conventional title (see [conventional-commits.md](./conventional-commits.md)) + file list
3. Rationale: how each layer compiles in isolation
4. PR strategy: single PR or stacked

Present this plan to the user BEFORE writing code. Re-confirm if scope grows during implementation.
