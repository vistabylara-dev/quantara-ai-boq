-- CreateEnum
CREATE TYPE "ExtractedEntityType" AS ENUM ('ROOM', 'FURNITURE', 'EQUIPMENT', 'MATERIAL', 'FIXTURE', 'ELECTRICAL_POINT', 'LIGHT_FIXTURE', 'HVAC_EQUIPMENT', 'FAN', 'DUCT', 'DIFFUSER', 'GRILLE', 'DAMPER', 'PIPE', 'VALVE', 'SANITARY_FIXTURE', 'FIRE_FIGHTING_ITEM', 'FIRE_ALARM_ITEM', 'DOOR', 'WINDOW', 'PARTITION', 'WALL_FINISH', 'FLOOR_FINISH', 'CEILING_FINISH', 'STRUCTURAL_ELEMENT', 'SCHEDULE_ROW', 'ANNOTATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExtractionMethod" AS ENUM ('TEXT_LAYER', 'OCR', 'TABLE_PARSER', 'VECTOR_BLOCK', 'VISION_MODEL', 'GEOMETRY_ENGINE', 'MANUAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "ExtractedEntityStatus" AS ENUM ('EXTRACTED', 'NEEDS_REVIEW', 'CONFIRMED', 'CORRECTED', 'REJECTED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "QuantityCalculationType" AS ENUM ('COUNT', 'AREA', 'PERIMETER', 'LENGTH', 'VOLUME', 'WALL_AREA', 'FLOOR_AREA', 'CEILING_AREA', 'SKIRTING_LENGTH', 'DUCT_SURFACE_AREA', 'PIPE_LENGTH', 'CABLE_LENGTH', 'CONCRETE_VOLUME', 'REINFORCEMENT_WEIGHT', 'FORMWORK_AREA', 'EXCAVATION_VOLUME', 'PAINT_AREA', 'PARTITION_AREA', 'CUSTOM');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'NEEDS_REVIEW', 'REVIEWED', 'APPROVED', 'ISSUED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InspectionResponseSourceType" AS ENUM ('MANUAL', 'PHOTO', 'DRAWING', 'TEST_RESULT', 'DOCUMENT_IMPORT', 'AI_SUGGESTED', 'EQUIPMENT_DATA', 'PREVIOUS_INSPECTION');

-- CreateEnum
CREATE TYPE "InspectionFindingStatus" AS ENUM ('DRAFT', 'AI_SUGGESTED', 'NEEDS_REVIEW', 'CONFIRMED', 'CORRECTED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RootCauseCategory" AS ENUM ('DESIGN_RELATED', 'INSTALLATION_RELATED', 'MATERIAL_RELATED', 'MAINTENANCE_RELATED', 'OPERATION_RELATED', 'AGE_RELATED', 'ENVIRONMENTAL', 'ACCIDENTAL_DAMAGE', 'WORKMANSHIP', 'USER_MISUSE', 'UNKNOWN_REQUIRES_TESTING');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskUrgency" AS ENUM ('IMMEDIATE_EMERGENCY', 'WITHIN_24_HOURS', 'WITHIN_7_DAYS', 'WITHIN_30_DAYS', 'PLANNED_CORRECTIVE_MAINTENANCE', 'PREVENTIVE_MAINTENANCE', 'CAPITAL_REPLACEMENT', 'FURTHER_INVESTIGATION', 'MONITORING_ONLY', 'NO_ACTION_REQUIRED');

-- CreateEnum
CREATE TYPE "CorrectiveActionType" AS ENUM ('IMMEDIATE', 'TEMPORARY', 'PERMANENT', 'PREVENTIVE', 'INVESTIGATION', 'MONITORING', 'REPLACEMENT', 'NO_ACTION');

-- CreateTable
CREATE TABLE "ExtractedEntity" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "projectFileId" UUID NOT NULL,
    "drawingPageId" UUID,
    "extractionJobId" UUID,
    "entityType" "ExtractedEntityType" NOT NULL,
    "categoryKey" TEXT,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT,
    "quantity" DECIMAL(14,4),
    "unit" TEXT,
    "confidence" DECIMAL(5,2) NOT NULL,
    "extractionMethod" "ExtractionMethod" NOT NULL DEFAULT 'MANUAL',
    "boundingGeometryJson" JSONB,
    "sourceText" TEXT,
    "sourceReference" TEXT,
    "technicalDataJson" JSONB,
    "matchedMasterItemId" UUID,
    "matchedCompanyLibraryItemId" UUID,
    "matchedCatalogueItemId" UUID,
    "status" "ExtractedEntityStatus" NOT NULL DEFAULT 'EXTRACTED',
    "confirmedByUserId" UUID,
    "confirmedAt" TIMESTAMP(3),
    "rejectedByUserId" UUID,
    "rejectedAt" TIMESTAMP(3),
    "correctionJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectedRoom" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "drawingPageId" UUID,
    "roomName" TEXT NOT NULL,
    "roomNumber" TEXT,
    "boundaryGeometryJson" JSONB,
    "area" DECIMAL(14,4),
    "perimeter" DECIMAL(14,4),
    "ceilingHeight" DECIMAL(8,3),
    "floorLevel" TEXT,
    "scaleCalibrationId" UUID,
    "confidence" DECIMAL(5,2) NOT NULL,
    "status" "ExtractedEntityStatus" NOT NULL DEFAULT 'EXTRACTED',
    "correctedDataJson" JSONB,
    "confirmedByUserId" UUID,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetectedRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SymbolDefinition" (
    "id" UUID NOT NULL,
    "disciplineId" UUID NOT NULL,
    "symbolKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "referenceImagesJson" JSONB,
    "vectorPatternJson" JSONB,
    "defaultMasterItemId" UUID,
    "metadataJson" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SymbolDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySymbolMapping" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "symbolDefinitionId" UUID NOT NULL,
    "customLabel" TEXT,
    "customReferenceImagesJson" JSONB,
    "mappedCompanyLibraryItemId" UUID,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySymbolMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuantityCalculation" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "extractedEntityId" UUID,
    "calculationType" "QuantityCalculationType" NOT NULL,
    "inputValuesJson" JSONB NOT NULL,
    "deductionsJson" JSONB,
    "allowancesJson" JSONB,
    "formula" TEXT NOT NULL,
    "resultValue" DECIMAL(18,6) NOT NULL,
    "resultUnit" TEXT NOT NULL,
    "confidence" DECIMAL(5,2) NOT NULL,
    "status" "ExtractedEntityStatus" NOT NULL DEFAULT 'EXTRACTED',
    "manuallyOverridden" BOOLEAN NOT NULL DEFAULT false,
    "originalResultValue" DECIMAL(18,6),
    "overrideReason" TEXT,
    "calculatedBy" TEXT NOT NULL DEFAULT 'deterministic-formula',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedByUserId" UUID,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuantityCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "disciplineId" UUID,
    "reportType" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "clientId" UUID,
    "consultantName" TEXT,
    "mainContractorName" TEXT,
    "subcontractorName" TEXT,
    "projectLocation" TEXT,
    "buildingType" TEXT,
    "inspectionDate" TIMESTAMP(3),
    "reportDate" TIMESTAMP(3),
    "preparedByUserId" UUID,
    "reviewedByUserId" UUID,
    "approvedByUserId" UUID,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "InspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "relatedBoqId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTemplate" (
    "id" UUID NOT NULL,
    "companyId" UUID,
    "disciplineId" UUID,
    "reportType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sectionsJson" JSONB NOT NULL,
    "fieldDefinitionsJson" JSONB NOT NULL,
    "scoringConfigJson" JSONB,
    "riskConfigJson" JSONB,
    "outputConfigJson" JSONB,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionResponse" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "unit" TEXT,
    "status" "ExtractedEntityStatus" NOT NULL DEFAULT 'EXTRACTED',
    "sourceType" "InspectionResponseSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceReference" TEXT,
    "enteredByUserId" UUID,
    "confirmedByUserId" UUID,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionFinding" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "findingNumber" INTEGER NOT NULL,
    "disciplineId" UUID,
    "assetId" TEXT,
    "location" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "observedCondition" TEXT,
    "expectedCondition" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "confidence" DECIMAL(5,2),
    "sourceReferencesJson" JSONB,
    "photoReferencesJson" JSONB,
    "drawingReferencesJson" JSONB,
    "status" "InspectionFindingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByType" TEXT NOT NULL DEFAULT 'HUMAN',
    "createdByUserId" UUID,
    "confirmedByUserId" UUID,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RootCauseAnalysis" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "inspectionFindingId" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "primaryCauseCategory" "RootCauseCategory" NOT NULL,
    "analysisJson" JSONB,
    "conclusion" TEXT,
    "confidence" DECIMAL(5,2),
    "furtherTestingRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExtractedEntityStatus" NOT NULL DEFAULT 'EXTRACTED',
    "createdByUserId" UUID,
    "confirmedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RootCauseAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "inspectionFindingId" UUID NOT NULL,
    "likelihood" INTEGER NOT NULL,
    "severity" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "affectedArea" TEXT,
    "operationalImpact" TEXT,
    "healthSafetyImpact" TEXT,
    "propertyDamageImpact" TEXT,
    "complianceImpact" TEXT,
    "businessContinuityImpact" TEXT,
    "recommendedUrgency" "RiskUrgency" NOT NULL,
    "rationale" TEXT,
    "status" "ExtractedEntityStatus" NOT NULL DEFAULT 'EXTRACTED',
    "assessedByUserId" UUID,
    "confirmedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectiveAction" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "inspectionFindingId" UUID NOT NULL,
    "actionType" "CorrectiveActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requiredMaterialsJson" JSONB,
    "requiredManpowerJson" JSONB,
    "requiredEquipmentJson" JSONB,
    "accessRequirements" TEXT,
    "safetyControlsJson" JSONB,
    "testingRequirementsJson" JSONB,
    "completionCriteriaJson" JSONB,
    "estimatedDurationHours" DECIMAL(8,2),
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" "ExtractedEntityStatus" NOT NULL DEFAULT 'EXTRACTED',
    "createdByUserId" UUID,
    "confirmedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectiveAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FindingBoqLink" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "inspectionFindingId" UUID NOT NULL,
    "correctiveActionId" UUID,
    "boqId" UUID NOT NULL,
    "boqItemId" UUID NOT NULL,
    "quantitySource" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FindingBoqLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractedEntity_companyId_idx" ON "ExtractedEntity"("companyId");

-- CreateIndex
CREATE INDEX "ExtractedEntity_projectId_idx" ON "ExtractedEntity"("projectId");

-- CreateIndex
CREATE INDEX "ExtractedEntity_projectFileId_idx" ON "ExtractedEntity"("projectFileId");

-- CreateIndex
CREATE INDEX "ExtractedEntity_status_idx" ON "ExtractedEntity"("status");

-- CreateIndex
CREATE INDEX "ExtractedEntity_entityType_idx" ON "ExtractedEntity"("entityType");

-- CreateIndex
CREATE INDEX "DetectedRoom_companyId_idx" ON "DetectedRoom"("companyId");

-- CreateIndex
CREATE INDEX "DetectedRoom_projectId_idx" ON "DetectedRoom"("projectId");

-- CreateIndex
CREATE INDEX "DetectedRoom_status_idx" ON "DetectedRoom"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SymbolDefinition_symbolKey_key" ON "SymbolDefinition"("symbolKey");

-- CreateIndex
CREATE INDEX "SymbolDefinition_disciplineId_idx" ON "SymbolDefinition"("disciplineId");

-- CreateIndex
CREATE INDEX "CompanySymbolMapping_companyId_idx" ON "CompanySymbolMapping"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySymbolMapping_companyId_symbolDefinitionId_key" ON "CompanySymbolMapping"("companyId", "symbolDefinitionId");

-- CreateIndex
CREATE INDEX "QuantityCalculation_companyId_idx" ON "QuantityCalculation"("companyId");

-- CreateIndex
CREATE INDEX "QuantityCalculation_projectId_idx" ON "QuantityCalculation"("projectId");

-- CreateIndex
CREATE INDEX "QuantityCalculation_extractedEntityId_idx" ON "QuantityCalculation"("extractedEntityId");

-- CreateIndex
CREATE INDEX "Inspection_companyId_idx" ON "Inspection"("companyId");

-- CreateIndex
CREATE INDEX "Inspection_projectId_idx" ON "Inspection"("projectId");

-- CreateIndex
CREATE INDEX "Inspection_status_idx" ON "Inspection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_companyId_reference_key" ON "Inspection"("companyId", "reference");

-- CreateIndex
CREATE INDEX "InspectionTemplate_companyId_idx" ON "InspectionTemplate"("companyId");

-- CreateIndex
CREATE INDEX "InspectionTemplate_reportType_idx" ON "InspectionTemplate"("reportType");

-- CreateIndex
CREATE INDEX "InspectionResponse_companyId_idx" ON "InspectionResponse"("companyId");

-- CreateIndex
CREATE INDEX "InspectionResponse_inspectionId_idx" ON "InspectionResponse"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionResponse_inspectionId_sectionKey_fieldKey_key" ON "InspectionResponse"("inspectionId", "sectionKey", "fieldKey");

-- CreateIndex
CREATE INDEX "InspectionFinding_companyId_idx" ON "InspectionFinding"("companyId");

-- CreateIndex
CREATE INDEX "InspectionFinding_inspectionId_idx" ON "InspectionFinding"("inspectionId");

-- CreateIndex
CREATE INDEX "InspectionFinding_status_idx" ON "InspectionFinding"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionFinding_inspectionId_findingNumber_key" ON "InspectionFinding"("inspectionId", "findingNumber");

-- CreateIndex
CREATE INDEX "RootCauseAnalysis_companyId_idx" ON "RootCauseAnalysis"("companyId");

-- CreateIndex
CREATE INDEX "RootCauseAnalysis_inspectionFindingId_idx" ON "RootCauseAnalysis"("inspectionFindingId");

-- CreateIndex
CREATE INDEX "RiskAssessment_companyId_idx" ON "RiskAssessment"("companyId");

-- CreateIndex
CREATE INDEX "RiskAssessment_inspectionFindingId_idx" ON "RiskAssessment"("inspectionFindingId");

-- CreateIndex
CREATE INDEX "CorrectiveAction_companyId_idx" ON "CorrectiveAction"("companyId");

-- CreateIndex
CREATE INDEX "CorrectiveAction_inspectionFindingId_idx" ON "CorrectiveAction"("inspectionFindingId");

-- CreateIndex
CREATE INDEX "FindingBoqLink_companyId_idx" ON "FindingBoqLink"("companyId");

-- CreateIndex
CREATE INDEX "FindingBoqLink_inspectionFindingId_idx" ON "FindingBoqLink"("inspectionFindingId");

-- CreateIndex
CREATE INDEX "FindingBoqLink_boqId_idx" ON "FindingBoqLink"("boqId");

-- AddForeignKey
ALTER TABLE "ExtractedEntity" ADD CONSTRAINT "ExtractedEntity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedEntity" ADD CONSTRAINT "ExtractedEntity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedEntity" ADD CONSTRAINT "ExtractedEntity_projectFileId_fkey" FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedRoom" ADD CONSTRAINT "DetectedRoom_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedRoom" ADD CONSTRAINT "DetectedRoom_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymbolDefinition" ADD CONSTRAINT "SymbolDefinition_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "MasterDiscipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySymbolMapping" ADD CONSTRAINT "CompanySymbolMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySymbolMapping" ADD CONSTRAINT "CompanySymbolMapping_symbolDefinitionId_fkey" FOREIGN KEY ("symbolDefinitionId") REFERENCES "SymbolDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuantityCalculation" ADD CONSTRAINT "QuantityCalculation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuantityCalculation" ADD CONSTRAINT "QuantityCalculation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuantityCalculation" ADD CONSTRAINT "QuantityCalculation_extractedEntityId_fkey" FOREIGN KEY ("extractedEntityId") REFERENCES "ExtractedEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionResponse" ADD CONSTRAINT "InspectionResponse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionResponse" ADD CONSTRAINT "InspectionResponse_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RootCauseAnalysis" ADD CONSTRAINT "RootCauseAnalysis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RootCauseAnalysis" ADD CONSTRAINT "RootCauseAnalysis_inspectionFindingId_fkey" FOREIGN KEY ("inspectionFindingId") REFERENCES "InspectionFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_inspectionFindingId_fkey" FOREIGN KEY ("inspectionFindingId") REFERENCES "InspectionFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_inspectionFindingId_fkey" FOREIGN KEY ("inspectionFindingId") REFERENCES "InspectionFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingBoqLink" ADD CONSTRAINT "FindingBoqLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingBoqLink" ADD CONSTRAINT "FindingBoqLink_inspectionFindingId_fkey" FOREIGN KEY ("inspectionFindingId") REFERENCES "InspectionFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingBoqLink" ADD CONSTRAINT "FindingBoqLink_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

