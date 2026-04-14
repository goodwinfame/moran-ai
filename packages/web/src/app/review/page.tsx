"use client";

import { useState, useCallback } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { ChapterReviewSelector } from "@/components/review/chapter-review-selector";
import { ReviewReport } from "@/components/review/review-report";
import { ReviewHistory, type ReviewHistoryEntry } from "@/components/review/review-history";
import { useProjectStore } from "@/stores/project-store";
import { useReviews, useReviewDetail } from "@/hooks/use-reviews";

export default function ReviewPage() {
  const { currentProject } = useProjectStore();
  const projectId = currentProject?.id ?? null;

  const { reviews, loading: listLoading } = useReviews(projectId);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | undefined>(undefined);

  const {
    review,
    loading: detailLoading,
    triggerReview,
    forcePass,
    updateVerdict,
  } = useReviewDetail(projectId, selectedChapter);

  const handleChapterSelect = useCallback((chapterNumber: number) => {
    setSelectedChapter(chapterNumber);
    setSelectedRound(undefined); // Reset to latest round
  }, []);

  // Build history entries from review rounds
  const historyEntries: ReviewHistoryEntry[] = review
    ? review.rounds.map((r) => ({
        round: r.round,
        passed: r.passed,
        score: r.score,
        issueCount: r.issues.length,
        timestamp: r.timestamp,
      }))
    : [];

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="🔍 审校"
        description={currentProject ? currentProject.name : "查看审校结果、人工批注、确认/驳回修改"}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: chapter list */}
        <nav className="w-56 shrink-0 border-r border-border bg-muted/30 overflow-hidden">
          <ChapterReviewSelector
            reviews={reviews}
            loading={listLoading}
            selectedChapter={selectedChapter}
            onSelect={handleChapterSelect}
          />
        </nav>

        {/* Center: content area with review history */}
        <div className="flex-1 overflow-auto">
          {!selectedChapter ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <p className="text-muted-foreground">选择章节查看审校结果</p>
            </div>
          ) : detailLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">加载审校数据...</p>
            </div>
          ) : review ? (
            <div className="mx-auto max-w-3xl px-8 py-6">
              {/* Review history timeline */}
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">审校历程</p>
                <ReviewHistory
                  entries={historyEntries}
                  selectedRound={selectedRound}
                  onRoundSelect={setSelectedRound}
                />
              </div>

              {/* Current round issues (displayed in center for readability) */}
              {review.rounds.length > 0 && (
                <div className="mt-6">
                  <p className="mb-3 text-sm font-medium">
                    第{review.rounds[selectedRound ?? review.rounds.length - 1]?.round ?? 1}轮审校问题
                  </p>
                  <div className="space-y-3">
                    {(review.rounds[selectedRound ?? review.rounds.length - 1]?.issues ?? []).map((issue) => (
                      <div
                        key={issue.id}
                        className="rounded-lg border bg-card p-4 text-sm"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={
                            issue.severity === "CRITICAL" ? "font-bold text-red-600" :
                            issue.severity === "MAJOR" ? "font-bold text-amber-600" :
                            issue.severity === "MINOR" ? "text-yellow-600" :
                            "text-blue-500"
                          }>
                            [{issue.severity}]
                          </span>
                          <span className="text-xs text-muted-foreground">{issue.category}</span>
                        </div>
                        <p className="text-foreground">{issue.message}</p>
                        {issue.evidence && (
                          <blockquote className="mt-2 border-l-2 border-muted pl-3 text-xs text-muted-foreground italic">
                            {issue.evidence}
                          </blockquote>
                        )}
                        {issue.suggestion && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            <span className="font-medium">建议：</span>{issue.suggestion}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Right sidebar: review report */}
        <aside className="hidden w-80 shrink-0 border-l border-border bg-muted/30 overflow-auto lg:block">
          {review ? (
            <ReviewReport
              chapterNumber={review.chapterNumber}
              chapterTitle={review.chapterTitle}
              rounds={review.rounds}
              status={review.status}
              latestScore={review.latestScore}
              selectedRound={selectedRound}
              onRoundSelect={setSelectedRound}
              onVerdictChange={updateVerdict}
              onTriggerReview={triggerReview}
              onForcePass={forcePass}
            />
          ) : (
            <div className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">审校报告</h3>
              <p className="text-sm text-muted-foreground">暂无审校数据</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
