import { describe, it, expect } from "vitest";

describe("fn:formatCurrency", () => {
  it("should format number as USD currency", () => {
    // Arrange
    const amount = 1234.56;

    // Act
    const result = formatCurrency(amount);

    // Assert
    expect(result).toBe("$1,234.56");
  });

  it("should format zero", () => {
    // arrange the zero-amount edge case input
    const amount = 0;

    const result = formatCurrency(amount);

    expect(result).toBe("$0.00");
  });
});

declare function formatCurrency(amount: number): string;
