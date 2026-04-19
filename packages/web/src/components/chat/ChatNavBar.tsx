"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { InlineEditor } from "@/components/shared/InlineEditor";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatNavBarProps {
  projectId: string;
}

export function ChatNavBar({ projectId }: ChatNavBarProps) {
  const router = useRouter();
  const [project, setProject] = useState<{
    name: string;
    status: string;
    currentChapter: number;
    chapterCount: number;
    wordCount: number;
  } | null>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        const res = await api.get<{ ok: true; data: any }>(`/api/projects/${projectId}`);
        setProject(res.data);
      } catch (err) {
        console.error("Failed to load project", err);
      }
    }
    loadProject();
  }, [projectId]);

  const handleNameSave = async (newName: string) => {
    if (!newName.trim() || newName === project?.name) return;
    try {
      await api.put(`/api/projects/${projectId}`, { name: newName });
      setProject((prev) => (prev ? { ...prev, name: newName } : null));
    } catch (err) {
      console.error("Failed to update project name", err);
    }
  };

  const getStageLabel = (status?: string) => {
    switch (status) {
      case "brainstorm":
      case "world":
      case "character":
      case "outline":
        return "筹备中";
      case "writing":
        return "写作中";
      case "completed":
        return "已完结";
      default:
        return "筹备中";
    }
  };

  return (
    <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-background">
      <div className="flex items-center space-x-4 flex-1 overflow-hidden">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="shrink-0 text-muted-foreground">
          <Icon name="arrow_back" size={20} />
        </Button>

        <div className="flex items-center space-x-2 min-w-0 max-w-[200px]">
          <span className="text-xl">📖</span>
          {project && (
            <InlineEditor
              value={project.name}
              onSave={handleNameSave}
              onCancel={() => {}}
              className="text-base font-semibold truncate"
            />
          )}
        </div>

        {project && (
          <div className="flex items-center space-x-3 text-sm text-muted-foreground shrink-0">
            <Badge variant="secondary" className="font-normal text-xs">{getStageLabel(project.status)}</Badge>
            <span className="text-border">|</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="cursor-default">
                  {project.currentChapter}/{project.chapterCount} 章节
                </TooltipTrigger>
                <TooltipContent>项目进度</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-border">|</span>
            <span className="tabular-nums">{project.wordCount.toLocaleString()} 字</span>
            <span className="text-border">|</span>
            <span className="text-muted-foreground/60">0 Token</span>
          </div>
        )}
      </div>

      <div className="flex items-center shrink-0">
        <Button variant="ghost" size="icon" onClick={() => {}} className="text-muted-foreground">
          <Icon name="settings" size={20} />
        </Button>
      </div>
    </div>
  );
}
