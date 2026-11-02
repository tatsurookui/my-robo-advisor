import { describe, expect, it, vi } from "vitest";
import {
  createHolding,
  deleteHolding,
  getHolding,
  listHoldings,
  listStarredHoldings,
  setHoldingStarred,
  updateHolding,
  type HoldingInput,
  type HoldingRecord,
} from "../server/holdingStore";

const holdingInput: HoldingInput = {
  ticker: "VTI",
  name: "Vanguard Total Stock Market ETF",
  assetClassId: 1,
  quantity: "10",
  price: "250.00",
  notes: null,
};

const savedHolding: HoldingRecord = {
  id: "c3b1b3be-682a-4d1d-83b7-3a80e4b47f32",
  asset_class_id: 1,
  asset_class_name: "US Stocks",
  ticker: "VTI",
  name: "Vanguard Total Stock Market ETF",
  quantity: "10.00000000",
  price: "250.00000000",
  notes: null,
  is_starred: false,
  created_at: new Date("2026-10-31T12:00:00Z"),
  updated_at: new Date("2026-10-31T12:00:00Z"),
};

describe("holdingStore", () => {
  it("lists only holdings owned by the requested Clerk user", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [savedHolding] });

    const result = await listHoldings({ query } as never, "user_clerk_a");

    expect(result).toEqual([savedHolding]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE a.user_id = $1"),
      ["user_clerk_a"],
    );
  });

  it("does not return a holding owned by another user", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    const result = await getHolding(
      { query } as never,
      "user_clerk_b",
      savedHolding.id,
    );

    expect(result).toBeNull();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE a.user_id = $1 AND a.id = $2"),
      ["user_clerk_b", savedHolding.id],
    );
  });

  it("lists starred holdings only for the requested Clerk user", async () => {
    const starredHolding = { ...savedHolding, is_starred: true };
    const query = vi.fn().mockResolvedValue({ rows: [starredHolding] });

    const result = await listStarredHoldings(
      { query } as never,
      "user_clerk_a",
    );

    expect(result).toEqual([starredHolding]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "WHERE a.user_id = $1 AND s.asset_id IS NOT NULL",
      ),
      ["user_clerk_a"],
    );
  });

  it("creates a holding with the server-provided owner id", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [savedHolding] });

    const result = await createHolding(
      { query } as never,
      "user_clerk_a",
      holdingInput,
    );

    expect(result).toEqual(savedHolding);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO assets"),
      ["user_clerk_a", 1, "VTI", "Vanguard Total Stock Market ETF", "10", "250.00", null],
    );
  });

  it("updates only the requested user's holding", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [savedHolding] });

    const result = await updateHolding(
      { query } as never,
      "user_clerk_a",
      savedHolding.id,
      holdingInput,
    );

    expect(result).toEqual(savedHolding);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = $1 AND id = $2"),
      [
        "user_clerk_a",
        savedHolding.id,
        1,
        "VTI",
        "Vanguard Total Stock Market ETF",
        "10",
        "250.00",
        null,
      ],
    );
  });

  it("deletes only the requested user's holding", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });

    const deleted = await deleteHolding(
      { query } as never,
      "user_clerk_a",
      savedHolding.id,
    );

    expect(deleted).toBe(true);
    expect(query).toHaveBeenCalledWith(
      "DELETE FROM assets WHERE user_id = $1 AND id = $2",
      ["user_clerk_a", savedHolding.id],
    );
  });

  it("stars only a holding owned by the requested Clerk user", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: savedHolding.id }] });

    const updated = await setHoldingStarred(
      { query } as never,
      "user_clerk_a",
      savedHolding.id,
      true,
    );

    expect(updated).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO stars (user_id, asset_id)"),
      ["user_clerk_a", savedHolding.id],
    );
    expect(query.mock.calls[0]?.[0]).toContain(
      "WHERE user_id = $1 AND id = $2",
    );
    expect(query.mock.calls[0]?.[0]).toContain(
      "ON CONFLICT (user_id, asset_id) DO NOTHING",
    );
  });

  it("does not unstar a holding the requested user does not own", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    const updated = await setHoldingStarred(
      { query } as never,
      "user_clerk_b",
      savedHolding.id,
      false,
    );

    expect(updated).toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM stars AS s"),
      ["user_clerk_b", savedHolding.id],
    );
    expect(query.mock.calls[0]?.[0]).toContain(
      "WHERE user_id = $1 AND id = $2",
    );
    expect(query.mock.calls[0]?.[0]).toContain(
      "WHERE s.user_id = $1 AND s.asset_id = owned_holding.id",
    );
  });
});
