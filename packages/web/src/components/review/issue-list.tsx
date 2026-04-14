"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Info, Lightbulb, CheckCircle, XCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ReviewIssueData {
  id: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "SUGGESTION";
  category: string;
  message: string;
  evidence?: string;
  suggestion?: string;
  verdict: "accept" | "ignore" | "manual-edit" | "pending";
}

interface IssueListProps {
  issues: ReviewIssueData[];
  onVerdictChange?: (issueId: string, verdict: ReviewIssueData["verdict"]) => void;
  onIssueClick?: (issueId: string) => void;
}

const severityConfig: Record<string, {
  icon: typeof AlertTriangle;
  color: string;
  bgColor: string;
  label: string;
}> = {
  CRITICAL: { icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-50 border-red-200", label: "严重" },
  MAJOR: { icon: AlertTriangle, color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200", label: "重要" },
  MINOR: { icon: Info, color: "text-yellow-600", bgColor: "bg-yellow-50 border-yellow-200", label: "轻微" },
  SUGGESTION: { icon: Lightbulb, color: "text-blue-500", bgColor: "bg-blue-50 border-blue-200", label: "建议" },
};

/**
 * §5.3.3 — Issue list with severity-based coloring and verdict actions.
 */
export function IssueList({ issues, onVerdictChange, onIssueClick }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle className="h-8 w-8 text-green-500/50" />
        <p className="mt-2 text-sm text-muted-foreground">无审校问题</p>
      </div>
    );
  }

  // Group by severity
  const grouped = {
    CRITICAL: issues.filter((i) => i.severity === "CRITICAL"),
    MAJOR: issues.filter((i) => i.severity === "MAJOR"),
    MINOR: issues.filter((i) => i.severity === "MINOR"),
    SUGGESTION: issues.filter((i) => i.severity === "SUGGESTION"),
  };

  const order: Array<"CRITICAL" | "MAJOR" | "MINOR" | "SUGGESTION"> = [
    "CRITICAL", "MAJOR", "MINOR", "SUGGESTION",
  ];

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {order.map((sev) => {
          const count = grouped[sev].length;
          if (count === 0) return null;
          const config = severityConfig[sev];
          if (!config) return null;
          return (
            <Badge key={sev} variant="outline" className={cn("gap-1", config.color)}>
              <config.icon className="h-3 w-3" />
              {config.label} {count}
            </Badge>
          );
        })}
      </div>

      {/* Issue cards */}
      <div className="space-y-2">
        {order.flatMap((sev) =>
          grouped[sev].map((issue) => {
            const config = severityConfig[issue.severity];
            if (!config) return null;
            const Icon = config.icon;

            return (
              <div
                key={issue.id}
                className={cn(
                  "rounded-lg border p-3 transition-colors cursor-pointer",
                  config.bgColor,
                  issue.verdict === "accept" && "opacity-60",
                  issue.verdict === "ignore" && "opacity-40",
                )}
                onClick={() => onIssueClick?.(issue.id)}
                role="button"
                tabIndex={0}
              >
                {/* Header */}
                <div className="flex items-start gap-2">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[10px] h-4 px-1", config.color)}>
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{issue.category}</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{issue.message}</p>
                  </div>
                </div>

                {/* Evidence */}
                {issue.evidence && (
                  <div className="mt-2 ml-6 rounded-md bg-background/80 px-3 py-1.5 text-xs font-mono text-muted-foreground">
                    &ldquo;{issue.evidence}&rdquo;
                  </div>
                )}

                {/* Suggestion */}
                {issue.suggestion && (
                  <div className="mt-2 ml-6 text-xs text-muted-foreground">
                    <span className="font-medium">建议：</span>{issue.suggestion}
                  </div>
                )}

                {/* Verdict actions */}
                {onVerdictChange && (
                  <div className="mt-2 ml-6 flex gap-1.5">
                    <Button
                      size="sm"
                      variant={issue.verdict === "accept" ? "default" : "outline"}
                      className="h-6 px-2 text-[10px]"
                      onClick={(e) => { e.stopPropagation(); onVerdictChange(issue.id, "accept"); }}
                    >
                      <CheckCircle className="mr-1 h-3 w-3" />
                      接受
                    </Button>
                    <Button
                      size="sm"
                      variant={issue.verdict === "ignore" ? "default" : "outline"}
                      className="h-6 px-2 text-[10px]"
                      onClick={(e) => { e.stopPropagation(); onVerdictChange(issue.id, "ignore"); }}
                    >
                      <XCircle className="mr-1 h-3 w-3" />
                      忽略
                    </Button>
                    <Button
                      size="sm"
                      variant={issue.verdict === "manual-edit" ? "default" : "outline"}
                      className="h-6 px-2 text-[10px]"
                      onClick={(e) => { e.stopPropagation(); onVerdictChange(issue.id, "manual-edit"); }}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      手动修改
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
