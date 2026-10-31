import {
  getHoldingFieldErrors,
  holdingInputSchema,
  type HoldingFieldErrors,
} from "../shared/holdingValidation";
import type { HoldingInput } from "./holdingStore";

export type HoldingValidationResult =
  | { success: true; input: HoldingInput }
  | { success: false; fieldErrors: HoldingFieldErrors };

export function validateHoldingInput(body: unknown): HoldingValidationResult {
  const result = holdingInputSchema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      fieldErrors: getHoldingFieldErrors(result.error),
    };
  }

  return {
    success: true,
    input: {
      ticker: result.data.ticker,
      name: result.data.name,
      assetClassId: result.data.asset_class_id,
      quantity: result.data.quantity,
      price: result.data.price,
      notes: result.data.notes,
    },
  };
}
