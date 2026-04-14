"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Search, FileText, X } from "lucide-react";

export interface SubmitAnalysisData {
  workTitle: string;
  authorName?: string;
  userNotes?: string;
  providedTexts?: string[];
}

interface AnalysisSubmitFormProps {
  onSubmit: (data: SubmitAnalysisData) => void;
  loading?: boolean;
}

/**
 * §5.3.5 — Analysis submit form.
 * Input work name, optional author, paste text or upload TXT.
 */
export function AnalysisSubmitForm({ onSubmit, loading }: AnalysisSubmitFormProps) {
  const [workTitle, setWorkTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [textSnippets, setTextSnippets] = useState<string[]>([]);
  const [currentSnippet, setCurrentSnippet] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddSnippet = () => {
    const trimmed = currentSnippet.trim();
    if (trimmed) {
      setTextSnippets((prev) => [...prev, trimmed]);
      setCurrentSnippet("");
    }
  };

  const handleRemoveSnippet = (index: number) => {
    setTextSnippets((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string" && text.trim()) {
        setTextSnippets((prev) => [...prev, text.trim()]);
      }
    };
    reader.readAsText(file, "utf-8");

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workTitle.trim()) return;

    onSubmit({
      workTitle: workTitle.trim(),
      authorName: authorName.trim() || undefined,
      userNotes: userNotes.trim() || undefined,
      providedTexts: textSnippets.length > 0 ? textSnippets : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Work title */}
      <div>
        <label htmlFor="work-title" className="mb-1.5 block text-sm font-medium">
          作品名称 <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="work-title"
            type="text"
            value={workTitle}
            onChange={(e) => setWorkTitle(e.target.value)}
            placeholder="例：大奉打更人"
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={loading}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          析典会自动搜索作品信息进行分析
        </p>
      </div>

      {/* Author name */}
      <div>
        <label htmlFor="author-name" className="mb-1.5 block text-sm font-medium">
          作者名（可选）
        </label>
        <input
          id="author-name"
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="例：卖报小郎君"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={loading}
        />
      </div>

      {/* User notes */}
      <div>
        <label htmlFor="user-notes" className="mb-1.5 block text-sm font-medium">
          分析重点（可选）
        </label>
        <textarea
          id="user-notes"
          value={userNotes}
          onChange={(e) => setUserNotes(e.target.value)}
          placeholder="例：重点分析伏笔技巧和章末钩子的写法"
          rows={2}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={loading}
        />
      </div>

      {/* Text snippets */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          文本片段（可选）
        </label>
        <textarea
          value={currentSnippet}
          onChange={(e) => setCurrentSnippet(e.target.value)}
          placeholder="粘贴作品文本片段，辅助分析..."
          rows={3}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={loading}
        />
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSnippet}
            disabled={!currentSnippet.trim() || loading}
          >
            <FileText className="mr-1 h-3.5 w-3.5" />
            添加片段
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            上传 TXT
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Added snippets */}
        {textSnippets.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {textSnippets.map((snippet, i) => (
              <div
                key={`snippet-${i}-${snippet.slice(0, 20)}`}
                className="group flex items-start gap-2 rounded-md bg-muted/50 p-2"
              >
                <span className="flex-1 text-xs text-muted-foreground line-clamp-2">
                  片段 {i + 1}：{snippet.slice(0, 100)}
                  {snippet.length > 100 ? "…" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveSnippet(i)}
                  className="shrink-0 text-muted-foreground/50 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full"
        disabled={!workTitle.trim() || loading}
      >
        {loading ? "分析中…" : "开始九维分析"}
      </Button>
    </form>
  );
}
