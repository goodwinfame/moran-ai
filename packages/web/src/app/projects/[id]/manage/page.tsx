"use client";

import { useParams } from "next/navigation";
import { useProjectStats, useForeshadow } from "@/hooks/use-project-stats";
import { ProgressDashboard } from "@/components/manage/progress-dashboard";
import { CostDashboard } from "@/components/manage/cost-dashboard";
import { UNMHealthCard } from "@/components/manage/unm-health-card";
import { ExportPanel } from "@/components/manage/export-panel";
import { ForeshadowBoard } from "@/components/manage/foreshadow-board";
import { Icon } from "@/components/ui/icon";

/**
 * §5.3.6 — 项目管理仪表板
 *
 * Layout: header, top grid (progress + cost + UNM), bottom row (foreshadow + export).
 * Data: useProjectStats → combined stats, useForeshadow → foreshadow items.
 */
export default function ManagePage() {
  const params = useParams();
  const projectId = params.id as string;

  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useProjectStats(projectId);
  const { items: foreshadowItems, loading: foreshadowLoading, refetch: refetchForeshadow } = useForeshadow(projectId);

  const handleRefresh = () => {
    void refetchStats();
    void refetchForeshadow();
  };

  return (
    <div className="h-full overflow-y-auto bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Icon name="dashboard" size={24} className="text-primary" />
              项目管理
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              写作进度、成本、记忆健康状况一目了然
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Icon name="refresh" size={16} />
            刷新
          </button>
        </div>

        {/* Error banner */}
        {statsError && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {statsError}
          </div>
        )}

        {/* Loading skeleton */}
        {statsLoading && !stats && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-card border border-border" />
            ))}
          </div>
        )}

        {/* Top row: 3 stat cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <ProgressDashboard progress={stats.progress} />
            <CostDashboard cost={stats.cost} />
            <UNMHealthCard health={stats.unm} />
          </div>
        )}

        {/* Bottom row: foreshadow + export */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ForeshadowBoard items={foreshadowItems} loading={foreshadowLoading} />
          <ExportPanel
            projectId={projectId}
            totalChapters={stats?.progress.totalChapters}
          />
        </div>
      </div>
    </div>
  );
}
