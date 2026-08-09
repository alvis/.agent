# RPS-UTIL-01: `utilities/` Is Pure and React-Unaware; Domain Types Stay in Features

## Intent

`src/utilities/` is for **pure, React-unaware functions** — currency formatting, date math, string parsing, comparators. No JSX, no hooks, no `import` from `react`. The moment a utility reaches for React, it becomes either a component (belongs in `src/components/<bucket>/`) or a domain hook (belongs in `src/features/<domain>/hooks/`). Keeping `utilities/` React-free makes the entire folder usable from non-React contexts (Node scripts, tests, server functions) and keeps the bundle boundary clean.

`src/types/` follows the same purity rule for types: only **globally-shared** types live here (e.g., `ApiResponse<T>`, `Pagination`, `Result<T, E>`). Domain types like `Invoice`, `User`, `Project` belong in `src/features/<domain>/types/` because they describe a domain, not a cross-cutting shape.

## Fix

For misplaced React code in `src/utilities/`:

- File renders JSX → it is a component. Move it to the correct `src/components/<bucket>/` or `src/features/<domain>/components/` (see `RPS-LAYOUT-01`).
- File uses hooks (`useState`, `useEffect`, custom hook starting with `use`) → it is a hook. Move it to `src/features/<domain>/hooks/` if domain-tied. If it is genuinely generic (e.g., `useDebounce`, `useMediaQuery`), place it adjacent to its primary consumer in `src/components/<bucket>/` — the constitution does not allow `src/utilities/` hooks regardless of how generic.
- File imports `react` for any reason → it does not belong in `src/utilities/`.

For misplaced domain types in `src/types/`:

- Move domain types to `src/features/<domain>/types/`.
- Update all imports.
- Keep `src/types/` populated only with cross-cutting shapes that no single feature owns.

```typescript
// ❌ BAD: hook in utilities
// src/utilities/useDebounce.ts
import { useEffect, useState } from 'react';
export function useDebounce<T>(value: T, ms: number): T { ... }

// ❌ BAD: domain type in src/types/
// src/types/Invoice.ts
export interface Invoice { id: string; amount: number; ... }

// ✅ GOOD: pure utility
// src/utilities/formatCurrency.ts
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

// ✅ GOOD: cross-cutting type
// src/types/api.ts
export interface ApiResponse<T> { data: T; meta: { page: number; total: number } }

// ✅ GOOD: domain type in feature
// src/features/billing/types/Invoice.ts
export interface Invoice { id: string; amount: number; ... }
```

## Code Superpowers

- For each file under `src/utilities/**`, parse imports. Flag any import of `react`, `react-dom`, `next/*`, or any `*.tsx` file.
- For each file under `src/utilities/**`, scan for hook patterns: identifier starting with `use` and called at the top level of a function, or any of `useState`/`useEffect`/`useRef`/`useMemo`/`useCallback`/`useContext`/`useReducer`.
- For each file under `src/utilities/**`, scan for JSX (`.tsx` extension or `<Identifier ` in source).
- For each type declared in `src/types/`, check whether the name matches any folder under `src/features/` (e.g., a `User` type while `src/features/auth/` or `src/features/profile/` exists) — flag for review.

## Common Mistakes

1. Putting `useDebounce.ts` in `src/utilities/` because it is "small and generic" — hooks are React.
2. Putting `formatInvoice` in `src/utilities/` — it returns a string but operates on a domain type. Either it is genuinely string-formatting (then accept the primitive fields as args) or it is domain logic (then move it to `features/billing/`).
3. Putting every shared type in `src/types/` for convenience.
4. Importing `clsx` or `tailwind-merge` into a utility — these are React-adjacent. They are allowed in utilities only if the function returns a string (a className) and does not render or hook.

## Edge Cases

- **Validation schemas** (Zod, Yup): pure schemas without React are fine in `src/utilities/`. Schemas tied to a domain shape (e.g., `InvoiceSchema`) belong in `src/features/<domain>/`.
- **Constants and enums**: cross-cutting constants → `src/utilities/constants.ts` or `src/types/`. Domain constants → the feature.
- **API client setup**: a generic HTTP client wrapper (no domain assumptions) belongs in `src/utilities/` (e.g., `src/utilities/http.ts`). Domain `api/` functions live in `src/features/<domain>/api/` and import the client.
- **`Result<T, E>`, `Maybe<T>`, `Brand<T, K>`**: canonical cross-cutting types — `src/types/`.

## Related

- `RPS-LAYOUT-01` — decision order
- `RPS-FEAT-02` — domain types belong with their domain
- `RPS-COMPS-02` — generic hooks placed near their primary component
- `plugin:coding:standard:function` — pure function rules
- `plugin:coding:standard:typescript` — type design
