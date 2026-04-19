"use client";

import { useState } from "react";
import { usePanelStore } from "@/stores/panel-store";
import { CollapsibleSection } from "../shared/CollapsibleSection";
import { TabEmptyState } from "../shared/TabEmptyState";
import { cn } from "@/lib/utils";

const CONCLUSION_ICONS = {
  pass: "✅",
  revise: "⚠️",
  rewrite: "❌",
};

const SEVERITY_COLORS = {
  critical: "text-destructive border-destructive/20 bg-destructive/5",
  warning: "text-yellow-600 border-yellow-600/20 bg-yellow-600/5",
};

export function ReviewTab() {
  const data = usePanelStore((s) => s.reviews);
  const [localSelectedChapter, setLocalSelectedChapter] = useState<number | null>(null);

  if (!data || data.chapters.length === 0) {
    return <TabEmptyState text="还没有审校报告。章节写作完成后..." icon="🔄" />;
  }

  const effectiveSelected = localSelectedChapter ?? data.selectedChapter;
  const activeChapter = data.chapters.find((c) => c.chapterNumber === effectiveSelected) || data.chapters[0];
  const latestReview = activeChapter?.reviews[0];

  return (
    <div className="flex flex-col h-full">
      {/* Chapter Selector */}
      <div className="px-4 py-3 border-b flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10">
        <label className="text-sm font-medium">选择章节：</label>
        <select
          value={activeChapter?.chapterNumber || ""}
          onChange={(e) => setLocalSelectedChapter(Number(e.target.value))}
          className="text-sm border rounded-md px-2 py-1 bg-background max-w-[200px] truncate"
        >
          {data.chapters.map((ch) => (
            <option key={ch.chapterNumber} value={ch.chapterNumber}>
              第 {ch.chapterNumber} 章：{ch.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {latestReview ? (
          <>
            {/* Score Summary Card */}
            <div className="border rounded-xl p-5 bg-card shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold">{latestReview.totalScore} 分</h3>
                  <p className="text-sm text-muted-foreground">综合评分</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl mb-1">{CONCLUSION_ICONS[latestReview.conclusion]}</div>
                  <p className="text-sm font-medium capitalize">
                    {latestReview.conclusion === "pass" && "通过"}
                    {latestReview.conclusion === "revise" && "修改后通过"}
                    {latestReview.conclusion === "rewrite" && "需重写"}
                  </p>
                </div>
              </div>

              {/* 4 Rounds Score Bars */}
              <div className="space-y-3">
                {latestReview.rounds.map((round) => (
                  <div key={round.round} className="flex items-center gap-3 text-sm">
                    <span className="w-16 shrink-0 text-muted-foreground">第 {round.round} 轮</span>
                    <span className="w-20 shrink-0 font-medium truncate">{round.dimension}</span>
                    <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          round.score >= 80 ? "bg-green-500" : round.score >= 60 ? "bg-yellow-500" : "bg-destructive"
                        )}
                        style={{ width: `${round.score}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-medium">{round.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rounds Details */}
            <div className="space-y-4">
              {latestReview.rounds.map((round) => (
                <CollapsibleSection
                  key={round.round}
                  title={`第 ${round.round} 轮：${round.dimension}`}
                  badge={`${round.score} 分`}
                  defaultOpen={round.issues.length > 0}
                >
                  {round.issues.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground border rounded-lg bg-card">
                      本轮未发现问题，表现良好。
                    </div>
                  ) : (
                    <div className="space-y-3 pl-2">
                      {round.issues.map((issue, idx) => (
                        <div key={idx} className={cn("p-4 border rounded-lg", SEVERITY_COLORS[issue.severity])}>
                          <div className="flex items-center gap-2 mb-2 font-medium">
                            <span className="text-xs px-2 py-0.5 bg-background/50 rounded text-foreground">
                              {issue.location}
                            </span>
                            {issue.severity === "critical" && <span className="text-xs uppercase bg-destructive/10 px-1 rounded">致命问题</span>}
                          </div>
                          <p className="text-sm mb-2">{issue.description}</p>
                          <div className="text-sm mt-3 pt-2 border-t border-current/10">
                            <span className="font-semibold">修改建议：</span>
                            {issue.suggestion}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleSection>
              ))}
            </div>

            {/* History Link if any */}
            {activeChapter.reviews.length > 1 && (
              <div className="pt-4 border-t text-center">
                <button className="text-sm text-primary hover:underline">
                  查看历史轮次 ({activeChapter.reviews.length - 1})
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground p-8">本章尚未开始审校</div>
        )}
      </div>
    </div>
  );
}
