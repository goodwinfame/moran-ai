"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ChapterDetail } from "@/hooks/use-chapters";
import { FileText, Pen, Calendar, Hash, Layers } from "lucide-react";

interface ChapterInfoProps {
  chapter: ChapterDetail | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Right sidebar: chapter metadata, word count, writer info, timestamps.
 * Future: character states, thread tracking, summary.
 */
export function ChapterInfo({ chapter }: ChapterInfoProps) {
  if (!chapter) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">选中章节查看详情</p>
      </div>
    );
  }

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    draft: { label: "草稿", variant: "secondary" },
    archived: { label: "已归档", variant: "default" },
    reviewing: { label: "审校中", variant: "outline" },
  };

  const status = statusMap[chapter.status] ?? { label: chapter.status, variant: "secondary" as const };

  return (
    <div className="space-y-5 p-4">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">章节信息</h3>
        <div className="space-y-3">
          <InfoRow
            icon={<Hash className="h-3.5 w-3.5" />}
            label="章节"
            value={`第${chapter.chapterNumber}章`}
          />
          <InfoRow
            icon={<FileText className="h-3.5 w-3.5" />}
            label="字数"
            value={`${chapter.wordCount.toLocaleString()} 字`}
          />
          <InfoRow
            icon={<Layers className="h-3.5 w-3.5" />}
            label="版本"
            value={`v${chapter.currentVersion}`}
          />
          <InfoRow
            icon={<Pen className="h-3.5 w-3.5" />}
            label="写手"
            value={chapter.writerStyle ?? "默认"}
          />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">状态</span>
            <Badge variant={status.variant} className="ml-auto">
              {status.label}
            </Badge>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">时间</h3>
        <div className="space-y-3">
          <InfoRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="创建"
            value={formatDate(chapter.createdAt)}
          />
          <InfoRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="更新"
            value={formatDate(chapter.updatedAt)}
          />
        </div>
      </div>

      <Separator />

      {/* Placeholder for future consistency data */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">一致性追踪</h3>
        <p className="text-xs text-muted-foreground">
          角色状态、伏笔、世界观变更将在 M3.4 中接入
        </p>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium text-foreground">{value}</span>
    </div>
  );
}
