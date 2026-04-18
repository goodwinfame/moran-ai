"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { EventTimeline } from "@/components/visualize/event-timeline";
import { LocationTree } from "@/components/visualize/location-tree";
import { RelationshipGraph } from "@/components/visualize/relationship-graph";
import { Icon } from "@/components/ui/icon";

const TABS = [
  { key: "timeline", label: "事件时间线", icon: "timeline" },
  { key: "locations", label: "地点层级", icon: "pin_drop" },
  { key: "relationships", label: "人物关系", icon: "hub" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * §5.3.8 — 可视化页面
 *
 * 3 Tab 切换：事件时间线 / 地点层级 / 人物关系
 * 每个组件自包含，只需传 projectId。
 */
export default function VisualizePage() {
  const params = useParams();
  const projectId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabKey>("timeline");

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors
                ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "timeline" && <EventTimeline projectId={projectId} />}
        {activeTab === "locations" && <LocationTree projectId={projectId} />}
        {activeTab === "relationships" && <RelationshipGraph projectId={projectId} />}
      </div>
    </div>
  );
}
