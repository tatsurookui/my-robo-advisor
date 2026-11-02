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

export interface DashboardSummary {
  totalPortfolioValue: number;
  holdingCount: number;
  largestHolding: LargestHolding | null;
  allocations: DashboardAllocation[];
}

const ASSET_CLASS_ORDER = [
  "US Stocks",
  "International Stocks",
  "Bonds",
  "Cash",
] as const;

const ASSET_CLASS_COLORS: Record<(typeof ASSET_CLASS_ORDER)[number], string> = {
  "US Stocks": "#5049cf",
  "International Stocks": "#7594e9",
  Bonds: "#57afa4",
  Cash: "#e7bd69",
};

export function calculateDashboardSummary(
  holdings: readonly DashboardHolding[],
  assetClasses: readonly DashboardAssetClass[],
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

  return {
    totalPortfolioValue,
    holdingCount: holdings.length,
    largestHolding,
    allocations,
  };
}
