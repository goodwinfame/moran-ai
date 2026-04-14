"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkPlus, Check, Sparkles } from "lucide-react";
import { DIMENSION_LABELS, type WritingTechnique } from "@/hooks/use-analysis";

interface TechniqueCardsProps {
  techniques: WritingTechnique[];
  onSettle: (techniqueIds: string[]) => void;
  loading?: boolean;
}

const categoryLabels: Record<WritingTechnique["category"], string> = {
  writing_technique: "写作技法",
  genre_knowledge: "类型知识",
  style_guide: "风格指南",
  reference_analysis: "参考分析",
};

const categoryColors: Record<WritingTechnique["category"], string> = {
  writing_technique: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  genre_knowledge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  style_guide: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  reference_analysis: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

/**
 * §5.3.5 — Writing technique cards with one-click settle.
 */
export function TechniqueCards({ techniques, onSettle, loading }: TechniqueCardsProps) {
  if (techniques.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">暂无提取的写作技法</p>
      </div>
    );
  }

  const unsettled = techniques.filter((t) => !t.settled);
  const settled = techniques.filter((t) => t.settled);

  return (
    <div className="space-y-4">
      {/* Batch settle button */}
      {unsettled.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {unsettled.length} 条技法可沉淀
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSettle(unsettled.map((t) => t.id))}
            disabled={loading}
          >
            <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
            全部沉淀到知识库
          </Button>
        </div>
      )}

      {/* Cards grid */}
      <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
        {techniques.map((tech) => (
          <TechniqueCard
            key={tech.id}
            technique={tech}
            onSettle={() => onSettle([tech.id])}
            loading={loading}
          />
        ))}
      </div>

      {/* Settled count */}
      {settled.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {settled.length} 条技法已沉淀到知识库
        </p>
      )}
    </div>
  );
}

interface TechniqueCardProps {
  technique: WritingTechnique;
  onSettle: () => void;
  loading?: boolean;
}

function TechniqueCard({ technique, onSettle, loading }: TechniqueCardProps) {
  const dimLabel = DIMENSION_LABELS[technique.sourceDimension] ?? technique.sourceDimension;
  const catLabel = categoryLabels[technique.category];
  const catColor = categoryColors[technique.category];

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition-all",
        technique.settled && "opacity-60",
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold leading-tight">{technique.title}</h4>
        {technique.settled ? (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            <Check className="mr-0.5 h-3 w-3" />
            已沉淀
          </Badge>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 h-7 px-2 text-xs"
            onClick={onSettle}
            disabled={loading}
          >
            <BookmarkPlus className="mr-1 h-3 w-3" />
            沉淀
          </Button>
        )}
      </div>

      {/* Description */}
      <p className="mb-3 text-sm text-muted-foreground leading-relaxed">
        {technique.description}
      </p>

      {/* Meta tags */}
      <div className="flex items-center gap-1.5">
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", catColor)}>
          {catLabel}
        </span>
        <span className="text-[10px] text-muted-foreground">
          来自：{dimLabel}
        </span>
      </div>
    </div>
  );
}
