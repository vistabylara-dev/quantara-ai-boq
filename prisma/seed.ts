import {
  BOQItemStatus,
  BOQStatus,
  DocumentTemplateType,
  MarginMode,
  Prisma,
  PrismaClient,
  ProjectStatus,
  RateStatus,
  UserRole,
  VerificationSeverity,
} from "@prisma/client";
import { demoIndustries } from "../src/config/industries/index";
import { seedMechanicalDiscipline, seedTaxonomyFoundations } from "./seed-data/master-data";
import { seedMechanicalPackage, seedSoftwarePlans } from "./seed-data/commercial";
import { getDevelopmentCompanyId } from "../src/lib/tenancy/development-company";
import { hashPassword } from "../src/lib/auth/password";
import { calculateLandedCost, calculateSellingRate } from "../src/lib/calculations/boq-calculator";
import {
  DEFAULT_CONTENT_CONFIG,
  DEFAULT_STYLE_CONFIG,
  type DocumentTemplateContentConfig,
  type DocumentTemplateStyleConfig,
} from "../src/lib/documents/template-config";

const prisma = new PrismaClient();

const CREATED_AT = new Date("2026-01-01T08:00:00.000Z");
const UPDATED_AT = new Date("2026-01-15T12:00:00.000Z");

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

type SupplierSeed = {
  key: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  defaultCurrency: string;
  paymentTerms: string;
  leadTimeDays: number;
};

const supplierSeeds: SupplierSeed[] = [
  { key: "dubai-concrete-steel", name: "Dubai Concrete & Steel Co", contactPerson: "Ahmed Al Marzooqi", email: "sales@dubaiconcretesteel.ae", phone: "+971-4-555-0101", defaultCurrency: "AED", paymentTerms: "Net 30", leadTimeDays: 7 },
  { key: "gulf-waterproofing-formwork", name: "Gulf Waterproofing & Formwork", contactPerson: "Sara Haddad", email: "quotes@gulfwaterproofing.ae", phone: "+971-4-555-0102", defaultCurrency: "AED", paymentTerms: "Net 30", leadTimeDays: 10 },
  { key: "emirates-interior-materials", name: "Emirates Interior Materials", contactPerson: "Rania Youssef", email: "info@emiratesinteriors.ae", phone: "+971-4-555-0103", defaultCurrency: "AED", paymentTerms: "Net 45", leadTimeDays: 14 },
  { key: "officecomfort-furniture", name: "OfficeComfort Furniture", contactPerson: "David Lopes", email: "orders@officecomfort.ae", phone: "+971-4-555-0104", defaultCurrency: "AED", paymentTerms: "Net 30", leadTimeDays: 21 },
  { key: "climate-systems-uae", name: "Climate Systems UAE", contactPerson: "Faisal Rahman", email: "sales@climatesystems.ae", phone: "+971-4-555-0105", defaultCurrency: "AED", paymentTerms: "Net 30", leadTimeDays: 28 },
  { key: "powerline-supplies", name: "PowerLine Supplies", contactPerson: "Michael Tan", email: "sales@powerlinesupplies.ae", phone: "+971-4-555-0106", defaultCurrency: "AED", paymentTerms: "Net 30", leadTimeDays: 10 },
  { key: "aquaflow-supplies", name: "AquaFlow Supplies", contactPerson: "Hassan Ali", email: "info@aquaflowsupplies.ae", phone: "+971-4-555-0107", defaultCurrency: "AED", paymentTerms: "Net 15", leadTimeDays: 7 },
  { key: "woodcraft-uae", name: "WoodCraft UAE", contactPerson: "Layla Nasser", email: "sales@woodcraft.ae", phone: "+971-4-555-0108", defaultCurrency: "AED", paymentTerms: "Net 30", leadTimeDays: 18 },
  { key: "greenscape-materials", name: "GreenScape Materials", contactPerson: "Omar Suleiman", email: "sales@greenscape.ae", phone: "+971-4-555-0109", defaultCurrency: "AED", paymentTerms: "Net 30", leadTimeDays: 14 },
  { key: "irritech-systems", name: "IrriTech Systems", contactPerson: "Noura Khalid", email: "info@irritech.ae", phone: "+971-4-555-0110", defaultCurrency: "AED", paymentTerms: "Net 30", leadTimeDays: 10 },
  { key: "lumascape-lighting", name: "LumaScape Lighting", contactPerson: "Karim Fathy", email: "sales@lumascape.ae", phone: "+971-4-555-0111", defaultCurrency: "AED", paymentTerms: "Net 30", leadTimeDays: 21 },
];

type CatalogueStatusKind = "ACTIVE" | "EXPIRED" | "PENDING";

type CatalogueSeed = {
  industryKey: string;
  itemCode: string;
  category: string;
  description: string;
  unit: string;
  supplierKey: string;
  baseCost: string;
  freightCost: string;
  installationCost: string;
  defaultMargin: string;
  statusKind: CatalogueStatusKind;
  minimumSellingRate?: string;
};

const catalogueSeeds: CatalogueSeed[] = [
  // Construction
  { industryKey: "construction", itemCode: "CON-CONC-25", category: "Concrete", description: "25 MPa ready-mix concrete", unit: "m3", supplierKey: "dubai-concrete-steel", baseCost: "480", freightCost: "20", installationCost: "0", defaultMargin: "12", statusKind: "ACTIVE" },
  { industryKey: "construction", itemCode: "CON-REBAR-12", category: "Reinforcement", description: "High-yield reinforcement steel 12 mm", unit: "tonne", supplierKey: "dubai-concrete-steel", baseCost: "2380", freightCost: "90", installationCost: "0", defaultMargin: "18", statusKind: "ACTIVE" },
  { industryKey: "construction", itemCode: "CON-BLOCK-200", category: "Blockwork", description: "200 mm concrete block wall", unit: "m2", supplierKey: "dubai-concrete-steel", baseCost: "65", freightCost: "5", installationCost: "15", defaultMargin: "15", statusKind: "ACTIVE" },
  { industryKey: "construction", itemCode: "CON-WP-TORCH", category: "Waterproofing", description: "Torch-applied bituminous waterproof membrane", unit: "m2", supplierKey: "gulf-waterproofing-formwork", baseCost: "45", freightCost: "3", installationCost: "12", defaultMargin: "18", statusKind: "EXPIRED" },
  { industryKey: "construction", itemCode: "CON-FORM-PLY", category: "Formwork", description: "Plywood formwork system", unit: "m2", supplierKey: "gulf-waterproofing-formwork", baseCost: "35", freightCost: "2", installationCost: "8", defaultMargin: "15", statusKind: "PENDING" },

  // Interior fit-out
  { industryKey: "interior-fitout", itemCode: "INT-GYP-125", category: "Gypsum Board", description: "12.5 mm gypsum wallboard", unit: "m2", supplierKey: "emirates-interior-materials", baseCost: "28", freightCost: "2", installationCost: "10", defaultMargin: "15", statusKind: "ACTIVE" },
  { industryKey: "interior-fitout", itemCode: "INT-CARPET-600", category: "Flooring", description: "Carpet tile 600x600 mm", unit: "m2", supplierKey: "emirates-interior-materials", baseCost: "85", freightCost: "5", installationCost: "15", defaultMargin: "12", statusKind: "ACTIVE" },
  { industryKey: "interior-fitout", itemCode: "INT-GLASS-PART", category: "Glass Partition", description: "10 mm tempered glass partition", unit: "m2", supplierKey: "emirates-interior-materials", baseCost: "320", freightCost: "15", installationCost: "45", defaultMargin: "18", statusKind: "ACTIVE" },
  { industryKey: "interior-fitout", itemCode: "INT-PAINT-EMUL", category: "Painting", description: "Emulsion paint, three coats", unit: "m2", supplierKey: "emirates-interior-materials", baseCost: "12", freightCost: "1", installationCost: "6", defaultMargin: "20", statusKind: "EXPIRED" },
  { industryKey: "interior-fitout", itemCode: "INT-CEIL-GRID", category: "Ceiling System", description: "Suspended ceiling grid with tiles", unit: "m2", supplierKey: "emirates-interior-materials", baseCost: "55", freightCost: "3", installationCost: "18", defaultMargin: "15", statusKind: "PENDING" },

  // Furniture
  { industryKey: "furniture", itemCode: "FUR-DESK-EXEC", category: "Executive Furniture", description: "Executive desk 1800x900 mm", unit: "pcs", supplierKey: "officecomfort-furniture", baseCost: "1850", freightCost: "80", installationCost: "50", defaultMargin: "18", statusKind: "ACTIVE" },
  { industryKey: "furniture", itemCode: "FUR-CHAIR-TASK", category: "Seating", description: "Ergonomic task chair", unit: "pcs", supplierKey: "officecomfort-furniture", baseCost: "620", freightCost: "30", installationCost: "0", defaultMargin: "20", statusKind: "ACTIVE", minimumSellingRate: "820" },
  { industryKey: "furniture", itemCode: "FUR-WS-1200", category: "Workstations", description: "1200 mm workstation with screen", unit: "pcs", supplierKey: "officecomfort-furniture", baseCost: "1450", freightCost: "60", installationCost: "40", defaultMargin: "15", statusKind: "ACTIVE" },
  { industryKey: "furniture", itemCode: "FUR-TABLE-MEET", category: "Meeting Rooms", description: "Meeting table, seats eight", unit: "pcs", supplierKey: "officecomfort-furniture", baseCost: "3200", freightCost: "150", installationCost: "100", defaultMargin: "16", statusKind: "EXPIRED" },
  { industryKey: "furniture", itemCode: "FUR-CAB-FILE", category: "Storage", description: "4-drawer filing cabinet", unit: "pcs", supplierKey: "officecomfort-furniture", baseCost: "780", freightCost: "40", installationCost: "0", defaultMargin: "18", statusKind: "PENDING" },

  // MEP
  { industryKey: "mep", itemCode: "MEP-FCU-2T", category: "Mechanical", description: "Fan coil unit, 2 ton", unit: "nos", supplierKey: "climate-systems-uae", baseCost: "2100", freightCost: "120", installationCost: "250", defaultMargin: "15", statusKind: "ACTIVE" },
  { industryKey: "mep", itemCode: "MEP-AHU-5000", category: "Mechanical", description: "Air handling unit, 5000 CFM", unit: "nos", supplierKey: "climate-systems-uae", baseCost: "18500", freightCost: "800", installationCost: "1200", defaultMargin: "12", statusKind: "ACTIVE" },
  { industryKey: "mep", itemCode: "MEP-CABLE-4C25", category: "Electrical", description: "4C x 25 mm2 XLPE power cable", unit: "m", supplierKey: "powerline-supplies", baseCost: "42", freightCost: "2", installationCost: "8", defaultMargin: "10", statusKind: "ACTIVE" },
  { industryKey: "mep", itemCode: "MEP-PIPE-PPR32", category: "Plumbing", description: "32 mm PPR pipe", unit: "m", supplierKey: "aquaflow-supplies", baseCost: "22", freightCost: "1", installationCost: "6", defaultMargin: "12", statusKind: "EXPIRED" },
  { industryKey: "mep", itemCode: "MEP-DIFF-600", category: "HVAC", description: "600x600 linear diffuser", unit: "nos", supplierKey: "climate-systems-uae", baseCost: "165", freightCost: "10", installationCost: "25", defaultMargin: "15", statusKind: "PENDING" },

  // Joinery
  { industryKey: "joinery", itemCode: "JNY-MDF-18", category: "MDF Board", description: "18 mm MDF board", unit: "m2", supplierKey: "woodcraft-uae", baseCost: "48", freightCost: "3", installationCost: "0", defaultMargin: "15", statusKind: "ACTIVE" },
  { industryKey: "joinery", itemCode: "JNY-VENEER-OAK", category: "Veneer", description: "Natural oak veneer", unit: "m2", supplierKey: "woodcraft-uae", baseCost: "95", freightCost: "5", installationCost: "20", defaultMargin: "18", statusKind: "ACTIVE" },
  { industryKey: "joinery", itemCode: "JNY-LAM-HPL", category: "Laminate", description: "High-pressure laminate finish", unit: "m2", supplierKey: "woodcraft-uae", baseCost: "65", freightCost: "4", installationCost: "15", defaultMargin: "16", statusKind: "ACTIVE" },
  { industryKey: "joinery", itemCode: "JNY-HW-HINGE", category: "Hardware", description: "Soft-close cabinet hinge set", unit: "set", supplierKey: "woodcraft-uae", baseCost: "35", freightCost: "2", installationCost: "0", defaultMargin: "25", statusKind: "EXPIRED" },
  { industryKey: "joinery", itemCode: "JNY-INSTALL-LS", category: "Installation", description: "Joinery installation labor", unit: "LS", supplierKey: "woodcraft-uae", baseCost: "5000", freightCost: "0", installationCost: "0", defaultMargin: "20", statusKind: "PENDING" },

  // Landscaping
  { industryKey: "landscaping", itemCode: "LND-TREE-PALM", category: "Trees", description: "Mature date palm tree", unit: "nos", supplierKey: "greenscape-materials", baseCost: "850", freightCost: "100", installationCost: "150", defaultMargin: "15", statusKind: "ACTIVE" },
  { industryKey: "landscaping", itemCode: "LND-TURF-NAT", category: "Turf", description: "Natural grass turf", unit: "m2", supplierKey: "greenscape-materials", baseCost: "18", freightCost: "2", installationCost: "5", defaultMargin: "12", statusKind: "ACTIVE" },
  { industryKey: "landscaping", itemCode: "LND-IRR-PIPE20", category: "Irrigation", description: "20 mm irrigation drip pipe", unit: "m", supplierKey: "irritech-systems", baseCost: "8", freightCost: "1", installationCost: "3", defaultMargin: "15", statusKind: "ACTIVE" },
  { industryKey: "landscaping", itemCode: "LND-PAVE-600", category: "Hardscape", description: "600x600 concrete paving slab", unit: "m2", supplierKey: "greenscape-materials", baseCost: "195", freightCost: "12", installationCost: "40", defaultMargin: "12", statusKind: "EXPIRED" },
  { industryKey: "landscaping", itemCode: "LND-LIGHT-LED", category: "Landscape Lighting", description: "LED bollard light", unit: "nos", supplierKey: "lumascape-lighting", baseCost: "320", freightCost: "20", installationCost: "60", defaultMargin: "18", statusKind: "PENDING" },
];

async function seedCompany(): Promise<string> {
  const companyId = getDevelopmentCompanyId();
  await prisma.company.upsert({
    where: { id: companyId },
    update: {
      // Backfilled on every reseed (not just at creation) so an existing dev
      // database picks up a complete profile without a manual reset —
      // document generation for CLIENT audiences requires this field.
      taxRegistrationNumber: "100123456700003",
    },
    create: {
      id: companyId,
      legalName: "Quantara AI Development Workspace",
      tradeName: "Quantara AI",
      email: "development@quantara.local",
      phone: "+971-4-555-0100",
      website: "quantara.ai",
      address: "Dubai, United Arab Emirates",
      taxRegistrationNumber: "100123456700003",
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

async function seedSuppliers(companyId: string): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const [index, seed] of supplierSeeds.entries()) {
    const supplier = await prisma.supplier.upsert({
      where: { id: seedUuid("b1000000", index + 1) },
      update: {},
      create: {
        id: seedUuid("b1000000", index + 1),
        companyId,
        name: seed.name,
        contactPerson: seed.contactPerson,
        email: seed.email,
        phone: seed.phone,
        defaultCurrency: seed.defaultCurrency,
        paymentTerms: seed.paymentTerms,
        leadTimeDays: seed.leadTimeDays,
        isActive: true,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });
    ids.set(seed.key, supplier.id);
  }
  return ids;
}

function statusDateRange(kind: CatalogueStatusKind): { effectiveDate: Date; expiryDate: Date | null } {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (kind) {
    case "ACTIVE":
      return { effectiveDate: new Date(now - 30 * day), expiryDate: new Date(now + 90 * day) };
    case "EXPIRED":
      return { effectiveDate: new Date(now - 120 * day), expiryDate: new Date(now - 10 * day) };
    case "PENDING":
      return { effectiveDate: new Date(now + 14 * day), expiryDate: null };
  }
}

async function seedCatalogue(
  companyId: string,
  industryIds: Map<string, string>,
  supplierIds: Map<string, string>,
): Promise<void> {
  for (const [index, seed] of catalogueSeeds.entries()) {
    const industryEngineId = requiredId(industryIds, seed.industryKey, "industry");
    const supplierId = requiredId(supplierIds, seed.supplierKey, "supplier");
    const { effectiveDate, expiryDate } = statusDateRange(seed.statusKind);

    const landedCost = calculateLandedCost({
      unitCost: seed.baseCost,
      freightCost: seed.freightCost,
      installationCost: seed.installationCost,
    });
    const sellingRate = calculateSellingRate(landedCost, MarginMode.MARKUP, seed.defaultMargin);

    const data = {
      companyId,
      industryEngineId,
      supplierId,
      itemCode: seed.itemCode,
      category: seed.category,
      description: seed.description,
      unit: seed.unit,
      baseCost: decimal(seed.baseCost),
      freightCost: decimal(seed.freightCost),
      installationCost: decimal(seed.installationCost),
      additionalCost: decimal(0),
      landedCost,
      marginMode: MarginMode.MARKUP,
      defaultMargin: decimal(seed.defaultMargin),
      sellingRate,
      minimumSellingRate: seed.minimumSellingRate ? decimal(seed.minimumSellingRate) : null,
      currency: "AED",
      effectiveDate,
      expiryDate,
      status: seed.statusKind as RateStatus,
      updatedAt: UPDATED_AT,
    };
    await prisma.rateCatalogueItem.upsert({
      where: { companyId_itemCode: { companyId, itemCode: seed.itemCode } },
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

type TemplateSeed = {
  key: string;
  industryKey: string | null;
  name: string;
  code: string;
  type: DocumentTemplateType;
  description: string;
  style: Partial<DocumentTemplateStyleConfig>;
  content: Partial<DocumentTemplateContentConfig>;
};

const templateSeeds: TemplateSeed[] = [
  {
    key: "corporate-technical",
    industryKey: null,
    name: "Corporate Technical",
    code: "corporate-technical",
    type: DocumentTemplateType.CORPORATE_TECHNICAL,
    description: "Clean, formal BOQ document for construction, consultancy, and general technical submissions.",
    style: { direction: "ltr", coverStyle: "light", primaryColor: "#0B1D3A", accentColor: "#2563EB", fontFamily: "sans" },
    content: {},
  },
  {
    key: "executive-premium",
    industryKey: null,
    name: "Executive Premium",
    code: "executive-premium",
    type: DocumentTemplateType.EXECUTIVE_PREMIUM,
    description: "Premium proposal layout for luxury fit-out and executive client submissions.",
    style: { direction: "ltr", coverStyle: "dark", primaryColor: "#111827", accentColor: "#D4AF37", fontFamily: "sans" },
    content: { showExclusionsSection: false, columns: { ...DEFAULT_CONTENT_CONFIG.columns, notes: false } },
  },
  {
    key: "furniture-catalogue",
    industryKey: "furniture",
    name: "Furniture Catalogue",
    code: "furniture-catalogue",
    type: DocumentTemplateType.FURNITURE_CATALOGUE,
    description: "Catalogue-style layout for furniture packages: item, specification, quantity, and rate per piece.",
    style: { direction: "ltr", coverStyle: "light", primaryColor: "#1F2937", accentColor: "#B45309", fontFamily: "sans" },
    content: { columns: { ...DEFAULT_CONTENT_CONFIG.columns, brandModel: true } },
  },
  {
    key: "mep-tender",
    industryKey: "mep",
    name: "MEP Tender",
    code: "mep-tender",
    type: DocumentTemplateType.MEP_TENDER,
    description: "Dense technical tender format for MEP submissions, grouped by discipline and system.",
    style: { direction: "ltr", coverStyle: "light", primaryColor: "#0F172A", accentColor: "#0EA5E9", fontFamily: "sans" },
    content: { denseTechnicalTable: true },
  },
  {
    key: "arabic-formal",
    industryKey: null,
    name: "Arabic Formal",
    code: "arabic-formal",
    type: DocumentTemplateType.ARABIC_FORMAL,
    description: "Right-to-left Arabic BOQ document with mirrored layout and Arabic-capable typography.",
    style: { direction: "rtl", coverStyle: "dark", primaryColor: "#0B1D3A", accentColor: "#2563EB", fontFamily: "arabic-naskh" },
    content: {},
  },
  {
    key: "minimal-client-summary",
    industryKey: null,
    name: "Minimal Client Summary",
    code: "minimal-client-summary",
    type: DocumentTemplateType.CORPORATE_TECHNICAL,
    description: "No cover page, fewer columns — a fast, clean quote for a client reading on their phone.",
    style: { direction: "ltr", coverStyle: "none", primaryColor: "#0B1D3A", accentColor: "#2563EB", fontFamily: "sans" },
    content: {
      showCoverPage: false,
      showExclusionsSection: false,
      columns: { ...DEFAULT_CONTENT_CONFIG.columns, drawingReference: false, notes: false },
    },
  },
  {
    key: "internal-cost-review",
    industryKey: null,
    name: "Internal Cost Review",
    code: "internal-cost-review",
    type: DocumentTemplateType.CORPORATE_TECHNICAL,
    description: "Dense table with full cost and margin breakdown — for internal review only, never send to a client.",
    style: { direction: "ltr", coverStyle: "light", primaryColor: "#0F172A", accentColor: "#0EA5E9", fontFamily: "sans" },
    content: {
      denseTechnicalTable: true,
      showInternalCostFieldsToClient: true,
      columns: { ...DEFAULT_CONTENT_CONFIG.columns, brandModel: true },
    },
  },
];

async function seedDocumentTemplates(companyId: string, industryIds: Map<string, string>): Promise<void> {
  for (const [index, seed] of templateSeeds.entries()) {
    const industryEngineId = seed.industryKey ? requiredId(industryIds, seed.industryKey, "IndustryEngine") : null;
    const id = seedUuid("d0000000", index + 1);
    await prisma.documentTemplate.upsert({
      where: { id },
      update: {},
      create: {
        id,
        companyId,
        industryEngineId,
        name: seed.name,
        code: seed.code,
        type: seed.type,
        description: seed.description,
        styleConfigJson: json({ ...DEFAULT_STYLE_CONFIG, ...seed.style }),
        contentConfigJson: json({ ...DEFAULT_CONTENT_CONFIG, ...seed.content }),
        isDefault: true,
        isActive: true,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });
  }
}

const DEFAULT_ENGLISH_SUBJECT = "BOQ Submission – {{projectName}} – {{boqReference}}";

const DEFAULT_ENGLISH_BODY_TEXT = `Dear {{clientName}},

Thank you for the opportunity to submit our proposal for {{projectName}}.

Please review the Bill of Quantities using the secure link below:

{{secureReviewUrl}}

Through the proposal portal, you may:

- Review the proposed scope and commercial value
- Select available product or material options
- Add comments or clarification requests
- Approve the proposal or request a revision
- Download authorized proposal documents

Proposal reference:
{{boqReference}}

Revision:
{{revision}}

Validity date:
{{proposalValidityDate}}

Grand total:
{{currency}} {{grandTotal}}

Please note that quantities and pricing remain subject to the stated terms, exclusions, approved drawings, selected materials, and confirmed project conditions.

Kind regards,

{{senderName}}
{{companyName}}
{{senderEmail}}`;

const DEFAULT_ENGLISH_BODY_HTML = `<div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
<p>Dear {{clientName}},</p>
<p>Thank you for the opportunity to submit our proposal for {{projectName}}.</p>
<p>Please review the Bill of Quantities using the secure link below:</p>
<p><a href="{{secureReviewUrl}}">{{secureReviewUrl}}</a></p>
<p>Through the proposal portal, you may:</p>
<ul>
<li>Review the proposed scope and commercial value</li>
<li>Select available product or material options</li>
<li>Add comments or clarification requests</li>
<li>Approve the proposal or request a revision</li>
<li>Download authorized proposal documents</li>
</ul>
<p>Proposal reference: <strong>{{boqReference}}</strong><br />
Revision: <strong>{{revision}}</strong><br />
Validity date: <strong>{{proposalValidityDate}}</strong><br />
Grand total: <strong>{{currency}} {{grandTotal}}</strong></p>
<p style="color:#64748b;font-size:12px;">Please note that quantities and pricing remain subject to the stated terms, exclusions, approved drawings, selected materials, and confirmed project conditions.</p>
<p>Kind regards,<br />
{{senderName}}<br />
{{companyName}}<br />
{{senderEmail}}</p>
</div>`;

const DEFAULT_ARABIC_SUBJECT = "عرض الأسعار – {{projectName}} – {{boqReference}}";

const DEFAULT_ARABIC_BODY_TEXT = `عزيزي {{clientName}}،

شكراً لإتاحة الفرصة لتقديم عرضنا لمشروع {{projectName}}.

يرجى مراجعة كشف الكميات عبر الرابط الآمن أدناه:

{{secureReviewUrl}}

مرجع العرض: {{boqReference}}
المراجعة: {{revision}}
تاريخ الصلاحية: {{proposalValidityDate}}
الإجمالي الكلي: {{currency}} {{grandTotal}}

مع خالص التقدير،
{{senderName}}
{{companyName}}
{{senderEmail}}`;

const DEFAULT_ARABIC_BODY_HTML = `<div dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif; color: #0f172a; line-height: 1.8; text-align: right;">
<p>عزيزي {{clientName}}،</p>
<p>شكراً لإتاحة الفرصة لتقديم عرضنا لمشروع {{projectName}}.</p>
<p>يرجى مراجعة كشف الكميات عبر الرابط الآمن أدناه:</p>
<p><a href="{{secureReviewUrl}}">{{secureReviewUrl}}</a></p>
<p>مرجع العرض: <strong>{{boqReference}}</strong><br />
المراجعة: <strong>{{revision}}</strong><br />
تاريخ الصلاحية: <strong>{{proposalValidityDate}}</strong><br />
الإجمالي الكلي: <strong>{{currency}} {{grandTotal}}</strong></p>
<p>مع خالص التقدير،<br />
{{senderName}}<br />
{{companyName}}<br />
{{senderEmail}}</p>
</div>`;

async function seedEmailTemplates(companyId: string): Promise<void> {
  await prisma.emailTemplate.upsert({
    where: { id: seedUuid("e0000000", 1) },
    update: {},
    create: {
      id: seedUuid("e0000000", 1),
      companyId,
      name: "Default Proposal Email",
      code: "default-proposal-english",
      subject: DEFAULT_ENGLISH_SUBJECT,
      bodyHtml: DEFAULT_ENGLISH_BODY_HTML,
      bodyText: DEFAULT_ENGLISH_BODY_TEXT,
      language: "English",
      isDefault: true,
      isActive: true,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    },
  });
  await prisma.emailTemplate.upsert({
    where: { id: seedUuid("e0000000", 2) },
    update: {},
    create: {
      id: seedUuid("e0000000", 2),
      companyId,
      name: "Default Proposal Email (Arabic)",
      code: "default-proposal-arabic",
      subject: DEFAULT_ARABIC_SUBJECT,
      bodyHtml: DEFAULT_ARABIC_BODY_HTML,
      bodyText: DEFAULT_ARABIC_BODY_TEXT,
      language: "Arabic",
      isDefault: false,
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
  const supplierIds = await seedSuppliers(companyId);
  await seedCatalogue(companyId, industryIds, supplierIds);
  await seedDocumentTemplates(companyId, industryIds);
  await seedEmailTemplates(companyId);
  await seedVerificationExamples(companyId, boqIds, itemIds);
  await seedAuditLogs(companyId, boqIds);
  await seedOwnerUser(companyId);

  const mechanical = await seedMechanicalDiscipline(prisma);
  await seedTaxonomyFoundations(prisma);
  await seedSoftwarePlans(prisma);
  await seedMechanicalPackage(prisma, mechanical.disciplineId, mechanical.itemIds);

  console.log(
    `Seeded Quantara development tenant with ${INDUSTRY_KEYS.length} industries, ${projectSeeds.length} projects, ${supplierSeeds.length} suppliers, ${catalogueSeeds.length} catalogue rates, ${templateSeeds.length} document templates, 2 email templates, 9 master-data disciplines, ${mechanical.itemIds.length} Mechanical master items, and 5 software plans.`,
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
