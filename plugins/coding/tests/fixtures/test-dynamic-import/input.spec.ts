// compliant: static import — keeps test imports predictable
import { describe, it, expect } from "vitest";

import { createUser } from "./user";

describe("fn:createUser", () => {
  it("should load the module dynamically", async () => {
    // violation: dynamic import in a test file
    const mod = await import("./user");
    expect(mod).toBeDefined();
  });

  it("should create a user", () => {
    expect(createUser()).toBeDefined();
  });
});
