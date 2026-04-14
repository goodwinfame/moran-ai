"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTimeline, type TimelineItem, type TimelineGroup } from "@/hooks/use-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, RefreshCw } from "lucide-react";

interface EventTimelineProps {
  projectId: string | null;
}

const significanceLabels: Record<string, string> = {
  major: "重大",
  minor: "次要",
  turning_point: "转折点",
};

export function EventTimeline({ projectId }: EventTimelineProps) {
  const { items, groups, loading, error, refetch } = useTimeline(projectId);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<unknown>(null);

  const renderTimeline = useCallback(
    async (timelineItems: TimelineItem[], timelineGroups: TimelineGroup[]) => {
      if (!containerRef.current || timelineItems.length === 0) return;

      const visTimeline = await import("vis-timeline/standalone");
      const { DataSet } = await import("vis-data/standalone");

      // Destroy previous instance
      if (timelineRef.current) {
        (timelineRef.current as { destroy: () => void }).destroy();
      }

      const groupsDS = new DataSet(
        timelineGroups.map((g) => ({
          id: g.id,
          content: g.content,
          order: g.order,
        })),
      );

      const itemsDS = new DataSet(
        timelineItems.map((item) => ({
          id: item.id,
          content: item.content,
          title: item.title,
          group: item.group,
          start: item.start,
          end: item.end ?? undefined,
          type: item.type,
          className: item.className,
        })),
      );

      const options = {
        stack: true,
        showCurrentTime: false,
        orientation: { axis: "top" as const, item: "bottom" as const },
        margin: { item: { horizontal: 5, vertical: 5 } },
        zoomMin: 1000 * 60 * 60 * 24 * 7,
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 2,
        editable: false,
        tooltip: { followMouse: true, overflowMethod: "cap" as const },
      };

      const timeline = new visTimeline.Timeline(
        containerRef.current,
        itemsDS,
        groupsDS,
        options,
      );

      timelineRef.current = timeline;
    },
    [],
  );

  useEffect(() => {
    if (!loading && items.length > 0) {
      void renderTimeline(items, groups);
    }

    return () => {
      if (timelineRef.current) {
        (timelineRef.current as { destroy: () => void }).destroy();
        timelineRef.current = null;
      }
    };
  }, [items, groups, loading, renderTimeline]);

  // Count significances
  const majorCount = items.filter((i) => i.significance === "major").length;
  const turningCount = items.filter((i) => i.significance === "turning_point").length;

  if (!projectId) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">请先选择项目</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          事件时间线
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{items.length} 事件</Badge>
          {majorCount > 0 && <Badge variant="default">{majorCount} 重大</Badge>}
          {turningCount > 0 && <Badge variant="outline">{turningCount} 转折点</Badge>}
          <button
            onClick={() => void refetch()}
            className="rounded p-1 hover:bg-accent"
            title="刷新"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">暂无事件数据</p>
          </div>
        ) : (
          <>
            <div ref={containerRef} className="h-full w-full" data-testid="timeline-container" />
            <div className="flex gap-3 border-t px-4 py-2">
              {Object.entries(significanceLabels).map(([sig, label]) => {
                const sigColors: Record<string, string> = {
                  major: "#e53e3e",
                  minor: "#718096",
                  turning_point: "#d69e2e",
                };
                return (
                  <div key={sig} className="flex items-center gap-1 text-xs">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: sigColors[sig] ?? "#718096" }}
                    />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
