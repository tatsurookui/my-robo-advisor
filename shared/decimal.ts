interface DecimalParts {
  coefficient: bigint;
  scale: number;
}

function parseDecimal(value: string | number): DecimalParts {
  const raw = String(value).trim();
  const match = raw.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match) {
    throw new Error(`Invalid decimal value: ${raw}`);
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const fraction = match[3] ?? "";
  const exponent = Number(match[4] ?? "0");
  if (!Number.isSafeInteger(exponent)) {
    throw new Error(`Invalid decimal exponent: ${raw}`);
  }

  let coefficient = BigInt(`${match[2]}${fraction}`) * sign;
  let scale = fraction.length - exponent;
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale);
    scale = 0;
  }

  return { coefficient, scale };
}

function decimalString({ coefficient, scale }: DecimalParts): string {
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient)
    .toString()
    .padStart(scale + 1, "0");
  const integer = scale > 0 ? digits.slice(0, -scale) : digits;
  const fraction = scale > 0 ? digits.slice(-scale).replace(/0+$/, "") : "";

  return `${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
}

export function addDecimalStrings(
  left: string | number,
  right: string | number,
): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  const scale = Math.max(a.scale, b.scale);
  const leftCoefficient = a.coefficient * 10n ** BigInt(scale - a.scale);
  const rightCoefficient = b.coefficient * 10n ** BigInt(scale - b.scale);

  return decimalString({
    coefficient: leftCoefficient + rightCoefficient,
    scale,
  });
}

export function multiplyDecimalStrings(
  left: string | number,
  right: string | number,
): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);

  return decimalString({
    coefficient: a.coefficient * b.coefficient,
    scale: a.scale + b.scale,
  });
}

export function formatDecimalQuantity(value: string | number): string {
  const formatted = decimalString(parseDecimal(value));
  const negative = formatted.startsWith("-");
  const unsigned = negative ? formatted.slice(1) : formatted;
  const [integer = "0", fraction] = unsigned.split(".");
  const groupedInteger = BigInt(integer).toLocaleString("en-US");

  return `${negative ? "-" : ""}${groupedInteger}${fraction ? `.${fraction}` : ""}`;
}

export function formatUsd(value: string | number): string {
  const { coefficient, scale } = parseDecimal(value);
  const absolute = coefficient < 0n ? -coefficient : coefficient;
  let cents: bigint;

  if (scale <= 2) {
    cents = absolute * 10n ** BigInt(2 - scale);
  } else {
    const divisor = 10n ** BigInt(scale - 2);
    cents = absolute / divisor;
    if ((absolute % divisor) * 2n >= divisor) cents += 1n;
  }

  const dollars = cents / 100n;
  const centsPart = String(cents % 100n).padStart(2, "0");
  const sign = coefficient < 0n && cents > 0n ? "-" : "";

  return `${sign}$${dollars.toLocaleString("en-US")}.${centsPart}`;
}
