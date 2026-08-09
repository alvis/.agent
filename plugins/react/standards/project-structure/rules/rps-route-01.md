# RPS-ROUTE-01: Route-Local Folder Is `components/`, Not `_components/`

## Intent

Route-local components belong in `src/app/<route>/components/` — not `_components/`. Next.js's leading-underscore convention exists to opt a folder out of route resolution, but it is not a structural marker for "this is route-local." Our project uses `components/` everywhere — route-local and shared — and relies on the *path* (under `src/app/<route>/`) to mark it as route-local. This keeps grep, IDE navigation, and folder structure uniform across the entire project.

## Fix

- Rename `src/app/<route>/_components/` to `src/app/<route>/components/`.
- Update imports inside the route to use `./components/...`.
- If the folder name was relied on to keep Next.js from treating a file as a route, verify after renaming that no `.tsx` files inside accidentally satisfy the page/route/layout conventions — only `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `template.tsx`, `default.tsx`, and `route.ts` (in `app/`) are picked up by Next.js, so a regular `components/` folder containing other names is safe.

## Code Superpowers

- Walk `src/app/` and flag any folder named `_components` (or any other underscore-prefixed structural folder we do not sanction).
- Diff against the allowed Next.js special file list and confirm nothing inside `components/` matches a Next.js route filename.

## Common Mistakes

1. Carrying over the `_components/` convention from a starter template.
2. Using `_components/` in some routes and `components/` in others — inconsistency across routes.
3. Putting a `page.tsx` inside `components/` (Next.js will not route it, but it confuses readers).

## Edge Cases

- **Other underscore folders** (`_lib/`, `_utils/`): also rename. The constitution does not sanction underscore-prefixed folders. Route-local utilities, when actually needed, can live inline alongside `components/` or be promoted to `src/utilities/`.
- **`(group)` folder syntax**: parenthesized route groups are a Next.js routing feature and are allowed.

## Related

- `RPS-LAYOUT-01` — decision order
- `RPS-ROUTE-02` — `page.tsx` composition rule
- `plugin:coding:standard:file-structure` — file/folder naming
