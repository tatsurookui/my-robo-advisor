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

  return upsertUserRecord(database, {
    id: authenticatedUserId,
    email: identity.verifiedEmail,
  });
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
