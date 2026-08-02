export function safeNumber(value: unknown): number {
  const numberValue = typeof value === "string" ? Number(value) : Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function calculateWastageQuantity(quantity: number, wastagePercentage: number): number {
  const qty = safeNumber(quantity);
  const wastage = safeNumber(wastagePercentage);
  return Number((qty * (1 + wastage / 100)).toFixed(2));
}
