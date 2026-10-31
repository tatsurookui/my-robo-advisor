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
    a.created_at,
    a.updated_at
  FROM assets AS a
  JOIN asset_classes AS ac ON ac.id = a.asset_class_id
`;

export async function listHoldings(
  database: Queryable,
  userId: string,
): Promise<HoldingRecord[]> {
  const { rows } = await database.query<HoldingRecord>(
    `${HOLDING_SELECT}
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC, a.id`,
    [userId],
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
       saved.created_at,
       saved.updated_at
     FROM saved
     JOIN asset_classes AS ac ON ac.id = saved.asset_class_id`,
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
       saved.created_at,
       saved.updated_at
     FROM saved
     JOIN asset_classes AS ac ON ac.id = saved.asset_class_id`,
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
