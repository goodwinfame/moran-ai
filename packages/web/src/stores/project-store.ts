import { create } from "zustand";

export interface ProjectInfo {
  id: string;
  name: string;
  genre: string;
  totalWords: number;
  chapterCount: number;
  currentArc: number;
  status: "idle" | "writing" | "reviewing" | "archiving";
}

interface ProjectStore {
  /** Currently selected project */
  currentProject: ProjectInfo | null;
  /** All available projects */
  projects: ProjectInfo[];
  /** Set current project */
  setCurrentProject: (project: ProjectInfo | null) => void;
  /** Set all projects */
  setProjects: (projects: ProjectInfo[]) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  projects: [],
  setCurrentProject: (project) => set({ currentProject: project }),
  setProjects: (projects) => set({ projects }),
}));
