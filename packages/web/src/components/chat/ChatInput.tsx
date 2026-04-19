"use client";

import React, { useRef, useState, KeyboardEvent } from "react";
import { useChatStore } from "@/stores/chat-store";
import { Icon } from "@/components/ui/icon";
import { CommandPalette } from "./CommandPalette";
import { QuestionPanel } from "./QuestionPanel";

interface ChatInputProps {
  projectId: string;
  disabled?: boolean;
}

export function ChatInput({ projectId, disabled }: ChatInputProps) {
  const [text, setText] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const inputMode = useChatStore((state) => state.inputMode);
  const questionPrompt = useChatStore((state) => state.questionPrompt);
  const questionOptions = useChatStore((state) => state.questionOptions);
  const resetInputMode = useChatStore((state) => state.resetInputMode);
  const sendMessage = useChatStore((state) => state.sendMessage);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    if (val.startsWith("/")) {
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        144 // approx 6 rows
      )}px`;
    }
  };

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    sendMessage(projectId, text);
    setText("");
    setShowCommands(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter" || e.key === "Escape") {
        // Prevent default cursor moving / text entry while navigating the palette
        e.preventDefault();
        // Fire custom event to ensure CommandPalette receives it synchronously
        window.dispatchEvent(new window.KeyboardEvent("keydown", { key: e.key, bubbles: true }));
      }
    } else {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleCommandSelect = (cmd: string) => {
    setText(cmd + " ");
    setShowCommands(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  if (inputMode === "question" && questionOptions && questionPrompt) {
    return (
      <div className="p-4 bg-background">
        <QuestionPanel
          question={questionPrompt}
          options={questionOptions}
          onSelect={(val) => {
            sendMessage(projectId, val);
            resetInputMode();
          }}
          onFreeInput={resetInputMode}
        />
      </div>
    );
  }

  return (
    <div className="p-4 relative bg-background border-t border-border shrink-0">
      {showCommands && (
        <CommandPalette
          filter={text.slice(1)}
          onSelect={handleCommandSelect}
          onClose={() => setShowCommands(false)}
        />
      )}
      <div className="relative flex items-center bg-background border border-border rounded-xl focus-within:ring-2 focus-within:ring-ring/20 focus-within:outline-none transition-shadow">
        <button
          className="absolute left-3 top-3 text-muted-foreground hover:text-primary transition-colors"
          onClick={() => {
            // Attachment handled by Agent C
          }}
          disabled={disabled}
        >
          <Icon name="attach_file" size={20} />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="向墨衡发送消息... (输入 / 唤起命令)"
          className="flex-1 max-h-36 bg-transparent resize-none py-3 pl-10 pr-12 text-sm text-primary-foreground placeholder:text-muted-foreground focus:outline-none"
          rows={1}
        />

        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="absolute right-3 top-3 text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Icon name="send" size={20} />
        </button>
      </div>
    </div>
  );
}
