import { describe, it, expect } from "vitest";

// violation: silent skip via describe.runIf
describe.runIf(process.env.TEST_DATABASE_URL)("fn:fetchUser", () => {
  it("should return the user row", () => {
    expect(true).toBe(true);
  });
});

// violation: silent skip via it.skipIf
describe("fn:fetchOrder", () => {
  it.skipIf(!process.env.TEST_DATABASE_URL)("should return the order", () => {
    expect(true).toBe(true);
  });
});

// compliant: no conditional skip — config hard-fails at file load elsewhere
describe("fn:fetchProduct", () => {
  it("should return the product", () => {
    expect(true).toBe(true);
  });
});
