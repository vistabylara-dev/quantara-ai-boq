-- STRIPE COMMERCIAL CHECKOUT
-- Additive-only migration for Stripe customer identity,
-- Stripe subscription identity, and webhook idempotency.
--
-- IMPORTANT:
-- Do not remove the existing MasterItem pg_trgm/GIN search indexes.
-- They are intentionally managed outside Prisma's schema DSL.
--
-- Stripe customer identity deliberately lives in its own table instead of a
-- new scalar column on Company. This avoids a deployment-order failure where
-- existing Company queries would select a column that production has not yet
-- migrated.

-- Stripe customer identity: one test-mode and one live-mode customer per company.
CREATE TABLE "StripeBillingCustomer" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeBillingCustomer_pkey" PRIMARY KEY ("id")
);

-- Stripe webhook idempotency ledger.
CREATE TABLE "StripeWebhookEvent" (
    "id" UUID NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "companyId" UUID,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StripeBillingCustomer_stripeCustomerId_key"
ON "StripeBillingCustomer"("stripeCustomerId");

CREATE UNIQUE INDEX "StripeBillingCustomer_companyId_livemode_key"
ON "StripeBillingCustomer"("companyId", "livemode");

CREATE INDEX "StripeBillingCustomer_companyId_idx"
ON "StripeBillingCustomer"("companyId");

CREATE INDEX "StripeBillingCustomer_livemode_idx"
ON "StripeBillingCustomer"("livemode");

-- Prevent the same Stripe webhook event from being processed twice.
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key"
ON "StripeWebhookEvent"("stripeEventId");

CREATE INDEX "StripeWebhookEvent_companyId_idx"
ON "StripeWebhookEvent"("companyId");

CREATE INDEX "StripeWebhookEvent_eventType_idx"
ON "StripeWebhookEvent"("eventType");

CREATE INDEX "StripeWebhookEvent_processedAt_idx"
ON "StripeWebhookEvent"("processedAt");

-- One Stripe subscription may map to only one Quantara subscription.
CREATE UNIQUE INDEX "CompanySoftwareSubscription_externalSubscriptionId_key"
ON "CompanySoftwareSubscription"("externalSubscriptionId");

ALTER TABLE "StripeBillingCustomer"
ADD CONSTRAINT "StripeBillingCustomer_companyId_fkey"
FOREIGN KEY ("companyId")
REFERENCES "Company"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "StripeWebhookEvent"
ADD CONSTRAINT "StripeWebhookEvent_companyId_fkey"
FOREIGN KEY ("companyId")
REFERENCES "Company"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;