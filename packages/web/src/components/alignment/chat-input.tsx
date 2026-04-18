"use client";

import { useState, KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";

export interface ChatInputProps {
  onSend?: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled = false, placeholder = "描述你的想法..." }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend?.(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-6 bg-transparent mt-auto">
      <div className="relative max-w-2xl mx-auto flex items-center">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1A202C] focus:border-transparent text-sm shadow-sm transition-all outline-none placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder={placeholder}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="absolute right-2 p-2 bg-[#1A202C] text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon name="send" size={16} />
        </button>
      </div>
    </div>
  );
}