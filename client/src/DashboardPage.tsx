import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "wouter";
import type {
  DashboardChartAllocation,
  DashboardSummary,
} from "../../shared/dashboard";

const DashboardChart = lazy(() => import("./DashboardChart"));

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

const riskProfileLabels = {
  conservative: "Conservative",
  moderate: "Moderate",
  aggressive: "Aggressive",
} as const;

async function loadDashboard(): Promise<DashboardSummary> {
  const response = await fetch("/api/dashboard");
  const payload = (await response.json().catch(() => null)) as
    | { dashboard?: DashboardSummary; error?: string }
    | null;

  if (!response.ok || !payload?.dashboard) {
    throw new Error(
      payload?.error ?? "Your portfolio dashboard could not be loaded.",
    );
  }

  return payload.dashboard;
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");
    loadDashboard()
      .then((result) => {
        if (!cancelled) setDashboard(result);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Your portfolio dashboard could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reload]);

  const currentChartAllocations: DashboardChartAllocation[] = (
    dashboard?.allocations ?? []
  ).map((allocation) => ({
    assetClassId: allocation.assetClassId,
    assetClassName: allocation.assetClassName,
    value: allocation.percentage,
    color: allocation.color,
  }));
  const recommendedChartAllocations: DashboardChartAllocation[] = (
    dashboard?.recommendedAllocations ?? []
  ).map((allocation) => ({
    assetClassId: allocation.assetClassId,
    assetClassName: allocation.assetClassName,
    value: allocation.percentage,
    color: allocation.color,
  }));

  return (
    <section className="holdings-content dashboard-content">
      <div className="holdings-page-heading">
        <div>
          <div className="eyebrow">YOUR PORTFOLIO</div>
          <h1>Dashboard</h1>
          <p>A clear view of your holdings and current asset allocation.</p>
        </div>
        <Link href="/holdings/new" className="button">
          Add a holding <span aria-hidden="true">+</span>
        </Link>
      </div>

      {isLoading && <p className="holdings-message">Loading your dashboard…</p>}
      {error && (
        <div className="holdings-alert" role="alert">
          <span>{error}</span>
          <button
            className="text-button"
            onClick={() => setReload((attempt) => attempt + 1)}
            type="button"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && dashboard && (
        <>
          <div className="dashboard-stats">
            <article className="dashboard-stat">
              <span className="dashboard-stat__label">Total portfolio value</span>
              <strong className="dashboard-stat__value">
                {formatCurrency(dashboard.totalPortfolioValue)}
              </strong>
              <span className="dashboard-stat__detail">Current market value</span>
            </article>
            <article className="dashboard-stat">
              <span className="dashboard-stat__label">Number of holdings</span>
              <strong className="dashboard-stat__value">
                {new Intl.NumberFormat("en-US").format(dashboard.holdingCount)}
              </strong>
              <span className="dashboard-stat__detail">Positions in your portfolio</span>
            </article>
            <article className="dashboard-stat">
              <span className="dashboard-stat__label">Largest holding</span>
              <strong className="dashboard-stat__value dashboard-stat__value--largest">
                {dashboard.largestHolding
                  ? formatCurrency(dashboard.largestHolding.marketValue)
                  : "—"}
              </strong>
              <span className="dashboard-stat__detail">
                {dashboard.largestHolding
                  ? `${dashboard.largestHolding.ticker} · ${dashboard.largestHolding.name}`
                  : "Add a holding to see your largest position"}
              </span>
            </article>
          </div>

          <div className="dashboard-allocation-comparison">
            <section
              className="dashboard-card dashboard-comparison-card"
              aria-labelledby="current-allocation-title"
            >
              <div className="dashboard-card__heading">
                <div>
                  <h2 id="current-allocation-title">Current allocation</h2>
                  <p>Your portfolio by asset class</p>
                </div>
                <span className="dashboard-card__total">
                  {formatCurrency(dashboard.totalPortfolioValue)}
                </span>
              </div>
              <div className="dashboard-comparison-chart">
                {dashboard.totalPortfolioValue > 0 ? (
                  <Suspense
                    fallback={
                      <div className="dashboard-chart__loading">
                        Loading chart…
                      </div>
                    }
                  >
                    <DashboardChart
                      allocations={currentChartAllocations}
                      formatValue={formatPercentage}
                    />
                  </Suspense>
                ) : (
                  <div className="dashboard-chart__empty">
                    <span aria-hidden="true">◌</span>
                    <strong>
                      {dashboard.holdingCount === 0
                        ? "No holdings to chart yet"
                        : "No market value to chart yet"}
                    </strong>
                    {dashboard.holdingCount === 0 ? (
                      <Link href="/holdings/new" className="text-button">
                        Add your first holding
                      </Link>
                    ) : (
                      <Link href="/holdings" className="text-button">
                        Review holdings
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <ul className="dashboard-allocation-list dashboard-allocation-list--comparison">
                {dashboard.allocations.map((allocation) => (
                  <li key={allocation.assetClassId}>
                    <span
                      className="dashboard-allocation-list__swatch"
                      style={{ backgroundColor: allocation.color }}
                      aria-hidden="true"
                    />
                    <span className="dashboard-allocation-list__copy">
                      <span className="dashboard-allocation-list__name">
                        {allocation.assetClassName}
                      </span>
                      <small>{formatCurrency(allocation.marketValue)}</small>
                    </span>
                    <strong>{formatPercentage(allocation.percentage)}</strong>
                  </li>
                ))}
              </ul>
            </section>

            <section
              className="dashboard-card dashboard-comparison-card"
              aria-labelledby="recommended-allocation-title"
            >
              <div className="dashboard-card__heading">
                <div>
                  <h2 id="recommended-allocation-title">
                    Recommended allocation
                  </h2>
                  <p>
                    {dashboard.riskProfile
                      ? `Based on your ${riskProfileLabels[dashboard.riskProfile.profile].toLowerCase()} profile`
                      : "Targets based on your risk profile"}
                  </p>
                </div>
                {dashboard.riskProfile && (
                  <span className="dashboard-risk-badge">
                    {riskProfileLabels[dashboard.riskProfile.profile]}
                  </span>
                )}
              </div>

              {dashboard.recommendedAllocations ? (
                <>
                  <div className="dashboard-comparison-chart">
                    <Suspense
                      fallback={
                        <div className="dashboard-chart__loading">
                          Loading chart…
                        </div>
                      }
                    >
                      <DashboardChart
                        allocations={recommendedChartAllocations}
                        formatValue={formatPercentage}
                      />
                    </Suspense>
                  </div>
                  <ul className="dashboard-allocation-list dashboard-allocation-list--comparison">
                    {dashboard.recommendedAllocations.map((allocation) => (
                      <li key={allocation.assetClassId}>
                        <span
                          className="dashboard-allocation-list__swatch"
                          style={{ backgroundColor: allocation.color }}
                          aria-hidden="true"
                        />
                        <span className="dashboard-allocation-list__copy">
                          <span className="dashboard-allocation-list__name">
                            {allocation.assetClassName}
                          </span>
                        </span>
                        <strong>{formatPercentage(allocation.percentage)}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="dashboard-recommendation-empty">
                  <span aria-hidden="true">◈</span>
                  <strong>Set your risk profile</strong>
                  <p>
                    Complete the short quiz to see your recommended portfolio
                    mix here.
                  </p>
                  <Link href="/risk-quiz" className="button button--small">
                    Take the risk quiz
                  </Link>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
