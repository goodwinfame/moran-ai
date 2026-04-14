"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, PenTool, Target, TrendingUp } from "lucide-react";
import type { WritingProgress } from "@/hooks/use-project-stats";

interface ProgressDashboardProps {
  progress: WritingProgress | null;
}

/**
 * §5.3.4 — Writing progress dashboard.
 * Shows total words, chapters, arc, daily average, and progress bar.
 */
export function ProgressDashboard({ progress }: ProgressDashboardProps) {
  if (!progress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            写作进度
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    { label: "总字数", value: progress.totalWords.toLocaleString(), icon: PenTool },
    { label: "总章节", value: `${progress.totalChapters}`, icon: BookOpen },
    { label: "当前弧段", value: `第${progress.currentArc}弧`, icon: Target },
    { label: "日均产出", value: `${progress.dailyAverage.toLocaleString()}字`, icon: TrendingUp },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4" />
          写作进度
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{progress.completionPercentage.toFixed(1)}%</span>
            <span>目标 {(progress.targetWordCount / 10000).toFixed(0)}万字</span>
          </div>
          <Progress value={progress.completionPercentage} className="h-2" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-sm font-semibold tabular-nums">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Average */}
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">每章均字</p>
          <p className="text-sm font-medium tabular-nums">
            {progress.averageWordsPerChapter.toLocaleString()}字
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
