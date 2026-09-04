export const RATE_ONLY_MAX_DECIMAL_PLACES = 4;
export const RATE_ONLY_MAX_EXCLUSIVE = 100_000_000_000_000;

export type ParsedUnitRate =
  | { ok: true; value: number; serialized: string }
  | { ok: false; message: string };

export function parseUnitRateInput(input: string): ParsedUnitRate {
  const normalized = input.trim();
  if (!normalized) {
    return { ok: false, message: "Enter a unit rate." };
  }
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(normalized)) {
    return { ok: false, message: "Enter a non-negative rate with up to 4 decimal places." };
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value >= RATE_ONLY_MAX_EXCLUSIVE) {
    return { ok: false, message: "Enter a unit rate within the supported range." };
  }

  return { ok: true, value, serialized: normalized };
}

export function calculateRateOnlyAmount(quantity: number, unitRate: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitRate)) return 0;
  return Number((quantity * unitRate).toFixed(2));
}
