import type { Pool } from "pg";

export interface AccountRecord {
  id: string;
  email: string;
  created_at: Date;
}

export async function upsertUserRecord(
  database: Pick<Pool, "query">,
  identity: { id: string; email: string },
): Promise<AccountRecord> {
  const { rows } = await database.query<AccountRecord>(
    `INSERT INTO users (id, email)
     VALUES ($1, $2)
     ON CONFLICT (id)
     DO UPDATE SET email = EXCLUDED.email
     RETURNING id, email, created_at`,
    [identity.id, identity.email],
  );

  if (!rows[0]) {
    throw new Error("PostgreSQL did not return the saved account.");
  }

  return rows[0];
}
