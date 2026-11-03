import { describe, expect, it, vi } from "vitest";
import {
  calculateDashboardSummary,
  type DashboardAssetClass,
  type DashboardHolding,
} from "../shared/dashboard";
import { calculateRebalancing } from "../shared/rebalancing";
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

function createDashboard(values: number[], hasRiskProfile = true) {
  const holdings: DashboardHolding[] = values.map((marketValue, index) => ({
    id: `holding-${index + 1}`,
    ticker: `T${index + 1}`,
    name: `Test holding ${index + 1}`,
    asset_class_id: index + 1,
    quantity: "1",
    price: String(marketValue),
  }));

  return calculateDashboardSummary(
    holdings,
    assetClasses,
    hasRiskProfile
      ? { risk_score: 5, risk_profile: "moderate" }
      : { risk_score: null, risk_profile: null },
  );
}

describe("rebalancing calculations", () => {
  it("calculates Buy, Sell, and zero adjustment using target value minus current value", () => {
    const plan = calculateRebalancing(
      createDashboard([100, 200, 350, 350]),
    );
    const usStocks = plan.rows?.find(
      (row) => row.assetClassName === "US Stocks",
    );
    const internationalStocks = plan.rows?.find(
      (row) => row.assetClassName === "International Stocks",
    );
    const cash = plan.rows?.find((row) => row.assetClassName === "Cash");

    expect(plan.totalPortfolioValue).toBe(1000);
    expect(plan.totalPortfolioValueCents).toBe("100000");
    expect(usStocks).toMatchObject({
      currentPercentage: 10,
      targetPercentage: 35,
      driftPercentagePoints: -25,
      adjustmentAmount: 250,
      adjustmentAmountCents: "25000",
      action: "buy",
      needsAttention: true,
    });
    expect(internationalStocks).toMatchObject({
      currentPercentage: 20,
      targetPercentage: 20,
      driftPercentagePoints: 0,
      adjustmentAmount: 0,
      adjustmentAmountCents: "0",
      action: "none",
      needsAttention: false,
    });
    expect(cash).toMatchObject({
      currentPercentage: 35,
      targetPercentage: 10,
      driftPercentagePoints: 25,
      adjustmentAmount: -250,
      adjustmentAmountCents: "-25000",
      action: "sell",
      needsAttention: true,
    });
  });

  it("does not highlight a drift of exactly five percentage points", () => {
    const plan = calculateRebalancing(
      createDashboard([400, 200, 300, 100]),
    );
    const usStocks = plan.rows?.find(
      (row) => row.assetClassName === "US Stocks",
    );
    const bonds = plan.rows?.find((row) => row.assetClassName === "Bonds");

    expect(usStocks?.driftPercentagePoints).toBe(5);
    expect(usStocks?.needsAttention).toBe(false);
    expect(bonds?.driftPercentagePoints).toBe(-5);
    expect(bonds?.needsAttention).toBe(false);
  });

  it("returns zero adjustments for an empty portfolio without invalid percentages", () => {
    const dashboard = calculateDashboardSummary(
      [],
      assetClasses,
      { risk_score: 5, risk_profile: "moderate" },
    );
    const plan = calculateRebalancing(dashboard);

    expect(plan.totalPortfolioValue).toBe(0);
    expect(plan.rows).toHaveLength(4);
    expect(
      plan.rows?.every(
        (row) =>
          row.currentPercentage === 0 &&
          row.adjustmentAmount === 0 &&
          row.action === "none",
      ),
    ).toBe(true);
  });

  it("handles holdings with no ticker or name", () => {
    const dashboard = calculateDashboardSummary(
      [
        {
          id: "unnamed-holding",
          ticker: null,
          name: null,
          asset_class_id: 1,
          quantity: "0.25",
          price: "100",
        },
      ],
      assetClasses,
      { risk_score: 5, risk_profile: "moderate" },
    );
    const plan = calculateRebalancing(dashboard);

    expect(plan.totalPortfolioValueCents).toBe("2500");
    expect(plan.rows).toHaveLength(4);
  });

  it("omits target rows until the user has a saved risk profile", () => {
    const plan = calculateRebalancing(createDashboard([100, 200, 300, 400], false));

    expect(plan.riskProfile).toBeNull();
    expect(plan.rows).toBeNull();
  });

  it("loads holdings and risk profile only for the authenticated user", async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes("FROM assets AS a")) {
        return Promise.resolve({
          rows: [
            {
              id: "private-holding",
              ticker: "OWN",
              name: "Own holding",
              asset_class_id: 1,
              quantity: "1",
              price: "100",
            },
          ],
        });
      }
      if (sql.includes("FROM users")) {
        return Promise.resolve({
          rows: [{ risk_score: 5, risk_profile: "moderate" }],
        });
      }
      return Promise.resolve({ rows: assetClasses });
    });

    const dashboard = await getDashboardSummary(
      { query } as never,
      "clerk_user_only",
    );
    const plan = calculateRebalancing(dashboard);

    expect(plan.totalPortfolioValue).toBe(100);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE a.user_id = $1"),
      ["clerk_user_only"],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $1"),
      ["clerk_user_only"],
    );
  });
});
