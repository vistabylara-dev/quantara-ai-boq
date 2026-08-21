import {
  Fan,
  Droplet,
  Construction,
  Cuboid,
  Paintbrush,
  DoorOpen,
  Building,
  Home,
  Map,
  TreePine,
  ClipboardList,
  Box,
  Award,
  Shield,
  Layers
} from "lucide-react";

export type LibraryConfig = {
  key: string;
  packageCode: string;
  displayName: string;
  description: string;
  icon: any; // LucideIcon type
  searchTerms: string[];
};

export const CATALOGUE_LIBRARIES: LibraryConfig[] = [
  {
    key: "hvac",
    packageCode: "hvac-library",
    displayName: "HVAC Library",
    description: "Complete HVAC equipment, ducting, air distribution, and accessories.",
    icon: Fan,
    searchTerms: ["FCU", "AHU", "Chiller", "Duct", "Grille", "Ventilation"]
  },
  {
    key: "plumbing",
    packageCode: "plumbing-library",
    displayName: "Plumbing Library",
    description: "Pipes, fittings, valves, drainage specialties, and plumbing fixtures.",
    icon: Droplet,
    searchTerms: ["Valve", "Pipe", "Drain", "Fitting", "Pump", "Fixture"]
  },
  {
    key: "civil-works",
    packageCode: "civil-works-library",
    displayName: "Civil Works Library",
    description: "Earthworks, excavation, backfill, concrete, and civil structures.",
    icon: Construction,
    searchTerms: ["Concrete", "Excavation", "Rebar", "Backfill", "Asphalt"]
  },
  {
    key: "structural",
    packageCode: "structural-library",
    displayName: "Structural Library",
    description: "Steel beams, columns, structural frames, and heavy engineering.",
    icon: Cuboid,
    searchTerms: ["Beam", "Column", "Steel", "Plate", "Girder"]
  },
  {
    key: "architectural-finishes",
    packageCode: "architectural-finishes-library",
    displayName: "Architectural Finishes Library",
    description: "Paints, tiles, flooring, ceilings, and interior decorations.",
    icon: Paintbrush,
    searchTerms: ["Paint", "Tile", "Carpet", "Gypsum", "Ceiling", "Finish"]
  },
  {
    key: "doors-and-windows",
    packageCode: "doors-and-windows-library",
    displayName: "Doors and Windows Library",
    description: "Wooden doors, steel frames, glazing, windows, and hardware.",
    icon: DoorOpen,
    searchTerms: ["Door", "Window", "Glazing", "Hardware", "Hinge"]
  },
  {
    key: "facade",
    packageCode: "facade-library",
    displayName: "Facade Library",
    description: "Curtain walls, cladding, exterior finishes, and elevations.",
    icon: Building,
    searchTerms: ["Curtain Wall", "Cladding", "Panel", "ACP", "Louvers"]
  },
  {
    key: "roofing",
    packageCode: "roofing-library",
    displayName: "Roofing Library",
    description: "Waterproofing, insulation, roof tiles, and drainage.",
    icon: Home,
    searchTerms: ["Waterproofing", "Insulation", "Membrane", "Flashing", "Tile"]
  },
  {
    key: "site-infrastructure",
    packageCode: "site-infrastructure-library",
    displayName: "Site Infrastructure Library",
    description: "Roads, utilities, external drainage, and street lighting.",
    icon: Map,
    searchTerms: ["Road", "Manhole", "Trench", "Asphalt", "Paving"]
  },
  {
    key: "landscaping",
    packageCode: "landscaping-library",
    displayName: "Landscaping Library",
    description: "Trees, shrubs, irrigation systems, and hardscaping.",
    icon: TreePine,
    searchTerms: ["Tree", "Shrub", "Irrigation", "Pavers", "Planter"]
  },
  {
    key: "general-requirements",
    packageCode: "general-requirements-library",
    displayName: "General Requirements Library",
    description: "Preliminaries, site offices, mobilization, and permits.",
    icon: ClipboardList,
    searchTerms: ["Mobilization", "Permit", "Office", "Testing", "Survey"]
  },
  {
    key: "temporary-works",
    packageCode: "temporary-works-library",
    displayName: "Temporary Works Library",
    description: "Scaffolding, shoring, formwork, and temporary fencing.",
    icon: Box,
    searchTerms: ["Scaffolding", "Shoring", "Formwork", "Fencing", "Barricade"]
  },
  {
    key: "closeout",
    packageCode: "closeout-library",
    displayName: "Closeout Library",
    description: "Testing, commissioning, warranties, and handover documents.",
    icon: Award,
    searchTerms: ["Commissioning", "Testing", "Warranty", "Handover", "Training"]
  },
  {
    key: "bim-and-digital-deliverables",
    packageCode: "bim-digital-deliverables-library",
    displayName: "BIM and Digital Deliverables Library",
    description: "3D models, BIM execution plans, and digital twins.",
    icon: Layers,
    searchTerms: ["BIM", "LOD", "Model", "Digital Twin", "Coordination"]
  },
  {
    key: "uae-authority-and-regulatory",
    packageCode: "uae-authority-regulatory-library",
    displayName: "UAE Authority and Regulatory Library",
    description: "DEWA, Civil Defence, Municipality compliance and approvals.",
    icon: Shield,
    searchTerms: ["DEWA", "DCD", "Municipality", "Approval", "NOC"]
  }
];

export function getLibraryConfigByCode(packageCode: string): LibraryConfig | undefined {
  return CATALOGUE_LIBRARIES.find(l => l.packageCode === packageCode);
}

export function getLibraryConfigByKey(key: string): LibraryConfig | undefined {
  return CATALOGUE_LIBRARIES.find(l => l.key === key);
}
