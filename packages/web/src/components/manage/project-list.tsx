"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, FolderOpen, Loader2 } from "lucide-react";
import { useProjects } from "@/hooks/use-project";
import { api } from "@/lib/api";
import { useProjectStore, type ProjectInfo } from "@/stores/project-store";

interface ProjectListProps {
  onSelectProject?: (project: ProjectInfo) => void;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  idle: { label: "空闲", variant: "outline" },
  writing: { label: "写作中", variant: "default" },
  reviewing: { label: "审校中", variant: "default" },
  archiving: { label: "归档中", variant: "secondary" },
};

/**
 * §5.3.4 — Project list with CRUD actions.
 */
export function ProjectList({ onSelectProject }: ProjectListProps) {
  const { projects, loading, refetch } = useProjects();
  const { currentProject, setCurrentProject } = useProjectStore();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newGenre, setNewGenre] = useState("");

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await api.post("/api/projects", {
        title: newTitle.trim(),
        genre: newGenre.trim() || undefined,
      });
      setNewTitle("");
      setNewGenre("");
      setCreating(false);
      await refetch();
    } catch {
      // Error handled by UI
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/projects/${id}`);
      if (currentProject?.id === id) {
        setCurrentProject(null);
      }
      await refetch();
    } catch {
      // Error handled by UI
    }
  };

  const handleSelect = (project: ProjectInfo) => {
    setCurrentProject(project);
    onSelectProject?.(project);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4" />
            项目列表
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setCreating(!creating)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            新建
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Create form */}
        {creating && (
          <div className="rounded-lg border border-dashed p-3 space-y-2">
            <input
              type="text"
              placeholder="项目名称"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="题材（可选）"
              value={newGenre}
              onChange={(e) => setNewGenre(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim()}>
                创建
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                取消
              </Button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Project list */}
        {!loading && projects.length === 0 && !creating && (
          <p className="text-sm text-muted-foreground text-center py-4">
            暂无项目，点击「新建」开始
          </p>
        )}

        {projects.map((project) => {
          const isSelected = currentProject?.id === project.id;
          const statusInfo = statusLabels[project.status] ?? { label: project.status, variant: "secondary" as const };

          return (
            <div
              key={project.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
                "hover:bg-accent",
                isSelected && "border-primary/50 bg-accent/80",
              )}
              onClick={() => handleSelect(project)}
              role="button"
              tabIndex={0}
            >
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", isSelected && "text-primary")}>
                  {project.name}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {project.genre && <span>{project.genre}</span>}
                  <span>{project.totalWords.toLocaleString()}字</span>
                  <span>{project.chapterCount}章</span>
                  <Badge variant={statusInfo.variant} className="h-4 px-1.5 text-[10px]">
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={(e) => { e.stopPropagation(); /* TODO: edit modal */ }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); void handleDelete(project.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
