"use client";

import { Button } from "@/components/ui/button";
import type { WritingStage } from "@/stores/writing-store";
import { Play, BookOpen, Square, RotateCcw } from "lucide-react";

interface WriteControlsProps {
  stage: WritingStage;
  onWriteNext: () => void;
  onContinuous: () => void;
  onStop: () => void;
  onReset: () => void;
}

/**
 * §5.3.2 — Writing control buttons.
 * - idle/done/error → "写下一章" + "连续写作"
 * - writing/reviewing/archiving/context → "中止" only
 */
export function WriteControls({ stage, onWriteNext, onContinuous, onStop, onReset }: WriteControlsProps) {
  const isActive = stage === "writing" || stage === "reviewing" || stage === "archiving" || stage === "context";

  if (isActive) {
    return (
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={onStop}>
          <Square className="mr-1.5 h-3.5 w-3.5" />
          中止
        </Button>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="flex gap-2">
        <Button size="sm" onClick={onWriteNext}>
          <Play className="mr-1.5 h-3.5 w-3.5" />
          写下一章
        </Button>
        <Button size="sm" variant="outline" onClick={onContinuous}>
          <BookOpen className="mr-1.5 h-3.5 w-3.5" />
          连续写作
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          重置
        </Button>
      </div>
    );
  }

  // idle / error
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={onWriteNext}>
        <Play className="mr-1.5 h-3.5 w-3.5" />
        写下一章
      </Button>
      <Button size="sm" variant="outline" onClick={onContinuous}>
        <BookOpen className="mr-1.5 h-3.5 w-3.5" />
        连续写作
      </Button>
      {stage === "error" && (
        <Button size="sm" variant="ghost" onClick={onReset}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          重置
        </Button>
      )}
    </div>
  );
}
