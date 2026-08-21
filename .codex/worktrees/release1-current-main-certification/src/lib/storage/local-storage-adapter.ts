import { demoIndustries } from "@/config/industries/index";
import { demoProjects } from "@/data/demo-projects";
import { demoBOQs } from "@/data/demo-boqs";
import { demoCatalogue } from "@/data/demo-catalogue";
import type { BOQ } from "@/types/boq";
import type { CatalogueItem } from "@/types/catalogue";
import type { IndustryEngine } from "@/types/industry";
import type { Project } from "@/types/project";
import type { StorageAdapter } from "./storage-adapter";

const STORAGE_KEYS = {
  industries: "quantara-industry-engines",
  projects: "quantara-projects",
  boqs: "quantara-boqs",
  catalogue: "quantara-catalogue",
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function ensureSeeded(): void {
  if (typeof window === "undefined") return;
  if (!window.localStorage.getItem(STORAGE_KEYS.industries)) {
    writeJson(STORAGE_KEYS.industries, demoIndustries);
  }
  if (!window.localStorage.getItem(STORAGE_KEYS.projects)) {
    writeJson(STORAGE_KEYS.projects, demoProjects);
  }
  if (!window.localStorage.getItem(STORAGE_KEYS.boqs)) {
    writeJson(STORAGE_KEYS.boqs, demoBOQs);
  }
  if (!window.localStorage.getItem(STORAGE_KEYS.catalogue)) {
    writeJson(STORAGE_KEYS.catalogue, demoCatalogue);
  }
}

export const localStorageAdapter: StorageAdapter = {
  getIndustries: () => {
    ensureSeeded();
    return readJson(STORAGE_KEYS.industries, demoIndustries);
  },
  getProjects: () => {
    ensureSeeded();
    return readJson(STORAGE_KEYS.projects, demoProjects);
  },
  saveProject: (project: Project) => {
    const current = readJson(STORAGE_KEYS.projects, demoProjects);
    const updated = current.filter((item) => item.id !== project.id);
    updated.push(project);
    writeJson(STORAGE_KEYS.projects, updated);
  },
  getProject: (projectId: string) => {
    return localStorageAdapter.getProjects().find((project) => project.id === projectId);
  },
  getBOQs: () => {
    ensureSeeded();
    return readJson(STORAGE_KEYS.boqs, demoBOQs);
  },
  saveBOQ: (boq: BOQ) => {
    const current = readJson(STORAGE_KEYS.boqs, demoBOQs);
    const updated = current.filter((item) => item.id !== boq.id);
    updated.push(boq);
    writeJson(STORAGE_KEYS.boqs, updated);
  },
  getBOQ: (boqId: string) => {
    return localStorageAdapter.getBOQs().find((boq) => boq.id === boqId);
  },
  getCatalogue: () => {
    ensureSeeded();
    return readJson(STORAGE_KEYS.catalogue, demoCatalogue);
  },
  saveCatalogue: (item: CatalogueItem) => {
    const current = readJson(STORAGE_KEYS.catalogue, demoCatalogue);
    const updated = current.filter((entry) => entry.id !== item.id);
    updated.push(item);
    writeJson(STORAGE_KEYS.catalogue, updated);
  },
  getRevisions: (projectId: string) => {
    return localStorageAdapter.getBOQs().filter((boq) => boq.projectId === projectId);
  },
  saveRevision: (boq: BOQ) => {
    localStorageAdapter.saveBOQ(boq);
  },
  resetDemoData: () => {
    if (typeof window === "undefined") return;
    writeJson(STORAGE_KEYS.industries, demoIndustries);
    writeJson(STORAGE_KEYS.projects, demoProjects);
    writeJson(STORAGE_KEYS.boqs, demoBOQs);
    writeJson(STORAGE_KEYS.catalogue, demoCatalogue);
  },
};
