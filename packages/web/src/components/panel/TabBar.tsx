/**
 * TabBar — horizontal tab strip for the info panel.
 * Shows only visible tabs in fixed order, with badge indicators.
 */
"use client";

import { cn } from "@/lib/utils";
import { BadgeIndicator } from "@/components/panel/shared/BadgeIndicator";
import { usePanelStore } from "@/stores/panel-store";
import type { TabId, BadgeType } from "@/stores/panel-store";

// ── Tab label mapping ──────────────────────────────────────────────────────────

const TAB_LABELS: Record<TabId, string> = {
  brainstorm: "脑暴",
  world: "设定",
  character: "角色",
  outline: "大纲",
  chapter: "章节",
  review: "审校",
  analysis: "分析",
  knowledge: "知识库",
};

// ── TabBar ─────────────────────────────────────────────────────────────────────

interface TabBarProps {
  className?: string;
}

export function TabBar({ className }: TabBarProps) {
  const activeTab = usePanelStore((s) => s.activeTab);
  const visibleTabs = usePanelStore((s) => s.visibleTabs);
  const badges = usePanelStore((s) => s.badges);
  const setActiveTab = usePanelStore((s) => s.setActiveTab);
  const clearBadge = usePanelStore((s) => s.clearBadge);
  const setLastUserAction = usePanelStore((s) => s.setLastUserAction);

  function handleTabClick(tab: TabId) {
    setActiveTab(tab);
    clearBadge(tab);
    setLastUserAction(Date.now());
  }

  if (visibleTabs.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="信息面板标签"
      className={cn(
        "flex items-end gap-0 border-b bg-background overflow-x-auto scrollbar-none",
        className,
      )}
    >
      {visibleTabs.map((tab) => {
        const isActive = tab === activeTab;
        const badge: BadgeType | undefined = badges[tab];

        return (
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            data-testid={`tab-${tab}`}
            onClick={() => handleTabClick(tab)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium",
              "whitespace-nowrap transition-colors shrink-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "text-foreground border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {TAB_LABELS[tab]}
            {badge !== undefined && (
              <BadgeIndicator badge={badge} />
            )}
          </button>
        );
      })}
    </div>
  );
}
