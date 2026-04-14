"use client";

import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, ArrowRight } from "lucide-react";

export interface ReviewHistoryEntry {
  round: number;
  passed: boolean;
  score: number;
  issueCount: number;
  timestamp: string;
}

interface ReviewHistoryProps {
  entries: ReviewHistoryEntry[];
  selectedRound?: number;
  onRoundSelect?: (round: number) => void;
}

/**
 * §5.3.3 — Review history timeline showing Round 1 → 2 → 3 progression.
 */
export function ReviewHistory({ entries, selectedRound, onRoundSelect }: ReviewHistoryProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {entries.map((entry, i) => {
        const isSelected = selectedRound === i;
        const isLast = i === entries.length - 1;

        return (
          <div key={entry.round} className="flex items-center gap-1">
            <button
              onClick={() => onRoundSelect?.(i)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
                "hover:bg-accent",
                isSelected && "bg-accent shadow-sm ring-1 ring-primary/30",
              )}
            >
              {entry.passed ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              )}
              <span className="font-medium">R{entry.round}</span>
              <span className={cn(
                "font-mono text-[10px]",
                entry.score >= 80 ? "text-green-600" :
                entry.score >= 60 ? "text-amber-600" :
                "text-red-600",
              )}>
                {entry.score}
              </span>
              {entry.issueCount > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  ({entry.issueCount})
                </span>
              )}
            </button>
            {!isLast && (
              <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
