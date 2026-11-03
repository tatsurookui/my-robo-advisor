const DECIMAL_SCALE = 100_000_000n;
const PRODUCT_TO_CENTS_DIVISOR = 100_000_000_000_000n;
const DECIMAL_TO_CENTS_DIVISOR = 1_000_000n;

type DecimalInput = string | number;

function parseScaledDecimal(value: DecimalInput): bigint | null {
  const text = typeof value === "number" ? String(value) : value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return null;

  const whole = match[1]!;
  const fraction = match[2] ?? "";
  if (fraction.length > 8) return null;

  return (
    BigInt(whole) * DECIMAL_SCALE +
    BigInt(fraction.padEnd(8, "0") || "0")
  );
}

function roundPositiveDivision(numerator: bigint, denominator: bigint) {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

export function multiplyDecimalsToCents(
  quantity: DecimalInput,
  price: DecimalInput,
): bigint | null {
  const scaledQuantity = parseScaledDecimal(quantity);
  const scaledPrice = parseScaledDecimal(price);
  if (
    scaledQuantity === null ||
    scaledPrice === null ||
    scaledQuantity <= 0n
  ) {
    return null;
  }

  return roundPositiveDivision(
    scaledQuantity * scaledPrice,
    PRODUCT_TO_CENTS_DIVISOR,
  );
}

export function decimalToCents(value: DecimalInput): bigint | null {
  const scaledValue = parseScaledDecimal(value);
  if (scaledValue === null) return null;
  return roundPositiveDivision(scaledValue, DECIMAL_TO_CENTS_DIVISOR);
}

export function centsToNumber(cents: bigint | string): number {
  return Number(cents) / 100;
}

export function formatUsdCents(cents: bigint | string): string {
  const amount = typeof cents === "bigint" ? cents : BigInt(cents);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const whole = (absolute / 100n).toString();
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${groupedWhole}.${fraction}`;
}

export function formatUsdDecimal(value: string): string {
  const cents = decimalToCents(value);
  return cents === null ? "$—" : formatUsdCents(cents);
}

export function formatExactQuantity(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const whole = match[1]!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
