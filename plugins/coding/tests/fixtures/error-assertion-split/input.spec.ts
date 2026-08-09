import { describe, expect, it } from 'vitest';

import { doWork } from './work';

describe('fn:doWork', () => {
  it('should split the error assertion (flagged)', async () => {
    const error = await doWork().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('boom');
  });

  it('should split a custom error assertion (flagged)', async () => {
    const error = await doWork().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FetchError);
    expect((error as FetchError).cause).toBe('network');
  });

  it('should assert the whole error (clean)', async () => {
    const error = await doWork().catch((e: unknown) => e);

    expect(error).toEqual(new Error('boom'));
  });

  it('should narrow for control flow only (clean)', () => {
    const value: unknown = 42;

    expect(value).toBeInstanceOf(Number);
  });
});
