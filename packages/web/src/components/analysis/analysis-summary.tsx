"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, BookOpen, Cpu } from "lucide-react";
import type { WorkMetadata } from "@/hooks/use-analysis";

interface AnalysisSummaryProps {
  work: WorkMetadata;
  overallSummary: string;
  totalUsage: { inputTokens: number; outputTokens: number };
  createdAt: string;
  onExport: () => void;
}

/**
 * §5.3.5 — Analysis overview card showing work metadata, summary, and export.
 */
export function AnalysisSummary({ work, overallSummary, totalUsage, createdAt, onExport }: AnalysisSummaryProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              《{work.title}》
            </CardTitle>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{work.author}</span>
              {work.platform && (
                <>
                  <span>·</span>
                  <span>{work.platform}</span>
                </>
              )}
              {work.rating !== null && work.rating !== undefined && (
                <>
                  <span>·</span>
                  <span>评分 {work.rating}</span>
                </>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            导出 Markdown
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {work.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {work.wordCount !== null && work.wordCount !== undefined && (
            <Badge variant="outline" className="text-xs">
              {(work.wordCount / 10000).toFixed(0)}万字
            </Badge>
          )}
        </div>

        {/* Synopsis */}
        {work.synopsis && (
          <p className="text-sm text-muted-foreground leading-relaxed">{work.synopsis}</p>
        )}

        {/* Overall summary */}
        <div className="rounded-lg bg-muted/40 p-4">
          <div className="whitespace-pre-line text-sm leading-relaxed">
            {renderSummaryText(overallSummary)}
          </div>
        </div>

        {/* Meta footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>分析时间：{new Date(createdAt).toLocaleString("zh-CN")}</span>
          <div className="flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            <span>
              {(totalUsage.inputTokens / 1000).toFixed(0)}K 输入 / {(totalUsage.outputTokens / 1000).toFixed(0)}K 输出
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Render summary text with simple markdown-like bold/heading support */
function renderSummaryText(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<br key={`br-${key++}`} />);
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h3 key={`h-${key++}`} className="mb-2 text-base font-bold">{trimmed.slice(2)}</h3>,
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h4 key={`h-${key++}`} className="mt-3 mb-1 text-sm font-semibold">{trimmed.slice(3)}</h4>,
      );
    } else if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote key={`bq-${key++}`} className="border-l-2 border-primary/50 pl-3 text-sm italic text-muted-foreground">
          {trimmed.slice(2)}
        </blockquote>,
      );
    } else if (trimmed.match(/^\d+\./)) {
      elements.push(
        <p key={`ol-${key++}`} className="text-sm pl-2">{renderInlineBold(trimmed)}</p>,
      );
    } else {
      elements.push(
        <p key={`p-${key++}`} className="text-sm">{renderInlineBold(trimmed)}</p>,
      );
    }
  }

  return <>{elements}</>;
}

function renderInlineBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={`b-${i}`} className="font-semibold">{part}</strong>
    ) : (
      <span key={`t-${i}`}>{part}</span>
    ),
  );
}
