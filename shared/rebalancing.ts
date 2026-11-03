import type { DashboardSummary } from "./dashboard";
import { centsToNumber } from "./money";

export type RebalanceAction = "buy" | "sell" | "none";

export interface RebalancingRow {
  assetClassId: number;
  assetClassName: string;
  color: string;
  currentPercentage: number;
  targetPercentage: number;
  driftPercentagePoints: number;
  adjustmentAmount: number;
  adjustmentAmountCents: string;
  action: RebalanceAction;
  needsAttention: boolean;
}

export interface RebalancingPlan {
  totalPortfolioValue: number;
  totalPortfolioValueCents: string;
  holdingCount: number;
  riskProfile: DashboardSummary["riskProfile"];
  rows: RebalancingRow[] | null;
}

function roundPositiveDivision(numerator: bigint, denominator: bigint) {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

export function calculateRebalancing(
  dashboard: DashboardSummary,
): RebalancingPlan {
  const riskProfile = dashboard.riskProfile;
  const recommendedAllocations = dashboard.recommendedAllocations;
  if (!riskProfile || !recommendedAllocations) {
    return {
      totalPortfolioValue: dashboard.totalPortfolioValue,
      totalPortfolioValueCents: dashboard.totalPortfolioValueCents,
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
    const targetBasisPoints = BigInt(Math.round(target.percentage * 100));
    const targetValueCents = roundPositiveDivision(
      BigInt(dashboard.totalPortfolioValueCents) * targetBasisPoints,
      10_000n,
    );
    const adjustmentAmountCents =
      targetValueCents - BigInt(current.marketValueCents);
    const adjustmentAmount = centsToNumber(adjustmentAmountCents);
    const action: RebalanceAction =
      adjustmentAmountCents > 0n
        ? "buy"
        : adjustmentAmountCents < 0n
          ? "sell"
          : "none";

    return {
      assetClassId: target.assetClassId,
      assetClassName: target.assetClassName,
      color: target.color,
      currentPercentage: current.percentage,
      targetPercentage: target.percentage,
      driftPercentagePoints,
      adjustmentAmount,
      adjustmentAmountCents: adjustmentAmountCents.toString(),
      action,
      needsAttention: Math.abs(driftPercentagePoints) > 5,
    };
  });

  return {
    totalPortfolioValue: dashboard.totalPortfolioValue,
    totalPortfolioValueCents: dashboard.totalPortfolioValueCents,
    holdingCount: dashboard.holdingCount,
    riskProfile,
    rows,
  };
}
