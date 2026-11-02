import type { Pool } from "pg";
import {
  calculateDashboardSummary,
  type DashboardSummary,
} from "../shared/dashboard";
import { listAssetClasses, listHoldings } from "./holdingStore";
import { getUserRiskProfile } from "./userStore";

type Queryable = Pick<Pool, "query">;

export async function getDashboardSummary(
  database: Queryable,
  userId: string,
): Promise<DashboardSummary> {
  const [holdings, assetClasses, riskProfile] = await Promise.all([
    listHoldings(database, userId),
    listAssetClasses(database),
    getUserRiskProfile(database, userId),
  ]);

  return calculateDashboardSummary(holdings, assetClasses, riskProfile);
}
