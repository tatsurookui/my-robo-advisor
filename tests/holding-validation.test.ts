import { describe, expect, it } from "vitest";
import { validateHoldingInput } from "../server/holdingValidation";
import {
  getHoldingFieldErrors,
  holdingInputSchema,
} from "../shared/holdingValidation";

const validInput = {
  ticker: " VTI ",
  name: " Vanguard Total Stock Market ETF ",
  asset_class_id: "1",
  quantity: "10.25",
  price: "250.00",
  notes: "  Long-term  ",
};

describe("holding validation", () => {
  it("trims fields and normalizes valid input for the database", () => {
    const result = validateHoldingInput({
      ...validInput,
      user_id: "untrusted-client-user",
    });

    expect(result).toEqual({
      success: true,
      input: {
        ticker: "VTI",
        name: "Vanguard Total Stock Market ETF",
        assetClassId: 1,
        quantity: "10.25",
        price: "250.00",
        notes: "Long-term",
      },
    });
  });

  it("allows notes to be omitted", () => {
    const result = validateHoldingInput({ ...validInput, notes: undefined });

    expect(result).toMatchObject({
      success: true,
      input: { notes: null },
    });
  });

  it("reports clear messages when required fields are blank", () => {
    const result = holdingInputSchema.safeParse({
      ticker: "  ",
      name: "",
      asset_class_id: "",
      quantity: "",
      price: "",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(getHoldingFieldErrors(result.error)).toEqual({
      ticker: "Enter a ticker symbol.",
      name: "Enter a holding name.",
      asset_class_id: "Select an asset class.",
      quantity: "Enter a quantity greater than 0.",
      price: "Enter a price of $0 or more.",
    });
  });

  it.each(["0", "0.00000000", "-1", "-0.01", "not-a-number"])(
    "rejects invalid quantity %s before a database write",
    (quantity) => {
      const result = validateHoldingInput({ ...validInput, quantity });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors.quantity).toBeTruthy();
      }
    },
  );

  it("rejects negative prices and accepts a zero price", () => {
    const negative = validateHoldingInput({
      ...validInput,
      price: "-0.01",
    });
    const zero = validateHoldingInput({ ...validInput, price: "0" });

    expect(negative).toMatchObject({
      success: false,
      fieldErrors: { price: "Enter a price of $0 or more." },
    });
    expect(zero).toMatchObject({
      success: true,
      input: { price: "0" },
    });
  });

  it.each(["1.123456789", "1000000000000", "1e3", "Infinity"])(
    "rejects values outside the database numeric format: %s",
    (value) => {
      const quantityResult = validateHoldingInput({
        ...validInput,
        quantity: value,
      });
      const priceResult = validateHoldingInput({
        ...validInput,
        price: value,
      });

      expect(quantityResult.success).toBe(false);
      expect(priceResult.success).toBe(false);
    },
  );

  it("rejects a non-positive or malformed asset class id", () => {
    for (const assetClassId of ["", "0", "-1", "1.5", "invalid"]) {
      const result = validateHoldingInput({
        ...validInput,
        asset_class_id: assetClassId,
      });

      expect(result).toMatchObject({
        success: false,
        fieldErrors: { asset_class_id: "Select an asset class." },
      });
    }
  });
});
