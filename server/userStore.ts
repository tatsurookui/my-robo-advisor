import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  classifyRiskScore,
  riskProfileSchema,
  type RiskProfile,
} from "../shared/riskQuiz";

export interface AccountRecord {
  id: string;
  email: string;
  created_at: Date;
}

export class UserEmailVerificationRequiredError extends Error {
  constructor() {
    super("Verify an email address to finish setting up your account.");
    this.name = "UserEmailVerificationRequiredError";
  }
}

export class ClerkIdentityMismatchError extends Error {
  constructor() {
    super("The signed-in Clerk identity did not match the requested account.");
    this.name = "ClerkIdentityMismatchError";
  }
}

export class AccountTransferRequiredError extends Error {
  constructor() {
    super("An existing account uses this verified email address.");
    this.name = "AccountTransferRequiredError";
  }
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

export async function ensureUserRecord(
  database: Pick<Pool, "query">,
  authenticatedUserId: string,
  loadClerkIdentity: (
    userId: string,
  ) => Promise<{ id: string; verifiedEmail: string | null }>,
): Promise<AccountRecord> {
  const { rows: existingRows } = await database.query<AccountRecord>(
    `SELECT id, email, created_at
     FROM users
     WHERE id = $1`,
    [authenticatedUserId],
  );

  if (existingRows[0]) {
    return existingRows[0];
  }

  const identity = await loadClerkIdentity(authenticatedUserId);
  if (identity.id !== authenticatedUserId) {
    throw new ClerkIdentityMismatchError();
  }
  if (!identity.verifiedEmail) {
    throw new UserEmailVerificationRequiredError();
  }

  try {
    return await upsertUserRecord(database, {
      id: authenticatedUserId,
      email: identity.verifiedEmail,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AccountTransferRequiredError();
    }
    throw error;
  }
}

export async function transferUserRecord(
  database: Pick<Pool, "connect">,
  authenticatedUserId: string,
  verifiedEmail: string,
): Promise<AccountRecord> {
  const client = await database.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const currentAccount = await client.query<AccountRecord>(
      `SELECT id, email, created_at
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [authenticatedUserId],
    );
    if (currentAccount.rows[0]) {
      await client.query("COMMIT");
      transactionStarted = false;
      return currentAccount.rows[0];
    }

    const existingAccount = await client.query<{
      id: string;
      email: string;
      created_at: Date;
      risk_score: number | null;
      risk_profile: string | null;
    }>(
      `SELECT id, email, created_at, risk_score, risk_profile
       FROM users
       WHERE email = $1
       FOR UPDATE`,
      [verifiedEmail],
    );
    const previousAccount = existingAccount.rows[0];

    if (!previousAccount) {
      const { rows } = await client.query<AccountRecord>(
        `INSERT INTO users (id, email)
         VALUES ($1, $2)
         ON CONFLICT (id)
         DO UPDATE SET email = EXCLUDED.email
         RETURNING id, email, created_at`,
        [authenticatedUserId, verifiedEmail],
      );
      if (!rows[0]) {
        throw new Error("PostgreSQL did not return the transferred account.");
      }
      await client.query("COMMIT");
      transactionStarted = false;
      return rows[0];
    }

    const previousUserId = previousAccount.id;
    const starredAssets = await client.query<{
      asset_id: string;
      created_at: Date;
    }>(
      `SELECT asset_id, created_at
       FROM stars
       WHERE user_id = $1
       FOR UPDATE`,
      [previousUserId],
    );

    // Free the unique email inside this transaction while preserving the old
    // row until the replacement and its owned data are safely in place.
    await client.query(
      `UPDATE users
       SET email = $1
       WHERE id = $2`,
      [`account-transfer-${randomUUID()}@invalid.local`, previousUserId],
    );

    const { rows: transferredRows } = await client.query<AccountRecord>(
      `INSERT INTO users (id, email, risk_score, risk_profile, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, created_at`,
      [
        authenticatedUserId,
        verifiedEmail,
        previousAccount.risk_score,
        previousAccount.risk_profile,
        previousAccount.created_at,
      ],
    );
    if (!transferredRows[0]) {
      throw new Error("PostgreSQL did not return the transferred account.");
    }

    await client.query("DELETE FROM stars WHERE user_id = $1", [previousUserId]);
    await client.query(
      `UPDATE assets
       SET user_id = $1
       WHERE user_id = $2`,
      [authenticatedUserId, previousUserId],
    );
    for (const star of starredAssets.rows) {
      await client.query(
        `INSERT INTO stars (user_id, asset_id, created_at)
         VALUES ($1, $2, $3)`,
        [authenticatedUserId, star.asset_id, star.created_at],
      );
    }
    await client.query("DELETE FROM users WHERE id = $1", [previousUserId]);
    await client.query("COMMIT");
    transactionStarted = false;
    return transferredRows[0];
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original failure if rollback itself also fails.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export interface UserRiskProfile {
  risk_score: number | null;
  risk_profile: RiskProfile | null;
}

function parseStoredRiskProfile(record: {
  risk_score: number | null;
  risk_profile: string | null;
}): UserRiskProfile {
  if (record.risk_score === null && record.risk_profile === null) {
    return { risk_score: null, risk_profile: null };
  }

  const profile = riskProfileSchema.safeParse(record.risk_profile);
  if (
    record.risk_score === null ||
    !profile.success ||
    classifyRiskScore(record.risk_score) !== profile.data
  ) {
    throw new Error("The saved risk assessment is invalid.");
  }

  return {
    risk_score: record.risk_score,
    risk_profile: profile.data,
  };
}

export async function getUserRiskProfile(
  database: Pick<Pool, "query">,
  userId: string,
): Promise<UserRiskProfile | null> {
  const { rows } = await database.query<{
    risk_score: number | null;
    risk_profile: string | null;
  }>(
    `SELECT risk_score, risk_profile
     FROM users
     WHERE id = $1`,
    [userId],
  );

  return rows[0] ? parseStoredRiskProfile(rows[0]) : null;
}

export async function saveUserRiskProfile(
  database: Pick<Pool, "query">,
  userId: string,
  assessment: { risk_score: number; risk_profile: RiskProfile },
): Promise<UserRiskProfile | null> {
  const { rows } = await database.query<{
    risk_score: number | null;
    risk_profile: string | null;
  }>(
    `UPDATE users
     SET risk_score = $1,
         risk_profile = $2
     WHERE id = $3
     RETURNING risk_score, risk_profile`,
    [assessment.risk_score, assessment.risk_profile, userId],
  );

  return rows[0] ? parseStoredRiskProfile(rows[0]) : null;
}
