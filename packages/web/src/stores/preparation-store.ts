import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Scheme {
  id: string;
  label: string;
  content: string;
  isActive: boolean;
}

interface PreparationStore {
  messages: ChatMessage[];
  schemes: Scheme[];
  isLoading: boolean;
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  addScheme: (scheme: Scheme) => void;
  setSchemes: (schemes: Scheme[]) => void;
  activateScheme: (id: string) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const usePreparationStore = create<PreparationStore>((set) => ({
  messages: [],
  schemes: [],
  isLoading: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  addScheme: (scheme) => set((s) => ({ schemes: [...s.schemes, scheme] })),
  setSchemes: (schemes) => set({ schemes }),
  activateScheme: (id) =>
    set((s) => ({
      schemes: s.schemes.map((sc) => ({ ...sc, isActive: sc.id === id })),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ messages: [], schemes: [], isLoading: false }),
}));
