# RPS-FEAT-02: Container/Presentational Split Inside `features/<domain>/`

## Intent

Inside `src/features/<domain>/`, container responsibilities (data fetching, mutations, orchestration) and presentational responsibilities (prop-in, JSX-out) live in **different files in different folders**. Containers go in `containers/`; presentational components go in `components/`. Mixing the two in one file makes the component impossible to story-test, impossible to render without a network stack, and impossible to reuse with different data sources. The split is structural, not a suggestion.

## Fix

When a file under `src/features/<domain>/components/` calls `useQuery`, `useMutation`, `fetch`, or any other data-fetching primitive:

1. Create a new file under `src/features/<domain>/containers/<Name>Container.tsx`.
2. Move the data-fetching + orchestration logic into the container.
3. Refactor the original component to be pure: it accepts props (the data shape, callbacks) and returns JSX.
4. Wire the container to render the presentational component with the fetched data.
5. Update callers (typically `app/<route>/page.tsx`) to import the container instead of the component.

```typescript
// ❌ BAD: container/presentational mix
// src/features/billing/components/InvoiceList.tsx
export const InvoiceList: FC = () => {
  const { data, isLoading } = useQuery(['invoices'], fetchInvoices);
  if (isLoading) return <Spinner />;
  return <ul className="invoice-list">{data.map((i) => <li key={i.id}>{i.number}</li>)}</ul>;
};

// ✅ GOOD: split
// src/features/billing/components/InvoiceList.tsx
export interface InvoiceListProps { invoices: Invoice[] }
export const InvoiceList: FC<InvoiceListProps> = ({ invoices }) => (
  <ul className="invoice-list">{invoices.map((i) => <li key={i.id}>{i.number}</li>)}</ul>
);

// src/features/billing/containers/InvoiceListContainer.tsx
import { InvoiceList } from '../components/InvoiceList';
import { useInvoices } from '../hooks/useInvoices';
export const InvoiceListContainer: FC = () => {
  const { data: invoices, isLoading } = useInvoices();
  if (isLoading) return <Spinner />;
  return <InvoiceList invoices={invoices} />;
};
```

## Code Superpowers

- Scan every file under `src/features/<domain>/components/`. Flag any that import:
  - `useQuery`, `useMutation`, `useSWR`, `useInfiniteQuery` (data hooks)
  - `fetch`, `axios`, `ky`, or any project-local `api/` function
  - Anything from `../api/` or `../hooks/use<Anything>Mutation`
- Scan every file under `src/features/<domain>/containers/`. Flag any that contain >~20 lines of pure JSX (likely a presentational component leaking into a container).
- Verify each container has exactly one corresponding presentational component it renders (1:1 isn't required, but it's a useful signal).

## Common Mistakes

1. Building "smart components" that fetch and render — they always become test-hostile.
2. Putting the container in `components/` because "it's a component too" — the folder split is the enforcement mechanism.
3. Having the presentational component accept a `query` or `mutation` object instead of plain data — the data shape should be the interface, not the data source.
4. Multiple containers wrapping the same presentational component — that's fine and expected; reuse the presentational layer.

## Edge Cases

- **Pure orchestration (no fetch)**: a component that just composes other components and manages local UI state (e.g., a modal open/close) is presentational. It belongs in `components/`, not `containers/`.
- **Server Components**: in Next.js, a Server Component container may `await` a data function directly. The split still applies — the Server Component goes in `containers/`; the rendered child stays in `components/` as a (potentially) Client Component.
- **Hooks that read from a global store**: `useCurrentTheme()` reading a Context is fine inside `components/` — it's not domain data fetching, it's environmental.

## Related

- `RPS-FEAT-01` — no cross-feature imports
- `RPS-FEAT-03` — no `features/shared/`
- `RPS-ROUTE-02` — `page.tsx` is composition only (it imports containers)
- `RPS-COMPS-02` — no `containers/` under `src/components/`
- `standard:components` — component rules (especially `RC-STRUCT-*`)
