import type { DashboardSummary } from "./dashboard";

export type RebalanceAction = "buy" | "sell" | "none";

export interface RebalancingRow {
  assetClassId: number;
  assetClassName: string;
  color: string;
  currentPercentage: number;
  targetPercentage: number;
  driftPercentagePoints: number;
  adjustmentAmount: number;
  action: RebalanceAction;
  needsAttention: boolean;
}

export interface RebalancingPlan {
  totalPortfolioValue: number;
  holdingCount: number;
  riskProfile: DashboardSummary["riskProfile"];
  rows: RebalancingRow[] | null;
}

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculateRebalancing(
  dashboard: DashboardSummary,
): RebalancingPlan {
  const riskProfile = dashboard.riskProfile;
  const recommendedAllocations = dashboard.recommendedAllocations;
  if (!riskProfile || !recommendedAllocations) {
    return {
      totalPortfolioValue: dashboard.totalPortfolioValue,
      holdingCount: dashboard.holdingCount,
      riskProfile: null,
      rows: null,
    };
  }

  const currentById = new Map(
    dashboard.allocations.map((allocation) => [
      allocation.assetClassId,
      allocation,
    ]),
  );

  const rows = recommendedAllocations.map((target) => {
    const current = currentById.get(target.assetClassId);
    if (!current) {
      throw new Error(
        `Current allocation is missing: ${target.assetClassName}`,
      );
    }

    const driftPercentagePoints =
      current.percentage - target.percentage;
    const targetValue =
      dashboard.totalPortfolioValue * (target.percentage / 100);
    const adjustmentAmount = roundCurrency(targetValue - current.marketValue);
    const action: RebalanceAction =
      adjustmentAmount > 0 ? "buy" : adjustmentAmount < 0 ? "sell" : "none";

    return {
      assetClassId: target.assetClassId,
      assetClassName: target.assetClassName,
      color: target.color,
      currentPercentage: current.percentage,
      targetPercentage: target.percentage,
      driftPercentagePoints,
      adjustmentAmount,
      action,
      needsAttention: Math.abs(driftPercentagePoints) > 5,
    };
  });

  return {
    totalPortfolioValue: dashboard.totalPortfolioValue,
    holdingCount: dashboard.holdingCount,
    riskProfile,
    rows,
  };
}
