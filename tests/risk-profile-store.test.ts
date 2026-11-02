import { describe, expect, it, vi } from "vitest";
import {
  getUserRiskProfile,
  saveUserRiskProfile,
} from "../server/userStore";

describe("user risk profile storage", () => {
  it("reads only the authenticated user's profile", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ risk_score: 4, risk_profile: "conservative" }],
    });

    await expect(
      getUserRiskProfile({ query } as never, "clerk_user_a"),
    ).resolves.toEqual({
      risk_score: 4,
      risk_profile: "conservative",
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $1"),
      ["clerk_user_a"],
    );
  });

  it("updates only the authenticated user's profile, allowing retakes", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ risk_score: 8, risk_profile: "aggressive" }],
    });

    await expect(
      saveUserRiskProfile(
        { query } as never,
        "clerk_user_b",
        { risk_score: 8, risk_profile: "aggressive" },
      ),
    ).resolves.toEqual({
      risk_score: 8,
      risk_profile: "aggressive",
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $3"),
      [8, "aggressive", "clerk_user_b"],
    );
  });

  it("returns null for a missing account and rejects inconsistent saved results", async () => {
    const missingQuery = vi.fn().mockResolvedValue({ rows: [] });
    const inconsistentQuery = vi.fn().mockResolvedValue({
      rows: [{ risk_score: 4, risk_profile: "moderate" }],
    });

    await expect(
      getUserRiskProfile({ query: missingQuery } as never, "missing_user"),
    ).resolves.toBeNull();
    await expect(
      getUserRiskProfile({ query: inconsistentQuery } as never, "clerk_user_c"),
    ).rejects.toThrow("The saved risk assessment is invalid.");
  });
});
