PROJECT: Quantara AI BOQ

CURRENT PHASE:
PHASE 8 — FILE INTELLIGENCE, DRAWING ANALYSIS, INSPECTION, TECHNICAL REPORTING, AND AI-ASSISTED QUANTITY EXTRACTION

MISSION:

Build Phase 8 as a controlled engineering-intelligence layer on top of the existing Quantara SaaS core.

This phase must extend the platform from:

Manual BOQ + Company Data + Documents + Client Proposals

into:

Files and Drawings
→ Classification
→ Structured Extraction
→ Spatial Analysis
→ Site Inspection
→ Findings
→ Root-Cause Analysis
→ Risk Assessment
→ Corrective Actions
→ Quantities
→ BOQ
→ Cost Estimate
→ Scope of Work
→ Method Statement
→ Technical Report
→ Client Approval

This phase must not destroy, redesign, or replace the already working SaaS core.

==================================================
0. VERIFIED EXISTING BASELINE
==================================================

The platform already contains or is expected to contain:

- PostgreSQL
- Prisma
- Authentication
- Session-based security
- Multi-tenant company isolation
- RBAC
- Client management
- Real project creation
- Multi-industry BOQ engines
- BOQ sections and items
- Deterministic financial calculations
- Revision control
- Locked immutable revisions
- Verification rules
- Supplier management
- Rate catalogue
- Price history
- Company library
- Industry master data
- Premium industry packages
- Trial entitlement rules
- Company branding
- Document generation
- Email delivery
- Client proposal portal
- Light mode
- Dark mode
- System mode
- UI governance
- Audit logs
- Automated tests
- Clean lint
- Clean build

These systems are LOCKED.

Do not redesign them.

Do not replace them.

Do not weaken tenant isolation.

Do not change the theme system.

Do not alter subscription rules.

Do not expose premium package content.

Do not remove existing database migrations.

Do not rewrite successful repositories, APIs, services, or UI pages unless a verified defect requires a targeted change.

==================================================
1. NON-NEGOTIABLE ANTI-DRIFT RULES
==================================================

1. Inspect the complete repository before writing code.
2. Read all UI governance documents.
3. Read all current schemas, repositories, services, routes, and tests.
4. Preserve every successful existing feature.
5. Do not rebuild the application from scratch.
6. Do not create a second parallel architecture.
7. Do not create duplicate file, document, BOQ, or verification models.
8. Reuse existing companyId tenant isolation everywhere.
9. Reuse existing RBAC helpers.
10. Reuse existing audit-log infrastructure.
11. Reuse existing storage abstraction where possible.
12. Reuse existing document-generation infrastructure.
13. Reuse existing company library and master-data matching.
14. Reuse existing entitlement checks.
15. Reuse existing UI components and theme tokens.
16. Do not introduce a second theme provider.
17. Do not introduce a new visual framework.
18. Do not install heavy dependencies without first proving they are required.
19. Do not add fake AI responses.
20. Do not mark unimplemented engines as complete.
21. Do not invent data to simulate success.
22. Do not claim perfect floor-plan reading.
23. Do not claim complete DWG or IFC support unless fully tested.
24. Do not claim OCR works for a language or scan type unless verified.
25. Do not auto-finalize AI output.
26. Do not overwrite confirmed user corrections.
27. Do not modify locked BOQ revisions.
28. Do not calculate commercial values through AI.
29. Do not invent standards or compliance clauses.
30. Do not issue approved engineering reports without authorized human approval.
31. Do not expose customer files publicly.
32. Do not use customer files for model training.
33. Do not send files to external providers without configured company consent.
34. Do not process large files synchronously in request handlers.
35. Do not continue into production billing or deployment in this phase.
36. Run validation after every sub-phase.
37. Stop immediately on migration corruption, data-loss risk, tenant leak, or locked-revision mutation.
38. Report exact blockers instead of hiding or bypassing them.

==================================================
2. PHASE 8 DELIVERY STRATEGY
==================================================

Implement Phase 8 in controlled sub-phases.

8A — File Intelligence Foundation
8B — Classification and Metadata
8C — Structured Table and Schedule Extraction
8D — OCR Foundation
8E — Drawing Viewer and Scale Calibration
8F — Room and Spatial Detection
8G — Furniture and Equipment Detection
8H — MEP Symbol and System Detection
8I — Deterministic Quantity Calculations
8J — Human Verification Workbench
8K — Inspection and Condition Assessment
8L — Findings, Root Causes, Risks, and Corrective Actions
8M — Findings-to-BOQ Conversion
8N — Test Measurements and Compliance
8O — Photo Intelligence and Drawing Annotation
8P — Method Statements, Safety Plans, and Maintenance
8Q — Technical Report Generation
8R — Integration, Security, Entitlements, and Validation

Do not attempt all sub-phases in one uncontrolled code change.

After every sub-phase:

- run migrations if applicable,
- run lint,
- run build,
- run tests,
- verify affected routes,
- update the Phase 8 status document.

==================================================
3. CREATE A PHASE 8 CURRENT-STATE AUDIT
==================================================

Before implementation, create:

docs/phase-8-current-state-audit.md

Document:

- Existing ProjectFile model
- Existing storage adapter
- Existing upload routes
- Existing document models
- Existing extraction/import models
- Existing BOQ source metadata
- Existing verification engine
- Existing company library
- Existing industry packages
- Existing entitlement rules
- Existing document generation
- Existing proposal portal
- Existing UI routes
- Existing tests
- Missing Phase 8 infrastructure
- Reusable services
- Migration risks
- Exact implementation order

Do not change behavior during the audit.

==================================================
4. CORE FILE INTELLIGENCE MODEL
==================================================

Create or extend ProjectFile.

Required fields:

- id
- companyId
- projectId
- uploadedByUserId
- originalName
- safeFileName
- storageKey
- mimeType
- extension
- fileSize
- checksum
- classification
- classificationConfidence
- classificationConfirmedByUserId
- classificationConfirmedAt
- status
- language
- pageCount
- sheetCount
- drawingNumber
- drawingTitle
- revisionNumber
- scaleText
- detectedScale
- measurementUnit
- metadataJson
- processingErrorCode
- processingErrorMessage
- createdAt
- updatedAt

Supported classifications:

- ARCHITECTURAL_PLAN
- STRUCTURAL_PLAN
- FURNITURE_LAYOUT
- INTERIOR_LAYOUT
- REFLECTED_CEILING_PLAN
- FLOORING_PLAN
- LIGHTING_PLAN
- ELECTRICAL_PLAN
- HVAC_PLAN
- PLUMBING_PLAN
- DRAINAGE_PLAN
- FIRE_FIGHTING_PLAN
- FIRE_ALARM_PLAN
- ELV_PLAN
- JOINERY_DRAWING
- LANDSCAPE_PLAN
- ELEVATION
- SECTION
- DETAIL_DRAWING
- MATERIAL_SCHEDULE
- FURNITURE_SCHEDULE
- EQUIPMENT_SCHEDULE
- DOOR_SCHEDULE
- WINDOW_SCHEDULE
- FINISH_SCHEDULE
- SUPPLIER_PRICE_LIST
- EXISTING_BOQ
- PRODUCT_CATALOGUE
- SITE_INSPECTION_PHOTO
- TEST_REPORT
- METHOD_STATEMENT
- TECHNICAL_REPORT
- UNKNOWN

File statuses:

- UPLOADED
- CLASSIFYING
- CLASSIFIED
- PREPROCESSING
- READY_FOR_PROCESSING
- PROCESSING
- NEEDS_REVIEW
- COMPLETED
- FAILED
- CANCELLED
- ARCHIVED

==================================================
5. PRIVATE FILE STORAGE
==================================================

Use the existing storage adapter if present.

Required behavior:

- private storage
- tenant-specific storage keys
- no direct public paths
- authorized download routes
- checksum validation
- MIME validation
- extension validation
- size validation
- safe file naming
- path-traversal prevention
- duplicate-file detection
- immutable originals
- derivative files stored separately
- deletion blocked where a file is referenced by issued records

Suggested storage structure:

companies/[companyId]/
  projects/[projectId]/
    originals/
    previews/
    pages/
    extracted/
    annotations/
    reports/

Never overwrite the original upload.

==================================================
6. SUPPORTED FILE TYPES
==================================================

Initial supported types:

- PDF
- PNG
- JPG
- JPEG
- TIFF
- CSV
- XLSX
- DOCX
- DXF
- DWG upload and metadata acceptance
- IFC upload and metadata acceptance

Capability rules:

PDF:
- text extraction where text layer exists
- page rasterization
- table extraction where reliable
- drawing preview

CSV:
- structured import

XLSX:
- structured import
- sheet selection
- formulas read as values where appropriate

Images:
- preview
- OCR where provider supports it
- inspection evidence
- visual analysis where configured

DXF:
- parser foundation
- layers
- text
- polylines
- blocks
- dimensions where supported

DWG:
- upload
- metadata
- conversion-required state
- do not claim native full parsing unless implemented

IFC:
- upload
- metadata
- parser foundation
- do not claim full model quantities unless implemented

==================================================
7. DRAWING PAGE MODEL
==================================================

Create:

DrawingPage

Fields:

- id
- companyId
- projectFileId
- pageNumber
- sheetName
- width
- height
- dpi
- imageStorageKey
- thumbnailStorageKey
- vectorDataStorageKey
- textLayerJson
- titleBlockJson
- detectedScale
- scaleUnit
- scaleConfidence
- orientation
- cropBoxJson
- processingStatus
- createdAt
- updatedAt

Create:

DrawingLayer

Fields:

- id
- companyId
- drawingPageId
- name
- layerType
- sourceLayerName
- isVisible
- metadataJson
- createdAt
- updatedAt

==================================================
8. EXTRACTION JOB ARCHITECTURE
==================================================

Create:

ExtractionJob

Fields:

- id
- companyId
- projectId
- projectFileId
- engineType
- provider
- status
- progressPercentage
- currentStep
- startedAt
- completedAt
- failedAt
- attempts
- maximumAttempts
- configurationJson
- resultSummaryJson
- usageMetadataJson
- errorCode
- errorMessage
- createdByUserId
- createdAt
- updatedAt

Engine types:

- DOCUMENT_CLASSIFICATION
- FILE_PREPROCESSING
- PDF_TEXT_EXTRACTION
- OCR_TEXT_EXTRACTION
- TABLE_EXTRACTION
- TITLE_BLOCK_EXTRACTION
- SCALE_DETECTION
- VECTOR_EXTRACTION
- ROOM_BOUNDARY_DETECTION
- OBJECT_DETECTION
- SYMBOL_DETECTION
- QUANTITY_CALCULATION
- PRODUCT_MATCHING
- PHOTO_ANALYSIS
- FINDINGS_DRAFTING
- REPORT_DRAFTING
- VERIFICATION_GENERATION

Statuses:

- QUEUED
- RUNNING
- NEEDS_INPUT
- NEEDS_REVIEW
- COMPLETED
- FAILED
- CANCELLED

Use a queue abstraction.

Create or extend:

src/lib/jobs/job-queue.ts
src/lib/jobs/local-job-queue.ts
src/lib/jobs/extraction-worker.ts

Requirements:

- idempotent processing
- retry control
- cancellation
- progress
- error persistence
- safe resume
- no synchronous large-file processing in API handlers

==================================================
9. DOCUMENT CLASSIFICATION
==================================================

Create:

src/lib/files/file-classifier.ts

Classification inputs may include:

- filename
- extension
- MIME type
- page text
- title-block text
- sheet name
- user-selected type
- optional external vision result

Rules:

- user-confirmed classification overrides automatic suggestion
- automatic result includes confidence
- unknown classification is allowed
- preserve suggested and confirmed values separately
- classification must not delete or mutate extracted data silently
- reclassification requires explicit user action and audit log

UI must display:

- suggested type
- confidence
- detected title
- drawing number
- revision
- scale
- language
- page count
- confirm or change action

==================================================
10. FILE PREPROCESSING
==================================================

Create:

src/lib/files/preprocessor.ts

Capabilities where supported:

- page splitting
- image rasterization
- orientation correction
- deskew
- contrast adjustment
- perspective correction for mobile photos
- shadow reduction
- page cropping
- thumbnail generation
- duplicate-page detection
- image metadata removal where privacy requires it

Rules:

- preserve original
- create derivatives
- record preprocessing operations
- never claim enhancement recovered unreadable data when it did not
- do not overwrite evidence photos

==================================================
11. STRUCTURED TABLE AND SCHEDULE EXTRACTION
==================================================

Support:

- CSV
- XLSX
- text-based PDF tables
- supplier quotations
- existing BOQs
- furniture schedules
- equipment schedules
- structural quantity schedules
- door and finish schedules

Create:

ExtractedTable
ExtractedTableRow
ExtractedTableCell

ExtractedTable fields:

- id
- companyId
- projectFileId
- drawingPageId
- sheetName
- title
- tableType
- confidence
- boundingGeometryJson
- sourceReference
- status
- createdAt
- updatedAt

ExtractedTableRow fields:

- id
- companyId
- extractedTableId
- rowNumber
- parentRowId
- normalizedDataJson
- rawDataJson
- confidence
- status
- createdAt
- updatedAt

ExtractedTableCell fields:

- id
- companyId
- extractedTableRowId
- columnKey
- rawValue
- normalizedValue
- confidence
- sourceCellReference
- boundingGeometryJson
- createdAt
- updatedAt

Required extraction fields where applicable:

- section
- parent element
- item code
- description
- specification
- quantity
- unit
- rate
- total
- manufacturer
- brand
- model
- room
- level
- diameter
- size
- drawing reference
- page
- sheet
- source cell

Merged-cell reconstruction is mandatory.

Parent-child row grouping is mandatory.

Do not flatten structural schedules incorrectly.

==================================================
12. STRUCTURAL SCHEDULE SUPPORT
==================================================

Support schedule structures such as:

Element:
Foundations

Concrete:
53 m3

Reinforcement:
25 mm → 0.58 tonne
20 mm → 0.46 tonne
16 mm → 4.50 tonne
12 mm → 0.48 tonne

Preserve:

- parent element
- concrete quantity
- reinforcement diameter
- reinforcement quantity
- unit
- source row
- source page
- confidence
- manual correction

Do not duplicate the parent concrete quantity for each steel row in a way that creates incorrect BOQ totals.

==================================================
13. OCR ABSTRACTION
==================================================

Create:

src/lib/ocr/ocr-provider.ts
src/lib/ocr/local-ocr-provider.ts
src/lib/ocr/external-ocr-provider.ts
src/lib/ocr/ocr-policy.ts

OCR output must include:

- original text
- normalized text
- confidence
- bounding geometry
- page number
- language
- provider
- source image reference

Rules:

- external OCR disabled by default unless configured
- company policy must permit external processing
- confirmed user corrections remain immutable
- OCR output is not automatically trusted
- Arabic and English support must be capability-based
- do not claim Arabic handwriting support unless verified
- do not use OCR for clean vector text when text extraction is available

==================================================
14. EXTERNAL AI PROVIDER POLICY
==================================================

Create:

src/lib/ai/provider-policy.ts
src/lib/ai/document-provider.ts
src/lib/ai/vision-provider.ts

Policy fields:

- providerEnabled
- allowedFileTypes
- allowedEngines
- maximumPages
- maximumFileSize
- region
- retentionPolicy
- costLimit
- timeout
- retryLimit
- companyConsentRequired

Company settings:

- allowExternalAiProcessing
- preferredProcessingRegion
- retainProcessedDerivatives
- retentionDays
- allowCompanyCorrectionMemory
- allowAnonymousUsageMetrics

Defaults:

- no external model training
- no cross-company learning
- no automatic file upload to external provider
- no provider use without policy approval

==================================================
15. SCALE CALIBRATION
==================================================

Create:

DrawingScaleCalibration

Fields:

- id
- companyId
- drawingPageId
- calibrationType
- scaleRatio
- drawingUnit
- realWorldUnit
- sourceText
- sourceGeometryJson
- confidence
- isVerified
- verifiedByUserId
- verifiedAt
- createdAt
- updatedAt

Calibration types:

- DETECTED_SCALE_TEXT
- KNOWN_DIMENSION
- TWO_POINT
- VECTOR_UNIT
- MANUAL_INPUT

Rules:

- spatial quantities blocked without verified scale
- detected scale is only a suggestion
- conflicting scales require review
- scale must be stored per page or sheet
- imported scale must not be assumed across unrelated sheets

==================================================
16. DRAWING VIEWER AND WORKBENCH
==================================================

Create routes:

/projects/[projectId]/files
/projects/[projectId]/files/[fileId]
/projects/[projectId]/workbench
/projects/[projectId]/extractions
/projects/[projectId]/quantities

Workbench layout:

Desktop:

Left 60%:
- drawing canvas
- zoom
- pan
- page selector
- sheet selector
- layer selector
- overlays
- manual measurement
- manual count
- scale calibration
- annotation tools

Right 40%:
- extracted entities
- filters
- confidence
- source evidence
- matched company item
- matched master item
- quantity
- status
- confirm
- correct
- reject
- import to BOQ

Tablet:
- collapsible right panel

Mobile:
- drawing first
- bottom-sheet item inspector
- no unusable side-by-side layout

==================================================
17. EXTRACTED ENTITY MODEL
==================================================

Create:

ExtractedEntity

Fields:

- id
- companyId
- projectId
- projectFileId
- drawingPageId
- extractionJobId
- entityType
- categoryKey
- label
- normalizedLabel
- quantity
- unit
- confidence
- extractionMethod
- boundingGeometryJson
- sourceText
- sourceReference
- technicalDataJson
- matchedMasterItemId
- matchedCompanyLibraryItemId
- matchedCatalogueItemId
- status
- confirmedByUserId
- confirmedAt
- rejectedByUserId
- rejectedAt
- correctionJson
- createdAt
- updatedAt

Entity types:

- ROOM
- FURNITURE
- EQUIPMENT
- MATERIAL
- FIXTURE
- ELECTRICAL_POINT
- LIGHT_FIXTURE
- HVAC_EQUIPMENT
- FAN
- DUCT
- DIFFUSER
- GRILLE
- DAMPER
- PIPE
- VALVE
- SANITARY_FIXTURE
- FIRE_FIGHTING_ITEM
- FIRE_ALARM_ITEM
- DOOR
- WINDOW
- PARTITION
- WALL_FINISH
- FLOOR_FINISH
- CEILING_FINISH
- STRUCTURAL_ELEMENT
- SCHEDULE_ROW
- ANNOTATION
- CUSTOM

Extraction methods:

- TEXT_LAYER
- OCR
- TABLE_PARSER
- VECTOR_BLOCK
- VISION_MODEL
- GEOMETRY_ENGINE
- MANUAL
- HYBRID

Statuses:

- EXTRACTED
- NEEDS_REVIEW
- CONFIRMED
- CORRECTED
- REJECTED
- IMPORTED

==================================================
18. ROOM AND SPATIAL DETECTION
==================================================

Create:

DetectedRoom

Fields:

- id
- companyId
- projectId
- drawingPageId
- roomName
- roomNumber
- boundaryGeometryJson
- area
- perimeter
- ceilingHeight
- floorLevel
- scaleCalibrationId
- confidence
- status
- correctedDataJson
- confirmedByUserId
- confirmedAt
- createdAt
- updatedAt

Detect where possible:

- room boundary
- room name
- room number
- floor level
- area
- perimeter
- openings
- ceiling height when explicitly available

Rules:

- do not assume missing ceiling height
- suggested defaults require confirmation
- user can rename
- redraw
- merge
- split
- delete
- assign floor
- enter height
- recalibrate

==================================================
19. FURNITURE AND EQUIPMENT DETECTION
==================================================

Initial furniture categories:

- Executive Desk
- Workstation
- Task Chair
- Meeting Chair
- Meeting Table
- Cabinet
- Pedestal
- Sofa
- Coffee Table
- Reception Counter
- Planter
- Bed
- Wardrobe
- Vanity
- Kitchen Unit
- Storage Unit
- TV Unit
- Bench
- Dining Table
- Dining Chair

Initial MEP categories:

- AHU
- FAHU
- FCU
- Chiller
- Cooling Tower
- VRF Outdoor Unit
- VRF Indoor Unit
- Package Unit
- Fan
- Diffuser
- Grille
- Damper
- Light Fixture
- Emergency Light
- Socket
- Switch
- Data Point
- Sprinkler
- Fire Extinguisher
- Hose Reel
- Landing Valve
- Water Closet
- Wash Basin
- Floor Drain
- Pump
- Valve

Every detection must include:

- page
- room
- bounding geometry
- category
- label
- confidence
- count
- matched item suggestion
- source evidence

==================================================
20. MEP SYMBOL RECOGNITION
==================================================

Implement symbol recognition as a configurable engine.

Create:

SymbolDefinition

Fields:

- id
- disciplineId
- systemId
- symbolKey
- name
- description
- referenceImagesJson
- vectorPatternJson
- defaultMasterItemId
- metadataJson
- version
- isActive
- createdAt
- updatedAt

Create:

CompanySymbolMapping

Fields:

- id
- companyId
- symbolDefinitionId
- customLabel
- customReferenceImagesJson
- mappedCompanyLibraryItemId
- usageCount
- createdAt
- updatedAt

Rules:

- symbols vary by consultant and drawing standard
- user correction must be supported
- company-specific mapping ranks higher
- unknown symbols remain reviewable
- no auto-import of low-confidence symbol matches

==================================================
21. CAD AND BIM FOUNDATION
==================================================

Create interfaces:

src/lib/cad/cad-parser.ts
src/lib/cad/dxf-parser.ts
src/lib/cad/dwg-parser.ts
src/lib/bim/ifc-parser.ts

DXF target capabilities:

- layers
- blocks
- text
- dimensions
- polylines
- units
- block counts

DWG:

- upload
- metadata
- conversion-required state
- provider abstraction
- no false full-support claim

IFC:

- upload
- metadata
- element foundation
- no false complete takeoff claim

Create capability statuses:

- SUPPORTED
- PARTIAL
- REQUIRES_CONVERSION
- METADATA_ONLY
- NOT_AVAILABLE

Display these accurately in the UI.

==================================================
22. QUANTITY CALCULATION MODEL
==================================================

Create:

QuantityCalculation

Fields:

- id
- companyId
- projectId
- extractedEntityId
- calculationType
- inputValuesJson
- deductionsJson
- allowancesJson
- formula
- resultValue
- resultUnit
- confidence
- status
- manuallyOverridden
- originalResultValue
- overrideReason
- calculatedBy
- calculatedAt
- confirmedByUserId
- confirmedAt
- createdAt
- updatedAt

Calculation types:

- COUNT
- AREA
- PERIMETER
- LENGTH
- VOLUME
- WALL_AREA
- FLOOR_AREA
- CEILING_AREA
- SKIRTING_LENGTH
- DUCT_SURFACE_AREA
- PIPE_LENGTH
- CABLE_LENGTH
- CONCRETE_VOLUME
- REINFORCEMENT_WEIGHT
- FORMWORK_AREA
- EXCAVATION_VOLUME
- PAINT_AREA
- PARTITION_AREA
- CUSTOM

==================================================
23. DETERMINISTIC QUANTITY FORMULAS
==================================================

Interior:

Flooring:
net floor area + wastage

Ceiling:
ceiling area + wastage

Skirting:
perimeter - door widths + wastage

Wall finish:
wall length × height - openings + wastage

Paint:
wall area - openings × coat factor

Partition:
length × height × applicable faces

Construction:

Concrete:
length × width × depth

Excavation:
length × width × depth

Blockwork:
wall length × wall height - openings

Formwork:
exposed concrete surface area

Reinforcement:
schedule quantity where available
or verified bar-length and unit-weight calculation

MEP:

Duct surface:
duct perimeter × length

Pipe:
verified route length + approved allowance

Cable:
route length + vertical drops + approved termination allowance

Furniture:
verified count

Rules:

- formulas deterministic
- formula visible
- all inputs visible
- deductions visible
- wastage visible
- allowances visible
- manual override requires reason
- commercial prices calculated separately

==================================================
24. CONFIDENCE RULES
==================================================

Default thresholds:

90–100:
High Confidence

75–89.99:
Needs Review

Below 75:
Manual Verification Required

Override conditions requiring review regardless of confidence:

- missing scale
- conflicting scale
- missing unit
- missing dimension
- revision mismatch
- schedule and drawing conflict
- duplicate detection
- overlapping labels
- low image quality
- unrecognized symbol
- unmatched category
- premium item without entitlement

No confidence threshold may auto-lock or auto-issue a BOQ.

==================================================
25. HUMAN VERIFICATION WORKFLOW
==================================================

Required actions:

- Confirm
- Correct
- Reject
- Add Missing
- Merge
- Split
- Reassign Category
- Reassign Room
- Match Company Item
- Match Master Item
- Match Catalogue Item
- Create Manual Item
- Recalculate
- Import to BOQ

Every correction must preserve:

- original value
- corrected value
- user
- timestamp
- reason
- source page
- extraction job

Confirmed values must not be overwritten by later reprocessing.

==================================================
26. EXTRACTION CORRECTION MEMORY
==================================================

Create:

ExtractionCorrectionPattern

Fields:

- id
- companyId
- engineType
- sourcePattern
- correctedCategory
- correctedLabel
- correctedTechnicalDataJson
- matchedCompanyLibraryItemId
- usageCount
- lastUsedAt
- createdByUserId
- createdAt
- updatedAt

Purpose:

- improve company-specific ranking
- reuse prior corrections
- never train a global model automatically
- never expose correction patterns to other companies

==================================================
27. MASTER-DATA MATCHING
==================================================

Match extracted entities against:

1. Company Library
2. Recently Used Items
3. Company Variants
4. Purchased Industry Packages
5. Supplier Catalogue
6. Previous BOQ Items
7. Locked Package Preview

Store:

- suggested item
- match score
- match reason
- source
- entitlement state
- user confirmation

Do not expose full premium data without entitlement.

Do not auto-purchase or auto-subscribe.

==================================================
28. IMPORT TO BOQ
==================================================

Only confirmed entities may be imported by default.

Import grouping options:

- one item per entity
- group identical items
- group by room
- group by zone
- group by floor
- group by system
- group by category
- group by item code

On import, store:

- sourceType
- sourceFileId
- sourcePageId
- extractedEntityId
- quantityCalculationId
- sourceReference
- confidence
- formula
- corrected value
- importedByUserId
- importedAt

Do not import selling price from drawings.

Commercial values come from:

- company catalogue
- supplier rate
- company library default
- manual confirmed input

==================================================
29. INSPECTION MODULE
==================================================

Create:

Inspection

Fields:

- id
- companyId
- projectId
- disciplineId
- systemId
- reportType
- reference
- title
- description
- clientId
- consultantName
- mainContractorName
- subcontractorName
- projectLocation
- buildingType
- inspectionDate
- reportDate
- preparedByUserId
- reviewedByUserId
- approvedByUserId
- revisionNumber
- status
- relatedBoqId
- relatedQuotationReference
- relatedContractReference
- workOrderNumber
- createdAt
- updatedAt

Statuses:

- DRAFT
- IN_PROGRESS
- NEEDS_REVIEW
- REVIEWED
- APPROVED
- ISSUED
- SUPERSEDED
- ARCHIVED

==================================================
30. INSPECTION TYPES
==================================================

Support:

- New Installation Report
- Existing-Condition Inspection Report
- Defect Report
- Maintenance Report
- Repair Proposal
- Testing and Commissioning Report
- Snagging Report
- Due-Diligence Report
- Condition Assessment
- Failure Investigation
- Technical Justification Report
- Method Statement
- Material Submittal Report
- Variation Report
- Completion Report
- Before-and-After Report
- Insurance Report
- Authority Submission Report
- Executive Report
- Quick Site Report

==================================================
31. DYNAMIC INSPECTION TEMPLATES
==================================================

Create:

InspectionTemplate

Fields:

- id
- companyId
- disciplineId
- systemId
- reportType
- name
- description
- sectionsJson
- fieldDefinitionsJson
- scoringConfigJson
- riskConfigJson
- outputConfigJson
- isSystemTemplate
- isActive
- createdAt
- updatedAt

Templates define:

- project fields
- system fields
- inspection questions
- measurements
- evidence requirements
- risk factors
- recommendation rules
- output sections
- approval requirements

==================================================
32. STRUCTURED INSPECTION RESPONSES
==================================================

Create:

InspectionResponse

Fields:

- id
- companyId
- inspectionId
- sectionKey
- fieldKey
- valueJson
- unit
- status
- sourceType
- sourceReference
- enteredByUserId
- confirmedByUserId
- confirmedAt
- createdAt
- updatedAt

Source types:

- MANUAL
- PHOTO
- DRAWING
- TEST_RESULT
- DOCUMENT_IMPORT
- AI_SUGGESTED
- EQUIPMENT_DATA
- PREVIOUS_INSPECTION

AI suggestions must not be confirmed automatically.

==================================================
33. SYSTEM-SPECIFIC INSPECTION FORMS
==================================================

Drainage fields:

- pipe material
- pipe diameter
- pipe condition
- flow condition
- blockage severity
- grease accumulation
- sludge level
- odor condition
- leakage
- backflow risk
- manhole condition
- cleanout accessibility
- grease-trap availability
- maintenance history
- test results
- photos

HVAC fields:

- equipment type
- equipment tag
- capacity
- airflow
- supply temperature
- return temperature
- static pressure
- filter condition
- coil condition
- fan condition
- noise
- vibration
- leakage
- electrical condition
- insulation condition
- controls condition
- refrigerant condition
- maintenance history

Create extensible forms for:

- electrical
- plumbing
- drainage
- fire fighting
- fire alarm
- ELV
- mechanical
- HVAC
- civil
- structural
- interior fit-out
- joinery
- landscaping
- furniture and equipment

==================================================
34. INSPECTION FINDINGS
==================================================

Create:

InspectionFinding

Fields:

- id
- companyId
- inspectionId
- findingNumber
- disciplineId
- systemId
- assetId
- location
- title
- description
- observedCondition
- expectedCondition
- severity
- confidence
- sourceReferencesJson
- photoReferencesJson
- drawingReferencesJson
- status
- createdByType
- createdByUserId
- confirmedByUserId
- confirmedAt
- createdAt
- updatedAt

Statuses:

- DRAFT
- AI_SUGGESTED
- NEEDS_REVIEW
- CONFIRMED
- CORRECTED
- REJECTED
- CLOSED

==================================================
35. AI FINDINGS DRAFTING
==================================================

Create:

src/lib/inspection/findings-generator.ts

Inputs:

- inspection responses
- engineer notes
- photos
- test results
- drawing annotations
- prior inspections
- asset information

Output:

- draft finding
- affected system
- location
- observed evidence
- expected condition
- operational impact
- safety impact
- proposed severity
- confidence
- missing information
- source references

Rules:

- no invented measurement
- no invented defect
- no unsupported conclusion
- no invented standard
- no auto-confirmation
- preserve original notes
- mark AI draft visibly

==================================================
36. ROOT-CAUSE ANALYSIS
==================================================

Create:

RootCauseAnalysis

Fields:

- id
- companyId
- inspectionFindingId
- method
- primaryCauseCategory
- analysisJson
- conclusion
- confidence
- furtherTestingRequired
- status
- createdByUserId
- confirmedByUserId
- createdAt
- updatedAt

Methods:

- Five Whys
- Fishbone Analysis
- Failure-Mode Analysis
- Cause-and-Effect Mapping
- Installation-Defect Analysis
- Maintenance-Failure Analysis
- Material-Failure Analysis
- Design-Deficiency Analysis
- Operational-Misuse Analysis
- Environmental-Condition Analysis

Cause categories:

- DESIGN_RELATED
- INSTALLATION_RELATED
- MATERIAL_RELATED
- MAINTENANCE_RELATED
- OPERATION_RELATED
- AGE_RELATED
- ENVIRONMENTAL
- ACCIDENTAL_DAMAGE
- WORKMANSHIP
- USER_MISUSE
- UNKNOWN_REQUIRES_TESTING

Do not force a definitive cause without sufficient evidence.

==================================================
37. RISK ASSESSMENT
==================================================

Create:

RiskAssessment

Fields:

- id
- companyId
- inspectionFindingId
- likelihood
- severity
- riskScore
- riskLevel
- affectedArea
- operationalImpact
- healthSafetyImpact
- propertyDamageImpact
- complianceImpact
- businessContinuityImpact
- recommendedUrgency
- rationale
- status
- assessedByUserId
- confirmedByUserId
- createdAt
- updatedAt

Default formula:

riskScore = likelihood × severity

Ranges:

1–4:
LOW

5–9:
MEDIUM

10–14:
HIGH

15–25:
CRITICAL

Make thresholds configurable.

Urgency:

- IMMEDIATE_EMERGENCY
- WITHIN_24_HOURS
- WITHIN_7_DAYS
- WITHIN_30_DAYS
- PLANNED_CORRECTIVE_MAINTENANCE
- PREVENTIVE_MAINTENANCE
- CAPITAL_REPLACEMENT
- FURTHER_INVESTIGATION
- MONITORING_ONLY
- NO_ACTION_REQUIRED

==================================================
38. CORRECTIVE ACTIONS
==================================================

Create:

CorrectiveAction

Fields:

- id
- companyId
- inspectionFindingId
- actionType
- title
- description
- requiredMaterialsJson
- requiredManpowerJson
- requiredEquipmentJson
- accessRequirements
- safetyControlsJson
- testingRequirementsJson
- completionCriteriaJson
- estimatedDurationHours
- priority
- status
- createdByUserId
- confirmedByUserId
- createdAt
- updatedAt

Action types:

- IMMEDIATE
- TEMPORARY
- PERMANENT
- PREVENTIVE
- INVESTIGATION
- MONITORING
- REPLACEMENT
- NO_ACTION

==================================================
39. FINDING-TO-BOQ SERVICE
==================================================

Create:

FindingBoqLink

Fields:

- id
- companyId
- inspectionFindingId
- correctiveActionId
- boqId
- boqItemId
- quantitySource
- createdByUserId
- createdAt

Create:

src/lib/services/finding-to-boq-service.ts

Functions:

- createBoqItemsFromFinding
- linkExistingBoqItem
- updateLinkedDraftBoqItem
- unlinkFinding
- calculateFindingCostSummary

Rules:

- finding must be confirmed
- action must be confirmed
- BOQ must be editable
- pricing must come from catalogue or manual confirmed input
- locked BOQ cannot change
- issued BOQ cannot change
- finding updates do not silently update BOQ
- explicit user confirmation required for draft synchronization

==================================================
40. PHOTO EVIDENCE
==================================================

Create:

InspectionPhoto

Fields:

- id
- companyId
- inspectionId
- findingId
- projectFileId
- photoNumber
- caption
- location
- capturedAt
- uploadedByUserId
- beforeAfterType
- annotationsJson
- aiObservationsJson
- status
- createdAt
- updatedAt

Types:

- BEFORE
- DURING
- AFTER
- REFERENCE

Possible AI suggestions:

- leakage
- corrosion
- broken insulation
- standing water
- exposed wires
- damaged ceiling
- blocked drain
- missing cover
- rust
- cracks
- staining
- poor workmanship

Rules:

- suggestion only
- user confirmation required
- editable annotations
- preserve original photo
- link to finding
- link to drawing
- link to BOQ

==================================================
41. DRAWING ANNOTATIONS
==================================================

Create:

InspectionAnnotation

Fields:

- id
- companyId
- inspectionId
- findingId
- drawingPageId
- annotationCode
- annotationType
- geometryJson
- label
- priority
- photoReference
- boqReference
- recommendationReference
- createdByUserId
- createdAt
- updatedAt

Examples:

- F-01
- M-12
- P-03
- D-05
- FA-07

==================================================
42. TEST AND MEASUREMENT MODULE
==================================================

Create:

TestMeasurement

Fields:

- id
- companyId
- inspectionId
- findingId
- assetId
- testType
- parameter
- measuredValue
- unit
- minimumAllowed
- maximumAllowed
- designValue
- referenceType
- referenceId
- resultStatus
- notes
- measuredByUserId
- measuredAt
- createdAt
- updatedAt

Statuses:

- COMPLIANT
- PARTIALLY_COMPLIANT
- NON_COMPLIANT
- NOT_VERIFIED
- NOT_APPLICABLE
- FURTHER_TESTING_REQUIRED

Support:

HVAC:
- temperatures
- airflow
- static pressure
- chilled-water temperature
- differential pressure
- noise
- vibration
- refrigerant pressure

Electrical:
- voltage
- current
- insulation resistance
- earth resistance
- continuity
- phase balance
- power factor
- thermal temperature

Plumbing and Drainage:
- pressure
- flow
- leakage
- hydrostatic test
- flow test
- CCTV result
- water quality

Fire Systems:
- pump pressure
- flow
- alarm response
- detector response
- sound level
- emergency-light duration

==================================================
43. COMPLIANCE KNOWLEDGE BASE
==================================================

Create:

ComplianceReference

Fields:

- id
- jurisdiction
- authority
- standardName
- edition
- clauseReference
- title
- approvedText
- summary
- applicabilityJson
- sourceDocumentId
- status
- createdAt
- updatedAt

Create:

FindingComplianceAssessment

Fields:

- id
- companyId
- findingId
- complianceReferenceId
- resultStatus
- rationale
- assessedByUserId
- confirmedByUserId
- createdAt
- updatedAt

Critical rules:

- never invent a clause
- only cite stored approved sources
- preserve exact reference
- show source document
- require manual confirmation

If no source exists, display:

“No approved compliance reference is available. Manual engineering review is required.”

==================================================
44. REPAIR-VERSUS-REPLACEMENT
==================================================

Create:

RepairReplacementAnalysis

Fields:

- id
- companyId
- findingId
- repairCost
- replacementCost
- repairExpectedLifeYears
- replacementExpectedLifeYears
- repairDowntimeHours
- replacementDowntimeHours
- repairRiskLevel
- replacementRiskLevel
- repairWarranty
- replacementWarranty
- recommendation
- rationale
- createdByUserId
- approvedByUserId
- createdAt
- updatedAt

Recommendations:

- REPAIR
- REPLACE
- TEMPORARY_REPAIR_THEN_REPLACE
- FURTHER_INVESTIGATION

==================================================
45. ASSET CONDITION INDEX
==================================================

Create:

AssetConditionAssessment

Fields:

- id
- companyId
- inspectionId
- assetId
- ageScore
- visibleConditionScore
- performanceScore
- maintenanceScore
- failureFrequencyScore
- complianceScore
- sparePartsScore
- safetyRiskScore
- remainingLifeScore
- weightedScore
- conditionCategory
- notes
- assessedByUserId
- createdAt
- updatedAt

Categories:

90–100:
EXCELLENT

75–89:
GOOD

60–74:
FAIR

40–59:
POOR

Below 40:
CRITICAL

Weights configurable.

==================================================
46. COMMERCIAL IMPACT
==================================================

Create:

FindingCommercialImpact

Fields:

- id
- companyId
- findingId
- immediateRepairCost
- permanentWorkCost
- preventiveMaintenanceCost
- delayedActionCost
- potentialDamageExposure
- emergencyResponseCost
- estimatedDowntimeHours
- estimatedDowntimeCost
- costSavingOpportunity
- repairReplacementDifference
- currency
- basisJson
- calculatedAt
- confirmedByUserId
- createdAt
- updatedAt

Costs must come from:

- linked BOQ
- catalogue rates
- manual confirmed input
- deterministic formulas

AI must not invent costs.

==================================================
47. SCOPE OF WORK GENERATION
==================================================

Create:

src/lib/inspection/scope-generator.ts

Generate draft sections:

- Mobilization
- Site Protection
- Isolation
- Removal
- Cleaning
- Repair
- Installation
- Testing
- Reinstatement
- Waste Disposal
- Handover
- Exclusions
- Assumptions
- Client Responsibilities

Human review required before issue.

==================================================
48. METHOD STATEMENT
==================================================

Create:

MethodStatement

Fields:

- id
- companyId
- inspectionId
- title
- workSequenceJson
- resourcesJson
- equipmentJson
- materialsJson
- accessRequirements
- isolationRequirements
- testingRequirementsJson
- qualityControlsJson
- handoverRequirementsJson
- exclusions
- assumptions
- status
- preparedByUserId
- reviewedByUserId
- approvedByUserId
- createdAt
- updatedAt

No final approval without authorized review.

==================================================
49. HEALTH AND SAFETY PLAN
==================================================

Create:

InspectionSafetyPlan

Fields:

- id
- companyId
- inspectionId
- hazardsJson
- controlMeasuresJson
- requiredPpeJson
- permitRequirementsJson
- confinedSpaceControlsJson
- isolationControlsJson
- lockoutTagoutJson
- workAtHeightControlsJson
- chemicalControlsJson
- wasteDisposalControlsJson
- emergencyProceduresJson
- reviewedByUserId
- approvedByUserId
- createdAt
- updatedAt

AI suggestions must be confirmed by a competent person.

==================================================
50. PREVENTIVE MAINTENANCE PLAN
==================================================

Create:

PreventiveMaintenancePlan

Fields:

- id
- companyId
- inspectionId
- assetId
- dailyTasksJson
- weeklyTasksJson
- monthlyTasksJson
- quarterlyTasksJson
- semiAnnualTasksJson
- annualTasksJson
- responsibleParty
- requiredSparePartsJson
- estimatedAnnualCost
- currency
- status
- createdByUserId
- approvedByUserId
- createdAt
- updatedAt

==================================================
51. TECHNICAL REPORT LEVELS
==================================================

Support:

Quick Site Report:
- 2–4 pages
- summary
- findings
- photos
- actions

Professional Technical Report:
- 8–15 pages
- findings
- root causes
- risks
- actions
- photos
- costs

Consultant-Level Report:
- 20–40 pages
- detailed methodology
- calculations
- testing
- compliance
- annotated drawings
- BOQ
- cost analysis

Executive Report:
- concise owner and CEO summary

Insurance Report:
- evidence
- cause
- damage
- liability notes
- photos
- cost

Authority Submission Report:
- structured compliance evidence

==================================================
52. TECHNICAL REPORT GENERATION
==================================================

Extend existing document generation.

Reports may include:

- Cover Page
- Document Control
- Revision History
- Distribution List
- Table of Contents
- Executive Summary
- Objective
- Inspection Scope
- Methodology
- Asset Register
- Findings
- Root Causes
- Risk Register
- Compliance Assessment
- Corrective Actions
- Repair-versus-Replacement
- Asset Condition Index
- Commercial Impact
- Linked BOQ
- Scope of Work
- Method Statement
- HSE Plan
- Preventive Maintenance
- Photos
- Annotated Drawings
- Test Results
- Conclusion
- Professional Recommendation
- Approval and Signatures

Outputs:

- DOCX
- PDF
- XLSX Findings Register
- HTML Report
- Secure Client Report
- Bilingual-ready format

==================================================
53. REPORT CONTROL
==================================================

Every report must contain:

- company branding
- unique report ID
- revision
- status
- generated date
- prepared by
- reviewed by
- approved by
- linked project
- linked inspection
- linked BOQ
- photo numbering
- drawing references
- signature section
- QR verification foundation

Rules:

- draft watermark before approval
- no APPROVED state without reviewer and approver
- issued report immutable
- new change creates new revision
- prior issued reports remain accessible
- no silent regeneration over previous file

==================================================
54. INSPECTION WORKSPACE ROUTES
==================================================

Create:

/projects/[projectId]/inspections
/projects/[projectId]/inspections/new
/projects/[projectId]/inspections/[inspectionId]
/projects/[projectId]/inspections/[inspectionId]/form
/projects/[projectId]/inspections/[inspectionId]/findings
/projects/[projectId]/inspections/[inspectionId]/root-causes
/projects/[projectId]/inspections/[inspectionId]/risks
/projects/[projectId]/inspections/[inspectionId]/actions
/projects/[projectId]/inspections/[inspectionId]/photos
/projects/[projectId]/inspections/[inspectionId]/drawings
/projects/[projectId]/inspections/[inspectionId]/tests
/projects/[projectId]/inspections/[inspectionId]/compliance
/projects/[projectId]/inspections/[inspectionId]/boq
/projects/[projectId]/inspections/[inspectionId]/method-statement
/projects/[projectId]/inspections/[inspectionId]/maintenance
/projects/[projectId]/inspections/[inspectionId]/report

Workspace tabs:

- Overview
- Inspection Form
- Findings
- Root Causes
- Risks
- Actions
- Photos
- Drawings
- Tests
- Compliance
- BOQ
- Method Statement
- Safety
- Maintenance
- Report

==================================================
55. MOBILE INSPECTION UX
==================================================

Support:

- mobile forms
- photo capture
- large tap targets
- save draft
- resume later
- quick condition selectors
- severity selectors
- equipment tag input
- location input
- progress indicator
- offline-ready architecture

Do not claim full offline synchronization unless conflict handling is implemented.

==================================================
56. AI DRAFT STATUS CONTROL
==================================================

Every AI-produced record must use one of:

- AI_SUGGESTED
- NEEDS_REVIEW
- CONFIRMED
- CORRECTED
- APPROVED
- REJECTED

Users must see source evidence used for:

- finding
- root cause
- risk
- recommendation
- report summary

No invisible AI reasoning or unsupported conclusion should appear in a final document.

==================================================
57. RBAC
==================================================

Existing roles must be preserved.

Suggested permissions:

COMPANY_OWNER:
- full

ADMINISTRATOR:
- full

QUANTITY_SURVEYOR:
- quantities
- BOQ
- cost links
- verification
- report commercial sections

ESTIMATOR:
- rates
- cost impact
- BOQ conversion

DESIGNER:
- technical findings
- drawings
- rooms
- furniture
- annotations

REVIEWER:
- confirm or reject
- review reports

SALES_USER:
- client-facing report and proposal access only

Future roles may include:

- INSPECTOR
- ENGINEER
- TECHNICAL_MANAGER
- HSE_REVIEWER

Do not add new roles without migration and tests.

==================================================
58. SUBSCRIPTION AND USAGE LIMITS
==================================================

Drawing and inspection intelligence must respect entitlements.

Possible plan behavior:

FREE:
- manual files
- manual inspection
- no AI processing

TRIAL:
- limited pages
- limited one project
- limited extraction credits
- one report
- one BOQ
- five premium items

PRO:
- structured PDF extraction
- schedule extraction
- limited monthly processing credits

BUSINESS:
- room detection
- furniture detection
- more users
- higher limits

ENTERPRISE:
- private provider
- dedicated region
- custom models
- API
- custom limits

Create:

AiProcessingUsage

Fields:

- id
- companyId
- subscriptionId
- projectId
- projectFileId
- extractionJobId
- engineType
- pagesProcessed
- creditsUsed
- provider
- status
- createdAt

All limits enforced server-side.

==================================================
59. VERIFICATION RULES
==================================================

Generate warnings for:

- missing file classification
- duplicate file
- revision mismatch
- missing scale
- conflicting scale
- missing unit
- missing dimension
- unreadable text
- low OCR confidence
- unrecognized symbol
- overlapping detection
- unmatched category
- extraction conflict
- schedule versus drawing mismatch
- missing room
- missing height
- missing technical field
- finding without evidence
- root cause without evidence
- risk without rationale
- corrective action without completion criteria
- BOQ item without source finding
- test without unit
- compliance without approved reference
- report without reviewer
- report without approver
- cost without BOQ or confirmed input
- method statement without safety controls
- missing before/after evidence

==================================================
60. API ROUTES
==================================================

Files:

POST /api/projects/[projectId]/files
GET /api/projects/[projectId]/files
GET /api/files/[fileId]
DELETE /api/files/[fileId]
GET /api/files/[fileId]/download

Processing:

POST /api/files/[fileId]/classify
POST /api/files/[fileId]/preprocess
POST /api/files/[fileId]/extract
GET /api/files/[fileId]/jobs
POST /api/jobs/[jobId]/cancel

Extraction:

GET /api/projects/[projectId]/extractions
GET /api/extractions/[entityId]
PUT /api/extractions/[entityId]
POST /api/extractions/[entityId]/confirm
POST /api/extractions/[entityId]/reject
POST /api/extractions/[entityId]/correct

Spatial:

POST /api/drawing-pages/[pageId]/scale
POST /api/drawing-pages/[pageId]/rooms/detect
POST /api/drawing-pages/[pageId]/objects/detect
POST /api/projects/[projectId]/quantities/calculate

BOQ:

POST /api/projects/[projectId]/extractions/import-to-boq

Inspections:

GET /api/projects/[projectId]/inspections
POST /api/projects/[projectId]/inspections
GET /api/inspections/[inspectionId]
PUT /api/inspections/[inspectionId]

POST /api/inspections/[inspectionId]/responses
POST /api/inspections/[inspectionId]/findings/generate
POST /api/inspections/[inspectionId]/findings
POST /api/findings/[findingId]/confirm
POST /api/findings/[findingId]/reject

POST /api/findings/[findingId]/root-cause
POST /api/findings/[findingId]/risk
POST /api/findings/[findingId]/actions
POST /api/findings/[findingId]/convert-to-boq

POST /api/inspections/[inspectionId]/photos
POST /api/inspections/[inspectionId]/tests
POST /api/inspections/[inspectionId]/compliance
POST /api/inspections/[inspectionId]/method-statement
POST /api/inspections/[inspectionId]/maintenance-plan
POST /api/inspections/[inspectionId]/reports/generate

==================================================
61. AUDIT LOGGING
==================================================

Log:

- file uploaded
- file classified
- file reclassified
- extraction started
- extraction completed
- extraction failed
- scale calibrated
- room confirmed
- entity confirmed
- entity corrected
- entity rejected
- quantity calculated
- quantity overridden
- BOQ import
- external provider used
- inspection created
- inspection response entered
- finding generated
- finding confirmed
- finding corrected
- finding rejected
- root cause created
- risk created
- corrective action created
- finding converted to BOQ
- photo added
- photo annotated
- test result entered
- compliance reference applied
- scope generated
- method statement generated
- safety plan created
- maintenance plan created
- report generated
- report reviewed
- report approved
- report issued

Do not log raw file contents, tokens, secrets, or unnecessary personal data.

==================================================
62. SECURITY
==================================================

Implement:

- companyId on every query
- role checks
- storage authorization
- file validation
- path-traversal prevention
- MIME verification
- checksum
- private derivatives
- provider consent
- rate limits
- processing limits
- safe error messages
- no raw stack traces to users
- no external URLs fetched without allowlist
- no arbitrary HTML execution
- sanitized report content
- no cross-company correction memory
- no cross-project report access

Create:

docs/phase-8-security-model.md
docs/ai-processing-policy.md
docs/file-retention-policy.md

==================================================
63. UI GOVERNANCE
==================================================

Follow exactly:

docs/UI-GOVERNANCE-MASTER-INSTRUCTION.md
docs/UI-LOCK-SHORT.md

Preserve:

- app shell
- dashboard
- navigation
- Light mode
- Dark mode
- System mode
- BOQ workspace
- verification workspace
- document workspace
- client proposal workspace
- table system
- form system
- responsive design
- accessibility

The drawing workbench may add a technical canvas layout but must remain consistent with the Quantara design system.

Do not create a flashy AI interface.

==================================================
64. TESTING REQUIREMENTS
==================================================

Add unit and integration tests for:

File security:
- MIME validation
- extension validation
- size validation
- checksum
- safe paths
- tenant isolation
- authorized download

Jobs:
- queue
- retry
- cancellation
- idempotency
- failed state

Classification:
- suggestion
- user override
- unknown type
- confidence

Tables:
- merged cells
- parent-child rows
- Arabic text preservation
- source references

OCR:
- provider abstraction
- confidence
- corrections preserved

Scale:
- missing scale blocks calculation
- manual scale
- two-point calibration
- conflict

Rooms:
- area
- perimeter
- correction
- split
- merge

Objects:
- count
- category
- confidence
- duplicate detection
- correction

Quantities:
- flooring
- wall area
- ceiling
- skirting
- duct area
- pipe length
- cable length
- concrete
- excavation
- formwork

BOQ import:
- confirmed only
- source links
- no price import
- locked BOQ block
- tenant isolation

Inspection:
- creation
- responses
- finding generation
- source preservation
- confirmation
- rejection

Root cause:
- uncertain cause
- further testing

Risk:
- score
- level
- configurable threshold

Finding-to-BOQ:
- confirmed finding required
- linked items
- no locked modification

Compliance:
- no invented reference
- missing reference warning

Reports:
- draft watermark
- reviewer requirement
- approver requirement
- issued immutability

Entitlements:
- trial limits
- processing credits
- expired access
- package matching

==================================================
65. MANUAL END-TO-END TEST
==================================================

Perform this exact scenario:

1. Log in as an authorized owner.
2. Open project-construction-001.
3. Upload a text-based structural schedule PDF.
4. Classify it.
5. Extract the table.
6. Confirm parent-child relationships.
7. Correct one quantity.
8. Confirm original remains preserved.
9. Import confirmed rows into draft BOQ.
10. Upload an architectural or furniture plan.
11. Confirm scale is required.
12. Calibrate scale manually.
13. Detect rooms.
14. Correct one boundary.
15. Detect furniture.
16. Confirm one high-confidence item.
17. Correct one low-confidence item.
18. Match one item to company library.
19. Calculate one room flooring quantity.
20. Confirm formula inputs are visible.
21. Override one quantity with reason.
22. Import confirmed items into BOQ.
23. Create a drainage inspection.
24. Enter severe grease accumulation.
25. Enter restricted flow.
26. Enter high sludge.
27. Mark grease trap absent.
28. Add photos.
29. Generate a draft finding.
30. Confirm source evidence is shown.
31. Correct and confirm the finding.
32. Create root-cause analysis.
33. Mark one cause as requiring further testing.
34. Create risk assessment.
35. Confirm risk score.
36. Generate corrective actions.
37. Convert actions into BOQ items.
38. Apply company rates.
39. Add a flow test.
40. Apply an approved compliance reference.
41. Generate scope of work.
42. Generate method statement.
43. Add safety controls.
44. Generate preventive maintenance plan.
45. Generate Professional Technical Report.
46. Open DOCX.
47. Open PDF.
48. Confirm photos, findings, risks, BOQ, and references.
49. Confirm draft report cannot be issued without reviewer.
50. Approve with authorized user.
51. Issue report.
52. Confirm audit history.
53. Confirm Light, Dark, and System modes still work.
54. Test another company cannot access any file, finding, report, or extraction.

==================================================
66. VALIDATION
==================================================

After every sub-phase run:

npm run lint
npm run build
npm test

Also validate:

- Prisma schema
- migration status
- seed
- PostgreSQL
- private storage
- queue worker
- file upload
- file download
- classification
- extraction
- scale
- room detection
- object detection
- quantity formulas
- BOQ import
- inspection workflow
- report generation
- entitlement enforcement
- tenant isolation
- theme persistence

Do not complete the phase with failing tests or unverified runtime behavior.

==================================================
67. REQUIRED PHASE STATUS DOCUMENT
==================================================

Create and maintain:

docs/phase-8-status.md

For every sub-phase show:

- NOT_STARTED
- ACTIVE
- BLOCKED
- MVP_COMPLETE
- VERIFIED
- EXPERIMENTAL
- PLANNED

Never mark experimental engines as VERIFIED.

Include:

- actual capability
- test evidence
- known limitations
- affected routes
- provider requirements
- supported file types
- unsupported scenarios

==================================================
68. FINAL REPORT
==================================================

At completion report:

1. Existing systems preserved
2. Files and storage
3. Job processing
4. Classification
5. Table extraction
6. OCR capability
7. Scale calibration
8. Room detection
9. Furniture detection
10. MEP detection
11. DXF capability
12. DWG capability
13. IFC capability
14. Quantity formulas
15. Human verification
16. Correction memory
17. Company-library matching
18. BOQ import
19. Inspection templates
20. Inspection forms
21. Findings
22. Root causes
23. Risk assessments
24. Corrective actions
25. Finding-to-BOQ conversion
26. Photo evidence
27. Drawing annotation
28. Test measurements
29. Compliance controls
30. Repair-versus-replacement
31. Asset condition index
32. Commercial impact
33. Scope generation
34. Method statements
35. Safety plans
36. Maintenance plans
37. Technical reports
38. Entitlement enforcement
39. RBAC
40. Audit logs
41. Security controls
42. Tests added
43. Tests passed
44. Lint result
45. Build result
46. Migration result
47. Manual workflow result
48. Genuine production-ready capabilities
49. Experimental capabilities
50. Planned capabilities
51. Known limitations
52. Recommended next phase

Do not claim:

- perfect OCR
- complete handwriting recognition
- full native DWG understanding
- complete IFC takeoff
- legally binding engineering approval
- guaranteed regulatory compliance
- qualified digital signatures
- fully autonomous BOQ generation

STOP when the controlled, reviewable, source-linked Phase 8 foundation is stable.