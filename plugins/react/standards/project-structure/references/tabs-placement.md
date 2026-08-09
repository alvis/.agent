# Tabs Placement — Full Case Study

This is the long-form companion to the "Tabs Placement — Brief" section of `standard:project-structure/write.md`. It walks through eight concrete Tabs scenarios — from headless primitive to third-party wrapping — and shows where each lives and when to escalate from one bucket to the next.

Cross-references:

- `standard:project-structure/rules/rps-comps-02.md` (allowed buckets under `src/components/`)
- `standard:project-structure/rules/rps-feat-02.md` (container/presentational split)
- `standard:project-structure/rules/rps-promo-01.md` (second-consumer promotion)

---

## 1. Headless Tabs (`src/components/headless/Tabs.tsx`)

**Purpose**: Behavior + ARIA only. No styled JSX. Other styled wrappers consume this primitive.

```typescript
// src/components/headless/Tabs.tsx
export type TabsProps = PropsWithChildren<{
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
}>;

export const Tabs: FC<TabsProps> = ({ defaultValue, value, onValueChange, children }) => {
  const [internal, setInternal] = useState(defaultValue);
  const active = value ?? internal;
  const setActive = onValueChange ?? setInternal;
  return <TabsContext.Provider value={{ active, setActive }}>{children}</TabsContext.Provider>;
};
```

**When to use**: You need tabs behavior (state, keyboard nav, ARIA roles) without committing to a visual style.

**Escalate to next bucket when**: A styled wrapper around this primitive is needed — move the styled version to `composites/Tabs.tsx` (section 2). The headless primitive stays here.

---

## 2. Styled Generic Tabs (`src/components/composites/Tabs.tsx`)

**Purpose**: Styled wrapper around the headless primitive. App-wide default look. Domain-agnostic.

```typescript
// src/components/composites/Tabs.tsx
import { Tabs as HeadlessTabs } from '#components/headless/Tabs';

export const Tabs: FC<TabsProps> = (props) => (
  <HeadlessTabs {...props} />
);

Tabs.List = (p) => <div className="tabs-list">{p.children}</div>;
Tabs.Trigger = (p) => <button className="tabs-trigger">{p.children}</button>;
Tabs.Content = (p) => <div className="tabs-content">{p.children}</div>;
```

**When to use**: You need a styled Tabs component reused across multiple routes/features with the project's default visual language.

**Escalate to next bucket when**: A new visual variant (pill, underline, segmented) is needed without changing behavior — see section 3. Or when the tab list is dictated by a specific domain — see section 4.

---

## 3. Visual Variants (`src/components/composites/Tabs/variants/`)

**Purpose**: Visual variants of the generic styled Tabs. Same behavior, different look.

```typescript
// src/components/composites/Tabs/variants/PillTabs.tsx
import { Tabs } from '#components/composites/Tabs';

export const PillTabs: typeof Tabs = (props) => (
  <Tabs {...props} className="tabs--pill" />
);
```

**When to use**: You have 2+ visual treatments of the same Tabs behavior (pill, underline, segmented) and want to keep them grouped.

**Escalate to next bucket when**: A variant becomes tightly coupled to a single domain — move it into `src/features/<domain>/components/` (section 4).

---

## 4. Feature-Specific Tabs (`src/features/billing/components/BillingTabs.tsx`)

**Purpose**: Tabs whose tab list, labels, or contents are dictated by a specific domain. Composes the generic Tabs composite.

```typescript
// src/features/billing/components/BillingTabs.tsx
import { Tabs } from '#components/composites/Tabs';

export const BillingTabs: FC = () => (
  <Tabs defaultValue="invoices">
    <Tabs.List>
      <Tabs.Trigger value="invoices">Invoices</Tabs.Trigger>
      <Tabs.Trigger value="subscriptions">Subscriptions</Tabs.Trigger>
      <Tabs.Trigger value="usage">Usage</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="invoices"><InvoicesPanel /></Tabs.Content>
    <Tabs.Content value="subscriptions"><SubscriptionsPanel /></Tabs.Content>
    <Tabs.Content value="usage"><UsagePanel /></Tabs.Content>
  </Tabs>
);
```

**When to use**: The tab list is part of the billing domain — adding/removing a billing concept changes the tabs.

**Escalate to next bucket when**: The tabs are used by exactly one route and won't appear anywhere else in the billing domain — drop down to `src/app/<route>/components/` (section 5). Or when the tab list is data-driven from the server — see section 7.

---

## 5. Page-Specific Tabs (`src/app/dashboard/components/DashboardTabs.tsx`)

**Purpose**: One-off tab orchestration scoped to a single route. Never reused.

```typescript
// src/app/dashboard/components/DashboardTabs.tsx
import { Tabs } from '#components/composites/Tabs';
import { OverviewPanel } from './OverviewPanel';
import { ActivityPanel } from './ActivityPanel';

export const DashboardTabs: FC = () => (
  <Tabs defaultValue="overview">
    <Tabs.List>
      <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
      <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="overview"><OverviewPanel /></Tabs.Content>
    <Tabs.Content value="activity"><ActivityPanel /></Tabs.Content>
  </Tabs>
);
```

**When to use**: The dashboard page is the only consumer. Tab list reflects this route's specific layout.

**Escalate to next bucket when**: A second route needs the same shape — promote to `src/features/<domain>/components/` if domain-scoped, or to `src/components/composites/` if domain-agnostic (`RPS-PROMO-01`).

---

## 6. Route/Layout Tabs (Tabs that drive routing)

**Purpose**: Tabs whose state IS the URL. Each tab is a route. Implemented at the Next.js layout level so the active tab persists across route segments.

```typescript
// src/app/settings/layout.tsx
import { SettingsTabs } from './components/SettingsTabs';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SettingsTabs />
      <main>{children}</main>
    </>
  );
}

// src/app/settings/components/SettingsTabs.tsx
'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export const SettingsTabs: FC = () => {
  const path = usePathname();
  return (
    <nav role="tablist">
      <Link href="/settings/profile" aria-selected={path === '/settings/profile'}>Profile</Link>
      <Link href="/settings/billing" aria-selected={path === '/settings/billing'}>Billing</Link>
    </nav>
  );
};
```

**When to use**: Each tab corresponds to a distinct route (`/settings/profile`, `/settings/billing`) and the user should be able to deep-link or refresh on a specific tab.

**Escalate to next bucket when**: The tabs no longer drive routing — fall back to section 5 (page-specific) or section 4 (feature) and let the Tabs component own its own state.

---

## 7. Data-Driven Tabs (tab list from API)

**Purpose**: The tab list itself is fetched from the server. Container fetches and orchestrates; the styled Tabs composite renders.

```typescript
// src/features/projects/containers/ProjectTabsContainer.tsx
import { Tabs } from '#components/composites/Tabs';
import { useProjects } from '../hooks/useProjects';

export const ProjectTabsContainer: FC = () => {
  const { data: projects, isLoading } = useProjects();
  if (isLoading) return <Spinner />;
  return (
    <Tabs defaultValue={projects[0].id}>
      <Tabs.List>
        {projects.map((p) => (
          <Tabs.Trigger key={p.id} value={p.id}>{p.name}</Tabs.Trigger>
        ))}
      </Tabs.List>
      {projects.map((p) => (
        <Tabs.Content key={p.id} value={p.id}><ProjectPanel project={p} /></Tabs.Content>
      ))}
    </Tabs>
  );
};
```

**When to use**: The list of tabs is not knowable at compile time. Respect the container/presentational split (`RPS-FEAT-02`): the container fetches; the styled composite renders.

**Escalate to next bucket when**: The third-party tabs library you use has a substantially different API surface and leaks into many call sites — wrap it (section 8).

---

## 8. Third-Party Wrapping (`src/components/adapters/RadixTabsAdapter.tsx`)

**Purpose**: Quarantine a third-party tabs library (Radix UI, Headless UI, Reach UI) behind a project-local API so call sites never import the library directly.

```typescript
// src/components/adapters/RadixTabsAdapter.tsx
import * as RadixTabs from '@radix-ui/react-tabs';

export type TabsProps = PropsWithChildren<{
  defaultValue: string;
}>;

export const Tabs: FC<TabsProps> & {
  List: typeof RadixTabs.List;
  Trigger: typeof RadixTabs.Trigger;
  Content: typeof RadixTabs.Content;
} = Object.assign(
  ({ defaultValue, children }: TabsProps) => (
    <RadixTabs.Root defaultValue={defaultValue}>{children}</RadixTabs.Root>
  ),
  { List: RadixTabs.List, Trigger: RadixTabs.Trigger, Content: RadixTabs.Content },
);
```

**When to use**: You want the behavior/a11y of a third-party library but need a single point of swap-out, version-bump control, or API stabilization.

**Escalate**: There is no escalation beyond this. Adapters are the seam where third-party API surface ends and project API surface begins. If first-party code starts to live here, move it to `primitives/`, `composites/`, or `headless/` instead.

---

## Summary Cheat Sheet

| Section | Path                                                      | Trigger                                                      |
|---------|-----------------------------------------------------------|--------------------------------------------------------------|
| 1       | `src/components/headless/Tabs.tsx`                        | Need behavior + ARIA only                                    |
| 2       | `src/components/composites/Tabs.tsx`                      | Need a project-default styled Tabs reused across the app     |
| 3       | `src/components/composites/Tabs/variants/`                | Multiple visual variants share behavior                      |
| 4       | `src/features/<domain>/components/`                       | Tab list is dictated by a domain                             |
| 5       | `src/app/<route>/components/`                             | One-off tab orchestration for a single route                 |
| 6       | `src/app/<section>/layout.tsx` + route-local Tabs         | Tabs ARE the routing                                         |
| 7       | feature container + composite Tabs                        | Tab list fetched from API                                    |
| 8       | `src/components/adapters/RadixTabsAdapter.tsx`            | Wrapping a third-party tabs library                          |
