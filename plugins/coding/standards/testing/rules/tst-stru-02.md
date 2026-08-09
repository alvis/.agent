# TST-STRU-02: Follow Canonical File Layout

## Intent

Use stable layout order for imports, mocks, constants, helpers, and suites. For complex files, keep standardized section headers.

## Fix

```typescript
// Before: Random order, mocks after describe blocks
import { describe, it, expect, vi } from 'vitest';

describe('fn:processUser', () => {
  // test code
});

const { fetchUser } = vi.hoisted(() => ({
  fetchUser: vi.fn(),
}));

// After: Correct canonical order with section headers
import { describe, it, expect, vi } from 'vitest';

// --- MOCKS --- //
const { fetchUser } = vi.hoisted(() => ({
  fetchUser: vi.fn(),
}));

// --- CONSTANTS --- //
const VALID_USER = { name: 'John' };

// --- TEST SUITES --- //
describe('fn:processUser', () => {
  // test code
});
```

## Section Headers (for complex test files)

Use standardized headers for files with setup areas before describe blocks:

```typescript
// --- TYPES --- //
// --- MOCKS --- //
// --- CONSTANTS --- //
// --- HELPERS --- //
// --- TEST SUITES --- //
```

```typescript
// ❌ VIOLATION: inconsistent header format and missing sections
import { describe, it, expect, vi } from 'vitest';

// mocks  <-- lowercase like comment, inconsistent format as a section header
const { fetchUser } = vi.hoisted(() => ({
  fetchUser: vi.fn(),
}));

const VALID_USER = { name: 'John' };
// missing section header for constants
```

## Canonical Section Header Format

Use standardized uppercase section headers in complex test files:

```typescript
// --- TYPES --- //
// --- MOCKS --- //
// --- CONSTANTS --- //
// --- HELPERS --- //
// --- TEST SUITES --- //
```

Lowercase header variants like `// test suites` are non-compliant for canonical section headers.

## Edge Cases

- When existing code matches prior violation patterns such as `describe(...) // before mock setup`, refactor before adding new behavior.
- Use section headers when setup complexity exceeds quick visual scan; keep simple files minimal but ordered.

## Related

TST-STRU-01, TST-STRU-03, TST-CORE-01
