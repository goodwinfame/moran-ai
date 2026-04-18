"use client";

import { useParams } from "next/navigation";
import { useState, useCallback } from "react";
import { useReviews, useReviewDetail } from "@/hooks/use-reviews";
import { ChapterReviewSelector } from "@/components/review/chapter-review-selector";
import { ReviewReport } from "@/components/review/review-report";
import { ReviewHistory } from "@/components/review/review-history";
import type { ReviewIssueData } from "@/components/review/issue-list";
import type { ReviewHistoryEntry } from "@/components/review/review-history";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSearch } from "lucide-react";

/**
 * §5.3.3 — 审校页面
 *
 * Two-panel layout: left chapter review selector, main area with review report.
 * Review history timeline shown above report when multiple rounds exist.
 * Supports: round switching, verdict actions (accept/ignore/manual-edit), re-trigger, force-pass.
 */
export default function ReviewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | undefined>(
    undefined,
  );

  const {
    reviews,
    loading: listLoading,
    refetch: refetchList,
  } = useReviews(projectId);
  const {
    review,
    loading: detailLoading,
    triggerReview,
    forcePass,
    updateVerdict,
  } = useReviewDetail(projectId, selectedChapter);

  const handleChapterSelect = useCallback((chapterNumber: number) => {
    setSelectedChapter(chapterNumber);
    setSelectedRound(undefined);
  }, []);

  const handleTriggerReview = useCallback(async () => {
    await triggerReview();
    await refetchList();
  }, [triggerReview, refetchList]);

  const handleForcePass = useCallback(async () => {
    await forcePass();
    await refetchList();
  }, [forcePass, refetchList]);

  const handleVerdictChange = useCallback(
    (issueId: string, verdict: ReviewIssueData["verdict"]) => {
      void updateVerdict(issueId, verdict);
    },
    [updateVerdict],
  );

  // Build history entries from review rounds for the timeline
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
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar: chapter review selector */}
      <div className="w-64 shrink-0 border-r border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">审校章节</h2>
          {reviews.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              共 {reviews.length} 章已审校
            </p>
          )}
        </div>
        <ChapterReviewSelector
          reviews={reviews}
          loading={listLoading}
          selectedChapter={selectedChapter}
          onSelect={handleChapterSelect}
        />
      </div>

      {/* Main area: review report */}
      <div className="flex-1 overflow-hidden">
        {selectedChapter !== null && review ? (
          <ScrollArea className="h-full">
            {/* Review history timeline (visible when 2+ rounds) */}
            {historyEntries.length > 1 && (
              <div className="border-b border-border px-4 py-2">
                <ReviewHistory
                  entries={historyEntries}
                  selectedRound={selectedRound}
                  onRoundSelect={setSelectedRound}
                />
              </div>
            )}
            <ReviewReport
              chapterNumber={review.chapterNumber}
              chapterTitle={review.chapterTitle}
              rounds={review.rounds}
              status={review.status}
              latestScore={review.latestScore}
              selectedRound={selectedRound}
              onRoundSelect={setSelectedRound}
              onVerdictChange={handleVerdictChange}
              onTriggerReview={handleTriggerReview}
              onForcePass={handleForcePass}
            />
          </ScrollArea>
        ) : detailLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <FileSearch className="h-12 w-12 text-muted-foreground/20" />
            <p className="text-muted-foreground">
              选择左侧章节查看审校报告
            </p>
            <p className="text-xs text-muted-foreground/70">
              写作完成后，明镜会自动审校每个章节
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
