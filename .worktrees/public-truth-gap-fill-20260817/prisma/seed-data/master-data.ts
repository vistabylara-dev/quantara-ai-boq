import type { PrismaClient, TechnicalFieldType } from "@prisma/client";

/**
 * Scalable, discipline-by-discipline master-data seed (spec section 28/29:
 * "Do not attempt to fully populate every package in one unsafe seed
 * operation"). Mechanical gets full items + technical fields for its two
 * explicitly-enumerated equipment groups (HVAC Equipment, Fans); every
 * other discipline gets its taxonomy foundation (categories only, no items
 * yet) so the hierarchy and future package authoring have somewhere to
 * attach to.
 */

type CategorySeed = { key: string; name: string };

const OTHER_DISCIPLINES: { key: string; name: string; description: string; icon: string; categories: CategorySeed[] }[] = [
  {
    key: "electrical",
    name: "Electrical",
    description: "Electrical distribution, containment, lighting, and low-current systems.",
    icon: "bolt",
    categories: [
      { key: "distribution", name: "Distribution" },
      { key: "panels", name: "Panels" },
      { key: "cabling", name: "Cabling" },
      { key: "containment", name: "Containment" },
      { key: "lighting", name: "Lighting" },
      { key: "emergency-lighting", name: "Emergency Lighting" },
      { key: "small-power", name: "Small Power" },
      { key: "earthing", name: "Earthing" },
      { key: "data", name: "Data" },
      { key: "security", name: "Security" },
      { key: "ups", name: "UPS" },
      { key: "generators", name: "Generators" },
    ],
  },
  {
    key: "plumbing",
    name: "Plumbing",
    description: "Water supply, drainage, and sanitary systems.",
    icon: "droplet",
    categories: [
      { key: "water-supply", name: "Water Supply" },
      { key: "drainage", name: "Drainage" },
      { key: "sanitary-fixtures", name: "Sanitary Fixtures" },
      { key: "pumps", name: "Pumps" },
      { key: "water-heaters", name: "Water Heaters" },
      { key: "valves", name: "Valves" },
      { key: "tanks", name: "Tanks" },
      { key: "accessories", name: "Accessories" },
      { key: "insulation", name: "Insulation" },
    ],
  },
  {
    key: "fire-fighting",
    name: "Fire Fighting",
    description: "Fire suppression, detection, and life-safety systems.",
    icon: "flame",
    categories: [
      { key: "pumps", name: "Pumps" },
      { key: "sprinklers", name: "Sprinklers" },
      { key: "pipes", name: "Pipes" },
      { key: "hose-reels", name: "Hose Reels" },
      { key: "landing-valves", name: "Landing Valves" },
      { key: "fire-cabinets", name: "Fire Cabinets" },
      { key: "extinguishers", name: "Extinguishers" },
      { key: "wet-risers", name: "Wet Risers" },
      { key: "dry-risers", name: "Dry Risers" },
      { key: "testing", name: "Testing" },
    ],
  },
  {
    key: "construction",
    name: "Construction",
    description: "Structural and civil construction works.",
    icon: "hammer",
    categories: [
      { key: "earthworks", name: "Earthworks" },
      { key: "concrete", name: "Concrete" },
      { key: "reinforcement", name: "Reinforcement" },
      { key: "formwork", name: "Formwork" },
      { key: "blockwork", name: "Blockwork" },
      { key: "waterproofing", name: "Waterproofing" },
      { key: "plastering", name: "Plastering" },
      { key: "painting", name: "Painting" },
      { key: "flooring", name: "Flooring" },
      { key: "doors", name: "Doors" },
      { key: "windows", name: "Windows" },
      { key: "roofing", name: "Roofing" },
      { key: "external-works", name: "External Works" },
    ],
  },
  {
    key: "interior-fit-out",
    name: "Interior Fit-Out",
    description: "Interior fit-out and finishing works.",
    icon: "layout",
    categories: [
      { key: "partitions", name: "Partitions" },
      { key: "ceilings", name: "Ceilings" },
      { key: "flooring", name: "Flooring" },
      { key: "wall-finishes", name: "Wall Finishes" },
      { key: "painting", name: "Painting" },
      { key: "glass", name: "Glass" },
      { key: "joinery", name: "Joinery" },
      { key: "doors", name: "Doors" },
      { key: "lighting", name: "Lighting" },
      { key: "curtains", name: "Curtains" },
      { key: "signage", name: "Signage" },
      { key: "decorative-works", name: "Decorative Works" },
    ],
  },
  {
    key: "furniture",
    name: "Furniture",
    description: "Office, hospitality, and educational furniture.",
    icon: "armchair",
    categories: [
      { key: "desks", name: "Desks" },
      { key: "workstations", name: "Workstations" },
      { key: "chairs", name: "Chairs" },
      { key: "tables", name: "Tables" },
      { key: "storage", name: "Storage" },
      { key: "reception", name: "Reception" },
      { key: "sofas", name: "Sofas" },
      { key: "accessories", name: "Accessories" },
      { key: "hospitality-furniture", name: "Hospitality Furniture" },
      { key: "educational-furniture", name: "Educational Furniture" },
    ],
  },
  {
    key: "joinery",
    name: "Joinery",
    description: "Custom joinery and millwork.",
    icon: "ruler",
    categories: [
      { key: "kitchens", name: "Kitchens" },
      { key: "wardrobes", name: "Wardrobes" },
      { key: "reception-counters", name: "Reception Counters" },
      { key: "wall-panels", name: "Wall Panels" },
      { key: "vanity-units", name: "Vanity Units" },
      { key: "doors", name: "Doors" },
      { key: "shelving", name: "Shelving" },
      { key: "hardware", name: "Hardware" },
    ],
  },
  {
    key: "landscaping",
    name: "Landscaping",
    description: "Soft and hard landscaping works.",
    icon: "tree",
    categories: [
      { key: "trees", name: "Trees" },
      { key: "shrubs", name: "Shrubs" },
      { key: "ground-cover", name: "Ground Cover" },
      { key: "turf", name: "Turf" },
      { key: "soil", name: "Soil" },
      { key: "irrigation", name: "Irrigation" },
      { key: "hardscape", name: "Hardscape" },
      { key: "lighting", name: "Lighting" },
      { key: "furniture", name: "Furniture" },
    ],
  },
];

const MECHANICAL_TOP_CATEGORIES: CategorySeed[] = [
  { key: "hvac-equipment", name: "HVAC Equipment" },
  { key: "fans", name: "Fans" },
  { key: "ductwork", name: "Ductwork" },
  { key: "air-distribution", name: "Air Distribution" },
  { key: "dampers", name: "Dampers" },
  { key: "chilled-water-systems", name: "Chilled-Water Systems" },
  { key: "refrigerant-systems", name: "Refrigerant Systems" },
  { key: "pumps", name: "Pumps" },
  { key: "heat-exchangers", name: "Heat Exchangers" },
  { key: "boilers", name: "Boilers" },
  { key: "water-heaters", name: "Water Heaters" },
  { key: "insulation", name: "Insulation" },
  { key: "controls-bms", name: "Controls and BMS" },
  { key: "supports-accessories", name: "Supports and Accessories" },
  { key: "testing-commissioning", name: "Testing and Commissioning" },
];

const HVAC_EQUIPMENT_ITEMS: CategorySeed[] = [
  { key: "ahu", name: "AHU" },
  { key: "fahu", name: "FAHU" },
  { key: "fcu", name: "FCU" },
  { key: "chiller", name: "Chiller" },
  { key: "cooling-tower", name: "Cooling Tower" },
  { key: "heat-pump", name: "Heat Pump" },
  { key: "package-unit", name: "Package Unit" },
  { key: "rooftop-package-unit", name: "Rooftop Package Unit" },
  { key: "vrf-outdoor-unit", name: "VRF Outdoor Unit" },
  { key: "vrf-indoor-unit", name: "VRF Indoor Unit" },
  { key: "dx-split-unit", name: "DX Split Unit" },
  { key: "ducted-split-unit", name: "Ducted Split Unit" },
  { key: "precision-air-conditioner", name: "Precision Air Conditioner" },
  { key: "close-control-unit", name: "Close Control Unit" },
  { key: "crah", name: "CRAH" },
  { key: "crac", name: "CRAC" },
  { key: "heat-recovery-unit", name: "Heat Recovery Unit" },
  { key: "energy-recovery-unit", name: "Energy Recovery Unit" },
  { key: "air-curtain", name: "Air Curtain" },
  { key: "unit-heater", name: "Unit Heater" },
  { key: "cabinet-fan", name: "Cabinet Fan" },
  { key: "fan-coil-cassette", name: "Fan Coil Cassette" },
  { key: "dehumidifier", name: "Dehumidifier" },
  { key: "humidifier", name: "Humidifier" },
];

const FAN_ITEMS: CategorySeed[] = [
  { key: "axial-fan", name: "Axial Fan" },
  { key: "centrifugal-fan", name: "Centrifugal Fan" },
  { key: "ec-fan", name: "EC Fan" },
  { key: "mixed-flow-fan", name: "Mixed-Flow Fan" },
  { key: "tube-axial-fan", name: "Tube-Axial Fan" },
  { key: "roof-fan", name: "Roof Fan" },
  { key: "smoke-extract-fan", name: "Smoke-Extract Fan" },
  { key: "tunnel-fan", name: "Tunnel Fan" },
  { key: "jet-fan", name: "Jet Fan" },
  { key: "car-park-fan", name: "Car-Park Fan" },
  { key: "kitchen-extract-fan", name: "Kitchen Extract Fan" },
  { key: "inline-fan", name: "Inline Fan" },
  { key: "ceiling-fan", name: "Ceiling Fan" },
  { key: "wall-mounted-fan", name: "Wall-Mounted Fan" },
  { key: "bifurcated-fan", name: "Bifurcated Fan" },
  { key: "plug-fan", name: "Plug Fan" },
  { key: "staircase-pressurization-fan", name: "Staircase Pressurization Fan" },
  { key: "toilet-extract-fan", name: "Toilet Extract Fan" },
  { key: "fresh-air-fan", name: "Fresh-Air Fan" },
  { key: "exhaust-fan", name: "Exhaust Fan" },
];

type FieldSeed = {
  key: string;
  label: string;
  fieldType: TechnicalFieldType;
  unit?: string;
  optionsJson?: string[];
  isFilterable?: boolean;
  isSearchable?: boolean;
};

const AHU_FIELDS: FieldSeed[] = [
  { key: "airflowCfm", label: "Airflow", fieldType: "NUMBER", unit: "CFM", isFilterable: true },
  { key: "coolingCapacityKw", label: "Cooling Capacity", fieldType: "DECIMAL", unit: "kW", isFilterable: true },
  { key: "heatingCapacityKw", label: "Heating Capacity", fieldType: "DECIMAL", unit: "kW", isFilterable: true },
  { key: "externalStaticPressurePa", label: "External Static Pressure", fieldType: "NUMBER", unit: "Pa", isFilterable: true },
  { key: "fanType", label: "Fan Type", fieldType: "SELECT", optionsJson: ["Centrifugal", "Axial", "Plug", "EC"], isFilterable: true },
  { key: "filtrationClass", label: "Filtration Class", fieldType: "SELECT", optionsJson: ["G4", "F7", "F9", "H13"], isFilterable: true },
  { key: "casingType", label: "Casing Type", fieldType: "SELECT", optionsJson: ["Single Skin", "Double Skin"] },
  { key: "coilRows", label: "Coil Rows", fieldType: "NUMBER" },
  { key: "motorEfficiency", label: "Motor Efficiency", fieldType: "SELECT", optionsJson: ["IE2", "IE3", "IE4"] },
  { key: "voltage", label: "Voltage", fieldType: "SELECT", optionsJson: ["230V", "400V", "415V"], isFilterable: true },
  { key: "phase", label: "Phase", fieldType: "SELECT", optionsJson: ["1", "3"] },
  { key: "controlsProtocol", label: "Controls Protocol", fieldType: "SELECT", optionsJson: ["BACnet", "Modbus", "LonWorks"], isFilterable: true },
  { key: "soundLevelDb", label: "Sound Level", fieldType: "NUMBER", unit: "dB" },
  { key: "dimensions", label: "Dimensions", fieldType: "DIMENSION" },
  { key: "weightKg", label: "Weight", fieldType: "NUMBER", unit: "kg" },
];

const FAN_FIELDS: FieldSeed[] = [
  { key: "fanType", label: "Fan Type", fieldType: "SELECT", optionsJson: ["Axial", "Centrifugal", "EC", "Mixed-Flow"], isFilterable: true },
  { key: "airflowCfm", label: "Airflow", fieldType: "NUMBER", unit: "CFM", isFilterable: true },
  { key: "staticPressurePa", label: "Static Pressure", fieldType: "NUMBER", unit: "Pa", isFilterable: true },
  { key: "motorPowerKw", label: "Motor Power", fieldType: "DECIMAL", unit: "kW", isFilterable: true },
  { key: "speedRpm", label: "Speed", fieldType: "NUMBER", unit: "RPM" },
  { key: "efficiencyClass", label: "Efficiency Class", fieldType: "SELECT", optionsJson: ["IE2", "IE3"] },
  { key: "impellerMaterial", label: "Impeller Material", fieldType: "SELECT", optionsJson: ["Galvanized Steel", "Aluminium", "GRP"] },
  { key: "casingMaterial", label: "Casing Material", fieldType: "SELECT", optionsJson: ["Galvanized Steel", "Aluminium", "GRP"] },
  { key: "temperatureRating", label: "Temperature Rating", fieldType: "SELECT", optionsJson: ["Standard", "F300 (300°C/2h)", "F400 (400°C/2h)"], isFilterable: true },
  { key: "smokeRating", label: "Smoke Rated", fieldType: "BOOLEAN", isFilterable: true },
  { key: "soundLevelDb", label: "Sound Level", fieldType: "NUMBER", unit: "dB" },
];

async function upsertDiscipline(prisma: PrismaClient, input: { key: string; name: string; description: string; icon: string; sortOrder: number }) {
  return prisma.masterDiscipline.upsert({
    where: { key: input.key },
    update: {},
    create: input,
  });
}

async function upsertCategory(prisma: PrismaClient, disciplineId: string, parentCategoryId: string | null, seed: CategorySeed, sortOrder: number) {
  const parent = parentCategoryId ? await prisma.masterCategory.findUnique({ where: { id: parentCategoryId } }) : null;
  const existing = await prisma.masterCategory.findFirst({ where: { disciplineId, parentCategoryId, key: seed.key } });
  if (existing) return existing;

  const depth = parent ? parent.depth + 1 : 0;
  const path = parent ? `${parent.path}/${seed.key}` : seed.key;
  return prisma.masterCategory.create({
    data: { disciplineId, parentCategoryId, key: seed.key, name: seed.name, path, depth, sortOrder },
  });
}

async function upsertFieldDefinition(prisma: PrismaClient, disciplineId: string, categoryId: string | null, field: FieldSeed, sortOrder: number) {
  const existing = await prisma.technicalFieldDefinition.findFirst({ where: { disciplineId, categoryId, key: field.key } });
  if (existing) return existing;
  return prisma.technicalFieldDefinition.create({
    data: {
      disciplineId,
      categoryId,
      key: field.key,
      label: field.label,
      fieldType: field.fieldType,
      unit: field.unit,
      optionsJson: field.optionsJson,
      isFilterable: field.isFilterable ?? false,
      isSearchable: field.isSearchable ?? false,
      sortOrder,
    },
  });
}

async function upsertMasterItem(
  prisma: PrismaClient,
  disciplineId: string,
  categoryId: string,
  itemCode: string,
  name: string,
  defaultUnit: string,
  shortDescription: string,
) {
  const existing = await prisma.masterItem.findUnique({ where: { disciplineId_itemCode: { disciplineId, itemCode } } });
  if (existing) return existing;
  return prisma.masterItem.create({
    data: {
      disciplineId,
      categoryId,
      itemCode,
      name,
      shortDescription,
      fullDescription: `${name} — technical reference item for professional BOQ preparation. Customize specification, quantity, and pricing per project.`,
      defaultUnit,
      isPremium: true,
      status: "ACTIVE",
    },
  });
}

export type MechanicalSeedResult = { disciplineId: string; itemIds: string[] };

export async function seedMechanicalDiscipline(prisma: PrismaClient): Promise<MechanicalSeedResult> {
  const discipline = await upsertDiscipline(prisma, {
    key: "mechanical",
    name: "Mechanical",
    description: "HVAC, mechanical piping, and mechanical equipment master data.",
    icon: "fan",
    sortOrder: 0,
  });

  const topCategories = new Map<string, string>();
  for (const [index, seed] of MECHANICAL_TOP_CATEGORIES.entries()) {
    const row = await upsertCategory(prisma, discipline.id, null, seed, index);
    topCategories.set(seed.key, row.id);
  }

  const hvacEquipmentId = topCategories.get("hvac-equipment")!;
  const fansId = topCategories.get("fans")!;

  for (const [index, field] of AHU_FIELDS.entries()) {
    await upsertFieldDefinition(prisma, discipline.id, hvacEquipmentId, field, index);
  }
  for (const [index, field] of FAN_FIELDS.entries()) {
    await upsertFieldDefinition(prisma, discipline.id, fansId, field, index);
  }

  const itemIds: string[] = [];
  for (const [index, equipment] of HVAC_EQUIPMENT_ITEMS.entries()) {
    const category = await upsertCategory(prisma, discipline.id, hvacEquipmentId, equipment, index);
    const item = await upsertMasterItem(prisma, discipline.id, category.id, `MECH-HVAC-${equipment.key.toUpperCase()}`, equipment.name, "nos", `${equipment.name} — HVAC equipment reference specification.`);
    itemIds.push(item.id);
  }
  for (const [index, fan] of FAN_ITEMS.entries()) {
    const category = await upsertCategory(prisma, discipline.id, fansId, fan, index);
    const item = await upsertMasterItem(prisma, discipline.id, category.id, `MECH-FAN-${fan.key.toUpperCase()}`, fan.name, "nos", `${fan.name} — mechanical ventilation fan reference specification.`);
    itemIds.push(item.id);
  }

  return { disciplineId: discipline.id, itemIds };
}

export async function seedTaxonomyFoundations(prisma: PrismaClient): Promise<void> {
  for (const [disciplineIndex, disciplineSeed] of OTHER_DISCIPLINES.entries()) {
    const discipline = await upsertDiscipline(prisma, {
      key: disciplineSeed.key,
      name: disciplineSeed.name,
      description: disciplineSeed.description,
      icon: disciplineSeed.icon,
      sortOrder: disciplineIndex + 1,
    });
    for (const [index, category] of disciplineSeed.categories.entries()) {
      await upsertCategory(prisma, discipline.id, null, category, index);
    }
  }
}
