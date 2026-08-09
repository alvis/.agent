import { describe, it, expect } from "vitest";

// violation: symbol describe with an unapproved prefix
describe("xx:computeTax", () => {
  // violation: it title not starting with `should`
  it("returns the tax amount", () => {
    expect(true).toBe(true);
  });

  // compliant: it title starts with `should`
  it("should return zero for a zero subtotal", () => {
    expect(true).toBe(true);
  });
});

// compliant: symbol describe with an approved prefix
describe("fn:formatName", () => {
  it("should format the name", () => {
    expect(true).toBe(true);
  });
});

// compliant: general-purpose describe carries no prefix
describe("edge cases", () => {
  it("should handle empty input", () => {
    expect(true).toBe(true);
  });
});
