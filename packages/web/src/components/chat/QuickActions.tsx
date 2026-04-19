"use client";

import * as React from "react";
import { Icon } from "@/components/ui/icon";

interface QuickActionsProps {
  projectId: string;
  onSendMessage: (text: string) => void;
}

const QUICK_ACTIONS = [
  { icon: "edit_note", label: "继续写作", message: "继续写下一章" },
  { icon: "rate_review", label: "送审校", message: "审校最新章节" },
  { icon: "monitoring", label: "查看进度", message: "给我项目进度报告" },
  { icon: "download", label: "导出", message: null },
  { icon: "pause", label: "暂停", message: "暂停当前工作" },
];

export function QuickActions({ projectId: _projectId, onSendMessage }: QuickActionsProps) {
  const handleClick = (action: typeof QUICK_ACTIONS[0]) => {
    if (action.message) {
      onSendMessage(action.message);
    } else if (action.icon === "download") {
      // Placeholder: currently calls onSendMessage or just log until dialog is hooked
      onSendMessage("请求导出项目");
    }
  };

  return (
    <div className="flex gap-2 px-4 py-2 border-t bg-background shrink-0 overflow-x-auto w-full hide-scrollbar">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          onClick={() => handleClick(action)}
          className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg hover:bg-secondary transition text-xs text-muted-foreground hover:text-foreground shrink-0"
        >
          <Icon name={action.icon} size={20} filled />
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
