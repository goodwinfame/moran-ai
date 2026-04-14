"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useExport, type ExportRange } from "@/hooks/use-export";
import {
  Download,
  FileText,
  BookOpen,
  FileCode,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface ExportPanelProps {
  projectId: string;
  totalChapters?: number;
}

const FORMAT_ICONS: Record<string, typeof FileText> = {
  epub: BookOpen,
  txt: FileText,
  markdown: FileCode,
};

/**
 * \u5BFC\u51FA\u9762\u677F \u2014 \u9009\u62E9\u683C\u5F0F\u548C\u8303\u56F4\uFF0C\u89E6\u53D1\u6587\u4EF6\u4E0B\u8F7D
 */
export function ExportPanel({ projectId, totalChapters }: ExportPanelProps) {
  const { formats, status, error, download, reset } = useExport(projectId);
  const [selectedFormat, setSelectedFormat] = useState("epub");
  const [rangeEnabled, setRangeEnabled] = useState(false);
  const [startChapter, setStartChapter] = useState(1);
  const [endChapter, setEndChapter] = useState(totalChapters ?? 100);

  const handleExport = () => {
    const range: ExportRange | undefined = rangeEnabled
      ? { start: startChapter, end: endChapter }
      : undefined;
    void download(selectedFormat, range);
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Download className="h-5 w-5" />
        <h3 className="text-lg font-semibold">{"\u5BFC\u51FA\u5C0F\u8BF4"}</h3>
      </div>

      <Separator />

      {/* \u683C\u5F0F\u9009\u62E9 */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{"\u5BFC\u51FA\u683C\u5F0F"}</p>
        <div className="flex flex-wrap gap-2">
          {formats.map((fmt) => {
            const Icon = FORMAT_ICONS[fmt.id] ?? FileText;
            const isSelected = selectedFormat === fmt.id;
            return (
              <Button
                key={fmt.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFormat(fmt.id)}
                data-testid={`format-${fmt.id}`}
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {fmt.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* \u8303\u56F4\u9009\u62E9 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rangeEnabled}
              onChange={(e) => setRangeEnabled(e.target.checked)}
              data-testid="range-toggle"
            />
            {"\u6307\u5B9A\u7AE0\u8282\u8303\u56F4"}
          </label>
        </div>

        {rangeEnabled && (
          <div className="flex items-center gap-2 text-sm">
            <label>
              {"\u7B2C "}
              <input
                type="number"
                className="w-16 rounded border px-2 py-1"
                min={1}
                value={startChapter}
                onChange={(e) => setStartChapter(parseInt(e.target.value, 10) || 1)}
                data-testid="start-chapter"
              />
              {" \u7AE0"}
            </label>
            <span>{"\u81F3"}</span>
            <label>
              {"\u7B2C "}
              <input
                type="number"
                className="w-16 rounded border px-2 py-1"
                min={1}
                value={endChapter}
                onChange={(e) => setEndChapter(parseInt(e.target.value, 10) || 1)}
                data-testid="end-chapter"
              />
              {" \u7AE0"}
            </label>
          </div>
        )}
      </div>

      <Separator />

      {/* \u5BFC\u51FA\u6309\u94AE + \u72B6\u6001 */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleExport}
          disabled={status === "loading"}
          data-testid="export-button"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              {"\u5BFC\u51FA\u4E2D..."}
            </>
          ) : (
            <>
              <Download className="mr-1.5 h-4 w-4" />
              {"\u5BFC\u51FA"}
            </>
          )}
        </Button>

        {status === "success" && (
          <Badge
            variant="secondary"
            className="text-green-700"
            data-testid="export-success"
          >
            <CheckCircle className="mr-1 h-3.5 w-3.5" />
            {"\u5BFC\u51FA\u6210\u529F"}
          </Badge>
        )}

        {status === "error" && error && (
          <div className="flex items-center gap-2">
            <Badge variant="destructive" data-testid="export-error">
              <AlertCircle className="mr-1 h-3.5 w-3.5" />
              {error}
            </Badge>
            <Button size="sm" variant="ghost" onClick={reset}>
              {"\u91CD\u8BD5"}
            </Button>
          </div>
        )}
      </div>

      {/* \u683C\u5F0F\u8BF4\u660E */}
      <div className="text-xs text-muted-foreground">
        {selectedFormat === "epub" &&
          "EPUB \u683C\u5F0F\u9002\u7528\u4E8E\u5927\u591A\u6570\u7535\u5B50\u4E66\u9605\u8BFB\u5668\uFF08Kindle\u3001Apple Books\u3001\u5FAE\u4FE1\u8BFB\u4E66\u7B49\uFF09"}
        {selectedFormat === "txt" &&
          "TXT \u7EAF\u6587\u672C\u683C\u5F0F\uFF0C\u517C\u5BB9\u6027\u6700\u5F3A\uFF0C\u65E0\u683C\u5F0F"}
        {selectedFormat === "markdown" &&
          "Markdown \u683C\u5F0F\uFF0C\u5305\u542B\u76EE\u5F55\u3001\u7AE0\u8282\u6807\u9898\u3001\u5B57\u6570\u7EDF\u8BA1"}
      </div>
    </div>
  );
}
