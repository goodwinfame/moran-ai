"use client";

import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, ShieldCheck, RotateCcw } from "lucide-react";
import { IssueList, type ReviewIssueData } from "./issue-list";

export interface ReviewRoundData {
  round: number;
  passed: boolean;
  score: number;
  issues: ReviewIssueData[];
  timestamp: string;
}

interface ReviewReportProps {
  chapterNumber: number;
  chapterTitle: string | null;
  rounds: ReviewRoundData[];
  status: string;
  latestScore: number | null;
  /** Currently selected round index (default: latest) */
  selectedRound?: number;
  onRoundSelect?: (round: number) => void;
  onVerdictChange?: (issueId: string, verdict: ReviewIssueData["verdict"]) => void;
  onIssueClick?: (issueId: string) => void;
  onTriggerReview?: () => void;
  onForcePass?: () => void;
}

/**
 * §5.3.3 — Full review report sidebar.
 * Shows score, status, round tabs, issue list, and actions.
 */
export function ReviewReport({
  chapterNumber,
  chapterTitle,
  rounds,
  status,
  latestScore,
  selectedRound,
  onRoundSelect,
  onVerdictChange,
  onIssueClick,
  onTriggerReview,
  onForcePass,
}: ReviewReportProps) {
  const currentRoundIndex = selectedRound ?? rounds.length - 1;
  const currentRound = rounds[currentRoundIndex];

  return (
    <div className="space-y-4 p-4">
      {/* Header: chapter + status */}
      <div>
        <h3 className="text-base font-semibold">
          第{chapterNumber}章
          {chapterTitle && <span className="ml-1 text-muted-foreground font-normal text-sm">{chapterTitle}</span>}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          {status === "passed" || status === "force-passed" ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className={cn(
            "text-sm font-medium",
            status === "passed" || status === "force-passed" ? "text-green-700" : "text-red-600",
          )}>
            {status === "passed" ? "审校通过" :
             status === "force-passed" ? "强制通过" :
             status === "failed" ? "审校未通过" :
             status === "reviewing" ? "审校中..." :
             "待审校"}
          </span>
          {latestScore !== null && (
            <Badge variant="outline" className={cn(
              "ml-auto text-xs font-bold",
              latestScore >= 80 ? "text-green-600 border-green-300" :
              latestScore >= 60 ? "text-amber-600 border-amber-300" :
              "text-red-600 border-red-300",
            )}>
              {latestScore}分
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Round tabs */}
      {rounds.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">审校轮次</p>
          <div className="flex gap-1">
            {rounds.map((r, i) => (
              <Button
                key={r.round}
                size="sm"
                variant={i === currentRoundIndex ? "default" : "outline"}
                className="h-7 px-2.5 text-xs"
                onClick={() => onRoundSelect?.(i)}
              >
                第{r.round}轮
                {r.passed ? (
                  <CheckCircle className="ml-1 h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="ml-1 h-3 w-3 text-red-400" />
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Current round details */}
      {currentRound ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">
              第{currentRound.round}轮 — {currentRound.score}分
            </p>
            <span className="text-[10px] text-muted-foreground">
              {new Date(currentRound.timestamp).toLocaleString("zh-CN")}
            </span>
          </div>
          <IssueList
            issues={currentRound.issues}
            onVerdictChange={onVerdictChange}
            onIssueClick={onIssueClick}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">暂无审校轮次数据</p>
      )}

      <Separator />

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onTriggerReview} className="flex-1">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          重新审校
        </Button>
        {status !== "passed" && status !== "force-passed" && (
          <Button size="sm" variant="ghost" onClick={onForcePass} className="flex-1 text-amber-600 hover:text-amber-700">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            强制通过
          </Button>
        )}
      </div>
    </div>
  );
}
