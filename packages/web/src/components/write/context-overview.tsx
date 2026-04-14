"use client";

import { Separator } from "@/components/ui/separator";
import type { WritingStage, ReviewResult } from "@/stores/writing-store";
import { Brain, Users, FileText, AlertTriangle, CheckCircle } from "lucide-react";

interface ContextOverviewProps {
  stage: WritingStage;
  wordCount: number;
  budget: { total: number; used: number; remaining: number } | null;
  reviewResult: ReviewResult | null;
  error: string | null;
}

/**
 * §5.3.2 — Right sidebar context overview.
 * Shows token budget, characters, word count, review status.
 */
export function ContextOverview({ stage, wordCount, budget, reviewResult, error }: ContextOverviewProps) {
  return (
    <div className="space-y-5 p-4">
      {/* Token budget */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Brain className="h-3.5 w-3.5" />
          Token 预算
        </h3>
        {budget ? (
          <div className="space-y-1.5">
            <BudgetBar used={budget.used} total={budget.total} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>已用 {budget.used.toLocaleString()}</span>
              <span>剩余 {budget.remaining.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">等待写作开始...</p>
        )}
      </div>

      <Separator />

      {/* Word count */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <FileText className="h-3.5 w-3.5" />
          实时字数
        </h3>
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {wordCount.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-muted-foreground">字</span>
        </p>
      </div>

      <Separator />

      {/* Characters placeholder */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Users className="h-3.5 w-3.5" />
          出场角色
        </h3>
        <p className="text-xs text-muted-foreground">
          角色追踪将在归档后显示
        </p>
      </div>

      <Separator />

      {/* Review result */}
      {reviewResult && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            审校结果 (第{reviewResult.round}轮)
          </h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-sm">
              {reviewResult.passed ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <span className={reviewResult.passed ? "text-green-700" : "text-amber-600"}>
                {reviewResult.passed ? "通过" : "需修改"}
              </span>
              {typeof reviewResult.score === "number" && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {reviewResult.score}分
                </span>
              )}
            </div>
            {reviewResult.issues && reviewResult.issues.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {reviewResult.issues.slice(0, 3).map((issue, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className={
                      issue.severity === "CRITICAL" ? "text-red-500" :
                      issue.severity === "MAJOR" ? "text-amber-500" :
                      "text-muted-foreground"
                    }>
                      [{issue.severity}]
                    </span>
                    <span>{issue.message}</span>
                  </li>
                ))}
                {reviewResult.issues.length > 3 && (
                  <li className="text-muted-foreground/60">
                    ... 还有 {reviewResult.issues.length - 3} 条
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && stage === "error" && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-xs font-medium text-destructive">错误</p>
          <p className="mt-1 text-xs text-destructive/80">{error}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Simple budget bar showing token usage percentage.
 */
function BudgetBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color = pct > 90 ? "bg-destructive" : pct > 70 ? "bg-amber-500" : "bg-primary";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
