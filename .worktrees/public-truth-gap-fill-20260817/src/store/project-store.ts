import create from "zustand";
import type { Project } from "@/types/project";
import { localStorageAdapter } from "@/lib/storage/local-storage-adapter";

export type ProjectStoreState = {
  projects: Project[];
  loadProjects: () => void;
  saveProject: (project: Project) => void;
  getProject: (projectId: string) => Project | undefined;
};

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: [],
  loadProjects: () => {
    const projects = localStorageAdapter.getProjects();
    set({ projects });
  },
  saveProject: (project: Project) => {
    localStorageAdapter.saveProject(project);
    const projects = localStorageAdapter.getProjects();
    set({ projects });
  },
  getProject: (projectId: string) => {
    return get().projects.find((project) => project.id === projectId) ?? localStorageAdapter.getProject(projectId);
  },
}));
