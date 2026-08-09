# Data Operations: Compliant Code Patterns

> **Prerequisite**: Read `meta.md` in this directory first for dependencies, exception policy, and rule groups.

## Key Principles

- Name operations with `search`, `list`, `get`, `set`, and `drop` according to their defined semantics.
- Give every operation a typed input object and one predictable return contract.
- Return `null` for missing single entities and an empty array for unmatched collections.
- Implement create/update as a typed `set` upsert and restrict destructive `drop` operations by status.
- Bound collection queries with sensible filter and pagination defaults.
- Colocate entity selectors and normalization, keep controllers thin, and mirror source organization in tests.

## Core Rules Summary

### Contracts (DOP-CONT)

- **DOP-CONT-01**: Use the canonical operation verb whose semantics match the request.
- **DOP-CONT-02**: Use explicit TypeScript input and return types, validation at boundaries, and predictable missing-result behavior.

### Single-Entity Operations (DOP-SING)

- **DOP-SING-01**: Implement `get` as unique retrieval returning the normalized entity or `null`.
- **DOP-SING-02**: Implement `set` as a typed create/update upsert returning the saved normalized entity.
- **DOP-SING-03**: Implement `drop` as status-restricted deletion returning the normalized deleted entity or `null` when absent.

### Collection Operations (DOP-COLL)

- **DOP-COLL-01**: Use `list` for structured filters and `search` when natural-language query capability is present.
- **DOP-COLL-02**: Apply sensible default filters, bounded pagination, stable sorting, and empty-array results.

### Structure and Tests (DOP-STRU)

- **DOP-STRU-01**: Colocate entity types, selectors, and normalization; keep one operation per file and controllers as typed pass-through wrappers.
- **DOP-STRU-02**: Mirror the source layout in unit and integration tests and cover success, absence, defaults, filters, and destructive constraints.

## Core Principles

### Consistent Operation Naming

Use standardized verbs for all data operations to ensure predictable APIs.

```typescript
// ✅ GOOD: consistent naming conventions
async function searchUsers(input: QueryInput): Promise<User[]>;
async function listUsers(input: QueryInput): Promise<User[]>;
async function getUser(input: { id: string }): Promise<User | null>;
async function setUser(user: User): Promise<User>;
async function dropUser(input: { id: string }): Promise<User | null>;

// ❌ BAD: inconsistent naming patterns
async function fetchUsers(); // should be list or search
async function createUser(); // should be setUser for upsert pattern
async function deleteUser(); // should be dropUser
```

### Type Safety First

All data operations must use proper TypeScript interfaces and validation.

```typescript
// ✅ GOOD: strongly typed with clear interfaces
interface GetUserInput {
  id: string;
}
async function getUser(input: GetUserInput): Promise<User | null>;

// ❌ BAD: weak typing
async function getUser(id: any): Promise<any>;
```

### Predictable Behavior

All operations should have consistent error handling and return patterns.

```typescript
// ✅ GOOD: consistent return patterns
async function getUser(input: { id: string }): Promise<User | null> {
  // Returns null for missing entities
  return user || null;
}

// ❌ BAD: inconsistent returns
async function getUser(id: string): Promise<User | undefined | false> {
  // Multiple falsy return types create confusion
  ...
}
```

## Operation Standards

Each operation type serves a specific purpose with predictable behavior and consistent implementation patterns.

### GET Operations

**Purpose**: Single entity retrieval by identifier

**Input Pattern**:

```typescript
interface GetInput {
  /** unique identifier of the entity */
  id: string;
}

// Alternative for entities with multiple unique fields
type GetInput = 
  | { id: string }
  | { slug: string }
  | { email: string };
```

**Return Conventions**:

```typescript
// GET operations - return null for missing
function get<Entity>(...): Promise<Entity | null>;
```

**Implementation Pattern**:

```typescript
// operations/getOffering.ts
import { offeringSelector, normalizeOffering } from '#entities/offering';

import type { PrismaClient } from '#prisma';
import type { Offering } from '#entities/offering';

/** input parameters for getOffering */
export type GetOfferingInput =
  | { /** unique identifier */ id: string }
  | { /** unique slug */ slug: string };

/**
 * retrieves an offering based on the provided criteria
 * @param client the Prisma client instance
 * @param input collection of input parameters
 * @returns a promise that resolves to an offering or null if not found
 */
export async function getOffering(
  client: PrismaClient,
  input: GetOfferingInput,
): Promise<Offering | null> {
  const offering = await client.offering.findUnique({
    select: offeringSelector,
    where: input,
  });

  return offering ? normalizeOffering(offering) : null;
}
```

**Testing Pattern**:

Test both found and missing entities, ensuring a missing entity returns `null`.

**Usage Examples**:

```typescript
// get single entity by id
await getProduct({ id: "abc123" });
// get by alternative unique field
await getUser({ slug: "john-doe" });
```

### SET Operations

**Purpose**: Handle both creation and updates in a single operation

**Input Pattern**:

Types should be defined directly in operation files for better cohesion:

```typescript
// operations/setOffering.ts
import type { SetOptional, SetRequired } from 'type-fest';
import type { Offering } from '#entities/offering';

/** input parameters for setOffering */
export type SetOfferingInput = CreateOfferingInput | UpdateOfferingInput;

export type CreateOfferingInput = SetOptional<
  Omit<Offering, 'slug'>,
  'id'
>;

export type UpdateOfferingInput = SetRequired<
  Partial<Omit<Offering, 'slug'>>,
  'id'
>;
```

**Return Conventions**:

```typescript
// SET operations - return the saved entity
function set<Entity>(...): Promise<Entity>;
```

**Implementation Pattern**:

```typescript
// operations/setOffering.ts
import { offeringSelector, normalizeOffering } from '#entities/offering';

import type { PrismaClient } from '#prisma';
import type { Offering } from '#entities/offering';

/** input parameters for setOffering */
export type SetOfferingInput =
  | { /** create */ id?: undefined, ... }
  | { /** update */ id: string, ... };

/**
 * sets an offering based on the provided data
 * @param client the Prisma client instance
 * @param input either complete data for creation or partial data for update
 * @returns a promise that resolves to the created or updated offering
 */
export async function setOffering(
  client: PrismaClient,
  input: SetOfferingInput,
): Promise<Offering> {
  const { status, suiteId, parentId, features, display } = input;
  const slug = display?.en.name ? slugify(display.en.name) : undefined;

  const data = {
    status, 
    suiteId, 
    parentId, 
    features, 
    display, 
    slug,
    quota: input.quota,
    rate: input.rate,
  };

  const offering = await client.offering.upsert({
    select: offeringSelector,
    where: { id },
    update: data,
    create: data,
  });

  return normalizeOffering(offering);
}
```

**Testing Pattern**:

Test both creation and update paths, ensuring each returns the saved entity.

```typescript
describe('op:setOffering', () => {
  it('should create a new offering when id does not exist', async () => {
    const input = {
      id: 'new-test-offering',
      status: 'draft' as const,
      suiteId: 'test-suite',
      display: {
        en: {
          name: 'New Test Offering',
          description: 'Test description',
        },
      },
    };

    const result = await instance.setOffering(input);

    expect(result).toMatchObject({
      slug: 'new-test-offering',
      status: 'draft',
      suiteId: 'test-suite',
    });
  });

  it('should update an existing offering when id already exists', async () => {
    // ... test implementation
  });
});
```

**Usage Examples**:

```typescript
// create or update
await setUser({ id: "123", name: "John", ... });
```

### DROP Operations

**Purpose**: Delete operations with status check

**Input Pattern**:

```typescript
interface DropInput {
  /** unique identifier of the entity */
  id: string;
}
```

**Return Conventions**:

```typescript
// DROP operations - return deleted entity or null for missing
function drop<Entity>(...): Promise<Entity | null>;
```

**Implementation Pattern**:

```typescript
// utilities.ts

import { Prisma } from '#prisma';

/**
 * ignoreNotFound lets you chain `.catch(ignoreNotFound)`
 * so Prisma "not found" errors (P2025) are swallowed and return `null`.
 */
export function ignoreNotFound(error: unknown): null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return null;
  }
  throw error; // rethrow other errors
}

```

```typescript
// operations/dropOffering.ts
import { offeringSummarySelector, normalizeOffering } from '#entities/offering';
import { ignoreNotFound } from '#utilities';

import type { PrismaClient } from '#prisma';
import type { OfferingSummary } from '#entities/offering';

/** input parameters for dropOffering */
export interface DropOfferingInput {
  /** unique identifier of the offering */
  id: string;
}

/**
 * remove an draft offering
 * @param client the Prisma client instance
 * @param input collection of input parameters
 * @returns the summary of the removed offering or null for missing
 */
export async function dropOffering(
  client: PrismaClient,
  { id }: DropOfferingInput,
): Promise<OfferingSummary | null> {
  // only draft entities can be deleted
  const offering = await client.offering.delete({
    select: offeringSummarySelector,
    where: { id, status: { in: ['draft'] } },
  }).catch(ignoreNotFound);

  return offering ? normalizeOffering(offering) : null;
}
```

**Testing Pattern**:

```typescript
describe('op:dropOffering', () => {
  it('should delete draft offerings', async () => {
    const result = await instance.dropOffering({ id: 'draft-offering' });
    
    expect(result).toMatchObject({
      slug: 'draft-offering',
    });
    
    // Verify it's actually deleted
    const check = await instance.getOffering({ id: 'draft-offering' });
    expect(check).toBeNull();
  });
});
```

**Usage Examples**:

```typescript
// remove entity
await dropUser({ id: "123" });
```

### LIST/SEARCH Operations

**Purpose**: Filter-based queries with optional NLP search capabilities

**Input Pattern**:

Base LIST input structure for structured queries:

```typescript
interface ListInput {
  /** applies rule-based structured filters */
  filter?: Record<string, unknown>;

  /** marks cursor position for next result set in cursor-based pagination */
  cursor?: string;

  /** specifies number of items to skip for offset-based pagination */
  offset?: number;

  /** limits maximum number of records to return */
  limit?: number;

  /** defines sorting criteria for results */
  sort?: Array<{
    field: string;
    order: "asc" | "desc";
  }>;
}

// SEARCH extends LIST with natural language query capability
interface SearchInput extends ListInput {
  /** contains natural language search query (SEARCH operations only) */
  query?: string;
}
```

**Return Conventions**:

```typescript
// both LIST and SEARCH operations return empty array when no matches
function list<Entity>(...): Promise<Entity[]>;
function search<Entity>(...): Promise<Entity[]>;
```

**Implementation Pattern**:

```typescript
// operations/listOfferings.ts
import { DEFAULT_LIMIT } from '#constants';
import { offeringSummarySelector, normalizeOffering } from '#entities/offering';

import type { PrismaClient } from '#prisma';
import type { Offering, OfferingSummary } from '#entities/offering';

/** input parameters for listOfferings */
export interface ListOfferingsInput {
  /** filter by status (defaults to ['active']) */
  status?: Array<'active' | 'inactive' | 'draft'>;
  /** filter by suite identifier */
  suiteId?: string;
  /** pagination limit */
  limit?: number;
  /** pagination offset */
  offset?: number;
  /** sorting field and direction */
  orderBy?: {
    field: keyof Pick<
      Offering,
      'createdAt' | 'name' | 'status'
    >;
    direction: 'asc' | 'desc';
  };
}

/**
 * lists offerings based on the provided filter criteria
 */
export async function listOfferings(
  client: PrismaClient,
  input?: ListOfferingsInput,
): Promise<OfferingSummary[]> {
  const { 
    status = ['active'], // default to active only
    suiteId,
    limit = DEFAULT_LIMIT,
    cursor,
    offset,
    orderBy = { field: 'createdAt', direction: 'desc' }
  } = {...input};

  const offerings = await client.offering.findMany({
    select: offeringSummarySelector,
    where: {
      status: { in: status },
      suiteId,
    },
    take: limit,
    skip: cursor ? 1 : offset,
    ...(cursor && { cursor: { id: cursor } }),
    orderBy: {
      [orderBy.field]: orderBy.direction,
    },
  });

  return offerings.map(normalizeOffering);
}

// operations/searchOfferings.ts (extends ListOfferingsInput with query field)
export interface SearchOfferingsInput extends ListOfferingsInput {
  /** natural language search query */
  query?: string;
}
```

**Key Concepts**:

**Default Filtering**: Always filter to sensible defaults

```typescript
async function listUsers(input?: ListUsersInput) {
  const { status = ['active'] } = { ...input };
  // active users by default
}
```

**Pagination Defaults**: Set reasonable limits to prevent unbounded queries

```typescript
async function listProducts(input?: ListProductsInput) {
  const { limit = DEFAULT_LIMIT, offset = 0 } = { ...input };
  // prevent unbounded queries
}
```

**NLP Capabilities (SEARCH only)**: Search operations can handle natural language queries and convert them to structured filters.

**Testing Pattern**:

```typescript
describe('op:listOfferings', () => {
  it('should default to active offerings only', async () => {
    const results = await instance.listOfferings();
    
    expect(results.every(o => o.status === 'active')).toBe(true);
  });

  it('should accept multiple status values', async () => {
    const results = await instance.listOfferings({
      status: ['active', 'inactive'],
    });
    
    const statuses = new Set(results.map(o => o.status));
    expect(statuses.has('draft')).toBe(false);
  });
});

describe('op:searchOfferings', () => {
  it('should handle natural language queries', async () => {
    const results = await instance.searchOfferings({
      query: "climate tech offerings in Europe",
      limit: 10,
    });
    
    expect(Array.isArray(results)).toBe(true);
  });

  it('should fallback to structured filters when NLP unavailable', async () => {
    const results = await instance.searchOfferings({
      status: ['active'],
      suiteId: 'climate-tech',
    });
    
    expect(results.every(o => o.status === 'active')).toBe(true);
  });
});
```

**Usage Examples**:

```typescript
// LIST: structured filters only
await listCommunities({
  filter: { country: "UK", active: true },
  limit: 50,
  sort: [{ field: "createdAt", order: "desc" }],
});

// SEARCH: natural language query
await searchCommunities({
  query: "climate tech in Europe",
  limit: 20,
});

// SEARCH: can combine NLP with structured filters
await searchCommunities({
  query: "sustainability projects",
  filter: { country: "UK" },
  limit: 20,
});
```

## Common Patterns

### Entity-Centric Pattern

Colocate selectors, types, and normalization helpers within entity files for better cohesion:

```typescript
// source/entities/offering.ts
import type { Prisma } from '#prisma';
import type { OverrideProperties } from 'type-fest';

/** offering with normalized display data */
export type Offering = OverrideProperties<
  Prisma.OfferingGetPayload<{
    select: typeof offeringSelector;
  }>,
  NormalizedField
>;

/** offering summary for list operations */
export type OfferingSummary = OverrideProperties<
  Prisma.OfferingGetPayload<{
    select: typeof offeringSummarySelector;
  }>,
  NormalizedField
>;

type NormalizedField = {
  features: Array<string>;
};

/** summary selector for list operations and relations */
export const offeringSummarySelector = {
  id: true,
  slug: true,
  status: true,
  suiteId: true,
  display: true,
} as const satisfies Prisma.OfferingSelect;

/** full attribute selector for detailed entity retrieval */
export const offeringSelector = {
  ...offeringSummarySelector,
  parentId: true,
  features: true,
  quota: true,
  rate: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.OfferingSelect;

/**
 * normalizes offering data for consistent API responses
 * @param offering raw offering from database
 * @returns normalized offering with processed fields
 */
export function normalizeOffering<
  T extends Prisma.OfferingGetPayload<{
    select: typeof offeringSummarySelector;
  }>,
>(offering: T): Omit<T, keyof NormalizedField> & NormalizedField {
  return {
    ...offering,
    features: offering.features ? JSON.parse(offering.features) : [],
  };
}
```

### Controller Integration Pattern

Controllers should be thin wrappers that delegate to operations:

```typescript
// source/index.ts
import { getOffering } from '#operations/getOffering';
import { setOffering } from '#operations/setOffering';
import { dropOffering } from '#operations/dropOffering';
import { listOfferings } from '#operations/listOfferings';

// export operation input types
export type { GetOfferingInput } from '#operations/getOffering';
export type { SetOfferingInput } from '#operations/setOffering';
export type { DropOfferingInput } from '#operations/dropOffering';
export type { ListOfferingsInput } from '#operations/listOfferings';

// export entity types from entity modules
export type { Offering, OfferingSummary } from '#entities/offering';

export class Product {
  #client: PrismaClient;
  
  constructor(client: PrismaClient) {
    this.#client = client;
  }

  /**
   * retrieves an offering based on the provided criteria
   */
  public async getOffering(
    input: Parameters<typeof getOffering>[1],
  ): ReturnType<typeof getOffering> {
    return getOffering(this.#client, input);
  }

  /**
   * sets an offering based on the provided data
   */
  public async setOffering(
    input: Parameters<typeof setOffering>[1],
  ): ReturnType<typeof setOffering> {
    return setOffering(this.#client, input);
  }

  // ... other methods following same pattern
}
```

**Data Controller Pattern**:

```typescript
class <Feature> {
  // read operations
  search<Entity>(input: QueryInput): Promise<T[]>;
  list<Entity>(input: QueryInput): Promise<T[]>;
  get<Entity>(input: IdentifierInput): Promise<T | null>;

  // write operations
  set<Entity>(entity: T): Promise<T>;
  drop<Entity>(input: IdentifierInput): Promise<T | null>;
}
```

### File Organization

**Directory Structure**:

```plaintext
data/{service}/
├── source/
│   ├── index.ts           # controller class and exports
│   ├── constants.ts       # shared constants (DEFAULT_LIMIT, etc.)
│   ├── entities/          # entity-specific modules
│   │   ├── offering.ts    # types, selectors, normalization
│   │   ├── user.ts        # types, selectors, normalization
│   │   └── profile.ts     # types, selectors, normalization
│   ├── operations/        # operation functions
│   │   ├── getOffering.ts
│   │   ├── setOffering.ts
│   │   ├── dropOffering.ts
│   │   └── listOfferings.ts
│   └── utilities.ts       # shared helper functions
├── spec/
│   ├── operations/       # integration tests
│   │   ├── getOffering.int.spec.ts
│   │   ├── setOffering.int.spec.ts
│   │   ├── dropOffering.int.spec.ts
│   │   └── listOfferings.int.spec.ts
│   ├── entities/         # entity unit tests
│   │   └── offering.spec.ts
│   ├── common.ts         # test utilities
│   └── fixture.ts        # database setup/seed
├── prisma/
│   └── schema.prisma     # database schema
└── package.json
```

**File Conventions**:

1. **Entity Files**: Types, selectors, and normalization colocated by domain
2. **Operation Files**: One operation per file, types at the top
3. **Controller**: Single class in `index.ts` with pass-through methods
4. **Tests**: Mirror source structure in `spec/` directory
5. **Integration Tests**: Use `.int.spec.ts` extension
6. **Unit Tests**: Use `.spec.ts` extension

## Testing Patterns

### Integration Test Structure

```typescript
// spec/operations/setOffering.int.spec.ts
import { describe, expect, it } from 'vitest';
import { instance } from '../common';
import setup from '../fixture';

describe('op:setOffering', () => {
  it('should create a new offering when id does not exist', async () => {
    await setup(); // reset and seed database for this test

    const input = {
      id: 'new-test-offering',
      status: 'draft' as const,
      suiteId: 'test-suite',
      display: {
        en: {
          name: 'New Test Offering',
          description: 'Test description',
        },
      },
    };

    const result = await instance.setOffering(input);

    expect(result).toMatchObject({
      slug: 'new-test-offering',
      status: 'draft',
      suiteId: 'test-suite',
    });
  });

  it('should update an existing offering when id already exists', async () => {
    await setup(); // reset and seed database for this test

    // ... test implementation
  });
});
```

### Common Test Utilities

Test utilities should be centralized for consistency across all operations.

## Quick Reference

| Operation | Purpose | Return Type | Example |
|-----------|---------|-------------|----------|
| `Get<Entity>` | Single retrieval | `Promise<T \| null>` | `getUser({ id: "123" })` |
| `Set<Entity>` | Create/Update (Upsert) | `Promise<T>` | `setUser(userData)` |
| `Drop<Entity>` | Status-based delete | `Promise<T \| null>` | `dropUser({ id: "123" })` |
| `List<Entity>` | Filtered queries | `Promise<T[]>` | `listUsers({ status: ['active'] })` |
| `Search<Entity>` | NLP + filtered queries | `Promise<T[]>` | `searchUsers({ query: "active developers" })` |

## Anti-Patterns

### Inconsistent Naming

```typescript
// ❌ BAD: mixed naming conventions
class UserService {
  async fetchUsers() { ... }     // should be listUsers or searchUsers
  async createUser() { ... }      // should be setUser
  async deleteUser() { ... }      // should be dropUser
  async getUserById() { ... }     // should be getUser
}

// ✅ GOOD: consistent naming
class UserService {
  async searchUsers(options: QueryOptions) { ... }
  async listUsers(filter: UserFilter) { ... }
  async getUser(input: { id: string }) { ... }
  async setUser(user: User) { ... }
  async dropUser(input: { id: string }) { ... }
}
```

### Unpredictable Returns

```typescript
// ❌ BAD: inconsistent return types for missing entities
async function getUser(id: string) {
  if (!user) throw new Error('Not found'); // throws
}

async function getProduct(id: string) {
  if (!product) return undefined; // returns undefined
}

// ✅ GOOD: consistent null returns for missing
async function getUser(input: { id: string }): Promise<User | null> {
  return user || null;
}

async function getProduct(input: { id: string }): Promise<Product | null> {
  return product || null;
}
```

### Common Mistakes to Avoid

1. **Hard deletes without status checks**
   - Problem: Data loss for active entities
   - Solution: Implement soft delete for active records
   - Example: Check status before deletion

2. **Missing pagination defaults**
   - Problem: Unbounded queries can crash the system
   - Solution: Always set a default limit
   - Example: `limit = input.limit ?? 100`

3. **Inconsistent error handling**
   - Problem: Different operations fail differently
   - Solution: Use consistent error patterns
   - Example: Return null for missing, throw for invalid input

4. **Type definitions scattered across files**
   - Problem: Hard to maintain and find types
   - Solution: Define types at the top of operation files
   - Example: Export types from operation files

## Quick Decision Tree

1. **What type of query is this?**
   - If natural language search → Use `Search<Entity>`
   - If structured filters → Use `List<Entity>`
   - If single item by ID → Use `Get<Entity>`

2. **Is this a write operation?**
   - If create OR update → Use `Set<Entity>` (upsert pattern)
   - If delete → Use `Drop<Entity>` (prefer soft delete)

3. **Do you need caching?**
   - If read-heavy workload → Implement cache layer
   - If write-heavy → Consider write-through cache
   - Otherwise → Direct repository access

4. **How should missing entities be handled?**
   - For GET operations → Return `null`
   - For LIST operations → Return empty array
   - For DROP operations → Return `null` if not found
