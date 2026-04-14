"use client";

import { Progress } from "@/components/ui/progress";
import type { WritingStage } from "@/stores/writing-store";

interface WriteProgressProps {
  stage: WritingStage;
}

const stageConfig: Record<WritingStage, { label: string; progress: number; color: string }> = {
  idle: { label: "空闲", progress: 0, color: "" },
  context: { label: "构建上下文", progress: 15, color: "text-blue-600" },
  writing: { label: "执笔写作中", progress: 45, color: "text-green-600" },
  reviewing: { label: "明镜审校中", progress: 70, color: "text-amber-600" },
  archiving: { label: "载史归档中", progress: 90, color: "text-purple-600" },
  done: { label: "完成", progress: 100, color: "text-green-700" },
  error: { label: "出错", progress: 0, color: "text-destructive" },
};

/**
 * §5.3.2 — 三段式进度条: 写作→审校→归档
 */
export function WriteProgress({ stage }: WriteProgressProps) {
  const config = stageConfig[stage];

  return (
    <div className="border-t border-border px-4 py-2.5">
      <div className="flex items-center gap-4">
        <span className={`min-w-[5rem] text-xs font-medium ${config.color || "text-muted-foreground"}`}>
          {config.label}
        </span>
        <Progress value={config.progress} className="flex-1" />
        {stage !== "idle" && stage !== "error" && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {config.progress}%
          </span>
        )}
      </div>

      {/* Stage indicator dots */}
      <div className="mt-1.5 flex items-center justify-between px-1">
        <StageDot label="上下文" active={stageIs(stage, ["context", "writing", "reviewing", "archiving", "done"])} />
        <div className="h-px flex-1 bg-border" />
        <StageDot label="写作" active={stageIs(stage, ["writing", "reviewing", "archiving", "done"])} />
        <div className="h-px flex-1 bg-border" />
        <StageDot label="审校" active={stageIs(stage, ["reviewing", "archiving", "done"])} />
        <div className="h-px flex-1 bg-border" />
        <StageDot label="归档" active={stageIs(stage, ["archiving", "done"])} />
      </div>
    </div>
  );
}

function stageIs(current: WritingStage, allowed: WritingStage[]): boolean {
  return allowed.includes(current);
}

function StageDot({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`h-2 w-2 rounded-full ${active ? "bg-primary" : "bg-border"}`} />
      <span className={`text-[10px] ${active ? "text-foreground" : "text-muted-foreground/60"}`}>
        {label}
      </span>
    </div>
  );
}
