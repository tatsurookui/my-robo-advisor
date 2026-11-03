import { describe, expect, it, vi } from "vitest";
import {
  AccountTransferRequiredError,
  ClerkIdentityMismatchError,
  ensureUserRecord,
  transferUserRecord,
  upsertUserRecord,
  UserEmailVerificationRequiredError,
} from "../server/userStore";

describe("upsertUserRecord", () => {
  it("creates or refreshes the account using the verified Clerk identity", async () => {
    const saved = {
      id: "user_clerk_123",
      email: "investor@example.com",
      created_at: new Date("2026-10-30T12:00:00Z"),
    };
    const query = vi.fn().mockResolvedValue({ rows: [saved] });

    const result = await upsertUserRecord({ query } as never, {
      id: "user_clerk_123",
      email: "investor@example.com",
    });

    expect(result).toEqual(saved);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (id)"),
      ["user_clerk_123", "investor@example.com"],
    );
    expect(query.mock.calls[0][0]).toContain("RETURNING id, email, created_at");
  });

  it("fails explicitly if PostgreSQL does not return the saved account", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await expect(
      upsertUserRecord({ query } as never, {
        id: "user_clerk_123",
        email: "investor@example.com",
      }),
    ).rejects.toThrow("PostgreSQL did not return the saved account.");
  });
});

describe("ensureUserRecord", () => {
  const userId = "user_clerk_123";
  const existingAccount = {
    id: userId,
    email: "investor@example.com",
    created_at: new Date("2026-10-30T12:00:00Z"),
  };

  it("creates a first-time account using the authenticated Clerk ID and verified email", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [existingAccount] });
    const loadClerkIdentity = vi.fn().mockResolvedValue({
      id: userId,
      verifiedEmail: existingAccount.email,
    });

    const account = await ensureUserRecord(
      { query } as never,
      userId,
      loadClerkIdentity,
    );

    expect(account).toEqual(existingAccount);
    expect(loadClerkIdentity).toHaveBeenCalledExactlyOnceWith(userId);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("WHERE id = $1"),
      [userId],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("ON CONFLICT (id)"),
      [userId, existingAccount.email],
    );
  });

  it("returns a returning user's existing account without another Clerk API call or write", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [existingAccount] });
    const loadClerkIdentity = vi.fn();

    const account = await ensureUserRecord(
      { query } as never,
      userId,
      loadClerkIdentity,
    );

    expect(account).toEqual(existingAccount);
    expect(query).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("WHERE id = $1"),
      [userId],
    );
    expect(loadClerkIdentity).not.toHaveBeenCalled();
  });

  it("rejects initialization when Clerk returns an identity different from the authenticated ID", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] });
    const loadClerkIdentity = vi.fn().mockResolvedValue({
      id: "user_someone_else",
      verifiedEmail: existingAccount.email,
    });

    await expect(
      ensureUserRecord({ query } as never, userId, loadClerkIdentity),
    ).rejects.toBeInstanceOf(ClerkIdentityMismatchError);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("rejects first-time initialization when Clerk has no verified email", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] });
    const loadClerkIdentity = vi.fn().mockResolvedValue({
      id: userId,
      verifiedEmail: null,
    });

    await expect(
      ensureUserRecord({ query } as never, userId, loadClerkIdentity),
    ).rejects.toBeInstanceOf(UserEmailVerificationRequiredError);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("propagates database initialization failures without falling through to Clerk", async () => {
    const databaseError = new Error("database unavailable");
    const query = vi.fn().mockRejectedValue(databaseError);
    const loadClerkIdentity = vi.fn();

    await expect(
      ensureUserRecord({ query } as never, userId, loadClerkIdentity),
    ).rejects.toBe(databaseError);
    expect(loadClerkIdentity).not.toHaveBeenCalled();
  });

  it("propagates Clerk lookup failures without attempting an account write", async () => {
    const clerkError = new Error("Clerk user lookup failed");
    const query = vi.fn().mockResolvedValueOnce({ rows: [] });
    const loadClerkIdentity = vi.fn().mockRejectedValue(clerkError);

    await expect(
      ensureUserRecord({ query } as never, userId, loadClerkIdentity),
    ).rejects.toBe(clerkError);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("requires an explicit transfer when another Clerk ID owns the verified email", async () => {
    const uniqueViolation = Object.assign(new Error("email already exists"), {
      code: "23505",
    });
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(uniqueViolation);

    await expect(
      ensureUserRecord(
        { query } as never,
        userId,
        vi.fn().mockResolvedValue({
          id: userId,
          verifiedEmail: existingAccount.email,
        }),
      ),
    ).rejects.toBeInstanceOf(AccountTransferRequiredError);
  });
});

describe("transferUserRecord", () => {
  const userId = "user_production_123";
  const previousUserId = "user_development_456";
  const email = "investor@example.com";
  const createdAt = new Date("2026-10-30T12:00:00Z");
  const priorAccount = {
    id: previousUserId,
    email,
    created_at: createdAt,
    risk_score: 8,
    risk_profile: "Aggressive",
  };
  const transferredAccount = { id: userId, email, created_at: createdAt };

  function makeDatabase(query: ReturnType<typeof vi.fn>) {
    const release = vi.fn();
    const client = { query, release };
    const connect = vi.fn().mockResolvedValue(client);
    return { database: { connect } as never, connect, release };
  }

  it("moves the saved profile, assets, and stars in one preserving transaction", async () => {
    const starCreatedAt = new Date("2026-10-31T12:00:00Z");
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // current Clerk ID
      .mockResolvedValueOnce({ rows: [priorAccount] }) // verified email match
      .mockResolvedValueOnce({
        rows: [{ asset_id: "asset-1", created_at: starCreatedAt }],
      }) // existing stars
      .mockResolvedValueOnce({ rows: [] }) // temporary email
      .mockResolvedValueOnce({ rows: [transferredAccount] }) // new user row
      .mockResolvedValueOnce({ rows: [] }) // remove old stars
      .mockResolvedValueOnce({ rows: [], rowCount: 2 }) // transfer assets
      .mockResolvedValueOnce({ rows: [] }) // restore star
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // remove old user
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    const { database, connect, release } = makeDatabase(query);

    const result = await transferUserRecord(database, userId, email);

    expect(result).toEqual(transferredAccount);
    expect(connect).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
    expect(query.mock.calls[5][1]).toEqual([
      userId,
      email,
      priorAccount.risk_score,
      priorAccount.risk_profile,
      createdAt,
    ]);
    const deleteStarsIndex = query.mock.calls.findIndex(([sql]) =>
      String(sql).includes("DELETE FROM stars"),
    );
    const transferAssetsIndex = query.mock.calls.findIndex(([sql]) =>
      String(sql).includes("UPDATE assets"),
    );
    const restoreStarsIndex = query.mock.calls.findIndex(([sql]) =>
      String(sql).includes("INSERT INTO stars"),
    );
    const deleteOldUserIndex = query.mock.calls.findIndex(([sql]) =>
      String(sql).includes("DELETE FROM users"),
    );
    expect(deleteStarsIndex).toBeLessThan(transferAssetsIndex);
    expect(transferAssetsIndex).toBeLessThan(restoreStarsIndex);
    expect(restoreStarsIndex).toBeLessThan(deleteOldUserIndex);
    expect(query.mock.calls[7][1]).toEqual([userId, previousUserId]);
    expect(query.mock.calls[8][1]).toEqual([
      userId,
      "asset-1",
      starCreatedAt,
    ]);
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });

  it("returns an already transferred account without moving it twice", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [transferredAccount] }) // current Clerk ID
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    const { database, release } = makeDatabase(query);

    const result = await transferUserRecord(database, userId, email);

    expect(result).toEqual(transferredAccount);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });

  it("creates a new account if the conflict disappeared before confirmation", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // current Clerk ID
      .mockResolvedValueOnce({ rows: [] }) // no email match
      .mockResolvedValueOnce({ rows: [transferredAccount] }) // insert
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    const { database, release } = makeDatabase(query);

    const result = await transferUserRecord(database, userId, email);

    expect(result).toEqual(transferredAccount);
    expect(query.mock.calls[3][0]).toContain("ON CONFLICT (id)");
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back the entire transfer if an owned asset cannot be moved", async () => {
    const transferError = new Error("asset update failed");
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // current Clerk ID
      .mockResolvedValueOnce({ rows: [priorAccount] }) // verified email match
      .mockResolvedValueOnce({ rows: [] }) // existing stars
      .mockResolvedValueOnce({ rows: [] }) // temporary email
      .mockResolvedValueOnce({ rows: [transferredAccount] }) // new user row
      .mockResolvedValueOnce({ rows: [] }) // remove old stars
      .mockRejectedValueOnce(transferError) // transfer assets
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    const { database, release } = makeDatabase(query);

    await expect(
      transferUserRecord(database, userId, email),
    ).rejects.toBe(transferError);

    expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("DELETE FROM users")),
    ).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });
});
