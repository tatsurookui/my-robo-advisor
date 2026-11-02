import type { RiskProfile } from "./riskQuiz";

export interface DashboardHolding {
  id: string;
  ticker: string;
  name: string;
  asset_class_id: number;
  quantity: string | number;
  price: string | number;
}

export interface DashboardAssetClass {
  id: number;
  name: string;
  target_conservative: string | number;
  target_moderate: string | number;
  target_aggressive: string | number;
}

export interface DashboardAllocation {
  assetClassId: number;
  assetClassName: string;
  marketValue: number;
  percentage: number;
  color: string;
}

export interface LargestHolding {
  id: string;
  ticker: string;
  name: string;
  marketValue: number;
}

export interface RecommendedAllocation {
  assetClassId: number;
  assetClassName: string;
  percentage: number;
  color: string;
}

export interface DashboardChartAllocation {
  assetClassId: number;
  assetClassName: string;
  value: number;
  color: string;
}

export interface DashboardRiskProfile {
  score: number;
  profile: RiskProfile;
}

export interface DashboardSummary {
  totalPortfolioValue: number;
  holdingCount: number;
  largestHolding: LargestHolding | null;
  allocations: DashboardAllocation[];
  riskProfile: DashboardRiskProfile | null;
  recommendedAllocations: RecommendedAllocation[] | null;
}

const ASSET_CLASS_ORDER = [
  "US Stocks",
  "International Stocks",
  "Bonds",
  "Cash",
] as const;

export const ASSET_CLASS_COLORS: Record<(typeof ASSET_CLASS_ORDER)[number], string> = {
  "US Stocks": "#5049cf",
  "International Stocks": "#7594e9",
  Bonds: "#57afa4",
  Cash: "#e7bd69",
};

const TARGET_FIELD_BY_PROFILE = {
  conservative: "target_conservative",
  moderate: "target_moderate",
  aggressive: "target_aggressive",
} as const;

export function calculateRecommendedAllocations(
  assetClasses: readonly DashboardAssetClass[],
  profile: RiskProfile,
): RecommendedAllocation[] {
  const assetClassByName = new Map(
    assetClasses.map((assetClass) => [assetClass.name, assetClass]),
  );
  const targetField = TARGET_FIELD_BY_PROFILE[profile];
  const allocations = ASSET_CLASS_ORDER.map((assetClassName) => {
    const assetClass = assetClassByName.get(assetClassName);
    if (!assetClass) {
      throw new Error(`Dashboard asset class is missing: ${assetClassName}`);
    }

    const percentage = Number(assetClass[targetField]);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error(`Recommended allocation is invalid: ${assetClassName}`);
    }

    return {
      assetClassId: assetClass.id,
      assetClassName,
      percentage,
      color: ASSET_CLASS_COLORS[assetClassName],
    };
  });

  const totalPercentage = allocations.reduce(
    (total, allocation) => total + allocation.percentage,
    0,
  );
  if (Math.abs(totalPercentage - 100) > 0.001) {
    throw new Error(
      `Recommended allocations for ${profile} must total 100%.`,
    );
  }

  return allocations;
}

export function calculateDashboardSummary(
  holdings: readonly DashboardHolding[],
  assetClasses: readonly DashboardAssetClass[],
  savedRiskProfile: {
    risk_score: number | null;
    risk_profile: RiskProfile | null;
  } | null = null,
): DashboardSummary {
  const assetClassByName = new Map(
    assetClasses.map((assetClass) => [assetClass.name, assetClass]),
  );
  const allocations = ASSET_CLASS_ORDER.map((assetClassName) => {
    const assetClass = assetClassByName.get(assetClassName);
    if (!assetClass) {
      throw new Error(`Dashboard asset class is missing: ${assetClassName}`);
    }
    return {
      assetClassId: assetClass.id,
      assetClassName,
      marketValue: 0,
      percentage: 0,
      color: ASSET_CLASS_COLORS[assetClassName],
    };
  });
  const allocationById = new Map(
    allocations.map((allocation) => [allocation.assetClassId, allocation]),
  );

  let totalPortfolioValue = 0;
  let largestHolding: LargestHolding | null = null;

  for (const holding of holdings) {
    const quantity = Number(holding.quantity);
    const price = Number(holding.price);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
      throw new Error(`Dashboard received invalid values for ${holding.ticker}.`);
    }

    const allocation = allocationById.get(holding.asset_class_id);
    if (!allocation) {
      throw new Error(`Dashboard asset class is missing for ${holding.ticker}.`);
    }

    const marketValue = quantity * price;
    allocation.marketValue += marketValue;
    totalPortfolioValue += marketValue;

    if (!largestHolding || marketValue > largestHolding.marketValue) {
      largestHolding = {
        id: holding.id,
        ticker: holding.ticker,
        name: holding.name,
        marketValue,
      };
    }
  }

  if (totalPortfolioValue > 0) {
    for (const allocation of allocations) {
      allocation.percentage = (allocation.marketValue / totalPortfolioValue) * 100;
    }
  }

  const riskProfile =
    savedRiskProfile?.risk_score !== null &&
    savedRiskProfile?.risk_score !== undefined &&
    savedRiskProfile.risk_profile !== null
      ? {
          score: savedRiskProfile.risk_score,
          profile: savedRiskProfile.risk_profile,
        }
      : null;

  return {
    totalPortfolioValue,
    holdingCount: holdings.length,
    largestHolding,
    allocations,
    riskProfile,
    recommendedAllocations: riskProfile
      ? calculateRecommendedAllocations(assetClasses, riskProfile.profile)
      : null,
  };
}
