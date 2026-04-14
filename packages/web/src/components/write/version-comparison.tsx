"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { GitCompareArrows, Check, X, Thermometer, FileText, Star } from "lucide-react";

// ── 类型 ──────────────────────────────────────────────

/** 版本摘要（不含正文） */
interface VersionSummary {
  versionIndex: number;
  wordCount: number;
  temperature: number;
  score: number;
  passed: boolean;
  isSelected: boolean;
}

/** 版本详情（含正文） */
interface VersionDetail extends VersionSummary {
  content: string;
}

/** 版本集数据 */
interface VersionSetData {
  chapterNumber: number;
  hasPassingVersion: boolean;
  totalVersions: number;
  passingVersions: number;
  selectedVersion: number;
  versions: VersionSummary[];
}

interface VersionComparisonProps {
  /** 版本数据 — null 表示无多版本数据 */
  data: VersionSetData | null;
  /** 加载版本详情的回调 */
  onLoadDetail?: (versionIndex: number) => Promise<VersionDetail>;
  /** 手动选择版本的回调 */
  onSelect?: (versionIndex: number) => Promise<void>;
  /** 是否正在加载 */
  loading?: boolean;
}

// ── 组件 ──────────────────────────────────────────────

/**
 * §5 多版本择优对比面板
 *
 * 展示同一章节的多个写作版本，支持对比查看和手动选择。
 */
export function VersionComparison({
  data,
  onLoadDetail,
  onSelect,
  loading = false,
}: VersionComparisonProps) {
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [loadedDetail, setLoadedDetail] = useState<VersionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectingVersion, setSelectingVersion] = useState<number | null>(null);

  const handleExpand = useCallback(
    async (versionIndex: number) => {
      if (expandedVersion === versionIndex) {
        setExpandedVersion(null);
        setLoadedDetail(null);
        return;
      }

      setExpandedVersion(versionIndex);
      if (onLoadDetail) {
        setDetailLoading(true);
        try {
          const detail = await onLoadDetail(versionIndex);
          setLoadedDetail(detail);
        } catch {
          setLoadedDetail(null);
        } finally {
          setDetailLoading(false);
        }
      }
    },
    [expandedVersion, onLoadDetail],
  );

  const handleSelect = useCallback(
    async (versionIndex: number) => {
      if (!onSelect) return;
      setSelectingVersion(versionIndex);
      try {
        await onSelect(versionIndex);
      } finally {
        setSelectingVersion(null);
      }
    },
    [onSelect],
  );

  // 无数据态
  if (!data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <GitCompareArrows className="mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">{"\u672A\u542F\u7528\u591A\u7248\u672C\u62E9\u4F18"}</p>
          <p className="mt-1 text-xs">{"\u5728\u8BBE\u7F6E\u4E2D\u5F00\u542F\u591A\u7248\u672C\u5199\u4F5C\u540E\uFF0C\u5C06\u5728\u6B64\u5C55\u793A\u7248\u672C\u5BF9\u6BD4"}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="h-4 w-4" />
            {"\u7248\u672C\u5BF9\u6BD4"}
            <Badge variant="outline" className="ml-1">
              {"\u7B2C"}{data.chapterNumber}{"\u7AE0"}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{data.totalVersions} {"\u4E2A\u7248\u672C"}</span>
            <Separator orientation="vertical" className="h-3" />
            <span className={data.passingVersions > 0 ? "text-green-600" : "text-amber-600"}>
              {data.passingVersions} {"\u4E2A\u901A\u8FC7"}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {data.versions.map((version) => (
          <VersionCard
            key={version.versionIndex}
            version={version}
            isExpanded={expandedVersion === version.versionIndex}
            detail={expandedVersion === version.versionIndex ? loadedDetail : null}
            detailLoading={detailLoading && expandedVersion === version.versionIndex}
            selecting={selectingVersion === version.versionIndex}
            onExpand={() => handleExpand(version.versionIndex)}
            onSelect={onSelect ? () => handleSelect(version.versionIndex) : undefined}
            loading={loading}
          />
        ))}

        {!data.hasPassingVersion && (
          <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {"\u26A0\uFE0F \u6240\u6709\u7248\u672C\u5747\u672A\u901A\u8FC7\u5BA1\u6821\uFF0C\u5DF2\u4FDD\u7559\u6700\u9AD8\u5206\u7248\u672C\u4F9B\u4EBA\u5DE5\u9009\u62E9"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 子组件 ──────────────────────────────────────────────

interface VersionCardProps {
  version: VersionSummary;
  isExpanded: boolean;
  detail: VersionDetail | null;
  detailLoading: boolean;
  selecting: boolean;
  onExpand: () => void;
  onSelect?: () => void;
  loading: boolean;
}

function VersionCard({
  version,
  isExpanded,
  detail,
  detailLoading,
  selecting,
  onExpand,
  onSelect,
  loading,
}: VersionCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        version.isSelected && "border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-950/30",
        isExpanded && !version.isSelected && "border-blue-200 dark:border-blue-800",
        !isExpanded && !version.isSelected && "border-border",
      )}
    >
      {/* 版本摘要行 */}
      <button
        type="button"
        onClick={onExpand}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        disabled={loading}
      >
        {/* 版本号 */}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
          V{version.versionIndex}
        </span>

        {/* 分数 */}
        <div className="flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              version.score >= 80 ? "text-green-600" : version.score >= 60 ? "text-amber-600" : "text-red-600",
            )}
          >
            {version.score}
          </span>
        </div>

        {/* 通过/未通过 */}
        {version.passed ? (
          <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900 dark:text-green-300">
            <Check className="mr-0.5 h-3 w-3" />
            {"\u901A\u8FC7"}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900 dark:text-red-300">
            <X className="mr-0.5 h-3 w-3" />
            {"\u672A\u901A\u8FC7"}
          </Badge>
        )}

        {/* 字数 */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span className="tabular-nums">{version.wordCount}</span>
        </div>

        {/* 温度 */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Thermometer className="h-3 w-3" />
          <span className="tabular-nums">{version.temperature.toFixed(3)}</span>
        </div>

        {/* 选中标记 */}
        {version.isSelected && (
          <Badge className="ml-auto bg-green-600 text-xs text-white">
            {"\u5DF2\u9009\u4E2D"}
          </Badge>
        )}
      </button>

      {/* 展开的版本详情 */}
      {isExpanded && (
        <div className="border-t px-4 py-3">
          {detailLoading ? (
            <p className="text-xs text-muted-foreground">{"\u52A0\u8F7D\u4E2D\u2026"}</p>
          ) : detail ? (
            <>
              <ScrollArea className="max-h-60">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed dark:prose-invert">
                  {detail.content}
                </div>
              </ScrollArea>

              {onSelect && !version.isSelected && (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onSelect}
                    disabled={selecting}
                  >
                    {selecting ? "\u9009\u62E9\u4E2D\u2026" : "\u9009\u62E9\u6B64\u7248\u672C"}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{"\u65E0\u6CD5\u52A0\u8F7D\u7248\u672C\u5185\u5BB9"}</p>
          )}
        </div>
      )}
    </div>
  );
}
