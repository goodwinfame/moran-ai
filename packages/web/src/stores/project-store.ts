import { create } from "zustand";

export type ProjectStatus =
  | "planning"
  | "intent"
  | "world"
  | "characters"
  | "style"
  | "outline"
  | "ready"
  | "active";

const PREP_STEPS: ProjectStatus[] = ["intent", "world", "characters", "style", "outline", "ready"];

export interface ProjectInfo {
  id: string;
  name: string;
  genre: string;
  totalWords: number;
  chapterCount: number;
  currentArc: number;
  status: ProjectStatus;
}

interface ProjectStore {
  currentProject: ProjectInfo | null;
  projects: ProjectInfo[];
  setCurrentProject: (project: ProjectInfo | null) => void;
  setProjects: (projects: ProjectInfo[]) => void;
  isPreparation: () => boolean;
  isWriting: () => boolean;
  currentPrepStep: () => ProjectStatus | null;
  prepStepIndex: () => number;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  currentProject: null,
  projects: [],
  setCurrentProject: (project) => set({ currentProject: project }),
  setProjects: (projects) => set({ projects }),
  isPreparation: () => {
    const s = get().currentProject?.status;
    return s !== undefined && PREP_STEPS.includes(s);
  },
  isWriting: () => get().currentProject?.status === "active",
  currentPrepStep: () => {
    const s = get().currentProject?.status;
    return s && PREP_STEPS.includes(s) ? s : null;
  },
  prepStepIndex: () => {
    const s = get().currentProject?.status;
    return s ? PREP_STEPS.indexOf(s) : -1;
  },
}));
