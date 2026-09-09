-- Additive, independent sales pilot accounting. No BOQ, Stripe or user changes.
CREATE TABLE "SalesAgentBudget" (
  "period" TEXT PRIMARY KEY,
  "reservedFils" INTEGER NOT NULL DEFAULT 0 CHECK ("reservedFils" BETWEEN 0 AND 5000)
);
CREATE TABLE "SalesAgentAttempt" (
  "id" TEXT PRIMARY KEY,
  "period" TEXT NOT NULL REFERENCES "SalesAgentBudget"("period"),
  "day" TEXT NOT NULL,
  "ipHash" TEXT NOT NULL,
  "reservedFils" INTEGER NOT NULL CHECK ("reservedFils" = 10),
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "SalesAgentAttempt_day_idx" ON "SalesAgentAttempt"("day");
CREATE INDEX "SalesAgentAttempt_day_ipHash_idx" ON "SalesAgentAttempt"("day", "ipHash");
