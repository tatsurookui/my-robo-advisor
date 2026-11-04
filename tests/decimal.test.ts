import { describe, expect, it } from "vitest";
import {
  addDecimalStrings,
  formatDecimalQuantity,
  formatUsd,
  multiplyDecimalStrings,
} from "../shared/decimal";

describe("exact decimal handling", () => {
  it.each([
    ["0.50000000", "0.5"],
    ["1.25000000", "1.25"],
    ["10.75000000", "10.75"],
    ["123456789012.12345678", "123,456,789,012.12345678"],
  ])("formats quantity %s without rounding", (value, expected) => {
    expect(formatDecimalQuantity(value)).toBe(expected);
  });

  it("multiplies share quantity by USD price exactly", () => {
    expect(multiplyDecimalStrings("1.25", "80.00")).toBe("100");
    expect(multiplyDecimalStrings("0.5", "10.05")).toBe("5.025");
    expect(addDecimalStrings("0.1", "0.2")).toBe("0.3");
  });

  it("rounds currency to cents from exact decimal text", () => {
    expect(formatUsd("1.005")).toBe("$1.01");
    expect(formatUsd("5.025")).toBe("$5.03");
    expect(formatUsd("1000000000000.00")).toBe("$1,000,000,000,000.00");
  });
});
