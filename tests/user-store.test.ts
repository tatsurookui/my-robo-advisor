import { describe, expect, it, vi } from "vitest";
import {
  ClerkIdentityMismatchError,
  ensureUserRecord,
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
});
