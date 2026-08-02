import {
  BOQItemStatus,
  BOQStatus,
  MarginMode,
  Prisma,
  PrismaClient,
  ProjectStatus,
  RateStatus,
  UserRole,
  VerificationSeverity,
} from "@prisma/client";
import { demoIndustries } from "../src/config/industries/index";
import { getDevelopmentCompanyId } from "../src/lib/tenancy/development-company";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const CREATED_AT = new Date("2026-01-01T08:00:00.000Z");
const UPDATED_AT = new Date("2026-01-15T12:00:00.000Z");
const EFFECTIVE_AT = new Date("2026-01-01T00:00:00.000Z");

const INDUSTRY_KEYS = [
  "construction",
  "interior-fitout",
  "furniture",
  "mep",
  "electrical",
  "hvac",
  "plumbing",
  "firefighting",
  "joinery",
  "landscaping",
] as const;

function seedUuid(namespace: string, ordinal: number): string {
  return `${namespace}-0000-4000-8000-${ordinal.toString().padStart(12, "0")}`;
}

function decimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function requiredId(map: Map<string, string>, key: string, entity: string): string {
  const id = map.get(key);
  if (!id) {
    throw new Error(`Missing seeded ${entity}: ${key}`);
  }
  return id;
}

const clientSeeds = [
  {
    id: seedUuid("30000000", 1),
    name: "Development Projects Team",
    companyName: "Al Futtaim Developments",
    email: "contact@alfuttaim.com",
    phone: null,
    address: "Dubai, UAE",
  },
  {
    id: seedUuid("30000000", 2),
    name: "Corporate Projects Team",
    companyName: "Gulf Business Towers",
    email: "projects@gulfbt.com",
    phone: null,
    address: "Dubai, UAE",
  },
  {
    id: seedUuid("30000000", 3),
    name: "Procurement Team",
    companyName: "Emirates Office Interiors",
    email: "sales@emiratesinteriors.com",
    phone: null,
    address: "Abu Dhabi, UAE",
  },
  {
    id: seedUuid("30000000", 4),
    name: "Facilities Team",
    companyName: "Apex Facilities",
    email: "facilities@apexuae.com",
    phone: null,
    address: "Dubai, UAE",
  },
  {
    id: seedUuid("30000000", 5),
    name: "Design Studio",
    companyName: "Prime Interiors UAE",
    email: "studio@primeinteriors.ae",
    phone: null,
    address: "Dubai, UAE",
  },
  {
    id: seedUuid("30000000", 6),
    name: "Landscape Projects Team",
    companyName: "Sapphire Resorts",
    email: "landscape@sapphire.ae",
    phone: null,
    address: "Dubai, UAE",
  },
] as const;

const projectSeeds = [
  {
    id: seedUuid("40000000", 1),
    slug: "project-construction-001",
    reference: "QBOQ-CON-001",
    name: "Dubai Residential Villa Structural Works",
    description: "Structural foundation and concrete works for an upscale residential villa.",
    location: "Dubai, UAE",
    industryKey: "construction",
    clientId: clientSeeds[0].id,
    status: ProjectStatus.ACTIVE,
  },
  {
    id: seedUuid("40000000", 2),
    slug: "project-interior-002",
    reference: "QBOQ-INT-002",
    name: "Executive Corporate Office Fit-Out",
    description: "Interior fit-out package for a premium corporate headquarters.",
    location: "Dubai, UAE",
    industryKey: "interior-fitout",
    clientId: clientSeeds[1].id,
    status: ProjectStatus.DRAFT,
  },
  {
    id: seedUuid("40000000", 3),
    slug: "project-furniture-003",
    reference: "QBOQ-FUR-003",
    name: "Headquarters Furniture Supply",
    description: "Furniture procurement and installation for a corporate headquarters.",
    location: "Abu Dhabi, UAE",
    industryKey: "furniture",
    clientId: clientSeeds[2].id,
    status: ProjectStatus.NEEDS_REVIEW,
  },
  {
    id: seedUuid("40000000", 4),
    slug: "project-mep-004",
    reference: "QBOQ-MEP-004",
    name: "Commercial Office MEP Upgrade",
    description: "MEP infrastructure upgrade for a mid-rise office tower.",
    location: "Dubai, UAE",
    industryKey: "mep",
    clientId: clientSeeds[3].id,
    status: ProjectStatus.ACTIVE,
  },
  {
    id: seedUuid("40000000", 5),
    slug: "project-joinery-005",
    reference: "QBOQ-JNY-005",
    name: "Luxury Villa Joinery Package",
    description: "Custom joinery and luxury cabinetry for a villa residence.",
    location: "Dubai, UAE",
    industryKey: "joinery",
    clientId: clientSeeds[4].id,
    status: ProjectStatus.DRAFT,
  },
  {
    id: seedUuid("40000000", 6),
    slug: "project-landscaping-006",
    reference: "QBOQ-LND-006",
    name: "Hospitality Landscape Development",
    description: "Landscape development for hospitality outdoor public spaces.",
    location: "Dubai, UAE",
    industryKey: "landscaping",
    clientId: clientSeeds[5].id,
    status: ProjectStatus.ACTIVE,
  },
] as const;

const boqSeeds = [
  {
    id: seedUuid("50000000", 1),
    projectSlug: "project-construction-001",
    title: "Structural Foundations BOQ",
    section: {
      id: seedUuid("60000000", 1),
      code: "FND",
      title: "Foundations",
      description: "Foundation concrete and reinforcement works.",
      items: [
        {
          id: seedUuid("70000000", 1),
          frontendId: "item-001",
          itemNumber: 1,
          itemCode: "C-001",
          category: "Concrete",
          description: "Foundations concrete 25 MPa",
          specification: "C25/30 ready-mix",
          quantity: "45",
          unit: "m3",
          unitCost: "520",
          marginPercentage: "12",
          sellingRate: "582.4",
          totalAmount: "26208",
          wastagePercentage: "0",
          sourceReference: "Structural Plan A-102",
          roomOrZone: "Foundation",
          drawingReference: "DRW-FND-01",
          confidenceScore: "92",
          notes: "Includes lean concrete and formwork allowance.",
          options: [],
        },
        {
          id: seedUuid("70000000", 2),
          frontendId: "item-002",
          itemNumber: 2,
          itemCode: "C-002",
          category: "Reinforcement",
          description: "Foundation reinforcement 16 mm",
          specification: "TMT bars grade 500",
          quantity: "6.8",
          unit: "tonne",
          unitCost: "4500",
          marginPercentage: "10",
          sellingRate: "4950",
          totalAmount: "33660",
          wastagePercentage: "0",
          sourceReference: "Structural Plan A-102",
          roomOrZone: "Foundation",
          drawingReference: "DRW-FND-02",
          confidenceScore: "89",
          notes: "Includes binding wire and hooks.",
          options: [],
        },
      ],
    },
  },
  {
    id: seedUuid("50000000", 2),
    projectSlug: "project-interior-002",
    title: "Office Fit-Out BOQ",
    section: {
      id: seedUuid("60000000", 2),
      code: "FLR",
      title: "Flooring",
      description: "Office flooring and floor finishes.",
      items: [
        {
          id: seedUuid("70000000", 3),
          frontendId: "item-101",
          itemNumber: 1,
          itemCode: "I-101",
          category: "Flooring",
          description: "Carpet tile supply and installation",
          specification: "600x600 mm, tufted carpet tiles",
          quantity: "360",
          unit: "m2",
          unitCost: "95",
          marginPercentage: "12",
          sellingRate: "106.4",
          totalAmount: "38304",
          wastagePercentage: "5",
          sourceReference: "Interior Layout B-201",
          roomOrZone: "Office Open Plan",
          drawingReference: "DRW-INT-01",
          confidenceScore: "90",
          notes: "Includes perimeter trims and site allowance.",
          options: [],
        },
      ],
    },
  },
  {
    id: seedUuid("50000000", 3),
    projectSlug: "project-furniture-003",
    title: "Furniture Supply BOQ",
    section: {
      id: seedUuid("60000000", 3),
      code: "EXE",
      title: "Executive Furniture",
      description: "Executive desks and seating.",
      items: [
        {
          id: seedUuid("70000000", 4),
          frontendId: "item-201",
          itemNumber: 1,
          itemCode: "F-201",
          category: "Seating",
          description: "Ergonomic executive chair",
          specification: "Leather finish, adjustable lumbar support",
          quantity: "12",
          unit: "pcs",
          unitCost: "1450",
          marginPercentage: "15",
          sellingRate: "1667.5",
          totalAmount: "20010",
          wastagePercentage: "0",
          sourceReference: "Furniture Schedule F-10",
          roomOrZone: "Executive Offices",
          drawingReference: "DRW-FUR-01",
          confidenceScore: "94",
          notes: "Includes assembly and delivery.",
          options: [
            {
              id: seedUuid("80000000", 1),
              label: "Option A",
              description: "Standard leather upholstery",
              specification: "Standard",
              rate: "0",
              isSelected: true,
            },
            {
              id: seedUuid("80000000", 2),
              label: "Option B",
              description: "Premium leather upholstery",
              specification: "Premium",
              rate: "220",
              isSelected: false,
            },
          ],
        },
      ],
    },
  },
  {
    id: seedUuid("50000000", 4),
    projectSlug: "project-mep-004",
    title: "MEP Upgrade BOQ",
    section: {
      id: seedUuid("60000000", 4),
      code: "ELE",
      title: "Electrical",
      description: "Office power distribution and lighting.",
      items: [
        {
          id: seedUuid("70000000", 5),
          frontendId: "item-301",
          itemNumber: 1,
          itemCode: "MEP-301",
          category: "Cabling",
          description: "Power cable installation 4C x 16 mm2",
          specification: "Copper conductor, XLPE insulation",
          quantity: "180",
          unit: "m",
          unitCost: "33",
          marginPercentage: "10",
          sellingRate: "36.3",
          totalAmount: "6534",
          wastagePercentage: "5",
          sourceReference: "MEP Layout M-102",
          roomOrZone: "Data Center",
          drawingReference: "DRW-MEP-01",
          confidenceScore: "88",
          notes: "Includes containment and terminations.",
          options: [],
        },
      ],
    },
  },
  {
    id: seedUuid("50000000", 5),
    projectSlug: "project-joinery-005",
    title: "Joinery Package BOQ",
    section: {
      id: seedUuid("60000000", 5),
      code: "RCP",
      title: "Reception Counters",
      description: "Reception desk and joinery units.",
      items: [
        {
          id: seedUuid("70000000", 6),
          frontendId: "item-401",
          itemNumber: 1,
          itemCode: "J-401",
          category: "Joinery",
          description: "Reception desk with laminate finish",
          specification: "Oak veneer, integrated cable tray",
          quantity: "1",
          unit: "LS",
          unitCost: "28500",
          marginPercentage: "15",
          sellingRate: "32775",
          totalAmount: "32775",
          wastagePercentage: "0",
          sourceReference: "Joinery Drawings J-10",
          roomOrZone: "Lobby",
          drawingReference: "DRW-JNY-01",
          confidenceScore: "91",
          notes: "Includes installation and edge banding.",
          options: [],
        },
      ],
    },
  },
  {
    id: seedUuid("50000000", 6),
    projectSlug: "project-landscaping-006",
    title: "Landscape Development BOQ",
    section: {
      id: seedUuid("60000000", 6),
      code: "HSC",
      title: "Hardscape",
      description: "Paving and site furnishing works.",
      items: [
        {
          id: seedUuid("70000000", 7),
          frontendId: "item-501",
          itemNumber: 1,
          itemCode: "L-501",
          category: "Hardscape",
          description: "Permeable paving slab installation",
          specification: "600x600 concrete paving slabs",
          quantity: "220",
          unit: "m2",
          unitCost: "210",
          marginPercentage: "12",
          sellingRate: "235.2",
          totalAmount: "51744",
          wastagePercentage: "5",
          sourceReference: "Landscape Plan L-301",
          roomOrZone: "Front Plaza",
          drawingReference: "DRW-LND-01",
          confidenceScore: "87",
          notes: "Includes bedding sand and jointing material.",
          options: [],
        },
      ],
    },
  },
] as const;

const catalogueSeeds = [
  ["construction", "C-001", "Concrete", "25 MPa ready-mix concrete", "m3", "Dubai Concrete", "520", "12", "582.4"],
  ["mep", "M-301", "Cabling", "4C x 16 mm2 power cable", "m", "PowerLine Supplies", "33", "10", "36.3"],
  ["interior-fitout", "I-101", "Flooring", "Commercial carpet tile supply and installation", "m2", "FloorTech UAE", "95", "12", "106.4"],
  ["furniture", "F-201", "Seating", "Ergonomic executive chair", "pcs", "OfficeComfort", "1450", "15", "1667.5"],
  ["electrical", "E-101", "Lighting", "600x600 mm LED panel light, 36 W", "nos", "Gulf Electrical Supplies", "165", "12", "184.8"],
  ["hvac", "H-101", "Diffusers", "Linear slot diffuser supply and installation", "lm", "Climate Systems UAE", "280", "12", "313.6"],
  ["plumbing", "P-101", "Water Supply", "25 mm PPR water supply pipe", "m", "AquaFlow Supplies", "18", "12", "20.16"],
  ["firefighting", "FF-101", "Sprinklers", "Quick-response sprinkler head", "nos", "FireSafe Equipment", "38", "12", "42.56"],
  ["joinery", "J-401", "Joinery", "Reception desk with oak veneer finish", "LS", "WoodCraft UAE", "28500", "15", "32775"],
  ["landscaping", "L-501", "Hardscape", "600x600 permeable concrete paving slabs", "m2", "GreenScape Materials", "210", "12", "235.2"],
] as const;

async function seedCompany(): Promise<string> {
  const companyId = getDevelopmentCompanyId();
  await prisma.company.upsert({
    where: { id: companyId },
    update: {},
    create: {
      id: companyId,
      legalName: "Quantara AI Development Workspace",
      tradeName: "Quantara AI",
      email: "development@quantara.local",
      phone: null,
      website: null,
      address: "Dubai, United Arab Emirates",
      taxRegistrationNumber: null,
      defaultCurrency: "AED",
      vatRate: decimal(5),
      defaultLanguage: "English",
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    },
  });
  return companyId;
}

async function seedIndustries(companyId: string): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const key of INDUSTRY_KEYS) {
    const ordinal = INDUSTRY_KEYS.indexOf(key) + 1;
    const source = demoIndustries.find((industry) => industry.id === key);
    if (!source) {
      throw new Error(`Frontend industry configuration is missing: ${key}`);
    }

    const industry = await prisma.industryEngine.upsert({
      where: { key },
      update: {
        name: source.name,
        description: source.description,
        isActive: source.status === "active",
        configJson: json(source),
        updatedAt: UPDATED_AT,
      },
      create: {
        id: seedUuid("10000000", ordinal),
        key,
        name: source.name,
        description: source.description,
        isActive: source.status === "active",
        configJson: json(source),
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    ids.set(key, industry.id);
    await prisma.companyIndustryEngine.upsert({
      where: {
        companyId_industryEngineId: {
          companyId,
          industryEngineId: industry.id,
        },
      },
      update: {},
      create: {
        id: seedUuid("20000000", ordinal),
        companyId,
        industryEngineId: industry.id,
        enabled: true,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });
  }

  return ids;
}

async function seedClients(companyId: string): Promise<void> {
  for (const seed of clientSeeds) {
    const data = {
      companyId,
      name: seed.name,
      companyName: seed.companyName,
      email: seed.email,
      phone: seed.phone,
      address: seed.address,
      updatedAt: UPDATED_AT,
    };
    await prisma.client.upsert({
      where: { id: seed.id },
      update: {},
      create: { id: seed.id, ...data, createdAt: CREATED_AT },
    });
  }
}

async function seedProjects(
  companyId: string,
  industryIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const seed of projectSeeds) {
    const data = {
      clientId: seed.clientId,
      industryEngineId: requiredId(industryIds, seed.industryKey, "industry"),
      slug: seed.slug,
      reference: seed.reference,
      name: seed.name,
      description: seed.description,
      location: seed.location,
      currency: "AED",
      taxRate: decimal(5),
      language: "English",
      status: seed.status,
      currentRevisionNumber: 1,
      updatedAt: UPDATED_AT,
    };
    const project = await prisma.project.upsert({
      where: { companyId_slug: { companyId, slug: seed.slug } },
      update: {},
      create: {
        id: seed.id,
        companyId,
        ...data,
        createdAt: CREATED_AT,
      },
    });
    ids.set(seed.slug, project.id);
  }

  return ids;
}

async function seedBOQs(
  companyId: string,
  projectIds: Map<string, string>,
): Promise<{ boqIds: Map<string, string>; itemIds: Map<string, string> }> {
  const boqIds = new Map<string, string>();
  const itemIds = new Map<string, string>();

  for (const seed of boqSeeds) {
    const projectId = requiredId(projectIds, seed.projectSlug, "project");
    const boq = await prisma.bOQ.upsert({
      where: { projectId_revisionNumber: { projectId, revisionNumber: 1 } },
      update: {},
      create: {
        id: seed.id,
        companyId,
        projectId,
        title: seed.title,
        revisionNumber: 1,
        status: BOQStatus.DRAFT,
        isLocked: false,
        lockedAt: null,
        approvedByName: null,
        discountPercentage: decimal(0),
        taxRate: decimal(5),
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });
    boqIds.set(seed.projectSlug, boq.id);

    const section = await prisma.bOQSection.upsert({
      where: { boqId_code: { boqId: boq.id, code: seed.section.code } },
      update: {},
      create: {
        id: seed.section.id,
        companyId,
        boqId: boq.id,
        code: seed.section.code,
        title: seed.section.title,
        description: seed.section.description,
        sortOrder: 1,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });

    for (const itemSeed of seed.section.items) {
      const itemData = {
        companyId,
        sectionId: section.id,
        itemNumber: itemSeed.itemNumber,
        itemCode: itemSeed.itemCode,
        category: itemSeed.category,
        description: itemSeed.description,
        specification: itemSeed.specification,
        quantity: decimal(itemSeed.quantity),
        unit: itemSeed.unit,
        unitCost: decimal(itemSeed.unitCost),
        freightCost: decimal(0),
        installationCost: decimal(0),
        additionalCost: decimal(0),
        landedCost: decimal(itemSeed.unitCost),
        marginMode: MarginMode.MARKUP,
        marginPercentage: decimal(itemSeed.marginPercentage),
        sellingRate: decimal(itemSeed.sellingRate),
        totalAmount: decimal(itemSeed.totalAmount),
        wastagePercentage: decimal(itemSeed.wastagePercentage),
        taxApplicable: true,
        sourceReference: itemSeed.sourceReference,
        roomOrZone: itemSeed.roomOrZone,
        drawingReference: itemSeed.drawingReference,
        confidenceScore: decimal(itemSeed.confidenceScore),
        status: BOQItemStatus.CONFIRMED,
        notes: itemSeed.notes,
        sortOrder: itemSeed.itemNumber,
        updatedAt: UPDATED_AT,
      };
      const item = await prisma.bOQItem.upsert({
        where: { id: itemSeed.id },
        update: {},
        create: { id: itemSeed.id, ...itemData, createdAt: CREATED_AT },
      });
      itemIds.set(itemSeed.frontendId, item.id);

      for (const option of itemSeed.options) {
        const optionData = {
          companyId,
          boqItemId: item.id,
          label: option.label,
          description: option.description,
          specification: option.specification,
          rate: decimal(option.rate),
          isSelected: option.isSelected,
          updatedAt: UPDATED_AT,
        };
        await prisma.bOQItemOption.upsert({
          where: { boqItemId_label: { boqItemId: item.id, label: option.label } },
          update: {},
          create: { id: option.id, ...optionData, createdAt: CREATED_AT },
        });
      }
    }
  }

  return { boqIds, itemIds };
}

async function seedCatalogue(
  companyId: string,
  industryIds: Map<string, string>,
): Promise<void> {
  for (const [index, seed] of catalogueSeeds.entries()) {
    const [industryKey, itemCode, category, description, unit, supplier, cost, margin, sellingRate] = seed;
    const industryEngineId = requiredId(industryIds, industryKey, "industry");
    const data = {
      companyId,
      industryEngineId,
      itemCode,
      category,
      description,
      unit,
      supplier,
      cost: decimal(cost),
      defaultMargin: decimal(margin),
      sellingRate: decimal(sellingRate),
      currency: "AED",
      effectiveDate: EFFECTIVE_AT,
      expiryDate: null,
      status: RateStatus.ACTIVE,
      updatedAt: UPDATED_AT,
    };
    await prisma.rateCatalogueItem.upsert({
      where: {
        companyId_industryEngineId_itemCode_effectiveDate: {
          companyId,
          industryEngineId,
          itemCode,
          effectiveDate: EFFECTIVE_AT,
        },
      },
      update: {},
      create: {
        id: seedUuid("90000000", index + 1),
        ...data,
        createdAt: CREATED_AT,
      },
    });
  }
}

async function seedVerificationExamples(
  companyId: string,
  boqIds: Map<string, string>,
  itemIds: Map<string, string>,
): Promise<void> {
  const examples = [
    {
      id: seedUuid("a0000000", 1),
      boqId: requiredId(boqIds, "project-construction-001", "BOQ"),
      boqItemId: requiredId(itemIds, "item-001", "BOQ item"),
      type: "QUANTITY_MISMATCH",
      severity: VerificationSeverity.CRITICAL,
      message: "Quantity mismatch in structural foundation concrete.",
      currentValue: "45.0000 m3",
      suggestedValue: "Review the source drawing dimensions before issue.",
      resolutionNote: null,
      resolved: false,
      resolvedAt: null,
    },
    {
      id: seedUuid("a0000000", 2),
      boqId: requiredId(boqIds, "project-construction-001", "BOQ"),
      boqItemId: requiredId(itemIds, "item-002", "BOQ item"),
      type: "SUPPLIER_RATE_REVIEW",
      severity: VerificationSeverity.WARNING,
      message: "Confirm the reinforcement supplier rate before issuing this BOQ.",
      currentValue: "AED 4,500.0000 per tonne",
      suggestedValue: "Validate against the current approved supplier quotation.",
      resolutionNote: null,
      resolved: false,
      resolvedAt: null,
    },
    {
      id: seedUuid("a0000000", 3),
      boqId: requiredId(boqIds, "project-furniture-003", "BOQ"),
      boqItemId: requiredId(itemIds, "item-201", "BOQ item"),
      type: "OPTION_SPECIFICATION_REVIEW",
      severity: VerificationSeverity.INFO,
      message: "Furniture option specifications were reviewed for client clarity.",
      currentValue: "Standard and premium upholstery options",
      suggestedValue: null,
      resolutionNote: "Both option specifications are present in the seeded BOQ.",
      resolved: true,
      resolvedAt: UPDATED_AT,
    },
  ] as const;

  for (const example of examples) {
    const { id, ...data } = example;
    await prisma.verificationException.upsert({
      where: { id },
      update: {},
      create: {
        id,
        ...data,
        companyId,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });
  }
}

async function seedOwnerUser(companyId: string): Promise<void> {
  const email = (process.env.DEV_OWNER_EMAIL ?? "owner@quantara.local").toLowerCase();
  const password = process.env.DEV_OWNER_PASSWORD ?? "QuantaraDev#2026";
  const fullName = process.env.DEV_OWNER_NAME ?? "Quantara Development Owner";

  if (!process.env.DEV_OWNER_EMAIL || !process.env.DEV_OWNER_PASSWORD) {
    console.warn(
      "[seed] DEV_OWNER_EMAIL / DEV_OWNER_PASSWORD not set in the environment; " +
        `using the default development owner (${email}). Set both in .env for a real credential.`,
    );
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      id: seedUuid("c0000000", 1),
      companyId,
      email,
      passwordHash,
      fullName,
      role: UserRole.COMPANY_OWNER,
      emailVerifiedAt: CREATED_AT,
      isActive: true,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    },
  });
}

async function seedAuditLogs(
  companyId: string,
  boqIds: Map<string, string>,
): Promise<void> {
  for (const [index, seed] of projectSeeds.entries()) {
    const boqId = requiredId(boqIds, seed.slug, "BOQ");
    await prisma.auditLog.upsert({
      where: { id: seedUuid("b0000000", index + 1) },
      update: {},
      create: {
        id: seedUuid("b0000000", index + 1),
        companyId,
        entityType: "BOQ",
        entityId: boqId,
        action: "BOQ_CREATED",
        payloadJson: json({ revisionNumber: 1, seeded: true }),
        actorName: "Quantara Seed",
        createdAt: CREATED_AT,
      },
    });
  }
}

async function main(): Promise<void> {
  const companyId = await seedCompany();
  const industryIds = await seedIndustries(companyId);
  await seedClients(companyId);
  const projectIds = await seedProjects(companyId, industryIds);
  const { boqIds, itemIds } = await seedBOQs(companyId, projectIds);
  await seedCatalogue(companyId, industryIds);
  await seedVerificationExamples(companyId, boqIds, itemIds);
  await seedAuditLogs(companyId, boqIds);
  await seedOwnerUser(companyId);

  console.log(
    `Seeded Quantara development tenant with ${INDUSTRY_KEYS.length} industries and ${projectSeeds.length} projects.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Quantara seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
