# TYP-MODL-01: Top-Level Symbol Group Ordering

## Intent

Use this file order: imports, re-exports, types, constants, classes, functions. Organize file contents in a consistent, predictable order to improve navigability and reduce merge conflicts.

## Fix

```typescript
// GROUP 1: imports
import { readFile } from "node:fs/promises";
import { validate } from "express-validator";
import { DatabaseClient } from "#database/client";

import type { User } from "#types/user";

// GROUP 2: re-exports
export { UserRepository } from "./repository";
export type { User } from "./types";

// GROUP 3: types
export interface UserServiceConfig { cacheEnabled: boolean; }
interface CacheEntry { user: User; timestamp: number; }

// GROUP 4: constants
export const DEFAULT_CACHE_TTL = 3600;
const CACHE_KEY_PREFIX = "user:";

// GROUP 5: classes
export class UserService { /* ... */ }

// GROUP 6: functions
export function createUser(input: CreateUserInput): Promise<UserResult> { /* ... */ }
function validateUserInput(input: CreateUserInput): ValidationResult { /* ... */ }
```

### Group Ordering Detail

**GROUP 1: External Imports**
1. `import` statements (code imports)
2. `import type` statements (type-only imports)

**GROUP 2: Re-exports**
3. `export { ... } from` statements (code re-exports)
4. `export type { ... } from` statements (type-only re-exports)

**GROUP 3: Type Definitions**
5. Exported types/interfaces (`export type`, `export interface`)
6. Private types/interfaces (non-exported)

**GROUP 4: Constants & Variables**
7. Exported constants (`export const`)
8. Private constants (non-exported `const`)

**GROUP 5: Classes**
9. Exported classes (`export class`)
10. Private classes (non-exported)

**GROUP 6: Functions**
11. Exported functions (`export function`, `export const fn =`)
12. Private functions (non-exported)

### Complete File Example

```typescript
// GROUP 1: EXTERNAL IMPORTS //

import { readFile } from 'node:fs/promises';

import { validate } from 'express-validator';
import axios from 'axios';

import { DatabaseClient } from '#database/client';
import { logger } from '#utilities/logger';

import type { Request, Response } from 'express';

import type { User, CreateUserInput } from '#types/user';
import type { DatabaseConfig } from '#database/types';

// GROUP 2: RE-EXPORTS //

export { UserRepository } from './repository';
export { createUserService } from './factory';

export type { User, CreateUserInput } from './types';

// GROUP 3: TYPE DEFINITIONS //

export interface UserServiceConfig {
  database: DatabaseConfig;
  cacheEnabled: boolean;
}

export type UserResult = Result<User, UserError>;

interface CacheEntry {
  user: User;
  timestamp: number;
}

// GROUP 4: CONSTANTS //

export const DEFAULT_CACHE_TTL = 3600;
export const USER_VALIDATION_RULES = {
  minAge: 18,
  maxNameLength: 100,
} as const;

const CACHE_KEY_PREFIX = 'user:';

// GROUP 5: CLASSES //

export class UserService {
  #repository: UserRepository;
  #cache: Map<string, CacheEntry>;

  constructor(config: UserServiceConfig) {
    this.#repository = new UserRepository(config.database);
    this.#cache = new Map();
  }

  async findUser(id: string): Promise<UserResult> {
    const cached = this.#getCached(id);
    if (cached) return { success: true, data: cached };

    const user = await this.#repository.find(id);
    if (!user) return { success: false, error: new UserNotFoundError(id) };

    this.#setCached(id, user);
    return { success: true, data: user };
  }

  #getCached(id: string): User | null {
    const entry = this.#cache.get(buildCacheKey(id));
    return entry && !isCacheExpired(entry) ? entry.user : null;
  }

  #setCached(id: string, user: User): void {
    this.#cache.set(buildCacheKey(id), { user, timestamp: Date.now() });
  }
}

// GROUP 6: FUNCTIONS //

export function createUser(input: CreateUserInput): Promise<UserResult> {
  const validated = validateUserInput(input);
  if (!validated.valid) {
    return Promise.resolve({
      success: false,
      error: new ValidationError(validated.errors),
    });
  }
  return persistUser(validated.data);
}

function validateUserInput(input: CreateUserInput): ValidationResult {
  const errors = checkRequiredFields(input);
  return { valid: errors.length === 0, errors };
}

async function persistUser(user: User): Promise<UserResult> {
  const saved = await saveToDatabase(user);
  return { success: true, data: saved };
}

function checkRequiredFields(input: CreateUserInput): string[] { /* ... */ }
function saveToDatabase(user: User): Promise<User> { /* ... */ }
function buildCacheKey(id: string): string { return `${CACHE_KEY_PREFIX}${id}`; }
function isCacheExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp > DEFAULT_CACHE_TTL * 1000;
}
```

### Special Cases

- **Constants used by multiple groups**: Place in GROUP 4 even if used by types/classes
- **Type guards**: Treat as functions in GROUP 6
- **Factory functions**: Treat as root-level functions in GROUP 6

## Edge Cases

- When existing code matches prior violation patterns such as ❌ `export fn(); const X = 1` (functions before constants), refactor before adding new behavior.

## Related

TYP-MODL-02, TYP-MODL-03, TYP-IMPT-01
