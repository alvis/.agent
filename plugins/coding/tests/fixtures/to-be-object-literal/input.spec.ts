import { describe, it, expect } from "vitest";

describe("fn:loadUser", () => {
  it("should return the user shape", () => {
    const result = loadUser("u1");

    expect(result).toBe({ id: "u1" });
  });

  it("should return the configured items", () => {
    const items = loadItems();

    expect(items).toBe(["a", "b"]);
  });

  it("should return zero when no users exist", () => {
    const count = countUsers();

    expect(count).toBe(0);
  });

  it("should cache the loaded user instance", () => {
    const k = "u1";

    expect(getCached(k)).toBe(getCached(k));
  });

  it("should structurally equal the expected shape", () => {
    const result = loadUser("u1");

    expect(result).toEqual({ id: "u1" });
  });
});

declare function loadUser(id: string): { id: string };
declare function loadItems(): string[];
declare function countUsers(): number;
declare function getCached(key: string): { id: string };
