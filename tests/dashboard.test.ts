import { describe, expect, it, vi } from "vitest";
import {
  calculateRecommendedAllocations,
  calculateDashboardSummary,
  type DashboardAssetClass,
  type DashboardHolding,
} from "../shared/dashboard";
import { getDashboardSummary } from "../server/dashboardStore";

const assetClasses: DashboardAssetClass[] = [
  {
    id: 1,
    name: "US Stocks",
    target_conservative: "20",
    target_moderate: "35",
    target_aggressive: "55",
  },
  {
    id: 2,
    name: "International Stocks",
    target_conservative: "10",
    target_moderate: "20",
    target_aggressive: "30",
  },
  {
    id: 3,
    name: "Bonds",
    target_conservative: "55",
    target_moderate: "35",
    target_aggressive: "10",
  },
  {
    id: 4,
    name: "Cash",
    target_conservative: "15",
    target_moderate: "10",
    target_aggressive: "5",
  },
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
    expect(summary.riskProfile).toBeNull();
    expect(summary.recommendedAllocations).toBeNull();
  });

  it.each([
    ["conservative", [20, 10, 55, 15]],
    ["moderate", [35, 20, 35, 10]],
    ["aggressive", [55, 30, 10, 5]],
  ] as const)(
    "uses the exact %s PLAN.md targets and totals 100%",
    (profile, expectedTargets) => {
      const recommendations = calculateRecommendedAllocations(
        assetClasses,
        profile,
      );

      expect(recommendations.map(({ percentage }) => percentage)).toEqual(
        expectedTargets,
      );
      expect(
        recommendations.reduce(
          (total, allocation) => total + allocation.percentage,
          0,
        ),
      ).toBe(100);
      expect(recommendations.map(({ color }) => color)).toEqual(
        calculateDashboardSummary([], assetClasses).allocations.map(
          ({ color }) => color,
        ),
      );
    },
  );

  it("adds the saved profile and its recommended targets to the dashboard summary", () => {
    const summary = calculateDashboardSummary([], assetClasses, {
      risk_score: 7,
      risk_profile: "moderate",
    });

    expect(summary.riskProfile).toEqual({
      score: 7,
      profile: "moderate",
    });
    expect(summary.recommendedAllocations?.map(({ percentage }) => percentage))
      .toEqual([35, 20, 35, 10]);
  });

  it("rejects target percentages that do not total 100%", () => {
    const invalidAssetClasses = assetClasses.map((assetClass) =>
      assetClass.name === "Cash"
        ? { ...assetClass, target_aggressive: "4" }
        : assetClass,
    );

    expect(() =>
      calculateRecommendedAllocations(invalidAssetClasses, "aggressive"),
    ).toThrow("Recommended allocations for aggressive must total 100%.");
  });

  it("handles an authenticated user with no holdings and no saved risk profile", async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes("FROM assets AS a")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("FROM users")) {
        return Promise.resolve({
          rows: [{ risk_score: null, risk_profile: null }],
        });
      }
      return Promise.resolve({ rows: assetClasses });
    });

    const summary = await getDashboardSummary(
      { query } as never,
      "user_without_profile",
    );

    expect(summary.totalPortfolioValue).toBe(0);
    expect(summary.holdingCount).toBe(0);
    expect(summary.allocations.every(({ percentage }) => percentage === 0)).toBe(
      true,
    );
    expect(summary.riskProfile).toBeNull();
    expect(summary.recommendedAllocations).toBeNull();
  });

  it("loads dashboard holdings using only the authenticated user's id", async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes("FROM assets AS a")) {
        return Promise.resolve({ rows: exampleHoldings });
      }
      if (sql.includes("FROM users")) {
        return Promise.resolve({
          rows: [{ risk_score: 5, risk_profile: "moderate" }],
        });
      }
      return Promise.resolve({ rows: assetClasses });
    });

    const summary = await getDashboardSummary(
      { query } as never,
      "user_clerk_a",
    );

    expect(summary.totalPortfolioValue).toBe(3950);
    expect(summary.riskProfile).toEqual({ score: 5, profile: "moderate" });
    expect(summary.recommendedAllocations?.map(({ percentage }) => percentage))
      .toEqual([35, 20, 35, 10]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE a.user_id = $1"),
      ["user_clerk_a"],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $1"),
      ["user_clerk_a"],
    );
  });
});
