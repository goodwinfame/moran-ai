"use client";

import React, { useState } from "react";
import { usePanelStore } from "@/stores/panel-store";
import { SearchInput } from "@/components/panel/shared/SearchInput";
import { CardGrid } from "@/components/panel/shared/CardGrid";
import { TabEmptyState } from "@/components/panel/shared/TabEmptyState";
import { WorldDetailPage } from "./WorldDetailPage";
import { cn } from "@/lib/utils";

interface TabProps {
  projectId: string;
}

export function WorldTab(_props: TabProps) {
  const data = usePanelStore((s) => s.world);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activeSubsystemId, setActiveSubsystemId] = useState<string | null>(null);

  if (!data) {
    return <TabEmptyState text="世界观设定尚未创建。当脑暴方案确定后..." />;
  }

  if (activeSubsystemId) {
    // Assuming panel store provides full detail when switching, or we fetch. 
    // Here we just pass the ID and assume the page component fetches or reads from store
    return (
      <WorldDetailPage 
        projectId={_props.projectId}
        subsystemId={activeSubsystemId} 
        onBack={() => setActiveSubsystemId(null)}
        onNavigate={(id) => setActiveSubsystemId(id)}
      />
    );
  }

  const filteredSubsystems = data.subsystems.filter((s) => {
    const matchesCategory =
      selectedCategories.length === 0 || selectedCategories.includes(s.category);
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.summary.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCategoryToggle = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2 space-y-3 -mx-4 px-4 -mt-4 mb-2 border-b">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="搜索设定内容..."
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategories([])}
            className={cn(
              "px-3 py-1 text-xs rounded-full border transition-all duration-200",
              selectedCategories.length === 0
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground hover:bg-secondary"
            )}
          >
            全部
          </button>
          {data.categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryToggle(cat)}
              className={cn(
                "px-3 py-1 text-xs rounded-full border transition-all duration-200",
                selectedCategories.includes(cat)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-secondary"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <CardGrid
        items={filteredSubsystems}
        onCardClick={(id) => setActiveSubsystemId(id)}
        renderCard={(item) => (
          <div className="flex flex-col h-full bg-card hover:bg-accent/50 border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer relative group">
            {item.hasNewContent && (
              <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
            )}
            <div className="p-4 flex-1">
              <div className="flex items-start gap-3 mb-2">
                <span className="text-2xl bg-secondary/50 p-2 rounded-lg group-hover:scale-110 transition-transform">
                  {item.icon}
                </span>
                <div>
                  <h3 className="font-bold text-base line-clamp-1">{item.name}</h3>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    {item.category}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                {item.summary}
              </p>
            </div>
            <div className="bg-secondary/30 px-4 py-2.5 text-xs text-muted-foreground flex justify-between items-center border-t border-border/50">
              <span className="font-medium text-primary/80">{item.entryCount} 条目</span>
              {item.lastUpdatedChapter && (
                <span>第 {item.lastUpdatedChapter} 章后</span>
              )}
            </div>
          </div>
        )}
      />
    </div>
  );
}
