import { create } from "zustand";

export type WritingStage =
  | "idle"
  | "context"
  | "writing"
  | "reviewing"
  | "archiving"
  | "done"
  | "error";

export interface ReviewResult {
  round: number;
  passed: boolean;
  score?: number;
  issues?: Array<{
    severity: "CRITICAL" | "MAJOR" | "MINOR" | "SUGGESTION";
    message: string;
    evidence?: string;
    suggestion?: string;
  }>;
}

interface WritingStore {
  /** Current writing stage */
  stage: WritingStage;
  /** Chapter content accumulated from SSE chunks */
  content: string;
  /** Real-time word count */
  wordCount: number;
  /** Current chapter number being written */
  chapterNumber: number | null;
  /** Review result from latest review round */
  reviewResult: ReviewResult | null;
  /** Token budget info */
  budget: { total: number; used: number; remaining: number } | null;
  /** Error message if any */
  error: string | null;

  /** Actions */
  setStage: (stage: WritingStage) => void;
  appendContent: (chunk: string) => void;
  setWordCount: (count: number) => void;
  setChapterNumber: (num: number) => void;
  setReviewResult: (result: ReviewResult) => void;
  setBudget: (budget: { total: number; used: number; remaining: number }) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  stage: "idle" as WritingStage,
  content: "",
  wordCount: 0,
  chapterNumber: null as number | null,
  reviewResult: null as ReviewResult | null,
  budget: null as { total: number; used: number; remaining: number } | null,
  error: null as string | null,
};

export const useWritingStore = create<WritingStore>((set) => ({
  ...initialState,
  setStage: (stage) => set({ stage }),
  appendContent: (chunk) =>
    set((state) => ({ content: state.content + chunk })),
  setWordCount: (wordCount) => set({ wordCount }),
  setChapterNumber: (chapterNumber) => set({ chapterNumber }),
  setReviewResult: (reviewResult) => set({ reviewResult }),
  setBudget: (budget) => set({ budget }),
  setError: (error) => set({ error, stage: error ? "error" : "idle" }),
  reset: () => set(initialState),
}));
