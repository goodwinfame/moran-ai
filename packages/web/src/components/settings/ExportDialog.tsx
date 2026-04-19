"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function ExportDialog({ open, onClose, projectId }: ExportDialogProps) {
  const [format, setFormat] = React.useState<"txt" | "md" | "docx" | "epub">("md");
  const [rangeType, setRangeType] = React.useState<"all" | "custom">("all");
  const [includeTitle, setIncludeTitle] = React.useState(true);
  const [includeNotes, setIncludeNotes] = React.useState(false);
  const [startChapter, setStartChapter] = React.useState(1);
  const [endChapter, setEndChapter] = React.useState(10);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const handleExportClick = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      // Only support txt and md for MVP; docx/epub fall back to txt
      const exportFormat = (format === "txt" || format === "md") ? format : "txt";
      const body: Record<string, unknown> = { format: exportFormat, includeTitle };
      if (rangeType === "custom") {
        body.startChapter = startChapter;
        body.endChapter = endChapter;
      }

      const res = await api.post<{ ok: boolean; data: { content: string; filename: string } }>(
        `/api/projects/${projectId}/export`,
        body,
      );

      // Trigger browser download
      const blob = new Blob([res.data.content], {
        type: exportFormat === "md" ? "text/markdown" : "text/plain",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onClose();
    } catch {
      setExportError("导出失败，请重试");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导出项目</DialogTitle>
          <DialogDescription>
            将您的作品导出为常用文档格式。
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Format Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Icon name="description" size={18} /> 导出格式
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "txt", label: "纯文本 (TXT)", icon: "text_snippet" },
                { id: "md", label: "Markdown", icon: "markdown" },
                { id: "docx", label: "Word (DOCX)", icon: "article" },
                { id: "epub", label: "电子书 (EPUB)", icon: "menu_book" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    format === opt.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    className="sr-only"
                    checked={format === opt.id}
                    onChange={() => setFormat(opt.id as "txt" | "md" | "docx" | "epub")}
                  />
                  <Icon name={opt.icon} size={24} className="mb-1" filled={format === opt.id} />
                  <span className="text-xs font-medium">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Range Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Icon name="list_alt" size={18} /> 导出范围
            </h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-secondary/50 transition-colors">
                <input
                  type="radio"
                  name="rangeType"
                  checked={rangeType === "all"}
                  onChange={() => setRangeType("all")}
                  className="accent-primary w-4 h-4"
                />
                全部已完成章节
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-secondary/50 transition-colors">
                <input
                  type="radio"
                  name="rangeType"
                  checked={rangeType === "custom"}
                  onChange={() => setRangeType("custom")}
                  className="accent-primary w-4 h-4"
                />
                自定义范围
              </label>

              {rangeType === "custom" && (
                <div className="flex items-center gap-2 ml-8 mt-2 text-sm">
                  <span>第</span>
                  <input
                    type="number"
                    min="1"
                    value={startChapter}
                    onChange={(e) => setStartChapter(Number(e.target.value))}
                    className="w-16 border rounded px-2 py-1 text-center bg-background"
                  />
                  <span>章</span>
                  <span className="text-muted-foreground px-2">至</span>
                  <span>第</span>
                  <input
                    type="number"
                    min="1"
                    value={endChapter}
                    onChange={(e) => setEndChapter(Number(e.target.value))}
                    className="w-16 border rounded px-2 py-1 text-center bg-background"
                  />
                  <span>章</span>
                </div>
              )}
            </div>
          </div>

          {/* Include Options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Icon name="tune" size={18} /> 导出内容
            </h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-secondary/50 transition-colors">
                <input
                  type="checkbox"
                  checked={includeTitle}
                  onChange={(e) => setIncludeTitle(e.target.checked)}
                  className="accent-primary w-4 h-4 rounded"
                />
                包含章节标题 (如：第 1 章 命运的相遇)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded hover:bg-secondary/50 transition-colors">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="accent-primary w-4 h-4 rounded"
                />
                包含作者注释 (写作随笔与设定备注)
              </label>
            </div>
          </div>
        </div>

        {exportError && (
          <p className="text-sm text-destructive mb-2">{exportError}</p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t mt-4">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            取消
          </Button>
          <Button onClick={handleExportClick} className="gap-2" disabled={isExporting}>
            <Icon name="download" size={18} />
            {isExporting ? "导出中..." : "开始导出"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
