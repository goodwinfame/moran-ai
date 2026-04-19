/**
 * EmptyState — shown when no tabs are visible yet (panel not yet populated).
 */
"use client";

import { Icon } from "@/components/ui/icon";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
      <Icon name="auto_stories" size={48} className="text-muted-foreground/30" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">
          开始创作后，信息将在此显示
        </p>
        <p className="text-xs text-muted-foreground/60">
          与墨衡对话，AI 将自动填充各个面板
        </p>
      </div>
    </div>
  );
}
