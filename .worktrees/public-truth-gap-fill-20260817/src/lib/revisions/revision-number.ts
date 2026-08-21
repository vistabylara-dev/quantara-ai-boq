export const INITIAL_REVISION_NUMBER = "R01";

export class InvalidRevisionNumberError extends Error {
  readonly code = "INVALID_REVISION_NUMBER";

  constructor(readonly revisionNumber: string | number) {
    super(`Invalid BOQ revision number: ${String(revisionNumber)}.`);
    this.name = "InvalidRevisionNumberError";
  }
}

export function parseRevisionNumber(revisionNumber: string | number): number {
  const numericValue =
    typeof revisionNumber === "number"
      ? revisionNumber
      : /^R\d{2,}$/i.test(revisionNumber.trim())
        ? Number(revisionNumber.trim().slice(1))
        : Number.NaN;

  if (!Number.isSafeInteger(numericValue) || numericValue < 1) {
    throw new InvalidRevisionNumberError(revisionNumber);
  }

  return numericValue;
}

export function formatRevisionNumber(revisionNumber: number): string {
  const parsed = parseRevisionNumber(revisionNumber);
  return `R${String(parsed).padStart(2, "0")}`;
}

export function incrementRevisionNumber(currentRevisionNumber: string | number): string {
  const nextRevisionNumber = parseRevisionNumber(currentRevisionNumber) + 1;
  if (!Number.isSafeInteger(nextRevisionNumber)) {
    throw new InvalidRevisionNumberError(currentRevisionNumber);
  }
  return formatRevisionNumber(nextRevisionNumber);
}

export function nextRevisionSequence(currentRevisionNumber: string | number): number {
  return parseRevisionNumber(currentRevisionNumber) + 1;
}
