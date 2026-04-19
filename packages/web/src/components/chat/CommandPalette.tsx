"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const COMMANDS = [
  { command: "/write", label: "写作", description: "开始写第 N 章", icon: "edit_note" },
  { command: "/review", label: "审校", description: "审校第 N 章", icon: "rate_review" },
  { command: "/status", label: "进度", description: "查看项目总体进度", icon: "monitoring" },
  { command: "/export", label: "导出", description: "导出已完成章节", icon: "download" },
  { command: "/brainstorm", label: "脑暴", description: "开始新一轮脑暴", icon: "lightbulb" },
  { command: "/analyze", label: "分析", description: "析典分析第 N 章", icon: "analytics" },
  { command: "/lesson", label: "教训", description: "查看写作教训", icon: "school" },
  { command: "/style", label: "文风", description: "查看/调整文风", icon: "brush" },
  { command: "/rollback", label: "回滚", description: "回滚到某版本", icon: "undo" },
];

interface CommandPaletteProps {
  filter: string;
  onSelect: (command: string) => void;
  onClose: () => void;
}

export function CommandPalette({ filter, onSelect, onClose }: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = COMMANDS.filter(
    (cmd) =>
      cmd.command.toLowerCase().includes(filter.toLowerCase()) ||
      cmd.label.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex].command);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredCommands, selectedIndex, onSelect, onClose]);

  if (filteredCommands.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-full left-0 w-full mb-2 bg-background border border-border rounded-xl shadow-lg overflow-hidden z-50">
      <div className="max-h-[300px] overflow-y-auto py-2">
        {filteredCommands.map((cmd, index) => (
          <button
            key={cmd.command}
            className={cn(
              "w-full flex items-center px-4 py-2 text-left transition-colors",
              index === selectedIndex ? "bg-secondary" : "hover:bg-secondary/50"
            )}
            onClick={() => onSelect(cmd.command)}
          >
            <div className="text-muted-foreground mr-3">
              <Icon name={cmd.icon as any} size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm text-primary">{cmd.command}</span>
                <span className="text-sm font-medium">{cmd.label}</span>
              </div>
              <div className="text-xs text-muted-foreground">{cmd.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
