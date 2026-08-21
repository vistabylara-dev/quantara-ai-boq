import create from "zustand";
import type { IndustryEngine } from "@/types/industry";
import { localStorageAdapter } from "@/lib/storage/local-storage-adapter";

export type AppStoreState = {
  industries: IndustryEngine[];
  loadIndustries: () => void;
};

export const useAppStore = create<AppStoreState>((set) => ({
  industries: [],
  loadIndustries: () => {
    const industries = localStorageAdapter.getIndustries();
    set({ industries });
  },
}));
