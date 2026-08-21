import type { BOQ } from "@/types/boq";
import type { CatalogueItem } from "@/types/catalogue";
import type { IndustryEngine } from "@/types/industry";
import type { Project } from "@/types/project";

export type StorageAdapter = {
  getIndustries: () => IndustryEngine[];
  getProjects: () => Project[];
  saveProject: (project: Project) => void;
  getProject: (projectId: string) => Project | undefined;
  getBOQs: () => BOQ[];
  saveBOQ: (boq: BOQ) => void;
  getBOQ: (boqId: string) => BOQ | undefined;
  getCatalogue: () => CatalogueItem[];
  saveCatalogue: (item: CatalogueItem) => void;
  getRevisions: (projectId: string) => BOQ[];
  saveRevision: (boq: BOQ) => void;
  resetDemoData: () => void;
};
