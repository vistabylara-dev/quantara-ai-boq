-- CreateTable
CREATE TABLE "TayqanDeliverableAcceptance" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "boqId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "boqVersion" INTEGER NOT NULL,
    "boqRevisionNumber" INTEGER NOT NULL,
    "qaWorkerRunId" UUID NOT NULL,
    "acceptedByUserId" UUID NOT NULL,
    "acceptedByName" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TayqanDeliverableAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TayqanDeliverableAcceptance_workOrderId_key" ON "TayqanDeliverableAcceptance"("workOrderId");

-- CreateIndex
CREATE INDEX "TayqanDeliverableAcceptance_companyId_idx" ON "TayqanDeliverableAcceptance"("companyId");

-- CreateIndex
CREATE INDEX "TayqanDeliverableAcceptance_projectId_idx" ON "TayqanDeliverableAcceptance"("projectId");

-- CreateIndex
CREATE INDEX "TayqanDeliverableAcceptance_boqId_idx" ON "TayqanDeliverableAcceptance"("boqId");

-- AddForeignKey
ALTER TABLE "TayqanDeliverableAcceptance" ADD CONSTRAINT "TayqanDeliverableAcceptance_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "TayqanWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
