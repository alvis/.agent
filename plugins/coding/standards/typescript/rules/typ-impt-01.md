# TYP-IMPT-01: Import Category Ordering

## Intent

Import order is strict across **five groups**: built-in (`node:`), scoped internal-org packages (`@theriety/*`, other `@scope/*` packages belonging to the org), generic third-party, project modules (alias/subpath/relative), then type-only imports — with blank-line separation between categories. Never mix runtime and `type` imports in a single statement.

## Fix

```typescript
import { readFile } from 'node:fs/promises';

import { operationMockFactory } from '@theriety/mock-service';

import { describe, expect, it, vi } from 'vitest';

import listSuites from '#operations/list-suites';

import type { TestContext } from 'vitest';

import type { Suite } from '#types/suite';
```

### Strict Import Order

**STRICT order** (blank lines separate each category):

1. **Built-in modules** (`node:`)
2. **Scoped internal-org packages** (`@theriety/*`, other `@scope/*` packages belonging to the org)
3. **Generic third-party libraries** (`vitest`, `react`, `axios`, …)
4. **Project modules** (subpath `#*`, path alias `@*`, or relative `../`)
5. **Type imports** (repeat the same 4-group order within)

```typescript
import { readFile } from 'node:fs/promises';

import { operationMockFactory } from '@theriety/mock-service';

import { useState } from 'react';
import axios from 'axios';

import { FeatureComponent } from '@/components/FeatureComponent';
import { featureFunction } from '#utilities/feature';
import { parentFunction } from '../helpers';

import type { FC } from 'react';

import type { User } from '#types/user';
```

### Import Style Rules

```typescript
// ✅ DO: clean, separated imports
import { useState, useEffect } from 'react';

import type { FC } from 'react';

// ❌ DON'T: mixed imports
import React, { useState, type FC } from 'react';

// ❌ DON'T: namespace imports
import * as React from 'react';

// ❌ DON'T: default imports when named available
import React from 'react';
```

### Subpath Import Rules

Check `package.json` for subpath mappings under `exports` or `imports`:

**RULE 1: Use shortest subpath** for cross-module imports:

```typescript
// ✅ DO: use subpaths for cross-module imports
import { handler } from '#request';
import { helper } from '#utilities/validator';

// ❌ DON'T: use relative paths when subpath exists
import { handler } from './fastify/request';
import { helper } from '../utilities/validator';
```

**RULE 2: Use relative** for same-subpath imports:

```typescript
// File: src/fastify/request.ts (part of #fastify/*)

// ✅ DO: relative imports within same subpath
import { formatResponse } from './response';

// ❌ DON'T: subpath imports within same subpath
import { formatResponse } from '#fastify/response';
```

## Group Separation

Import groups are separated by **blank lines only**. Do not use comment labels above import groups.

```typescript
// ❌ BAD: comment labels on import groups
// Third-party
import express from 'express';

// Internal
import { handler } from './handler';
```

```typescript
// ✅ GOOD: blank-line separation only
import express from 'express';

import { handler } from './handler';
```

The category ordering itself makes the grouping self-evident; comment labels add noise without value.

## Edge Cases

- Scoped `@org/*` packages belonging to the internal organization form their own group **before** generic third-party packages — do not intermix.
- When existing code matches prior violation patterns such as ❌ `import x from "#a"; import fs from "fs"` (wrong order), refactor before adding new behavior.
- Type-only imports repeat the same category order (builtin types, scoped-org types, third-party types, project types) within their section.

## Related

TYP-IMPT-02, TYP-IMPT-03, TYP-IMPT-04
