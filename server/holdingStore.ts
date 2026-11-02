import type { Pool } from "pg";

export interface AssetClassRecord {
  id: number;
  name: string;
  target_conservative: string;
  target_moderate: string;
  target_aggressive: string;
}

export interface HoldingRecord {
  id: string;
  asset_class_id: number;
  asset_class_name: string;
  ticker: string;
  name: string;
  quantity: string;
  price: string;
  notes: string | null;
  is_starred: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface HoldingInput {
  ticker: string;
  name: string;
  assetClassId: number;
  quantity: string;
  price: string;
  notes: string | null;
}

export type HoldingSort = "market-value" | "ticker" | "newest";

export interface HoldingListFilters {
  search?: string;
  assetClassId?: number;
  sort?: HoldingSort;
}

type Queryable = Pick<Pool, "query">;

const HOLDING_SELECT = `
  SELECT
    a.id,
    a.asset_class_id,
    ac.name AS asset_class_name,
    a.ticker,
    a.name,
    a.quantity,
    a.price,
    a.notes,
    s.asset_id IS NOT NULL AS is_starred,
    a.created_at,
    a.updated_at
  FROM assets AS a
  JOIN asset_classes AS ac ON ac.id = a.asset_class_id
  LEFT JOIN stars AS s ON s.user_id = $1 AND s.asset_id = a.id
`;

const HOLDING_SORT_SQL: Record<HoldingSort, string> = {
  "market-value": "a.quantity * a.price DESC",
  ticker: "LOWER(a.ticker) ASC, a.ticker ASC",
  newest: "a.created_at DESC",
};

function buildHoldingListQuery(
  filters: HoldingListFilters,
  starredOnly: boolean,
) {
  const values: (string | number)[] = [];
  const conditions = ["a.user_id = $1"];

  if (filters.search?.trim()) {
    const escapedSearch = filters.search
      .trim()
      .replace(/[!%_]/g, (character) => `!${character}`);
    values.push(`%${escapedSearch}%`);
    const parameter = `$${values.length + 1}`;
    conditions.push(
      `(a.ticker ILIKE ${parameter} ESCAPE '!' OR a.name ILIKE ${parameter} ESCAPE '!')`,
    );
  }

  if (filters.assetClassId !== undefined) {
    values.push(filters.assetClassId);
    conditions.push(`a.asset_class_id = $${values.length + 1}`);
  }

  if (starredOnly) {
    conditions.push("s.asset_id IS NOT NULL");
  }

  const sort = filters.sort ?? "newest";
  const orderBy = HOLDING_SORT_SQL[sort] ?? HOLDING_SORT_SQL.newest;

  return {
    text: `${HOLDING_SELECT}
     WHERE ${conditions.join(" AND ")}
     ORDER BY ${orderBy}, a.id`,
    values,
  };
}

export async function listHoldings(
  database: Queryable,
  userId: string,
  filters: HoldingListFilters = {},
): Promise<HoldingRecord[]> {
  const query = buildHoldingListQuery(filters, false);
  const { rows } = await database.query<HoldingRecord>(
    query.text,
    [userId, ...query.values],
  );
  return rows;
}

export async function listStarredHoldings(
  database: Queryable,
  userId: string,
  filters: HoldingListFilters = {},
): Promise<HoldingRecord[]> {
  const query = buildHoldingListQuery(filters, true);
  const { rows } = await database.query<HoldingRecord>(
    query.text,
    [userId, ...query.values],
  );
  return rows;
}

export async function getHolding(
  database: Queryable,
  userId: string,
  holdingId: string,
): Promise<HoldingRecord | null> {
  const { rows } = await database.query<HoldingRecord>(
    `${HOLDING_SELECT}
     WHERE a.user_id = $1 AND a.id = $2`,
    [userId, holdingId],
  );
  return rows[0] ?? null;
}

export async function createHolding(
  database: Queryable,
  userId: string,
  holding: HoldingInput,
): Promise<HoldingRecord> {
  const { rows } = await database.query<HoldingRecord>(
    `WITH saved AS (
       INSERT INTO assets (
         user_id,
         asset_class_id,
         ticker,
         name,
         quantity,
         price,
         notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *
     )
     SELECT
       saved.id,
       saved.asset_class_id,
       ac.name AS asset_class_name,
       saved.ticker,
       saved.name,
       saved.quantity,
       saved.price,
       saved.notes,
        s.asset_id IS NOT NULL AS is_starred,
       saved.created_at,
       saved.updated_at
     FROM saved
      JOIN asset_classes AS ac ON ac.id = saved.asset_class_id
      LEFT JOIN stars AS s ON s.user_id = $1 AND s.asset_id = saved.id`,
    [
      userId,
      holding.assetClassId,
      holding.ticker,
      holding.name,
      holding.quantity,
      holding.price,
      holding.notes,
    ],
  );

  if (!rows[0]) {
    throw new Error("PostgreSQL did not return the saved holding.");
  }

  return rows[0];
}

export async function updateHolding(
  database: Queryable,
  userId: string,
  holdingId: string,
  holding: HoldingInput,
): Promise<HoldingRecord | null> {
  const { rows } = await database.query<HoldingRecord>(
    `WITH saved AS (
       UPDATE assets
       SET
         asset_class_id = $3,
         ticker = $4,
         name = $5,
         quantity = $6,
         price = $7,
         notes = $8,
         updated_at = NOW()
       WHERE user_id = $1 AND id = $2
       RETURNING *
     )
     SELECT
       saved.id,
       saved.asset_class_id,
       ac.name AS asset_class_name,
       saved.ticker,
       saved.name,
       saved.quantity,
       saved.price,
       saved.notes,
        s.asset_id IS NOT NULL AS is_starred,
       saved.created_at,
       saved.updated_at
     FROM saved
      JOIN asset_classes AS ac ON ac.id = saved.asset_class_id
      LEFT JOIN stars AS s ON s.user_id = $1 AND s.asset_id = saved.id`,
    [
      userId,
      holdingId,
      holding.assetClassId,
      holding.ticker,
      holding.name,
      holding.quantity,
      holding.price,
      holding.notes,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteHolding(
  database: Queryable,
  userId: string,
  holdingId: string,
): Promise<boolean> {
  const result = await database.query(
    "DELETE FROM assets WHERE user_id = $1 AND id = $2",
    [userId, holdingId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function setHoldingStarred(
  database: Queryable,
  userId: string,
  holdingId: string,
  starred: boolean,
): Promise<boolean> {
  const query = starred
    ? `WITH owned_holding AS (
         SELECT id
         FROM assets
         WHERE user_id = $1 AND id = $2
       ),
       inserted AS (
         INSERT INTO stars (user_id, asset_id)
         SELECT $1, owned_holding.id
         FROM owned_holding
         ON CONFLICT (user_id, asset_id) DO NOTHING
         RETURNING asset_id
       )
       SELECT owned_holding.id
       FROM owned_holding
       LEFT JOIN inserted ON inserted.asset_id = owned_holding.id`
    : `WITH owned_holding AS (
         SELECT id
         FROM assets
         WHERE user_id = $1 AND id = $2
       ),
       removed AS (
         DELETE FROM stars AS s
         USING owned_holding
         WHERE s.user_id = $1 AND s.asset_id = owned_holding.id
         RETURNING s.asset_id
       )
       SELECT owned_holding.id
       FROM owned_holding
       LEFT JOIN removed ON removed.asset_id = owned_holding.id`;
  const { rows } = await database.query<{ id: string }>(query, [
    userId,
    holdingId,
  ]);
  return rows.length > 0;
}

export async function listAssetClasses(
  database: Queryable,
): Promise<AssetClassRecord[]> {
  const { rows } = await database.query<AssetClassRecord>(
    `SELECT
       id,
       name,
       target_conservative,
       target_moderate,
       target_aggressive
     FROM asset_classes
     ORDER BY id`,
  );
  return rows;
}
