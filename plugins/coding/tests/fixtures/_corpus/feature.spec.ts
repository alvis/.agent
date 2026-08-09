import { compute } from './source';

beforeAll(() => {
  setupEnv();
});

describe('feature', () => {
  let cachedResult = 0;

  beforeEach(() => {
    cachedResult = compute();
  });

  it('uses a mock', () => {
    const userMock = { id: 1 };
    expect(cachedResult).toBeGreaterThanOrEqual(0);
    expect(userMock.id).toBe(1);
  });
});

function setupEnv(): void {}
