import { describe, it, expect } from "vitest";

describe("fn:createUser", () => {
  it("should create a user without a role", () => {
    // violation: explicit `undefined` override — omit the field instead
    const user = createUser({ role: undefined });

    expect(user).toBeDefined();
  });

  it("should create a user with a role", () => {
    // compliant: real value passed, no explicit undefined
    const user = createUser({ role: "admin" });

    expect(user).toBeDefined();
  });
});

declare function createUser(data?: { role?: string }): object;
