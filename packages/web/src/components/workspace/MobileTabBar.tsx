/**
 * MobileTabBar — Tab switcher for viewports < 768px.
 * Shows "聊天" and "面板" tabs fixed at bottom of screen.
 *
 * Phase 5.2: chat-ui module
 */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { InfoPanel } from "@/components/panel/InfoPanel";

type TabKey = "chat" | "panel";

interface MobileTabBarProps {
  projectId: string;
}

export function MobileTabBar({ projectId }: MobileTabBarProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("chat");

  return (
    <div className="flex flex-col h-screen">
      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "chat" ? (
          <div
            data-testid="mobile-chat-content"
            className="h-full flex flex-col"
          >
            {/* ChatPanel placeholder — Phase 5.2 Agent B */}
          </div>
        ) : (
          <div
            data-testid="mobile-panel-content"
            className="h-full"
          >
            <InfoPanel projectId={projectId} />
          </div>
        )}
      </div>

      {/* Tab bar — fixed at bottom */}
      <div
        data-testid="mobile-tab-bar"
        className="flex border-t bg-background"
        role="tablist"
      >
        <button
          role="tab"
          aria-selected={activeTab === "chat"}
          data-testid="tab-chat"
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors",
            activeTab === "chat"
              ? "text-primary border-t-2 border-primary"
              : "text-muted-foreground",
          )}
          onClick={() => setActiveTab("chat")}
        >
          聊天
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "panel"}
          data-testid="tab-panel"
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors",
            activeTab === "panel"
              ? "text-primary border-t-2 border-primary"
              : "text-muted-foreground",
          )}
          onClick={() => setActiveTab("panel")}
        >
          面板
        </button>
      </div>
    </div>
  );
}
