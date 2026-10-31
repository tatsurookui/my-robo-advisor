import { describe, expect, it, vi } from "vitest";
import { upsertUserRecord } from "../server/userStore";

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
