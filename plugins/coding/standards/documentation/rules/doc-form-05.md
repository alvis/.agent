# DOC-FORM-05: Section Divider Applicability

## Intent

Section dividers (`// --- NAME --- //`) visually separate logical groups of properties, fields, or declarations within a single container. Use them in any construct that groups related items — file-level sections, interfaces, types, object literals, config objects, Prisma models.

## When to Use

- The structure has **3+ logically distinct groups** of members
- The structure has roughly **6+ members** total
- Grouping improves scannability (e.g., separating identifiers from timestamps from relations)

## When to Skip

- Simple structures with fewer than ~6 members
- Structures with only 1–2 logical groups (a blank line suffices)
- Single-purpose containers where every member belongs to the same category

## Fix

```typescript
// ✅ GOOD: interface with 3+ logical groups
interface Product {
  // --- IDENTIFIERS --- //
  id: number;

  // --- PROPERTIES --- //
  name: string;
  price: number;

  // --- TIMESTAMPS --- //
  createdAt: Date;
  updatedAt: Date;
}
```

```typescript
// ❌ BAD: unnecessary dividers in a small structure
interface Point {
  // --- COORDINATES --- //
  x: number;
  y: number;
}
```

## Related

DOC-FORM-01, DOC-FORM-06, DOC-FORM-07
