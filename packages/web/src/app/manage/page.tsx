"use client";

import { TopBar } from "@/components/layout/top-bar";
import { ProgressDashboard } from "@/components/manage/progress-dashboard";
import { CostDashboard } from "@/components/manage/cost-dashboard";
import { UNMHealthCard } from "@/components/manage/unm-health-card";
import { ForeshadowBoard } from "@/components/manage/foreshadow-board";
import { ProjectList } from "@/components/manage/project-list";
import { useProjectStore } from "@/stores/project-store";
import { useProjectStats, useForeshadow } from "@/hooks/use-project-stats";

export default function ManagePage() {
  const { currentProject } = useProjectStore();
  const projectId = currentProject?.id ?? null;

  const { stats } = useProjectStats(projectId);
  const { items: foreshadowItems, loading: foreshadowLoading } = useForeshadow(projectId);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="🗂️ 管理"
        description={currentProject ? currentProject.name : "项目全局管理、数据健康监控、成本追踪"}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Project list */}
          <ProjectList />

          {/* Stats grid — only visible when a project is selected */}
          {projectId && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <ProgressDashboard progress={stats?.progress ?? null} />
                <CostDashboard cost={stats?.cost ?? null} />
                <UNMHealthCard health={stats?.unm ?? null} />
              </div>

              {/* Foreshadow board — full width */}
              <ForeshadowBoard items={foreshadowItems} loading={foreshadowLoading} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
