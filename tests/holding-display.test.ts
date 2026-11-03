import { describe, expect, it } from "vitest";
import {
  getHoldingDisplayName,
  getHoldingSecondaryLabel,
} from "../shared/holdingDisplay";

describe("holding display labels", () => {
  it("uses an unnamed fallback when ticker and name are both missing", () => {
    const holding = { ticker: null, name: null };

    expect(getHoldingDisplayName(holding)).toBe("Unnamed holding");
    expect(getHoldingSecondaryLabel(holding)).toBeNull();
  });

  it("uses ticker as the display name when it is the only label", () => {
    const holding = { ticker: "BND", name: null };

    expect(getHoldingDisplayName(holding)).toBe("BND");
    expect(getHoldingSecondaryLabel(holding)).toBeNull();
  });

  it("uses name as the display name when it is the only label", () => {
    const holding = { ticker: null, name: "Bond fund" };

    expect(getHoldingDisplayName(holding)).toBe("Bond fund");
    expect(getHoldingSecondaryLabel(holding)).toBeNull();
  });

  it("displays a distinct ticker alongside a holding name", () => {
    const holding = { ticker: "BND", name: "Bond fund" };

    expect(getHoldingDisplayName(holding)).toBe("Bond fund");
    expect(getHoldingSecondaryLabel(holding)).toBe("BND");
  });
});
