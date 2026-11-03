import { describe, expect, it } from "vitest";
import {
  decimalToCents,
  formatExactQuantity,
  formatUsdCents,
  formatUsdDecimal,
  multiplyDecimalsToCents,
} from "../shared/money";

describe("exact money helpers", () => {
  it.each([
    ["10", "250", "250000"],
    ["20", "72.50", "145000"],
    ["0.25", "100", "2500"],
    ["0.1", "0.2", "2"],
    ["1", "0", "0"],
  ])("calculates %s × %s as exact cents", (quantity, price, expectedCents) => {
    expect(multiplyDecimalsToCents(quantity, price)?.toString()).toBe(
      expectedCents,
    );
  });

  it("uses decimal half-up rounding at the cent boundary", () => {
    expect(multiplyDecimalsToCents("1", "0.005")?.toString()).toBe("1");
    expect(multiplyDecimalsToCents("1", "0.0049")?.toString()).toBe("0");
  });

  it("returns no estimate for empty, invalid, or zero quantity input", () => {
    expect(multiplyDecimalsToCents("", "100")).toBeNull();
    expect(multiplyDecimalsToCents("1.000000001", "100")).toBeNull();
    expect(multiplyDecimalsToCents("0", "100")).toBeNull();
  });

  it("formats USD to two decimals without floating-point conversion", () => {
    expect(formatUsdCents(395000n)).toBe("$3,950.00");
    expect(formatUsdCents(-2500n)).toBe("-$25.00");
    expect(formatUsdDecimal("72.50000000")).toBe("$72.50");
    expect(decimalToCents("0.99")).toBe(99n);
  });

  it("keeps quantity text exact and removes only insignificant trailing zeros", () => {
    expect(formatExactQuantity("1.00000000")).toBe("1");
    expect(formatExactQuantity("1.00000001")).toBe("1.00000001");
    expect(formatExactQuantity("0.00010000")).toBe("0.0001");
  });
});
