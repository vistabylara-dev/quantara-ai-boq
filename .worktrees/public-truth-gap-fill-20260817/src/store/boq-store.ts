import create from "zustand";
import type { BOQ } from "@/types/boq";
import { localStorageAdapter } from "@/lib/storage/local-storage-adapter";

export type BOQStoreState = {
  boqs: BOQ[];
  loadBOQs: () => void;
  saveBOQ: (boq: BOQ) => void;
  getBOQ: (boqId: string) => BOQ | undefined;
  getRevisions: (projectId: string) => BOQ[];
};

export const useBOQStore = create<BOQStoreState>((set, get) => ({
  boqs: [],
  loadBOQs: () => {
    const boqs = localStorageAdapter.getBOQs();
    set({ boqs });
  },
  saveBOQ: (boq: BOQ) => {
    localStorageAdapter.saveBOQ(boq);
    const boqs = localStorageAdapter.getBOQs();
    set({ boqs });
  },
  getBOQ: (boqId: string) => {
    return get().boqs.find((boq) => boq.id === boqId) ?? localStorageAdapter.getBOQ(boqId);
  },
  getRevisions: (projectId: string) => {
    return localStorageAdapter.getRevisions(projectId);
  },
}));
