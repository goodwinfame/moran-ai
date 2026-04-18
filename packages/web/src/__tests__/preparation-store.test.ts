import { describe, it, expect, beforeEach } from "vitest";
import { usePreparationStore } from "@/stores/preparation-store";
import type { ChatMessage, Scheme } from "@/stores/preparation-store";

describe("preparation-store", () => {
  beforeEach(() => {
    usePreparationStore.setState({ messages: [], schemes: [], isLoading: false });
  });

  it("starts with empty messages, schemes, and isLoading=false", () => {
    const s = usePreparationStore.getState();
    expect(s.messages).toEqual([]);
    expect(s.schemes).toEqual([]);
    expect(s.isLoading).toBe(false);
  });

  it("addMessage appends a message", () => {
    const msg: ChatMessage = { id: "m1", role: "user", content: "你好", timestamp: 1000 };
    usePreparationStore.getState().addMessage(msg);
    expect(usePreparationStore.getState().messages).toHaveLength(1);
    expect(usePreparationStore.getState().messages[0]?.content).toBe("你好");
  });

  it("addMessage preserves existing messages", () => {
    const m1: ChatMessage = { id: "m1", role: "user", content: "first", timestamp: 1 };
    const m2: ChatMessage = { id: "m2", role: "assistant", content: "second", timestamp: 2 };
    usePreparationStore.getState().addMessage(m1);
    usePreparationStore.getState().addMessage(m2);
    expect(usePreparationStore.getState().messages).toHaveLength(2);
    expect(usePreparationStore.getState().messages[1]?.role).toBe("assistant");
  });

  it("setMessages replaces all messages", () => {
    usePreparationStore.getState().addMessage({ id: "old", role: "user", content: "old", timestamp: 0 });
    const fresh: ChatMessage[] = [{ id: "new", role: "assistant", content: "fresh", timestamp: 99 }];
    usePreparationStore.getState().setMessages(fresh);
    expect(usePreparationStore.getState().messages).toHaveLength(1);
    expect(usePreparationStore.getState().messages[0]?.id).toBe("new");
  });

  it("setSchemes replaces scheme list", () => {
    const schemes: Scheme[] = [
      { id: "1", label: "方案一", content: "{}", isActive: true },
      { id: "2", label: "方案二", content: "{}", isActive: false },
    ];
    usePreparationStore.getState().setSchemes(schemes);
    expect(usePreparationStore.getState().schemes).toHaveLength(2);
    expect(usePreparationStore.getState().schemes[0]?.label).toBe("方案一");
  });

  it("addScheme appends without replacing", () => {
    usePreparationStore.getState().addScheme({ id: "s1", label: "A", content: "{}", isActive: true });
    usePreparationStore.getState().addScheme({ id: "s2", label: "B", content: "{}", isActive: false });
    expect(usePreparationStore.getState().schemes).toHaveLength(2);
  });

  it("activateScheme sets only the target as active", () => {
    usePreparationStore.getState().setSchemes([
      { id: "s1", label: "A", content: "{}", isActive: true },
      { id: "s2", label: "B", content: "{}", isActive: false },
      { id: "s3", label: "C", content: "{}", isActive: false },
    ]);
    usePreparationStore.getState().activateScheme("s2");
    const schemes = usePreparationStore.getState().schemes;
    expect(schemes.find((s) => s.id === "s1")?.isActive).toBe(false);
    expect(schemes.find((s) => s.id === "s2")?.isActive).toBe(true);
    expect(schemes.find((s) => s.id === "s3")?.isActive).toBe(false);
  });

  it("setLoading(true) sets isLoading", () => {
    usePreparationStore.getState().setLoading(true);
    expect(usePreparationStore.getState().isLoading).toBe(true);
  });

  it("setLoading(false) clears isLoading", () => {
    usePreparationStore.getState().setLoading(true);
    usePreparationStore.getState().setLoading(false);
    expect(usePreparationStore.getState().isLoading).toBe(false);
  });

  it("reset clears messages, schemes, and isLoading", () => {
    usePreparationStore.getState().addMessage({ id: "x", role: "user", content: "x", timestamp: 1 });
    usePreparationStore.getState().addScheme({ id: "s", label: "S", content: "{}", isActive: true });
    usePreparationStore.getState().setLoading(true);
    usePreparationStore.getState().reset();
    const s = usePreparationStore.getState();
    expect(s.messages).toEqual([]);
    expect(s.schemes).toEqual([]);
    expect(s.isLoading).toBe(false);
  });
});