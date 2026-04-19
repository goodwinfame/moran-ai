"use client";

import { useState } from "react";
import { usePanelStore } from "@/stores/panel-store";
import { SearchInput } from "../shared/SearchInput";
import { TabEmptyState } from "../shared/TabEmptyState";
import { cn } from "@/lib/utils";
import type { KnowledgeEntry, KnowledgeScope } from "@/stores/panel-store-types";

const CATEGORY_FILTERS = [
  { value: null, label: "全部" },
  { value: "writing_technique", label: "写作技巧" },
  { value: "genre_knowledge", label: "题材知识" },
  { value: "style_special", label: "风格专项" },
  { value: "lesson", label: "经验教训" },
  { value: "analysis_deposit", label: "析典沉淀" },
] as const;

export interface TabProps {
  projectId: string;
}

export default function KnowledgeTab(_props: TabProps) {
  const data = usePanelStore((s) => s.knowledge);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<KnowledgeScope>("project");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(20);

  if (!data || data.entries.length === 0) {
    return <TabEmptyState text="知识库为空。写作过程中积累的经验教训将出现在这里..." icon="📚" />;
  }

  const filtered = data.entries.filter((e) => {
    const matchScope = e.scope === scope || scope === "global";
    const matchCategory =
      selectedCategories.length === 0 || selectedCategories.includes(e.category);
    const matchSearch =
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.summary.toLowerCase().includes(search.toLowerCase());
    return matchScope && matchCategory && matchSearch;
  });

  const displayed = filtered.slice(0, displayCount);
  const hasMore = displayCount < filtered.length;

  const handleCategoryToggle = (cat: string | null) => {
    if (cat === null) {
      setSelectedCategories([]);
      return;
    }
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header: search + filters */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 py-3 border-b space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="搜索知识条目..." />

        <div className="flex items-center justify-between">
          {/* Scope toggle */}
          <div className="flex rounded-lg border overflow-hidden text-xs">
            <button
              onClick={() => setScope("project")}
              className={cn(
                "px-3 py-1.5 transition-colors",
                scope === "project"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-background text-muted-foreground hover:bg-secondary"
              )}
            >
              当前项目
            </button>
            <button
              onClick={() => setScope("global")}
              className={cn(
                "px-3 py-1.5 transition-colors",
                scope === "global"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-background text-muted-foreground hover:bg-secondary"
              )}
            >
              全局
            </button>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => handleCategoryToggle(opt.value)}
              className={cn(
                "px-3 py-1 text-xs rounded-full border transition-all duration-200",
                (opt.value === null && selectedCategories.length === 0) ||
                  (opt.value !== null && selectedCategories.includes(opt.value))
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-secondary"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {displayed.length === 0 ? (
          <div className="text-center text-muted-foreground p-8">
            没有匹配的知识条目
          </div>
        ) : (
          displayed.map((entry) => (
            <KnowledgeCard
              key={entry.id}
              entry={entry}
              isExpanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            />
          ))
        )}

        {hasMore && (
          <button
            onClick={() => setDisplayCount((c) => c + 20)}
            className="w-full py-3 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            加载更多 ▼ ({filtered.length - displayCount} 条剩余)
          </button>
        )}
      </div>
    </div>
  );
}

function KnowledgeCard({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: KnowledgeEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const categoryLabel =
    CATEGORY_FILTERS.find((c) => c.value === entry.category)?.label ?? entry.category;

  return (
    <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate">{entry.title}</h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.summary}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] px-2 py-0.5 bg-secondary rounded-md font-medium">
              {categoryLabel}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {entry.scope === "project" ? "项目" : "全局"}
            </span>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t p-4 bg-secondary/10 space-y-3">
          {entry.content && (
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {entry.content}
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 border-t border-border/50">
            <span><span className="font-medium">来源：</span>{entry.source}</span>
            {entry.maintainer && <span><span className="font-medium">维护者：</span>{entry.maintainer}</span>}
            {entry.updatedAt && <span><span className="font-medium">更新于：</span>{entry.updatedAt}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
