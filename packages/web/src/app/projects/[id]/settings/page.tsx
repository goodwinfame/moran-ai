"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { WorldEditor } from "@/components/settings/world-editor";
import { CharacterEditor } from "@/components/settings/character-editor";
import { OutlineEditor } from "@/components/settings/outline-editor";
import { StyleEditor } from "@/components/settings/style-editor";
import { Icon } from "@/components/ui/icon";

const TABS = [
  { key: "world", label: "世界观", icon: "public" },
  { key: "characters", label: "角色", icon: "person" },
  { key: "outline", label: "大纲", icon: "list_alt" },
  { key: "style", label: "文风", icon: "style" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * §5.3.7 — 设定管理页面
 *
 * 4 Tab 切换：世界观 / 角色 / 大纲 / 文风
 * 每个 Editor 是自包含组件，只需传 projectId。
 */
export default function SettingsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabKey>("world");

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
      <div className="flex-1 overflow-y-auto">
        {activeTab === "world" && <WorldEditor projectId={projectId} />}
        {activeTab === "characters" && <CharacterEditor projectId={projectId} />}
        {activeTab === "outline" && <OutlineEditor projectId={projectId} />}
        {activeTab === "style" && <StyleEditor projectId={projectId} />}
      </div>
    </div>
  );
}
