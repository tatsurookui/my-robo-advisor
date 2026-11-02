import type { Pool } from "pg";
import {
  calculateDashboardSummary,
  type DashboardSummary,
} from "../shared/dashboard";
import { listAssetClasses, listHoldings } from "./holdingStore";

type Queryable = Pick<Pool, "query">;

export async function getDashboardSummary(
  database: Queryable,
  userId: string,
): Promise<DashboardSummary> {
  const [holdings, assetClasses] = await Promise.all([
    listHoldings(database, userId),
    listAssetClasses(database),
  ]);

  return calculateDashboardSummary(holdings, assetClasses);
}
