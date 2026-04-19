"use client";

import React, { useEffect } from "react";
import { QuestionOption } from "@/stores/chat-store";

interface QuestionPanelProps {
  question: string;
  options: QuestionOption[];
  onSelect: (value: string) => void;
  onFreeInput: () => void;
}

export function QuestionPanel({
  question,
  options,
  onSelect,
  onFreeInput,
}: QuestionPanelProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < options.length) {
        const selected = options[idx];
        if (selected) {
          e.preventDefault();
          onSelect(selected.value);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options, onSelect]);

  return (
    <div className="border border-border rounded-xl p-4 space-y-3 bg-background">
      <p className="text-sm text-primary-foreground font-medium mb-2">{question}</p>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => onSelect(opt.value)}
            className="w-full text-left px-4 py-3 border border-border rounded-lg hover:bg-secondary transition-colors focus:ring-2 focus:ring-ring/20 focus:outline-none"
          >
            <span className="text-muted-foreground mr-2 font-mono">{i + 1}.</span>
            <span className="text-sm text-primary-foreground">{opt.label}</span>
          </button>
        ))}
        <button
          onClick={onFreeInput}
          className="w-full text-left px-4 py-3 border border-border rounded-lg hover:bg-secondary transition-colors text-muted-foreground focus:ring-2 focus:ring-ring/20 focus:outline-none"
        >
          <span className="mr-2">💬</span>
          <span className="text-sm">自由输入</span>
        </button>
      </div>
    </div>
  );
}
