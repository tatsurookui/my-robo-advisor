export interface HoldingDisplayFields {
  ticker: string | null;
  name: string | null;
}

export function getHoldingDisplayName(holding: HoldingDisplayFields) {
  return holding.name?.trim() || holding.ticker?.trim() || "Unnamed holding";
}

export function getHoldingSecondaryLabel(holding: HoldingDisplayFields) {
  const ticker = holding.ticker?.trim();
  const name = holding.name?.trim();
  return ticker && name && ticker.toLocaleLowerCase() !== name.toLocaleLowerCase()
    ? ticker
    : null;
}
