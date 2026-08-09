# Data Entity: Compliant Code Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

## Key Principles

- Group entity fields as identifiers, properties, flags, timestamps, relations, then annotations.
- Document fields at both the TypeScript and Prisma boundaries.
- Use explicit nullable types and finite status unions or enums.
- Map database names explicitly when they differ from application names.
- Declare identifiers, uniqueness, defaults, timestamps, relations, table mappings, and query-driven indexes in Prisma.

## Core Rules Summary

### Entity Shape (DEN-SHAP)

- **DEN-SHAP-01**: Define a documented, typed application entity with consistently ordered field groups.
- **DEN-SHAP-02**: Represent nullable values, finite states, timestamps, and optional relations explicitly.

### Prisma Mapping (DEN-PRIS)

- **DEN-PRIS-01**: Keep the Prisma model aligned with the application entity, including names, nullability, states, defaults, and relations.
- **DEN-PRIS-02**: Declare database mappings, identity and uniqueness constraints, timestamps, and query-driven indexes explicitly.

## Patterns

### Entity Structure

```typescript
interface Customer {
  // identifiers //
  /** unique customer id */
  id: string;
  
  // properties //
  /** customer's email address */
  email: string;
  /** customer's first name */
  firstName: string;
  /** customer's last name */
  lastName: string;
  /** customer's date of birth */
  dateOfBirth: Date | null;
  
  // flags //
  /** current account status */
  status: 'active' | 'inactive';
  /** true if the customer is in the member club */
  isMember: boolean;
  
  // timestamps //
  /** creation timestamp (utc) */
  createdAt: Date;
  /** last update timestamp (utc) */
  updatedAt: Date;
  
  // relations //
  /** customer orders */
  orders?: Order[];
}
```

## Prisma Schema

```prisma
// file: prisma/models/customer.prisma

model Customer {
  // identifiers //
  id           String    @id @default(uuid())                /// unique customer id

  // properties //
  email        String    @unique                             /// customer's email address
  firstName    String    @map("first_name")                  /// customer's first name
  lastName     String    @map("last_name")                   /// customer's last name
  dateOfBirth  DateTime? @map("date_of_birth")               /// customer's date of birth

  // flags //
  status       CustomerStatus @default(active)               /// current account status
  isMember     Boolean   @default(true) @map("is_active")    /// true if the customer is in the member club

  // timestamps //
  createdAt    DateTime  @default(now()) @map("created_at")  /// creation timestamp (utc)
  updatedAt    DateTime  @updatedAt @map("updated_at")       /// last update timestamp (utc)

  // relations //
  orders       Order[]                                       /// customer orders

  // annotations //
  @@map("customers")

  // add @@index([...]) here if you frequently filter by fields (e.g., isActive, createdAt)
}

enum CustomerStatus {
  active    /// default state
  inactive  /// customer is no longer with us
}
```

## Anti-Patterns

- Undocumented or inconsistently grouped entity fields.
- Application and Prisma types that disagree on nullability, state values, names, or relations.
- Missing database mappings, uniqueness constraints, timestamp behavior, or indexes required by frequent filters.

## Quick Decision Tree

1. Defining the application entity? Group and document every field (`DEN-SHAP-01`).
2. Can a value be absent, finite-state, temporal, or relational? Encode that explicitly (`DEN-SHAP-02`).
3. Adding the persistence model? Mirror the application contract and declare defaults and relations (`DEN-PRIS-01`).
4. Does storage naming differ or a field drive identity, uniqueness, timestamps, or frequent filtering? Add the corresponding Prisma annotation (`DEN-PRIS-02`).
