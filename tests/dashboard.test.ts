import { describe, expect, it, vi } from "vitest";
import {
  calculateDashboardSummary,
  type DashboardAssetClass,
  type DashboardHolding,
} from "../shared/dashboard";
import { getDashboardSummary } from "../server/dashboardStore";

const assetClasses: DashboardAssetClass[] = [
  { id: 1, name: "US Stocks" },
  { id: 2, name: "International Stocks" },
  { id: 3, name: "Bonds" },
  { id: 4, name: "Cash" },
];

const exampleHoldings: DashboardHolding[] = [
  {
    id: "holding-vti",
    ticker: "VTI",
    name: "Vanguard Total Stock Market ETF",
    asset_class_id: 1,
    quantity: "10",
    price: "250.00",
  },
  {
    id: "holding-bnd",
    ticker: "BND",
    name: "Vanguard Total Bond Market ETF",
    asset_class_id: 3,
    quantity: "20",
    price: "72.50",
  },
];

describe("dashboard summary", () => {
  it("calculates the $3,950 plan example and groups allocations by class", () => {
    const summary = calculateDashboardSummary(exampleHoldings, assetClasses);

    expect(summary.totalPortfolioValue).toBe(3950);
    expect(summary.holdingCount).toBe(2);
    expect(summary.largestHolding).toEqual({
      id: "holding-vti",
      ticker: "VTI",
      name: "Vanguard Total Stock Market ETF",
      marketValue: 2500,
    });
    expect(summary.allocations).toHaveLength(4);
    expect(summary.allocations.map(({ marketValue }) => marketValue)).toEqual([
      2500,
      0,
      1450,
      0,
    ]);
    expect(summary.allocations[0]?.percentage).toBeCloseTo(63.2911, 3);
    expect(summary.allocations[2]?.percentage).toBeCloseTo(36.7089, 3);
  });

  it("returns a zeroed summary for an empty portfolio", () => {
    const summary = calculateDashboardSummary([], assetClasses);

    expect(summary.totalPortfolioValue).toBe(0);
    expect(summary.holdingCount).toBe(0);
    expect(summary.largestHolding).toBeNull();
    expect(summary.allocations).toHaveLength(4);
    expect(summary.allocations.every(({ marketValue, percentage }) =>
      marketValue === 0 && percentage === 0,
    )).toBe(true);
  });

  it("loads dashboard holdings using only the authenticated user's id", async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes("FROM assets AS a")) {
        return Promise.resolve({ rows: exampleHoldings });
      }
      return Promise.resolve({ rows: assetClasses });
    });

    const summary = await getDashboardSummary(
      { query } as never,
      "user_clerk_a",
    );

    expect(summary.totalPortfolioValue).toBe(3950);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE a.user_id = $1"),
      ["user_clerk_a"],
    );
  });
});
