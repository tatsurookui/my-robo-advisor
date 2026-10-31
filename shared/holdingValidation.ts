import { z, type ZodError } from "zod";

export const holdingFieldNames = [
  "ticker",
  "name",
  "asset_class_id",
  "quantity",
  "price",
  "notes",
] as const;

export type HoldingFieldName = (typeof holdingFieldNames)[number];
export type HoldingFieldErrors = Partial<Record<HoldingFieldName, string>>;

const requiredText = (message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().trim().min(1, message),
  );

function fitsPostgresNumeric(value: string) {
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const significantWholeDigits = whole.replace(/^0+/, "").length;
  return significantWholeDigits <= 12 && fraction.length <= 8;
}

function decimalValue(
  message: string,
  invalidNumberMessage: string,
  isValidValue: (value: string) => boolean,
) {
  return z.preprocess(
    (value) =>
      typeof value === "string"
        ? value.trim()
        : typeof value === "number" && Number.isFinite(value)
          ? String(value)
          : "",
    z
      .string()
      .min(1, message)
      .regex(/^-?\d+(?:\.\d+)?$/, invalidNumberMessage)
      .refine(
        fitsPostgresNumeric,
        "Use up to 12 digits before and 8 digits after the decimal.",
      )
      .refine(isValidValue, message),
  );
}

const assetClassId = z.unknown().transform((value, context) => {
  const id =
    typeof value === "string" && value.trim() !== ""
      ? Number(value.trim())
      : value;

  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) {
    context.addIssue({
      code: "custom",
      message: "Select an asset class.",
    });
    return z.NEVER;
  }

  return id;
});

const notes = z.unknown().optional().transform((value, context) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    context.addIssue({
      code: "custom",
      message: "Notes must be text.",
    });
    return z.NEVER;
  }
  return value.trim() || null;
});

export const holdingInputSchema = z.object({
  ticker: requiredText("Enter a ticker symbol."),
  name: requiredText("Enter a holding name."),
  asset_class_id: assetClassId,
  quantity: decimalValue(
    "Enter a quantity greater than 0.",
    "Enter a valid quantity using numbers only.",
    (value) => !value.startsWith("-") && /[1-9]/.test(value),
  ),
  price: decimalValue(
    "Enter a price of $0 or more.",
    "Enter a valid price using numbers only.",
    (value) => !value.startsWith("-"),
  ),
  notes,
});

export type ValidatedHoldingInput = z.infer<typeof holdingInputSchema>;

export function getHoldingFieldErrors(error: ZodError): HoldingFieldErrors {
  const fieldErrors: HoldingFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      typeof field === "string" &&
      holdingFieldNames.includes(field as HoldingFieldName) &&
      !fieldErrors[field as HoldingFieldName]
    ) {
      fieldErrors[field as HoldingFieldName] = issue.message;
    }
  }

  return fieldErrors;
}
