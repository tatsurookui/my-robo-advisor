import { useEffect, useState } from "react";
import { Link } from "wouter";
import type { RiskProfile } from "../../shared/riskQuiz";
import type {
  RebalanceAction,
  RebalancingPlan,
  RebalancingRow,
} from "../../shared/rebalancing";
import { formatUsdCents } from "../../shared/money";

interface RebalancingResponse {
  rebalancing?: RebalancingPlan;
  error?: string;
}

const riskProfileLabels: Record<RiskProfile, string> = {
  conservative: "Conservative",
  moderate: "Moderate",
  aggressive: "Aggressive",
};

function formatDrift(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(1)} pp`;
}

function getActionLabel(action: RebalanceAction, amountCents: string) {
  const amount = BigInt(amountCents);
  if (action === "buy") return `Buy ${formatUsdCents(amount)}`;
  if (action === "sell") {
    return `Sell ${formatUsdCents(amount < 0n ? -amount : amount)}`;
  }
  return `No dollar adjustment · ${formatUsdCents(0n)}`;
}

async function loadRebalancingPlan(): Promise<RebalancingPlan> {
  const response = await fetch("/api/rebalancing");
  const payload = (await response.json().catch(() => null)) as
    | RebalancingResponse
    | null;

  if (!response.ok || !payload?.rebalancing) {
    throw new Error(
      payload?.error ?? "Your rebalance plan could not be loaded.",
    );
  }
  return payload.rebalancing;
}

function RebalancingRowView({ row }: { row: RebalancingRow }) {
  return (
    <tr className={row.needsAttention ? "rebalance-row--attention" : undefined}>
      <th scope="row">
        <span className="rebalance-class-name">
          <span
            className="dashboard-allocation-list__swatch"
            style={{ backgroundColor: row.color }}
            aria-hidden="true"
          />
          {row.assetClassName}
        </span>
      </th>
      <td className="numeric-cell">{row.currentPercentage.toFixed(1)}%</td>
      <td className="numeric-cell">{row.targetPercentage.toFixed(1)}%</td>
      <td>
        <span
          className={`rebalance-drift${row.needsAttention ? " rebalance-drift--attention" : ""}`}
          title={
            row.needsAttention
              ? "This allocation is more than 5 percentage points from its target."
              : undefined
          }
        >
          {formatDrift(row.driftPercentagePoints)}
          {row.needsAttention && (
            <span className="rebalance-drift__flag">Review</span>
          )}
        </span>
      </td>
      <td>
        <span className={`rebalance-action rebalance-action--${row.action}`}>
          {getActionLabel(row.action, row.adjustmentAmountCents)}
        </span>
      </td>
    </tr>
  );
}

export default function RebalancingPage() {
  const [plan, setPlan] = useState<RebalancingPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    loadRebalancingPlan()
      .then((result) => {
        if (!cancelled) setPlan(result);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Your rebalance plan could not be loaded.",
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

  return (
    <section className="holdings-content rebalancing-content">
      <div className="holdings-page-heading">
        <div>
          <div className="eyebrow">PORTFOLIO TOOLS</div>
          <h1>Rebalancing calculator</h1>
          <p>
            Compare your current mix with your risk-based target allocation.
          </p>
        </div>
      </div>

      {isLoading && <p className="holdings-message">Calculating your plan…</p>}
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

      {!isLoading && !error && plan && (
        <>
          <div className="rebalancing-summary">
            <article className="dashboard-stat">
              <span className="dashboard-stat__label">Total portfolio value</span>
              <strong className="dashboard-stat__value">
                {formatUsdCents(plan.totalPortfolioValueCents)}
              </strong>
              <span className="dashboard-stat__detail">
                {plan.holdingCount}{" "}
                {plan.holdingCount === 1 ? "holding" : "holdings"}
              </span>
            </article>
            <article className="dashboard-stat rebalancing-profile-stat">
              <span className="dashboard-stat__label">Target profile</span>
              {plan.riskProfile ? (
                <>
                  <strong className="dashboard-stat__value dashboard-stat__value--profile">
                    {riskProfileLabels[plan.riskProfile.profile]}
                  </strong>
                  <span className="dashboard-stat__detail">
                    Risk score {plan.riskProfile.score} of 9
                  </span>
                </>
              ) : (
                <>
                  <strong className="dashboard-stat__value dashboard-stat__value--profile">
                    Not set
                  </strong>
                  <Link href="/risk-quiz" className="text-button">
                    Take the risk quiz
                  </Link>
                </>
              )}
            </article>
          </div>

          {!plan.rows && (
            <div className="rebalancing-notice rebalancing-notice--profile">
              <strong>Add a risk profile to calculate targets</strong>
              <p>
                Your holdings remain private. Complete the quiz to get
                personalized allocation targets.
              </p>
              <Link href="/risk-quiz" className="button button--small">
                Take the risk quiz
              </Link>
            </div>
          )}

          {plan.rows && (
            <section className="dashboard-card rebalancing-card">
              <div className="dashboard-card__heading">
                <div>
                  <h2>Suggested allocation adjustments</h2>
                  <p>
                    Drift is current allocation minus target allocation.
                  </p>
                </div>
                <span className="dashboard-risk-badge">
                  {riskProfileLabels[plan.riskProfile!.profile]}
                </span>
              </div>

              {plan.holdingCount === 0 && (
                <div className="rebalancing-notice">
                  <strong>No holdings yet</strong>
                  <p>
                    Your targets are shown below. Add holdings to calculate
                    useful dollar adjustments.
                  </p>
                  <Link href="/holdings/new" className="text-button">
                    Add your first holding
                  </Link>
                </div>
              )}

              <div className="rebalancing-table-wrap">
                <table className="rebalancing-table">
                  <caption className="visually-hidden">
                    Current and target allocation with suggested dollar
                    adjustments
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Asset class</th>
                      <th scope="col">Current</th>
                      <th scope="col">Target</th>
                      <th scope="col">Drift</th>
                      <th scope="col">Dollar adjustment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((row) => (
                      <RebalancingRowView
                        key={row.assetClassId}
                        row={row}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="rebalancing-disclaimer">
                These are estimates based on manually entered prices. This
                calculator does not place trades.
              </p>
            </section>
          )}
        </>
      )}
    </section>
  );
}
